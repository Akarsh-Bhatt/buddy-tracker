import { Router } from 'express';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import progressRoutes from './progressRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/progress', progressRoutes);

export default router;
