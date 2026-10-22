import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  validateRegister,
  validateLogin,
  validateCreateCourse,
  validateProgressSync,
  validateCourseIdParam
} from '../src/middleware/validate.js';
import { config } from '../src/config/env.js';
import { ApiError } from '../src/utils/apiError.js';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';

describe('Unit Tests: Validation Middleware', () => {
  test('validateRegister: rejects invalid inputs', () => {
    const invalidInputs = [
      { body: { name: '', email: 'alice@test.com', password: 'password123' }, expectedField: 'name' },
      { body: { name: 'Alice', email: 'not-an-email', password: 'password123' }, expectedField: 'email' },
      { body: { name: 'Alice', email: 'alice@test.com', password: '123' }, expectedField: 'password' }
    ];

    for (const item of invalidInputs) {
      let capturedError = null;
      const req = { body: item.body };
      const res = {};
      const next = (err) => { capturedError = err; };

      validateRegister(req, res, next);
      assert.ok(capturedError instanceof ApiError, `Expected ApiError for ${item.expectedField}`);
      assert.equal(capturedError.statusCode, 400);
      assert.ok(capturedError.errors.some((e) => e.field === item.expectedField));
    }
  });

  test('validateRegister: passes with valid payload', () => {
    let nextCalled = false;
    const req = {
      body: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'securePassword123'
      }
    };
    validateRegister(req, {}, (err) => {
      assert.equal(err, undefined);
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('validateLogin: rejects empty email or password', () => {
    let capturedError = null;
    const req = { body: { email: '', password: '' } };
    validateLogin(req, {}, (err) => { capturedError = err; });

    assert.ok(capturedError instanceof ApiError);
    assert.equal(capturedError.statusCode, 400);
  });

  test('validateCreateCourse: rejects missing title, invalid udemyCourseId, or non-positive totalLectures', () => {
    let capturedError = null;
    const req = { body: { title: 'JS', udemyCourseId: '', totalLectures: 0 } };
    validateCreateCourse(req, {}, (err) => { capturedError = err; });

    assert.ok(capturedError instanceof ApiError);
    assert.equal(capturedError.statusCode, 400);
  });

  test('validateProgressSync: rejects invalid courseId and negative lectures', () => {
    let capturedError = null;
    const req = { body: { courseId: 'invalid-id', completedLectures: -1 } };
    validateProgressSync(req, {}, (err) => { capturedError = err; });

    assert.ok(capturedError instanceof ApiError);
    assert.equal(capturedError.statusCode, 400);
    assert.ok(capturedError.errors.some((e) => e.field === 'courseId'));
    assert.ok(capturedError.errors.some((e) => e.field === 'completedLectures'));
  });

  test('validateCourseIdParam: rejects invalid param', () => {
    let capturedError = null;
    const req = { params: { courseId: 'not-valid' } };
    validateCourseIdParam(req, {}, (err) => { capturedError = err; });

    assert.ok(capturedError instanceof ApiError);
    assert.equal(capturedError.statusCode, 400);
  });
});

describe('Unit Tests: Password & JWT Security', () => {
  test('bcrypt successfully hashes and compares passwords', async () => {
    const rawPassword = 'MySecretPassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    assert.notEqual(rawPassword, hash);
    const isMatch = await bcrypt.compare(rawPassword, hash);
    assert.equal(isMatch, true);

    const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
    assert.equal(isWrongMatch, false);
  });

  test('JWT generates and verifies correctly with payload', () => {
    const userId = '67b841a12345678901234567';
    const token = jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: '1h' });

    assert.ok(typeof token === 'string');
    const decoded = jwt.verify(token, config.jwtSecret);
    assert.equal(decoded.id, userId);
  });

  test('JWT verification fails with wrong secret', () => {
    const token = jwt.sign({ id: 'test' }, 'wrong_secret', { expiresIn: '1h' });
    assert.throws(() => {
      jwt.verify(token, config.jwtSecret);
    }, /invalid signature/);
  });
});

describe('Unit Tests: Error & 404 Handlers', () => {
  test('notFoundHandler returns 404 ApiError', () => {
    let capturedError = null;
    const req = { method: 'GET', originalUrl: '/api/unknown-endpoint' };
    notFoundHandler(req, {}, (err) => { capturedError = err; });

    assert.ok(capturedError instanceof ApiError);
    assert.equal(capturedError.statusCode, 404);
  });

  test('errorHandler formats ApiError response with statusCode and message', () => {
    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    const err = ApiError.conflict('Course already exists', [{ field: 'udemyCourseId', message: 'Must be unique' }]);
    errorHandler(err, {}, res, () => {});

    assert.equal(responseStatus, 409);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, 'Course already exists');
    assert.equal(responseBody.errors.length, 1);
  });
});
