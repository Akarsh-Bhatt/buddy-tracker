import mongoose from 'mongoose';
import { Course } from '../models/Course.js';
import { Progress } from '../models/Progress.js';
import { ApiError } from '../utils/apiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Add a new course with total lecture count
 * POST /api/courses
 */
export const createCourse = async (req, res, next) => {
  try {
    const { title, udemyCourseId, totalLectures } = req.body;

    const normalizedUdemyId = String(udemyCourseId).trim();

    // Check if course with this udemyCourseId already exists
    const existingCourse = await Course.findOne({ udemyCourseId: normalizedUdemyId });
    if (existingCourse) {
      return next(
        ApiError.conflict(`Course with Udemy ID '${normalizedUdemyId}' already exists.`, [
          { field: 'udemyCourseId', message: 'udemyCourseId must be unique' }
        ])
      );
    }

    const course = await Course.create({
      title: title.trim(),
      udemyCourseId: normalizedUdemyId,
      totalLectures: Number(totalLectures)
    });

    sendSuccess(res, {
      statusCode: 201,
      message: 'Course created successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available courses
 * GET /api/courses
 */
export const getAllCourses = async (req, res, next) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Courses retrieved successfully',
      data: {
        total: courses.length,
        courses
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single course by ID
 * GET /api/courses/:courseId
 */
export const getCourseById = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return next(ApiError.notFound(`Course not found with id ${courseId}`));
    }

    sendSuccess(res, {
      statusCode: 200,
      message: 'Course retrieved successfully',
      data: { course }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get course leaderboard
 * GET /api/courses/:courseId/leaderboard
 * Returns all enrolled users with completed lectures, total lectures,
 * and calculated completion percentage, sorted by highest completion.
 */
export const getCourseLeaderboard = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return next(ApiError.notFound(`Course not found with id ${courseId}`));
    }

    const rawLeaderboard = await Progress.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId)
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $project: {
          _id: 1,
          user: {
            id: '$userDetails._id',
            name: '$userDetails.name',
            email: '$userDetails.email',
            avatar: '$userDetails.avatar'
          },
          completedLectures: 1,
          totalLectures: { $literal: course.totalLectures },
          completionPercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      '$completedLectures',
                      { $max: [course.totalLectures, 1] }
                    ]
                  },
                  100
                ]
              },
              1
            ]
          },
          lastWatchedAt: 1,
          completedLectureIdsCount: { $size: { $ifNull: ['$completedLectureIds', []] } }
        }
      },
      {
        $sort: {
          completionPercentage: -1,
          completedLectures: -1,
          lastWatchedAt: -1
        }
      }
    ]);

    // Attach ranks
    const leaderboard = rawLeaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));

    sendSuccess(res, {
      statusCode: 200,
      message: 'Leaderboard fetched successfully',
      data: {
        course: {
          id: course._id,
          title: course.title,
          udemyCourseId: course.udemyCourseId,
          totalLectures: course.totalLectures
        },
        enrolledCount: leaderboard.length,
        leaderboard
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a course and its associated progress records
 * DELETE /api/courses/:courseId
 */
export const deleteCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findByIdAndDelete(courseId);

    if (!course) {
      return next(ApiError.notFound(`Course not found with id ${courseId}`));
    }

    // Clean up associated progress records
    await Progress.deleteMany({ courseId });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Course and associated progress records removed successfully',
      data: { courseId }
    });
  } catch (error) {
    next(error);
  }
};
