import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

export const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.access_token;

    // Fallback to Bearer token in Authorization header if cookie not present
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication required. Missing session cookie or Bearer token.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Access token has expired. Please refresh session or log in again.'));
      }
      return next(ApiError.unauthorized('Invalid authentication token.'));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(ApiError.unauthorized('User belonging to this token no longer exists.'));
    }

    // Attach user to request object
    req.user = user;
    req.authType = 'session';
    next();
  } catch (error) {
    next(error);
  }
};
