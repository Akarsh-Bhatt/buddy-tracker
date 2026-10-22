import { Router } from 'express';
import {
  createCourse,
  getAllCourses,
  getCourseById,
  getCourseLeaderboard,
  deleteCourse
} from '../controllers/courseController.js';
import { protect } from '../middleware/auth.js';
import { validateCreateCourse, validateCourseIdParam } from '../middleware/validate.js';

const router = Router();

// Create a new course (Protected route)
router.post('/', protect, validateCreateCourse, createCourse);

// Get all courses (Public/Accessible to authenticated users)
router.get('/', getAllCourses);

// Get single course details
router.get('/:courseId', validateCourseIdParam, getCourseById);

// Get course leaderboard (Public or can be protected if desired)
router.get('/:courseId/leaderboard', validateCourseIdParam, getCourseLeaderboard);

// Delete course (Protected route)
router.delete('/:courseId', protect, validateCourseIdParam, deleteCourse);

export default router;
