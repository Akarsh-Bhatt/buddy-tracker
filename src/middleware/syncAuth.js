import { ApiKey } from '../models/ApiKey.js';
import { User } from '../models/User.js';
import { hashToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';
import { protect } from './auth.js';

/**
 * Authentication Middleware for /api/progress/sync
 * Verifies the x-api-key header for Chrome extension automation.
 * Falls back to standard web session auth (HttpOnly cookie / Bearer token) for web clients.
 */
export const syncAuth = async (req, res, next) => {
  try {
    const rawApiKey = req.headers['x-api-key'] || req.headers['X-Api-Key'];

    // 1. If x-api-key header is provided, authenticate via hashed scoped API key
    if (rawApiKey) {
      const keyString = String(rawApiKey).trim();

      if (!keyString.startsWith('udemy_track_live_')) {
        return next(
          ApiError.unauthorized(
            'Invalid extension API key format. Expected prefix: udemy_track_live_...'
          )
        );
      }

      // Hash key with sha256 to match database record
      const keyHash = hashToken(keyString);

      // Verify key exists and is currently active
      const apiKeyDoc = await ApiKey.findOne({ keyHash, isActive: true });

      if (!apiKeyDoc) {
        return next(
          ApiError.unauthorized(
            'Extension API key is invalid, inactive, or has been revoked.'
          )
        );
      }

      // Resolve the corresponding user
      const user = await User.findById(apiKeyDoc.userId);
      if (!user) {
        return next(
          ApiError.unauthorized('User associated with this extension API key no longer exists.')
        );
      }

      // Update last active timestamp on the key
      apiKeyDoc.lastUsedAt = new Date();
      await apiKeyDoc.save();

      // Attach user & key metadata to request
      req.user = user;
      req.authType = 'apiKey';
      req.apiKey = apiKeyDoc;

      return next();
    }

    // 2. If x-api-key is not provided, fall back to web session authentication
    return protect(req, res, next);
  } catch (error) {
    next(error);
  }
};
