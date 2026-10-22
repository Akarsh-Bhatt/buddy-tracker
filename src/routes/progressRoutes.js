import { Router } from 'express';
import {
  syncProgress,
  getUserCourseProgress,
  getAllUserProgress,
  getCourseProgressHistory
} from '../controllers/progressController.js';
import { protect } from '../middleware/auth.js';
import { syncAuth } from '../middleware/syncAuth.js';
import { validateProgressSync, validateCourseIdParam } from '../middleware/validate.js';
import { syncRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Upsert user progress for a course (supports both PATCH and POST from Chrome Extension)
// Protected via syncAuth (verifies x-api-key or session cookie) and syncRateLimiter
router.patch('/sync', syncAuth, syncRateLimiter, validateProgressSync, syncProgress);
router.post('/sync', syncAuth, syncRateLimiter, validateProgressSync, syncProgress);

// Verify extension key or session health
router.get('/sync/verify', syncAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication verified',
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email
      },
      keyName: req.apiKey?.name || 'Session'
    }
  });
});

// User progress inspection endpoints (Protected via web session auth)
router.get('/', protect, getAllUserProgress);
router.get('/:courseId/history', protect, validateCourseIdParam, getCourseProgressHistory);
router.get('/:courseId', protect, validateCourseIdParam, getUserCourseProgress);

export default router;
