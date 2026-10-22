import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiKey } from '../models/ApiKey.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
  generateApiKey
} from '../utils/token.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return next(ApiError.conflict('An account with this email already exists'));
    }

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    };

    if (avatar) {
      userData.avatar = avatar.trim();
    }

    const user = await User.create(userData);

    // Generate short-lived access token and long-lived refresh token
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Save hashed refresh token in database for rotation/revocation tracking
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    // Store tokens in secure HttpOnly cookies
    setAuthCookies(res, { accessToken, refreshToken });

    sendSuccess(res, {
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        user,
        accessToken,
        token: accessToken // backward compatibility
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in an existing user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Must explicitly select password & refreshTokenHash
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password +refreshTokenHash');

    if (!user) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    // Generate fresh tokens
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Store hashed refresh token in DB
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    // Set secure HttpOnly cookies
    setAuthCookies(res, { accessToken, refreshToken });

    // Remove sensitive fields before output
    user.password = undefined;
    user.refreshTokenHash = undefined;

    sendSuccess(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        user,
        accessToken,
        token: accessToken // backward compatibility
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Access Token with Token Rotation & Reuse Detection
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!incomingRefreshToken) {
      clearAuthCookies(res);
      return next(ApiError.unauthorized('Refresh token is required. No session cookie found.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, config.jwtRefreshSecret);
    } catch (err) {
      clearAuthCookies(res);
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Refresh token expired. Please log in again.'));
      }
      return next(ApiError.unauthorized('Invalid refresh token.'));
    }

    // Must match refresh token type
    if (decoded.type !== 'refresh') {
      clearAuthCookies(res);
      return next(ApiError.unauthorized('Token provided is not a valid refresh token.'));
    }

    // Find user with stored hashed refresh token
    const user = await User.findById(decoded.id).select('+refreshTokenHash');
    if (!user) {
      clearAuthCookies(res);
      return next(ApiError.unauthorized('User belonging to this token no longer exists.'));
    }

    const incomingHash = hashToken(incomingRefreshToken);

    // Token Reuse / Revocation Check:
    // If the stored hash does not match, a revoked or already rotated token is being used!
    if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
      // Invalidate all sessions for this user as a safeguard against stolen tokens
      user.refreshTokenHash = undefined;
      await user.save();
      clearAuthCookies(res);
      return next(
        ApiError.unauthorized('Refresh token has already been rotated or revoked. Please log in again.')
      );
    }

    // Token Rotation: Generate a brand new access token AND a brand new refresh token
    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);

    // Store new refresh token hash
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    // Set updated HttpOnly cookies
    setAuthCookies(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

    user.refreshTokenHash = undefined;

    sendSuccess(res, {
      statusCode: 200,
      message: 'Token refreshed successfully with token rotation',
      data: {
        user,
        accessToken: newAccessToken,
        token: newAccessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log out and revoke refresh token
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies?.refresh_token;

    if (incomingRefreshToken) {
      try {
        const decoded = jwt.verify(incomingRefreshToken, config.jwtRefreshSecret);
        if (decoded?.id) {
          await User.findByIdAndUpdate(decoded.id, { $unset: { refreshTokenHash: 1 } });
        }
      } catch {
        // Ignore token verification errors during logout
      }
    } else if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { $unset: { refreshTokenHash: 1 } });
    }

    // Clear HttpOnly cookies
    clearAuthCookies(res);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    sendSuccess(res, {
      statusCode: 200,
      message: 'Current user profile fetched successfully',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate a new Scoped Extension API Key
 * POST /api/auth/api-keys
 */
export const createApiKey = async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.user._id;

    const { rawKey, keyHash, displayPrefix } = generateApiKey();

    const apiKeyDoc = await ApiKey.create({
      userId,
      name: name?.trim() || 'Chrome Extension',
      keyHash,
      prefix: displayPrefix
    });

    sendSuccess(res, {
      statusCode: 201,
      message: 'Extension API key generated successfully. Store it now; it cannot be shown again.',
      data: {
        apiKey: rawKey, // Shown only ONCE upon generation
        id: apiKeyDoc._id,
        prefix: apiKeyDoc.prefix,
        name: apiKeyDoc.name,
        createdAt: apiKeyDoc.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all extension API keys for the current user
 * GET /api/auth/api-keys
 */
export const listApiKeys = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const keys = await ApiKey.find({ userId })
      .select('-keyHash')
      .sort({ createdAt: -1 });

    sendSuccess(res, {
      statusCode: 200,
      message: 'API keys retrieved successfully',
      data: {
        total: keys.length,
        keys
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke an extension API key
 * DELETE /api/auth/api-keys/:keyId
 */
export const revokeApiKey = async (req, res, next) => {
  try {
    const { keyId } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: keyId, userId });

    if (!apiKey) {
      return next(ApiError.notFound('API key not found'));
    }

    apiKey.isActive = false;
    apiKey.revokedAt = new Date();
    await apiKey.save();

    sendSuccess(res, {
      statusCode: 200,
      message: 'API key revoked successfully',
      data: {
        key: apiKey
      }
    });
  } catch (error) {
    next(error);
  }
};
