import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  createApiKey,
  listApiKeys,
  revokeApiKey
} from '../controllers/authController.js';
import { validateRegister, validateLogin } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public authentication routes (Strict rate limiting)
router.post('/register', authRateLimiter, validateRegister, register);
router.post('/login', authRateLimiter, validateLogin, login);

// Session refresh & logout routes
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected user profile
router.get('/me', protect, getMe);

// Scoped Extension API Key management (Protected by web session)
router.post('/api-keys', protect, createApiKey);
router.get('/api-keys', protect, listApiKeys);
router.delete('/api-keys/:keyId', protect, revokeApiKey);

export default router;
