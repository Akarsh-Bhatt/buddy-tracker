import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Strict Rate Limiter for Authentication Routes
 * Max 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimitAuthWindowMs, // default 15 minutes
  limit: config.rateLimitAuthMax, // default 5 attempts
  standardHeaders: true, // Draft-6 / Draft-7 RateLimit headers
  legacyHeaders: false,
  validate: {
    keyGeneratorIpFallback: false
  },
  skip: (req) => config.nodeEnv === 'test' && !req.headers['x-test-rate-limit'],
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many authentication attempts from this IP. Please try again after 15 minutes.',
        [
          {
            field: 'auth',
            message: 'Rate limit exceeded. Maximum 5 attempts per 15 minutes.'
          }
        ]
      )
    );
  }
});

/**
 * Moderate Rate Limiter for Progress Synchronization
 * Max 60 requests per minute per authenticated user
 */
export const syncRateLimiter = rateLimit({
  windowMs: config.rateLimitSyncWindowMs, // default 1 minute
  limit: config.rateLimitSyncMax, // default 60 requests
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    keyGeneratorIpFallback: false
  },
  skip: (req) => config.nodeEnv === 'test' && !req.headers['x-test-rate-limit'],
  keyGenerator: (req) => {
    // Key by authenticated user ID to protect against sync spam per user account
    if (req.user && req.user._id) {
      return `sync_user_${req.user._id.toString()}`;
    }
    return req.ip || 'anonymous';
  },
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many progress sync requests. Maximum 60 sync requests per minute allowed.',
        [
          {
            field: 'sync',
            message: 'Sync rate limit exceeded. Please wait a moment before sending more updates.'
          }
        ]
      )
    );
  }
});
