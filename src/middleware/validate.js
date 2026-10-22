export {
  registerSchema,
  loginSchema,
  createCourseSchema,
  progressSyncSchema,
  courseIdParamSchema,
  validateZod,
  validateRegisterZod as validateRegister,
  validateLoginZod as validateLogin,
  validateCreateCourseZod as validateCreateCourse,
  validateProgressSyncZod as validateProgressSync,
  validateCourseIdParamZod as validateCourseIdParam
} from './validateZod.js';
