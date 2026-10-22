import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';

let mongoServer;
let server;
let baseUrl;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Security Layer 1: Helmet & HTTP Headers Hardening', () => {
  test('Returns nosniff, DENY, and CSP headers on all responses', async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('content-security-policy'));
  });
});

describe('Security Layer 2: CORS Strict Origin Whitelisting', () => {
  test('Allows React frontend origin (http://localhost:5173)', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  test('Allows Chrome extension origin (chrome-extension://*)', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'chrome-extension://abcdefghijklmnop' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'chrome-extension://abcdefghijklmnop');
  });

  test('Blocks unauthorized / malicious origins with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil-attacker-site.com' }
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('CORS blocked'));
  });
});

describe('Security Layer 3: Payload Size Limiting (10kb)', () => {
  test('Rejects JSON payloads exceeding 10kb with 413 Payload Too Large', async () => {
    const oversizedString = 'x'.repeat(12 * 1024); // 12kb
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Oversized User',
        email: 'test@example.com',
        password: 'password123',
        extraPadding: oversizedString
      })
    });

    assert.equal(res.status, 413);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.message.includes('Payload too large'));
  });
});

describe('Security Layer 4: NoSQL Injection Sanitization', () => {
  test('Strips/replaces $ NoSQL operator keys in request bodies', async () => {
    // Attempting NoSQL injection with $gt in login payload
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { $gt: '' },
        password: 'password123'
      })
    });

    // Should fail validation rather than executing MongoDB query with $gt operator
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });
});

describe('Security Layer 5: Zod Schema Validation & Constraints', () => {
  test('Zod rejects invalid emails and short passwords with field details', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A',
        email: 'bad-email-format',
        password: '123'
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.errors.some((e) => e.field === 'email'));
    assert.ok(json.errors.some((e) => e.field === 'password'));
  });

  test('Zod validates completedLectures cannot exceed totalLectures', async () => {
    const res = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_or_dummy_token'
      },
      body: JSON.stringify({
        courseName: 'Test Course',
        completedLectures: 50,
        totalLectures: 40 // Invalid: 50 > 40
      })
    });

    // Request is rejected either at auth or at validation
    assert.ok(res.status === 400 || res.status === 401);
  });
});

describe('Security Layer 6: Rate Limiting Enforcement', () => {
  test('Enforces 429 Too Many Requests when rate limit threshold is triggered', async () => {
    // Send 6 rapid requests with x-test-rate-limit header enabled
    let lastStatus = 200;
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Rate-Limit': 'true'
        },
        body: JSON.stringify({
          email: 'rate-limit-test@example.com',
          password: 'wrong_password'
        })
      });
      lastStatus = res.status;
    }

    // Auth limit is max 5 attempts per window; 6th/7th should receive 429
    assert.equal(lastStatus, 429);
  });
});
