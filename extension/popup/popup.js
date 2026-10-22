// Popup logic for managing scoped extension API key, backend URL, and viewing live sync status

const DEFAULT_API_URL = 'http://localhost:5000/api';

const elApiUrl = document.getElementById('api-url');
const elApiKey = document.getElementById('api-key') || document.getElementById('jwt-token');
const elBtnToggle = document.getElementById('btn-toggle-token');
const elBtnPaste = document.getElementById('btn-paste-token');
const elBtnTest = document.getElementById('btn-test-connection');
const elBtnSave = document.getElementById('btn-save');
const elMessage = document.getElementById('status-message');

const elSyncBadge = document.getElementById('sync-badge');
const elStatCourse = document.getElementById('stat-course');
const elStatLectures = document.getElementById('stat-lectures');
const elStatTime = document.getElementById('stat-time');

// Show user feedback banner
function showMessage(text, isError = false) {
  elMessage.textContent = text;
  elMessage.className = `message visible ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    elMessage.className = 'message';
  }, 4500);
}

// Format relative timestamp
function formatTime(isoString) {
  if (!isoString) return 'Never';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update UI with stored sync statistics
function updateSyncDisplay(syncData, queue = []) {
  if (!syncData || !syncData.courseName) {
    elSyncBadge.textContent = 'Standby';
    elSyncBadge.className = 'status-badge';
    elStatCourse.textContent = 'None detected';
    elStatLectures.textContent = '— / —';
    elStatTime.textContent = 'Never';
    return;
  }

  elStatCourse.textContent = syncData.courseName;
  elStatCourse.title = syncData.courseName;

  const completed = syncData.completedLectures;
  const total = syncData.totalLectures;
  if (typeof completed === 'number' && typeof total === 'number' && total > 0) {
    const pct = Math.round((completed / total) * 100);
    elStatLectures.textContent = `${completed} / ${total} (${pct}%)`;
  } else if (syncData.status === 'dom_detection_failed') {
    elStatLectures.textContent = 'Checklist not found';
  } else {
    elStatLectures.textContent = '— / —';
  }

  elStatTime.textContent = formatTime(syncData.lastSyncAt);

  // Status Badge handling for offline queue, retry, and DOM warnings
  if (syncData.status === 'success') {
    elSyncBadge.textContent = 'Synced';
    elSyncBadge.className = 'status-badge connected';
  } else if (syncData.status === 'offline_queued') {
    const count = syncData.queuedCount || queue.length || 1;
    elSyncBadge.textContent = `Queued (${count})`;
    elSyncBadge.className = 'status-badge syncing';
  } else if (syncData.status === 'retrying') {
    elSyncBadge.textContent = syncData.nextRetrySec ? `Retry in ${syncData.nextRetrySec}s` : 'Retrying...';
    elSyncBadge.className = 'status-badge syncing';
  } else if (syncData.status === 'dom_detection_failed') {
    elSyncBadge.textContent = 'DOM Warning';
    elSyncBadge.className = 'status-badge error';
  } else if (syncData.status === 'missing_token') {
    elSyncBadge.textContent = 'Key Needed';
    elSyncBadge.className = 'status-badge error';
  } else {
    elSyncBadge.textContent = 'Sync Error';
    elSyncBadge.className = 'status-badge error';
  }
}

// Load saved settings from chrome.storage.local
async function loadSettings() {
  const data = await chrome.storage.local.get([
    'buddy_api_url',
    'buddy_api_key',
    'buddy_jwt_token',
    'buddy_sync_data',
    'buddy_offline_queue'
  ]);

  elApiUrl.value = data.buddy_api_url || DEFAULT_API_URL;
  elApiKey.value = data.buddy_api_key || data.buddy_jwt_token || '';

  updateSyncDisplay(data.buddy_sync_data, data.buddy_offline_queue || []);

  const activeKey = data.buddy_api_key || data.buddy_jwt_token;
  if (activeKey && (!data.buddy_sync_data || data.buddy_sync_data.status === 'success')) {
    validateKeySilently(data.buddy_api_url || DEFAULT_API_URL, activeKey);
  }
}

// Test key validity with backend verify endpoint
async function validateKeySilently(baseUrl, key) {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const headers = {};
    if (key.trim().startsWith('udemy_track_live_')) {
      headers['x-api-key'] = key.trim();
    } else {
      headers['Authorization'] = `Bearer ${key.trim()}`;
    }

    const res = await fetch(`${cleanUrl}/progress/sync/verify`, { headers });

    if (res.ok) {
      const json = await res.json();
      const userName = json.data?.user?.name || 'Buddy';
      elSyncBadge.textContent = `Ready (${userName})`;
      elSyncBadge.className = 'status-badge connected';
    } else {
      elSyncBadge.textContent = 'Invalid Key';
      elSyncBadge.className = 'status-badge error';
    }
  } catch (err) {
    elSyncBadge.textContent = 'Server Offline';
    elSyncBadge.className = 'status-badge error';
  }
}

// Save credentials to chrome.storage.local
async function saveSettings() {
  const apiUrl = elApiUrl.value.trim() || DEFAULT_API_URL;
  const key = elApiKey.value.trim();

  await chrome.storage.local.set({
    buddy_api_url: apiUrl,
    buddy_api_key: key,
    buddy_jwt_token: key
  });

  showMessage('Extension settings saved successfully!');

  if (key) {
    await validateKeySilently(apiUrl, key);
  }
}

// Test connection button handler
async function testConnection() {
  const apiUrl = elApiUrl.value.trim() || DEFAULT_API_URL;
  const key = elApiKey.value.trim();

  if (!key) {
    showMessage('Please enter or paste your Extension API Key first.', true);
    return;
  }

  elSyncBadge.textContent = 'Testing...';
  elSyncBadge.className = 'status-badge syncing';

  try {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    const headers = {};
    if (key.startsWith('udemy_track_live_')) {
      headers['x-api-key'] = key;
    } else {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fetch(`${cleanUrl}/progress/sync/verify`, { headers });

    if (res.ok) {
      const json = await res.json();
      const userName = json.data?.user?.name || 'User';
      const keyLabel = json.data?.keyName ? ` [${json.data.keyName}]` : '';
      showMessage(`Connected successfully as ${userName}${keyLabel}!`);
      elSyncBadge.textContent = 'Connected';
      elSyncBadge.className = 'status-badge connected';
    } else {
      const errJson = await res.json().catch(() => ({}));
      showMessage(`Key verification failed: ${errJson.message || res.statusText}`, true);
      elSyncBadge.textContent = 'Unauthorized';
      elSyncBadge.className = 'status-badge error';
    }
  } catch (err) {
    showMessage(`Connection error: Cannot reach ${apiUrl}`, true);
    elSyncBadge.textContent = 'Offline';
    elSyncBadge.className = 'status-badge error';
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', loadSettings);

elBtnSave.addEventListener('click', saveSettings);
elBtnTest.addEventListener('click', testConnection);

elBtnToggle.addEventListener('click', () => {
  if (elApiKey.type === 'password') {
    elApiKey.type = 'text';
    elBtnToggle.textContent = 'Hide';
  } else {
    elApiKey.type = 'password';
    elBtnToggle.textContent = 'Show';
  }
});

elBtnPaste.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      elApiKey.value = text.trim();
      showMessage('API Key pasted from clipboard!');
    }
  } catch {
    showMessage('Unable to read clipboard. Please paste manually.', true);
  }
});

// Listen for live updates from content script
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.buddy_sync_data || changes.buddy_offline_queue)) {
    chrome.storage.local.get(['buddy_sync_data', 'buddy_offline_queue']).then((data) => {
      updateSyncDisplay(data.buddy_sync_data, data.buddy_offline_queue || []);
    });
  }
});
