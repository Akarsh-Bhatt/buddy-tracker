import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/buddy_tracker',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production_12345',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key_change_in_production_98765',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  corsOrigin: process.env.CORS_ORIGIN || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  extensionId: process.env.EXTENSION_ID || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : [],
  rateLimitAuthWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || String(15 * 60 * 1000), 10),
  rateLimitAuthMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
  rateLimitSyncWindowMs: parseInt(process.env.RATE_LIMIT_SYNC_WINDOW_MS || String(60 * 1000), 10),
  rateLimitSyncMax: parseInt(process.env.RATE_LIMIT_SYNC_MAX || '60', 10)
};
