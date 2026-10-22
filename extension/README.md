# 🧩 Udemy Buddy Tracker — Chrome Extension (Manifest V3)

A Manifest V3 Google Chrome extension that automatically detects and synchronizes your completed Udemy course lectures with the **BuddyTracker** Express backend in real time.

---

## 📂 Extension File Structure

```
extension/
├── manifest.json       # Manifest V3 compliant configuration
├── content.js          # Content script with DOM observer & debounced sync
├── popup/
│   ├── popup.html      # Token configuration & live sync status popup
│   └── popup.js        # Storage & token validation logic
└── icons/
    ├── icon-16.png     # 16x16 pixel icon
    ├── icon-48.png     # 48x48 pixel icon
    └── icon-128.png    # 128x128 pixel icon
```

---

## ⚙️ Key Technical Features

1. **Manifest V3 Compliant & Scoped Security**:
   - `manifest_version: 3`
   - Permissions: `activeTab`, `storage`
   - Scoped `host_permissions`: `https://*.udemy.com/*` and `http://localhost:5000/*`
   - Authenticates via scoped API keys (`udemy_track_live_...`) hashed with SHA-256 on the backend, completely isolating master web session JWTs in HttpOnly cookies.

2. **Resilient DOM Parsing (Immune to Randomized CSS Modules)**:
   - Eliminates fragile class selectors (`.clp-lead__title`, `[class*="curriculum-item"]`).
   - Prioritizes robust **ARIA attributes** (`[aria-label*="progress" i]`, `[aria-label*="complete" i]`, `[aria-checked="true"]`, `[role="progressbar"]`, `[role="checkbox"]`).
   - Uses native `input[type="checkbox"]` and data attributes (`[data-purpose*="course-progress"]`, `[data-purpose*="curriculum-item"]`).
   - **Graceful Fallback**: If Udemy structure alters unexpectedly, logs a non-intrusive warning to `console.warn` and reports `status: 'dom_detection_failed'` to the popup badge without crashing the page script.

3. **Performance-Optimized MutationObserver (2s Throttling)**:
   - Scopes observation directly to the curriculum sidebar container rather than the entire `document.body`.
   - Filters out high-frequency video playback events (`<video>`, `.vjs-`, playhead ticks).
   - Enforces a **2-second debounce** (`DEBOUNCE_DELAY_MS = 2000`) to eliminate CPU spikes and API thrashing when expanding curriculum sections or autoplaying lectures.

4. **Offline Queueing & Exponential Backoff Re-sync**:
   - If network drops or the backend experiences downtime, sync payloads are coalesced and stored in `chrome.storage.local` under `buddy_offline_queue`.
   - Automatically listens for `online` network events to flush the queue.
   - Implements exponential backoff (`2s * 2^attempt`, capped at 60s) with jitter when retrying during intermittent outages.

5. **Popup Management UI & Status Feedback**:
   - Live status badges: `Synced` (green), `Queued (Offline)` (amber), `Retrying...` (amber), `DOM Warning` (red), `Key Needed` (red).
   - Custom API URL configuration (`http://localhost:5000/api` by default).
   - Test key connectivity against `/api/progress/sync/verify`.

---

## 🚀 How to Install & Use in Google Chrome

### Step 1: Load Unpacked in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. In the top-right corner, enable **Developer mode** toggle.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension` folder from this project:
   `a:\Projects\buddy-tracker\extension`
5. The **Udemy Buddy Tracker — Auto Progress Sync** extension will now appear in your toolbar.

---

### Step 2: Generate an Extension API Key from Dashboard
1. Open your web dashboard at `http://localhost:5173`.
2. Click your user profile in the top-right corner to open the **Security & Authentication** modal.
3. In the **Extension Keys** tab, enter a label (e.g. `Laptop Chrome`) and click **+ Generate Key**.
4. Copy the generated key (`udemy_track_live_...`).
   > *Security note: The key is stored as a SHA-256 hash in MongoDB and can be revoked at any time from your dashboard.*

---

### Step 3: Configure Your Extension
1. Click the **BuddyTracker** extension icon in your Chrome toolbar.
2. In the popup, paste your scoped API key into the input field.
3. Click **Test Key** to verify connectivity with the Express backend, then click **Save Settings**.

---

### Step 4: Browse Any Udemy Course
1. Go to any enrolled course on [Udemy.com](https://www.udemy.com/course/) and start watching a lecture.
2. As you finish lectures or check them off in the sidebar, the extension automatically extracts progress and synchronizes `{ courseName, completedLectures, totalLectures }` via `x-api-key` to `/api/progress/sync`!
3. Check your React dashboard at `http://localhost:5173` to see your progress update on the group leaderboard in real time!
