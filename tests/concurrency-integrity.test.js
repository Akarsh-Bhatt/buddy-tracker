import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { Course } from '../src/models/Course.js';
import { Progress } from '../src/models/Progress.js';
import { ProgressHistory } from '../src/models/ProgressHistory.js';
import { calculateStreak } from '../src/utils/streak.js';
import { config } from '../src/config/env.js';

let mongoServer;
let server;
let baseUrl;

process.env.NODE_ENV = 'test';
config.nodeEnv = 'test';

let userCookies = '';
let testCourse;
let extensionApiKey = '';

function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers.map((h) => h.split(';')[0]).join('; ');
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  // 1. Create test course
  testCourse = await Course.create({
    title: 'Concurrency & Distributed Systems',
    udemyCourseId: 'concurrency-201',
    totalLectures: 50
  });

  // 2. Register user for session cookies
  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'CompilerPassword123'
    })
  });
  assert.equal(registerRes.status, 201);
  userCookies = extractCookies(registerRes.headers.getSetCookie());

  // 3. Create scoped API key for extension simulation
  const keyRes = await fetch(`${baseUrl}/api/auth/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: userCookies
    },
    body: JSON.stringify({ name: 'Hopper Chrome Tab' })
  });
  assert.equal(keyRes.status, 201);
  const keyJson = await keyRes.json();
  extensionApiKey = keyJson.data.apiKey;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('1. Monotonic Progress Guard', () => {
  test('Initial sync establishes baseline progress', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 20
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.stats.completedLectures, 20);
  });

  test('Reject accidental progress regression without allowRollback flag', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 15 // Attempting regression from 20 to 15
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('Monotonic progress regression prevented'));
    assert.ok(json.message.includes('allowRollback: true'));

    // Verify database value remained 20
    const currentDoc = await Progress.findOne({ courseId: testCourse._id });
    assert.equal(currentDoc.completedLectures, 20);
  });

  test('Reject progress regression when allowRollback is explicitly false', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 12,
        allowRollback: false
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.message.includes('Monotonic progress regression prevented'));
  });

  test('Permit regression when allowRollback: true override is provided', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookies
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 15,
        allowRollback: true
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.stats.completedLectures, 15);

    // Verify database document was lowered to 15
    const currentDoc = await Progress.findOne({ courseId: testCourse._id });
    assert.equal(currentDoc.completedLectures, 15);
  });

  test('Permit forward progression normally (15 -> 30 lectures)', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 30
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.stats.completedLectures, 30);
  });
});

describe('2. Optimistic Concurrency & Timestamp Ordering', () => {
  let anchorTimestamp;

  test('Update with current timestamp sets lastSyncedAt in database', async () => {
    anchorTimestamp = new Date();
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 35,
        clientTimestamp: anchorTimestamp.toISOString()
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.stats.completedLectures, 35);

    const doc = await Progress.findOne({ courseId: testCourse._id });
    assert.ok(doc.lastSyncedAt);
    assert.equal(new Date(doc.lastSyncedAt).getTime(), anchorTimestamp.getTime());
  });

  test('Reject stale update if clientTimestamp is older than lastSyncedAt', async () => {
    // Construct a client timestamp 10 minutes earlier than anchor
    const staleTimestamp = new Date(anchorTimestamp.getTime() - 1000 * 60 * 10);

    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 38,
        clientTimestamp: staleTimestamp.toISOString()
      })
    });

    assert.equal(res.status, 409); // Conflict
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('Optimistic concurrency conflict'));
    assert.ok(json.message.includes('older than lastSyncedAt'));

    // Verify database record was not modified by the stale request
    const doc = await Progress.findOne({ courseId: testCourse._id });
    assert.equal(doc.completedLectures, 35);
  });

  test('Accept fresher update if clientTimestamp is newer than lastSyncedAt', async () => {
    const newerTimestamp = new Date(anchorTimestamp.getTime() + 1000 * 60 * 5);

    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 40,
        clientTimestamp: newerTimestamp.toISOString()
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.stats.completedLectures, 40);

    const doc = await Progress.findOne({ courseId: testCourse._id });
    assert.equal(doc.completedLectures, 40);
    assert.equal(new Date(doc.lastSyncedAt).getTime(), newerTimestamp.getTime());
  });

  test('Simultaneous concurrent sync requests resolve atomically without race regression', async () => {
    // Simulate 5 simultaneous requests from different open browser tabs
    const promises = [36, 42, 45, 41, 44].map((count) =>
      fetch(`${baseUrl}/api/progress/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': extensionApiKey
        },
        body: JSON.stringify({
          courseId: testCourse._id.toString(),
          completedLectures: count,
          allowRollback: count < 40 // lower ones explicitly test $max behavior
        })
      })
    );

    const responses = await Promise.all(promises);
    // All requests must return without uncaught server crash (either 200 or 400 for regression)
    for (const r of responses) {
      assert.ok([200, 400].includes(r.status));
    }

    // Monotonic $max atomic guarantee: final count must be highest value (45)
    const doc = await Progress.findOne({ courseId: testCourse._id });
    assert.equal(doc.completedLectures, 45);
  });
});

describe('3. Audit History Log & Streak Tracking', () => {
  test('Sync records source: extension when authenticated with x-api-key', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': extensionApiKey
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 47
      })
    });

    assert.equal(res.status, 200);
    const doc = await Progress.findOne({ courseId: testCourse._id });
    assert.ok(Array.isArray(doc.history));
    assert.ok(doc.history.length > 0);

    const latest = doc.history[doc.history.length - 1];
    assert.equal(latest.completedLectures, 47);
    assert.equal(latest.source, 'extension');
  });

  test('Sync records source: web_manual when authenticated with web session cookies', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookies
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 48
      })
    });

    assert.equal(res.status, 200);
    const doc = await Progress.findOne({ courseId: testCourse._id });
    const latest = doc.history[doc.history.length - 1];
    assert.equal(latest.completedLectures, 48);
    assert.equal(latest.source, 'web_manual');
  });

  test('ProgressHistory collection captures audit documents', async () => {
    const historyDocs = await ProgressHistory.find({ courseId: testCourse._id });
    assert.ok(historyDocs.length >= 2);

    const sources = historyDocs.map((h) => h.source);
    assert.ok(sources.includes('extension'));
    assert.ok(sources.includes('web_manual'));
  });

  test('GET /api/progress/:courseId/history returns audit logs and dailyStreak', async () => {
    const res = await fetch(`${baseUrl}/api/progress/${testCourse._id}/history`, {
      headers: { Cookie: userCookies }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.history));
    assert.ok(json.data.history.length > 0);
    assert.ok(typeof json.data.dailyStreak === 'number');
    assert.ok(json.data.dailyStreak >= 1);
  });

  test('Unit: calculateStreak accurately handles consecutive days, today, and breaks', () => {
    const now = new Date();

    const dToday = new Date(now).toISOString();
    const d1 = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const d2 = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
    const d4 = new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(); // 4 days ago (broken streak)

    // 3 consecutive days (today, yesterday, 2 days ago)
    const activeEntries = [
      { timestamp: dToday, completedLectures: 20 },
      { timestamp: dToday, completedLectures: 25 }, // multiple same day
      { timestamp: d1, completedLectures: 15 },
      { timestamp: d2, completedLectures: 10 },
      { timestamp: d4, completedLectures: 5 } // break before d2
    ];

    const streak = calculateStreak(activeEntries);
    assert.equal(streak, 3);

    // Broken streak (last activity 5 days ago)
    const brokenEntries = [
      { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), completedLectures: 5 }
    ];
    assert.equal(calculateStreak(brokenEntries), 0);
  });
});
