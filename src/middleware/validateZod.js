import { z } from 'zod';
import { ApiError } from '../utils/apiError.js';

const MONGO_OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Zod Schemas for Request Validation
 */
export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name cannot exceed 50 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
  avatar: z
    .string()
    .trim()
    .url('Avatar must be a valid URL')
    .optional()
    .or(z.literal(''))
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
});

export const createCourseSchema = z.object({
  title: z
    .string({ required_error: 'Course title is required' })
    .trim()
    .min(2, 'Course title must be at least 2 characters long')
    .max(200, 'Course title cannot exceed 200 characters'),
  udemyCourseId: z
    .union([z.string().trim().min(1, 'udemyCourseId is required'), z.number().int()])
    .transform((val) => String(val).trim()),
  totalLectures: z.coerce
    .number({ required_error: 'Total lecture count is required' })
    .int('totalLectures must be an integer')
    .min(1, 'totalLectures must be an integer of at least 1')
});

export const progressSyncSchema = z
  .object({
    courseId: z
      .string()
      .trim()
      .regex(MONGO_OBJECT_ID_REGEX, 'Valid courseId (MongoDB ObjectId) is required')
      .optional(),
    courseName: z
      .string()
      .trim()
      .min(1, 'courseName cannot be empty')
      .optional(),
    completedLectures: z.coerce
      .number({ required_error: 'completedLectures is required' })
      .int('completedLectures must be an integer')
      .min(0, 'completedLectures must be a non-negative integer'),
    totalLectures: z.coerce
      .number()
      .int('totalLectures must be an integer')
      .min(1, 'totalLectures must be at least 1')
      .optional(),
    completedLectureIds: z
      .array(z.union([z.string(), z.number().transform(String)]))
      .optional(),
    allowRollback: z.boolean().optional().default(false),
    clientTimestamp: z
      .union([z.string(), z.number(), z.date()])
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: 'clientTimestamp must be a valid date or timestamp'
      })
      .optional(),
    source: z.enum(['extension', 'web_manual']).optional()
  })
  .superRefine((data, ctx) => {
    // 1. Must supply either courseId or courseName
    if (!data.courseId && !data.courseName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['courseId'],
        message: 'Either courseId (MongoDB ObjectId) or courseName is required'
      });
    }

    // 2. If totalLectures is present in payload, completedLectures cannot exceed totalLectures
    if (data.totalLectures !== undefined && data.completedLectures > data.totalLectures) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedLectures'],
        message: `completedLectures (${data.completedLectures}) cannot exceed totalLectures (${data.totalLectures})`
      });
    }
  });

export const courseIdParamSchema = z.object({
  courseId: z
    .string({ required_error: 'courseId parameter is required' })
    .trim()
    .regex(MONGO_OBJECT_ID_REGEX, 'Invalid course ID parameter. Must be a valid MongoDB ObjectId.')
});

/**
 * Higher-order middleware factory for validating request parts with Zod
 * @param {z.ZodSchema} schema - Zod validation schema
 * @param {'body' | 'params' | 'query'} [source='body'] - Target property on req
 */
export const validateZod = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message
      }));

      return next(ApiError.badRequest('Validation failed', formattedErrors));
    }

    // Assign parsed & sanitized data back to req[source]
    req[source] = result.data;
    next();
  };
};

// Convenience middleware exports
export const validateRegisterZod = validateZod(registerSchema, 'body');
export const validateLoginZod = validateZod(loginSchema, 'body');
export const validateCreateCourseZod = validateZod(createCourseSchema, 'body');
export const validateProgressSyncZod = validateZod(progressSyncSchema, 'body');
export const validateCourseIdParamZod = validateZod(courseIdParamSchema, 'params');
