import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('1. Resilient Scraper Regex & Parsing Algorithms', () => {
  const parseSummaryText = (text) => {
    const match = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (!match) return null;
    const completed = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (total > 0 && completed <= total) {
      return { completedLectures: completed, totalLectures: total };
    }
    return null;
  };

  test('Correctly extracts lectures from Udemy ARIA label formats', () => {
    assert.deepEqual(parseSummaryText('42 of 100 complete'), { completedLectures: 42, totalLectures: 100 });
    assert.deepEqual(parseSummaryText('15 / 50 items completed'), { completedLectures: 15, totalLectures: 50 });
    assert.deepEqual(parseSummaryText('30 of 30 complete'), { completedLectures: 30, totalLectures: 30 });
    assert.deepEqual(parseSummaryText('Section progress: 5 of 12 lectures'), { completedLectures: 5, totalLectures: 12 });
  });

  test('Rejects invalid or corrupted progress formats safely', () => {
    assert.equal(parseSummaryText('No progress available'), null);
    assert.equal(parseSummaryText('50 of 40 completed'), null); // completed > total rejected
    assert.equal(parseSummaryText('0 of 0 items'), null); // total === 0 rejected
  });
});

describe('2. Offline Queue Coalescing & Management', () => {
  function coalesceQueue(existingQueue, newPayload) {
    const queue = Array.isArray(existingQueue) ? [...existingQueue] : [];
    const existingIdx = queue.findIndex((item) => item.courseName === newPayload.courseName);

    const queueItem = {
      ...newPayload,
      queuedAt: new Date().toISOString(),
      attempts: 0
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = queueItem;
    } else {
      queue.push(queueItem);
    }
    return queue;
  }

  test('Coalesces updates for the same course to prevent queue spam', () => {
    let queue = [];
    queue = coalesceQueue(queue, { courseName: 'Docker Mastery', completedLectures: 10, totalLectures: 50 });
    assert.equal(queue.length, 1);
    assert.equal(queue[0].completedLectures, 10);

    // Newer progress update for same course replaces previous entry
    queue = coalesceQueue(queue, { courseName: 'Docker Mastery', completedLectures: 14, totalLectures: 50 });
    assert.equal(queue.length, 1);
    assert.equal(queue[0].completedLectures, 14);
  });

  test('Maintains distinct queue entries for different courses', () => {
    let queue = [
      { courseName: 'Docker Mastery', completedLectures: 14, totalLectures: 50 }
    ];

    queue = coalesceQueue(queue, { courseName: 'Kubernetes Hands-On', completedLectures: 5, totalLectures: 30 });
    assert.equal(queue.length, 2);
    assert.equal(queue[0].courseName, 'Docker Mastery');
    assert.equal(queue[1].courseName, 'Kubernetes Hands-On');
  });
});

describe('3. Exponential Backoff Formula', () => {
  const BASE_BACKOFF_MS = 2000;
  const MAX_BACKOFF_MS = 60000;

  function calculateBackoff(attempt) {
    return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt));
  }

  test('Calculates expected exponential delays', () => {
    assert.equal(calculateBackoff(1), 4000);  // 2s * 2^1 = 4s
    assert.equal(calculateBackoff(2), 8000);  // 2s * 2^2 = 8s
    assert.equal(calculateBackoff(3), 16000); // 2s * 2^3 = 16s
    assert.equal(calculateBackoff(4), 32000); // 2s * 2^4 = 32s
  });

  test('Caps delay at MAX_BACKOFF_MS (60 seconds)', () => {
    assert.equal(calculateBackoff(5), 60000); // 2s * 2^5 = 64s -> capped at 60s
    assert.equal(calculateBackoff(10), 60000);
  });
});

describe('4. Content Script Static Analysis for DOM Resilience', () => {
  const contentJsPath = path.resolve(process.cwd(), 'extension/content.js');
  const code = fs.readFileSync(contentJsPath, 'utf8');

  test('Uses 2-second debounce delay (2000ms) for MutationObserver throttling', () => {
    assert.ok(code.includes('DEBOUNCE_DELAY_MS = 2000'));
  });

  test('Does not rely on transient randomized CSS class selectors', () => {
    // Ensure old fragile selectors were removed
    assert.ok(!code.includes('.clp-lead__title'));
    assert.ok(!code.includes('[class*="curriculum-item"]'));
    assert.ok(!code.includes('[class*="progress-popover"]'));
  });

  test('Relies on robust ARIA and data attributes', () => {
    assert.ok(code.includes('aria-checked'));
    assert.ok(code.includes('aria-label'));
    assert.ok(code.includes('data-purpose'));
    assert.ok(code.includes('input[type="checkbox"]'));
    assert.ok(code.includes('[role="checkbox"]'));
  });

  test('Contains offline queue storage and backoff routines', () => {
    assert.ok(code.includes('buddy_offline_queue'));
    assert.ok(code.includes('flushOfflineQueue'));
    assert.ok(code.includes('enqueueOfflinePayload'));
    assert.ok(code.includes('window.addEventListener(\'online\''));
  });

  test('Scopes MutationObserver to curriculum sidebar and ignores video playback elements', () => {
    assert.ok(code.includes('getCurriculumSidebar'));
    assert.ok(code.includes('targetNode.nodeName === \'VIDEO\''));
  });
});
