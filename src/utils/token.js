import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const hashToken = (raw) => {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
};

export const signAccessToken = (userId) => {
  return jwt.sign({ id: userId, type: 'access' }, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiresIn
  });
};

export const signRefreshToken = (userId) => {
  return jwt.sign(
    {
      id: userId,
      type: 'refresh',
      jti: crypto.randomUUID()
    },
    config.jwtRefreshSecret,
    {
      expiresIn: config.jwtRefreshExpiresIn
    }
  );
};

export const generateApiKey = (prefix = 'udemy_track_live_') => {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const rawKey = `${prefix}${randomPart}`;
  const keyHash = hashToken(rawKey);
  const displayPrefix = `${prefix}${randomPart.slice(0, 6)}...${randomPart.slice(-4)}`;

  return {
    rawKey,
    keyHash,
    displayPrefix
  };
};

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/'
  };

  if (accessToken) {
    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
  }

  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
};

export const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/'
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
};
