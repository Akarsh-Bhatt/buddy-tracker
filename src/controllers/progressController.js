import mongoose from 'mongoose';
import { Progress } from '../models/Progress.js';
import { Course } from '../models/Course.js';
import { ProgressHistory } from '../models/ProgressHistory.js';
import { calculateStreak } from '../utils/streak.js';
import { ApiError } from '../utils/apiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Sync user progress for a course (Upsert with Concurrency Control & Audit Logging)
 * PATCH /api/progress/sync or POST /api/progress/sync
 * Accepts { courseId, completedLectures, completedLectureIds?, allowRollback?, clientTimestamp?, source? }
 */
export const syncProgress = async (req, res, next) => {
  try {
    const {
      courseId,
      courseName,
      udemyCourseId,
      courseSlug,
      completedLectures,
      totalLectures,
      completedLectureIds,
      allowRollback = false,
      clientTimestamp,
      source: customSource
    } = req.body;
    const userId = req.user._id;

    // Determine audit source: explicit body param, or derived from authType
    const source = customSource || (req.authType === 'apiKey' ? 'extension' : 'web_manual');

    // Parse incoming timestamp (defaults to current server time)
    const incomingTimestamp = clientTimestamp ? new Date(clientTimestamp) : new Date();

    const slug = (courseSlug || udemyCourseId || '').trim();
    let course;

    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      course = await Course.findById(courseId);
    } else if (slug) {
      // Find course by canonical slug/udemyCourseId first
      course = await Course.findOne({
        $or: [
          { udemyCourseId: slug },
          { udemyCourseId: new RegExp(`^${slug}$`, 'i') }
        ]
      });
    }

    if (!course && courseName) {
      const normalized = String(courseName).trim();
      course = await Course.findOne({
        $or: [
          { udemyCourseId: normalized },
          { title: new RegExp(`^${normalized}$`, 'i') },
          { title: new RegExp(normalized, 'i') }
        ]
      });
    }

    // Auto-create or auto-update course if detected from Chrome extension
    if (!course && totalLectures) {
      const cleanSlug = slug || String(courseName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const formattedTitle = courseName
        ? String(courseName).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
        : cleanSlug;

      course = await Course.create({
        title: formattedTitle,
        udemyCourseId: cleanSlug,
        totalLectures: Math.max(1, Number(totalLectures) || 1)
      });
    } else if (course && totalLectures && Number(totalLectures) > course.totalLectures) {
      // If a fuller lecture count was discovered (e.g. 772 instead of section count 8), update it
      course.totalLectures = Number(totalLectures);
      if (courseName && courseName.trim().length > course.title.length) {
        course.title = String(courseName).trim();
      }
      await course.save();
    }

    if (!course) {
      return next(ApiError.notFound(`Course not found for '${courseId || courseName}'`));
    }

    const lectureCount = Number(completedLectures);

    // Business validation: completedLectures cannot exceed totalLectures
    if (lectureCount > course.totalLectures) {
      return next(
        ApiError.badRequest(
          `completedLectures (${lectureCount}) cannot exceed total course lectures (${course.totalLectures})`,
          [
            {
              field: 'completedLectures',
              message: `Maximum allowed completedLectures is ${course.totalLectures}`
            }
          ]
        )
      );
    }

    // 1. Check existing progress record for Concurrency & Monotonicity validation
    const existingProgress = await Progress.findOne({ userId, courseId: course._id });

    if (existingProgress) {
      // Monotonic Progress Guard:
      // Prevent accidental regression: cannot lower completedLectures unless allowRollback: true
      if (lectureCount < existingProgress.completedLectures && !allowRollback) {
        return next(
          ApiError.badRequest(
            `Monotonic progress regression prevented: completedLectures (${lectureCount}) cannot decrease from current progress (${existingProgress.completedLectures}) unless allowRollback: true is specified`,
            [
              {
                field: 'completedLectures',
                message: `Current progress is ${existingProgress.completedLectures}. Set allowRollback: true to permit regression.`
              }
            ]
          )
        );
      }

      // Optimistic Concurrency Guard:
      // Verify that incoming updates cannot overwrite data if their client timestamp is older than current database record
      if (clientTimestamp && existingProgress.lastSyncedAt) {
        const incomingMs = incomingTimestamp.getTime();
        const existingMs = new Date(existingProgress.lastSyncedAt).getTime();
        if (incomingMs < existingMs) {
          return next(
            ApiError.conflict(
              `Optimistic concurrency conflict: client timestamp (${incomingTimestamp.toISOString()}) is older than lastSyncedAt (${new Date(existingMs).toISOString()}) in database`,
              [
                {
                  field: 'clientTimestamp',
                  message: 'Incoming update is stale and cannot overwrite newer database state'
                }
              ]
            )
          );
        }
      }

      // 2. Atomic Update on existing record
      const filter = {
        _id: existingProgress._id
      };
      if (clientTimestamp) {
        filter.lastSyncedAt = { $lte: incomingTimestamp };
      }

      const updateOp = {
        $set: {
          lastSyncedAt: incomingTimestamp,
          lastWatchedAt: incomingTimestamp,
          ...(completedLectureIds !== undefined && { completedLectureIds })
        },
        $push: {
          history: {
            $each: [
              {
                timestamp: incomingTimestamp,
                completedLectures: lectureCount,
                source
              }
            ],
            $slice: -100 // retain latest 100 audit entries
          }
        }
      };

      if (allowRollback) {
        updateOp.$set.completedLectures = lectureCount;
      } else {
        // Use $max to atomically prevent race conditions if multiple tabs sync simultaneously
        updateOp.$max = { completedLectures: lectureCount };
      }

      const progress = await Progress.findOneAndUpdate(filter, updateOp, {
        returnDocument: 'after',
        runValidators: true
      }).populate('courseId', 'title udemyCourseId totalLectures');

      if (!progress) {
        return next(
          ApiError.conflict(
            'Concurrent sync conflict: record was updated concurrently with a newer timestamp',
            [{ field: 'clientTimestamp', message: 'A concurrent sync update took precedence' }]
          )
        );
      }

      // Async write to separate audit collection for global analytics
      await ProgressHistory.create({
        userId,
        courseId: course._id,
        completedLectures: progress.completedLectures,
        timestamp: incomingTimestamp,
        source
      }).catch(() => {});

      const completionPercentage = Math.round((progress.completedLectures / course.totalLectures) * 1000) / 10;
      const dailyStreak = calculateStreak(progress.history);

      return sendSuccess(res, {
        statusCode: 200,
        message: 'Progress synchronized successfully',
        data: {
          progress,
          stats: {
            completedLectures: progress.completedLectures,
            totalLectures: course.totalLectures,
            completionPercentage,
            isCompleted: progress.completedLectures >= course.totalLectures,
            dailyStreak
          }
        }
      });
    }

    // 3. Initial Atomic Insert if document does not exist yet
    const newHistoryEntry = {
      timestamp: incomingTimestamp,
      completedLectures: lectureCount,
      source
    };

    const newDoc = {
      userId,
      courseId: course._id,
      completedLectures: lectureCount,
      lastSyncedAt: incomingTimestamp,
      lastWatchedAt: incomingTimestamp,
      completedLectureIds: completedLectureIds || [],
      history: [newHistoryEntry]
    };

    let progress;
    try {
      progress = await Progress.findOneAndUpdate(
        { userId, courseId: course._id },
        { $setOnInsert: newDoc },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: true
        }
      ).populate('courseId', 'title udemyCourseId totalLectures');
    } catch (err) {
      if (err.code === 11000) {
        // Concurrent initial insert race condition: retry update on the inserted doc
        return syncProgress(req, res, next);
      }
      throw err;
    }

    // Async write to separate audit collection
    await ProgressHistory.create({
      userId,
      courseId: course._id,
      completedLectures: lectureCount,
      timestamp: incomingTimestamp,
      source
    }).catch(() => {});

    const completionPercentage = Math.round((lectureCount / course.totalLectures) * 1000) / 10;
    const dailyStreak = calculateStreak(progress.history);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Progress synchronized successfully',
      data: {
        progress,
        stats: {
          completedLectures: lectureCount,
          totalLectures: course.totalLectures,
          completionPercentage,
          isCompleted: lectureCount >= course.totalLectures,
          dailyStreak
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's progress for a specific course
 * GET /api/progress/:courseId
 */
export const getUserCourseProgress = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const course = await Course.findById(courseId);
    if (!course) {
      return next(ApiError.notFound(`Course not found with id ${courseId}`));
    }

    const progress = await Progress.findOne({ userId, courseId });

    const completedLectures = progress ? progress.completedLectures : 0;
    const completionPercentage = Math.round((completedLectures / course.totalLectures) * 1000) / 10;
    const dailyStreak = calculateStreak(progress ? progress.history : []);

    sendSuccess(res, {
      statusCode: 200,
      message: 'User progress retrieved successfully',
      data: {
        progress: progress || {
          userId,
          courseId,
          completedLectures: 0,
          completedLectureIds: [],
          lastWatchedAt: null,
          lastSyncedAt: null,
          history: []
        },
        stats: {
          completedLectures,
          totalLectures: course.totalLectures,
          completionPercentage,
          isCompleted: completedLectures >= course.totalLectures,
          dailyStreak
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit history logs for a specific course progress
 * GET /api/progress/:courseId/history
 */
export const getCourseProgressHistory = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const progress = await Progress.findOne({ userId, courseId });
    if (!progress) {
      return next(ApiError.notFound(`Progress not found for course id ${courseId}`));
    }

    // Query separate collection first, fallback to embedded history array
    let history = await ProgressHistory.find({ userId, courseId })
      .sort({ timestamp: -1 })
      .limit(100);

    if (!history || history.length === 0) {
      history = (progress.history || []).slice().reverse();
    }

    const dailyStreak = calculateStreak(progress.history);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Progress audit history retrieved successfully',
      data: {
        courseId,
        dailyStreak,
        totalEntries: history.length,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all course progress for current user
 * GET /api/progress
 */
export const getAllUserProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const progressList = await Progress.find({ userId })
      .populate('courseId', 'title udemyCourseId totalLectures')
      .sort({ lastWatchedAt: -1 });

    const detailedList = progressList.map((item) => {
      const totalLectures = item.courseId?.totalLectures || 0;
      const percentage = totalLectures > 0
        ? Math.round((item.completedLectures / totalLectures) * 1000) / 10
        : 0;

      return {
        ...item.toObject(),
        stats: {
          completedLectures: item.completedLectures,
          totalLectures,
          completionPercentage: percentage,
          isCompleted: totalLectures > 0 && item.completedLectures >= totalLectures
        }
      };
    });

    sendSuccess(res, {
      statusCode: 200,
      message: 'All user course progress retrieved successfully',
      data: {
        total: detailedList.length,
        progress: detailedList
      }
    });
  } catch (error) {
    next(error);
  }
};
