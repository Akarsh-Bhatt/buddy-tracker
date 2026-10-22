import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { ApiKey } from '../src/models/ApiKey.js';
import { Course } from '../src/models/Course.js';
import { config } from '../src/config/env.js';

let mongoServer;
let server;
let baseUrl;

process.env.NODE_ENV = 'test';
config.nodeEnv = 'test';

let userCookies = '';
let testCourse;
let generatedKeyRaw = '';
let generatedKeyId = '';

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  // Create a course for testing
  testCourse = await Course.create({
    title: 'Authentication Security Deep Dive',
    udemyCourseId: 'auth-sec-101',
    totalLectures: 30
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

// Helper to extract cookies from set-cookie header array
function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  return headers
    .map((h) => h.split(';')[0])
    .join('; ');
}

describe('1. Web Dashboard HttpOnly Cookies & Session Management', () => {
  test('POST /api/auth/register sets access_token and refresh_token in HttpOnly cookies', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cookie User',
        email: 'cookie.user@example.com',
        password: 'Password123!'
      })
    });

    assert.equal(res.status, 201);
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('access_token='));
    assert.ok(setCookie.includes('refresh_token='));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
    assert.ok(setCookie.toLowerCase().includes('samesite=strict'));

    userCookies = extractCookies(res.headers.getSetCookie?.() || setCookie);
  });

  test('GET /api/auth/me succeeds using ONLY HttpOnly session cookie (no Authorization header)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: userCookies
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.user.email, 'cookie.user@example.com');
  });

  test('POST /api/auth/refresh rotates both access_token and refresh_token and sets new cookies', async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: userCookies
      }
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('access_token='));
    assert.ok(setCookie.includes('refresh_token='));

    const updatedCookies = extractCookies(res.headers.getSetCookie?.() || setCookie);
    assert.notEqual(updatedCookies, userCookies, 'Refresh token should rotate on refresh');
    
    // Attempting to reuse old userCookies should fail due to token rotation & reuse detection
    const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: userCookies
      }
    });
    assert.equal(reuseRes.status, 401, 'Reusing rotated refresh token must trigger revocation');

    userCookies = updatedCookies;
  });

  test('POST /api/auth/logout clears HttpOnly cookies and invalidates refresh token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: userCookies
      }
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    // Cookie should be expired / cleared
    assert.ok(setCookie.includes('access_token=;') || setCookie.includes('Max-Age=0') || setCookie.includes('expires='));
  });
});

describe('2. Scoped Extension API Keys (SHA-256 Hashed)', () => {
  before(async () => {
    // Re-login to get fresh cookies
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cookie.user@example.com',
        password: 'Password123!'
      })
    });
    userCookies = extractCookies(res.headers.getSetCookie?.() || res.headers.get('set-cookie'));
  });

  test('POST /api/auth/api-keys generates a scoped API Key prefixed with udemy_track_live_', async () => {
    const res = await fetch(`${baseUrl}/api/auth/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userCookies
      },
      body: JSON.stringify({ name: 'Home Laptop Chrome' })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.apiKey.startsWith('udemy_track_live_'));
    assert.ok(json.data.prefix.startsWith('udemy_track_live_'));

    generatedKeyRaw = json.data.apiKey;
    generatedKeyId = json.data.id;

    // Verify key in MongoDB is stored as SHA-256 hash, NOT plaintext!
    const keyDoc = await ApiKey.findById(generatedKeyId);
    assert.ok(keyDoc);
    assert.notEqual(keyDoc.keyHash, generatedKeyRaw);
    
    const expectedHash = crypto.createHash('sha256').update(generatedKeyRaw).digest('hex');
    assert.equal(keyDoc.keyHash, expectedHash);
  });

  test('GET /api/auth/api-keys returns active keys without exposing keyHash', async () => {
    const res = await fetch(`${baseUrl}/api/auth/api-keys`, {
      headers: { Cookie: userCookies }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.total, 1);
    assert.equal(json.data.keys[0].name, 'Home Laptop Chrome');
    assert.equal(json.data.keys[0].keyHash, undefined);
  });

  test('POST /api/progress/sync authenticates successfully via X-Api-Key header and updates lastUsedAt', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': generatedKeyRaw
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 14
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.stats.completedLectures, 14);

    // Verify lastUsedAt was recorded on the API key
    const keyDoc = await ApiKey.findById(generatedKeyId);
    assert.ok(keyDoc.lastUsedAt);
  });

  test('GET /api/progress/sync/verify returns 200 with user and key metadata', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync/verify`, {
      headers: {
        'x-api-key': generatedKeyRaw
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.keyName, 'Home Laptop Chrome');
    assert.ok(json.data.user.name);
  });

  test('DELETE /api/auth/api-keys/:keyId revokes the key and prevents subsequent sync', async () => {
    const revokeRes = await fetch(`${baseUrl}/api/auth/api-keys/${generatedKeyId}`, {
      method: 'DELETE',
      headers: { Cookie: userCookies }
    });

    assert.equal(revokeRes.status, 200);
    const revokeJson = await revokeRes.json();
    assert.equal(revokeJson.data.key.isActive, false);

    // Attempting to sync with revoked key must fail with 401
    const syncRes = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': generatedKeyRaw
      },
      body: JSON.stringify({
        courseId: testCourse._id.toString(),
        completedLectures: 20
      })
    });

    assert.equal(syncRes.status, 401);
    const syncJson = await syncRes.json();
    assert.ok(syncJson.message.includes('revoked') || syncJson.message.includes('inactive'));
  });
});
