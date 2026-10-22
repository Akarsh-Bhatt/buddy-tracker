import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { config } from './config/env.js';
import { ApiError } from './utils/apiError.js';

const app = express();

// 1. Helmet: Secure HTTP Headers (CSP, HSTS, X-Content-Type-Options)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://api.dicebear.com', 'https://*.udemy.com'],
        connectSrc: ["'self'", 'http://localhost:5000', 'http://localhost:5173', 'chrome-extension:*']
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    crossOriginEmbedderPolicy: false // Allow embedding avatar SVGs
  })
);

// 2. CORS: Strict Origin Whitelisting (React frontend, Chrome extension, and configured origins)
const whitelist = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(config.clientUrl ? [config.clientUrl] : []),
  ...config.allowedOrigins
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin (e.g. curl, test runners, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Allow Chrome Extension origins
    if (origin.startsWith('chrome-extension://')) {
      if (config.extensionId) {
        if (origin === `chrome-extension://${config.extensionId}`) {
          return callback(null, true);
        }
        return callback(ApiError.forbidden('CORS blocked: Unauthorized extension origin'));
      }
      return callback(null, true);
    }

    // Check frontend whitelist
    if (whitelist.has(origin)) {
      return callback(null, true);
    }

    return callback(ApiError.forbidden(`CORS blocked: Origin '${origin}' is not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Test-Rate-Limit', 'X-Api-Key', 'x-api-key']
};

app.use(cors(corsOptions));

// 3. Cookie parser for HttpOnly session cookies
app.use(cookieParser());

// 4. Payload Hardening: Limit JSON & URL-encoded request body to 10kb to prevent payload DoS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. NoSQL Injection Prevention: Sanitize keys starting with $ or containing . using in-place sanitization (Express 5 compatible)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  }
  if (req.query && typeof req.query === 'object') {
    mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  }
  next();
});

// Logging middleware
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// Root welcome & API info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Udemy Buddy Tracker API',
    version: '1.0.0',
    description: 'Shared Udemy Course Progress Tracker API with live leaderboards',
    security: {
      helmet: 'enabled (CSP, HSTS, noSniff, frameguard)',
      payloadLimit: '10kb',
      noSqlSanitization: 'enabled',
      rateLimiting: 'active (auth: 5/15min, sync: 60/min)',
      cors: 'strict origin whitelisting'
    },
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      courses: {
        create: 'POST /api/courses',
        list: 'GET /api/courses',
        detail: 'GET /api/courses/:courseId',
        leaderboard: 'GET /api/courses/:courseId/leaderboard'
      },
      progress: {
        sync: 'PATCH /api/progress/sync (also accepts POST)',
        getCourseProgress: 'GET /api/progress/:courseId',
        getAllProgress: 'GET /api/progress'
      }
    }
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Catch 404 routes
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

export default app;
