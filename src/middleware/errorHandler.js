import { config } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl} - Route not found`));
};

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Payload Too Large (express.json limit)
  if (err.type === 'entity.too.large' || err.status === 413) {
    error = new ApiError(413, 'Payload too large. Maximum request body limit is 10kb.', [
      { field: 'body', message: 'Payload exceeds 10kb size limit' }
    ]);
  }

  // Handle Mongoose Bad ObjectId / CastError
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = ApiError.badRequest(message);
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message
    }));
    error = ApiError.badRequest('Database validation failed', errors);
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || {});
    const field = keys.length > 0 ? keys[0] : 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    const message = `Duplicate value '${value}' for field '${field}'. Please use another value.`;
    error = ApiError.conflict(message, [{ field, message }]);
  }

  // Handle JWT errors if bubbled
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token');
  } else if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token has expired');
  }

  const statusCode = error.statusCode || err.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors && error.errors.length > 0 && { errors: error.errors }),
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
};
