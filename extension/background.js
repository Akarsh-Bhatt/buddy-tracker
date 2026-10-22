// Background Service Worker for Udemy Buddy Tracker Manifest V3
// Runs in privileged extension context to bypass page-level CSP and mixed-content restrictions

const DEFAULT_API_URL = 'http://localhost:5000/api';
const STORAGE_KEY_QUEUE = 'buddy_offline_queue';

// Listen for messages from content.js and popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SYNC_PROGRESS') {
    handleSyncProgress(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'FLUSH_QUEUE') {
    flushOfflineQueue()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleSyncProgress(payload) {
  const data = await chrome.storage.local.get([
    'buddy_api_key',
    'buddy_jwt_token',
    'buddy_api_url'
  ]);

  const apiKey = (data.buddy_api_key || data.buddy_jwt_token || '').trim();
  const apiUrl = (data.buddy_api_url || DEFAULT_API_URL).replace(/\/+$/, '');

  if (!apiKey) {
    await chrome.storage.local.set({
      buddy_sync_data: {
        courseName: payload.courseName,
        completedLectures: payload.completedLectures,
        totalLectures: payload.totalLectures,
        lastSyncAt: new Date().toISOString(),
        status: 'missing_token'
      }
    });
    return { success: false, error: 'No extension API key configured' };
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey.startsWith('udemy_track_live_')) {
    headers['x-api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`${apiUrl}/progress/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const resJson = await response.json().catch(() => ({}));

    if (response.ok) {
      await chrome.storage.local.set({
        buddy_sync_data: {
          courseName: payload.courseName,
          completedLectures: payload.completedLectures,
          totalLectures: payload.totalLectures,
          lastSyncAt: new Date().toISOString(),
          status: 'success'
        }
      });

      // Flush any older queued offline updates
      flushOfflineQueue();

      return { success: true, data: resJson };
    } else {
      if (response.status >= 500) {
        await enqueueOffline(payload);
        return { success: false, error: 'Server error (5xx)', queued: true };
      } else {
        await chrome.storage.local.set({
          buddy_sync_data: {
            courseName: payload.courseName,
            completedLectures: payload.completedLectures,
            totalLectures: payload.totalLectures,
            lastSyncAt: new Date().toISOString(),
            status: 'error',
            error: resJson.message || response.statusText
          }
        });
        return { success: false, error: resJson.message || response.statusText, status: response.status };
      }
    }
  } catch (fetchErr) {
    // Network drop or offline
    await enqueueOffline(payload);
    return { success: false, error: fetchErr.message, queued: true };
  }
}

async function enqueueOffline(payload) {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEY_QUEUE]);
    const queue = Array.isArray(data[STORAGE_KEY_QUEUE]) ? data[STORAGE_KEY_QUEUE] : [];

    const existingIdx = queue.findIndex((item) => item.courseName === payload.courseName);
    const queueItem = {
      ...payload,
      queuedAt: new Date().toISOString(),
      attempts: 0
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = queueItem;
    } else {
      queue.push(queueItem);
    }

    await chrome.storage.local.set({
      [STORAGE_KEY_QUEUE]: queue,
      buddy_sync_data: {
        courseName: payload.courseName,
        completedLectures: payload.completedLectures,
        totalLectures: payload.totalLectures,
        lastSyncAt: new Date().toISOString(),
        status: 'offline_queued',
        queuedCount: queue.length
      }
    });
  } catch (err) {
    console.error('Failed to enqueue offline:', err);
  }
}

async function flushOfflineQueue() {
  if (!navigator.onLine) return;

  const data = await chrome.storage.local.get([
    STORAGE_KEY_QUEUE,
    'buddy_api_key',
    'buddy_jwt_token',
    'buddy_api_url'
  ]);

  const queue = Array.isArray(data[STORAGE_KEY_QUEUE]) ? data[STORAGE_KEY_QUEUE] : [];
  if (queue.length === 0) return;

  const apiKey = (data.buddy_api_key || data.buddy_jwt_token || '').trim();
  const apiUrl = (data.buddy_api_url || DEFAULT_API_URL).replace(/\/+$/, '');
  if (!apiKey) return;

  const remainingQueue = [...queue];

  while (remainingQueue.length > 0) {
    const item = remainingQueue[0];
    const headers = { 'Content-Type': 'application/json' };

    if (apiKey.startsWith('udemy_track_live_')) {
      headers['x-api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const res = await fetch(`${apiUrl}/progress/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseName: item.courseName,
          completedLectures: item.completedLectures,
          totalLectures: item.totalLectures,
          clientTimestamp: item.clientTimestamp || item.queuedAt
        })
      });

      if (res.ok || (res.status >= 400 && res.status < 500)) {
        remainingQueue.shift();
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  await chrome.storage.local.set({
    [STORAGE_KEY_QUEUE]: remainingQueue
  });

  if (remainingQueue.length === 0) {
    const sync = await chrome.storage.local.get(['buddy_sync_data']);
    if (sync.buddy_sync_data?.status === 'offline_queued') {
      await chrome.storage.local.set({
        buddy_sync_data: {
          ...sync.buddy_sync_data,
          status: 'success',
          lastSyncAt: new Date().toISOString()
        }
      });
    }
  }
}
