import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { config } from '../src/config/env.js';

process.env.NODE_ENV = 'test';
config.nodeEnv = 'test';

let mongoServer;
let server;
let baseUrl;

let aliceToken;
let aliceId;
let bobToken;
let bobId;
let createdCourseId;

before(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Start HTTP server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('1. Health and System Endpoints', () => {
  test('GET / returns API overview directory', async () => {
    const res = await fetch(`${baseUrl}/`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.name, 'Udemy Buddy Tracker API');
    assert.ok(json.endpoints);
  });

  test('GET /api/health returns status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.ok(json.timestamp);
  });
});

describe('2. Authentication & Input Validation', () => {
  test('POST /api/auth/register fails with validation error for invalid email and short password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A',
        email: 'not-an-email',
        password: '123'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
    assert.ok(json.errors && json.errors.length >= 3);
  });

  test('POST /api/auth/register succeeds for Alice', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'SecretPassword123'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.ok(json.data.token);
    assert.equal(json.data.user.email, 'alice@example.com');
    assert.equal(json.data.user.password, undefined); // password must not be returned
    assert.ok(json.data.user.avatar);

    aliceToken = json.data.token;
    aliceId = json.data.user._id;
  });

  test('POST /api/auth/register succeeds for Bob', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: 'SecretPassword456'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    bobToken = json.data.token;
    bobId = json.data.user._id;
  });

  test('POST /api/auth/register prevents duplicate email registration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Clone',
        email: 'alice@example.com',
        password: 'AnotherPassword123'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 409);
    assert.equal(json.success, false);
  });

  test('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'SecretPassword123'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.token);
  });

  test('POST /api/auth/login fails with wrong password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'WrongPassword'
      })
    });
    const json = await res.json();

    assert.equal(res.status, 401);
    assert.equal(json.success, false);
  });

  test('GET /api/auth/me returns user profile with valid Bearer token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${aliceToken}`
      }
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.user.email, 'alice@example.com');
  });

  test('GET /api/auth/me rejects request with invalid or missing token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    const json = await res.json();

    assert.equal(res.status, 401);
    assert.equal(json.success, false);
  });
});

describe('3. Courses Management', () => {
  test('POST /api/courses rejects unauthorized request', async () => {
    const res = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Full Stack JavaScript',
        udemyCourseId: 'udemy-js-101',
        totalLectures: 100
      })
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/courses validates input fields', async () => {
    const res = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: '',
        udemyCourseId: '',
        totalLectures: -5
      })
    });
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.ok(json.errors.length >= 3);
  });

  test('POST /api/courses creates course successfully', async () => {
    const res = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Complete 2026 Web Development Bootcamp',
        udemyCourseId: '1565838',
        totalLectures: 50
      })
    });
    const json = await res.json();

    assert.equal(res.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.course.udemyCourseId, '1565838');
    assert.equal(json.data.course.totalLectures, 50);

    createdCourseId = json.data.course._id;
  });

  test('POST /api/courses prevents duplicate udemyCourseId', async () => {
    const res = await fetch(`${baseUrl}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        title: 'Another Duplicate Course',
        udemyCourseId: '1565838',
        totalLectures: 30
      })
    });
    const json = await res.json();

    assert.equal(res.status, 409);
    assert.equal(json.success, false);
  });

  test('GET /api/courses lists all created courses', async () => {
    const res = await fetch(`${baseUrl}/api/courses`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.total, 1);
    assert.equal(json.data.courses[0]._id, createdCourseId);
  });
});

describe('4. Progress Tracking & Leaderboard', () => {
  test('PATCH /api/progress/sync validates that completedLectures cannot exceed totalLectures', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        courseId: createdCourseId,
        completedLectures: 60 // course only has 50 lectures
      })
    });
    const json = await res.json();

    assert.equal(res.status, 400);
    assert.equal(json.success, false);
  });

  test('PATCH /api/progress/sync upserts Alice progress to 40 lectures (80%)', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        courseId: createdCourseId,
        completedLectures: 40,
        completedLectureIds: ['lec_1', 'lec_2', 'lec_3']
      })
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.progress.completedLectures, 40);
    assert.equal(json.data.stats.completionPercentage, 80);
    assert.equal(json.data.stats.isCompleted, false);
  });

  test('PATCH /api/progress/sync upserts Bob progress to 25 lectures (50%)', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({
        courseId: createdCourseId,
        completedLectures: 25
      })
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.progress.completedLectures, 25);
    assert.equal(json.data.stats.completionPercentage, 50);
  });

  test('GET /api/courses/:courseId/leaderboard returns ranked users sorted by highest completion', async () => {
    const res = await fetch(`${baseUrl}/api/courses/${createdCourseId}/leaderboard`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.enrolledCount, 2);

    const leaderboard = json.data.leaderboard;
    // Alice has 80%, Bob has 50%
    assert.equal(leaderboard[0].rank, 1);
    assert.equal(leaderboard[0].user.name, 'Alice Johnson');
    assert.equal(leaderboard[0].completedLectures, 40);
    assert.equal(leaderboard[0].totalLectures, 50);
    assert.equal(leaderboard[0].completionPercentage, 80);

    assert.equal(leaderboard[1].rank, 2);
    assert.equal(leaderboard[1].user.name, 'Bob Smith');
    assert.equal(leaderboard[1].completedLectures, 25);
    assert.equal(leaderboard[1].totalLectures, 50);
    assert.equal(leaderboard[1].completionPercentage, 50);
  });

  test('PATCH /api/progress/sync updates Alice to 50 lectures (100% completion) without duplicate record', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({
        courseId: createdCourseId,
        completedLectures: 50
      })
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.stats.completionPercentage, 100);
    assert.equal(json.data.stats.isCompleted, true);

    // Leaderboard count should still be 2 (not 3)
    const lbRes = await fetch(`${baseUrl}/api/courses/${createdCourseId}/leaderboard`);
    const lbJson = await lbRes.json();
    assert.equal(lbJson.data.enrolledCount, 2);
    assert.equal(lbJson.data.leaderboard[0].completionPercentage, 100);
  });

  test('GET /api/progress/:courseId returns current user progress', async () => {
    const res = await fetch(`${baseUrl}/api/progress/${createdCourseId}`, {
      headers: {
        Authorization: `Bearer ${aliceToken}`
      }
    });
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.data.stats.completedLectures, 50);
    assert.equal(json.data.stats.completionPercentage, 100);
  });
});
