// Udemy Buddy Tracker — Hardened Content Script
// Resilient DOM Parsing (ARIA/Data attributes), Throttled MutationObserver (2s), Offline Queueing with Exponential Backoff

(function () {
  console.log(
    '%c[Udemy Buddy Tracker]%c Hardened content script initialized.',
    'color: #8b5cf6; font-weight: bold;',
    'color: inherit;'
  );

  const DEBOUNCE_DELAY_MS = 2000; // 2-second debounce to prevent CPU spikes & API thrashing
  const DEFAULT_API_URL = 'http://localhost:5000/api';
  const BASE_BACKOFF_MS = 2000;
  const MAX_BACKOFF_MS = 60000;
  const STORAGE_KEY_QUEUE = 'buddy_offline_queue';

  let debounceTimer = null;
  let isSyncInProgress = false;
  let lastSyncedSignature = '';
  let retryAttempt = 0;
  let retryTimer = null;
  let activeObserver = null;
  let currentObservedTarget = null;

  /**
   * 1. Resilient Course Info Extraction
   * Relies on URL slugs, semantic H1 tags, and data attributes instead of transient hashed classes.
   */
  function extractCourseInfo() {
    try {
      const pathname = window.location.pathname;

      // Extract slug from /course/<course-slug>/...
      const slugMatch = pathname.match(/\/course\/([^/]+)/i);
      const slug = slugMatch ? slugMatch[1] : '';

      // Format slug into clean title fallback
      const formattedSlugTitle = slug
        ? slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        : '';

      // Look for course title using data attributes and semantic heading elements
      const titleSelectors = [
        '[data-purpose="header-title"]',
        '[data-purpose="course-header-title"]',
        '[data-purpose="course-title"]',
        'header h1',
        'main h1',
        '[role="heading"][aria-level="1"]',
        'h1'
      ];

      let courseTitle = '';
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 1) {
          courseTitle = el.textContent.trim();
          break;
        }
      }

      // Final fallback to cleaned document title
      if (!courseTitle) {
        courseTitle = formattedSlugTitle || document.title.replace(/ \| Udemy.*$/i, '').trim();
      }

      return {
        courseName: courseTitle || 'Udemy Course',
        slug
      };
    } catch (err) {
      console.warn('[Udemy Buddy Tracker] Error extracting course info:', err.message);
      return { courseName: 'Udemy Course', slug: '' };
    }
  }

  /**
   * 2. Resilient DOM Parsing for Lecture Progress
   * Prioritizes ARIA attributes, input[type="checkbox"], and data-purpose attributes.
   * Completely avoids transient randomized CSS module class names.
   */
  function detectLectureProgress() {
    try {
      // -------------------------------------------------------------------
      // Strategy A: Progress Summary Containers (Header / Popover)
      // Extracts exact counts like "42 of 100 complete" or "42 / 100 items"
      // -------------------------------------------------------------------
      const summarySelectors = [
        '[data-purpose*="course-progress"]',
        '[data-purpose*="progress-popover"]',
        '[data-purpose="progress-tracker"]',
        '[role="progressbar"]',
        '[aria-label*="progress" i]',
        '[aria-label*="complete" i]',
        '[aria-label*="completed" i]'
      ];

      for (const selector of summarySelectors) {
        const containers = document.querySelectorAll(selector);
        for (const el of containers) {
          const textSources = [
            el.getAttribute('aria-label') || '',
            el.innerText || '',
            el.textContent || ''
          ];

          for (const text of textSources) {
            // Matches "42 of 100", "42 / 100", "42 of 100 complete", etc.
            const match = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
            if (match) {
              const completed = parseInt(match[1], 10);
              const total = parseInt(match[2], 10);
              if (total > 0 && completed <= total) {
                return {
                  completedLectures: completed,
                  totalLectures: total,
                  source: 'aria-progress-summary'
                };
              }
            }
          }

          // Check ARIA numeric properties if present (e.g. aria-valuenow="42" aria-valuemax="100")
          const valueNow = el.getAttribute('aria-valuenow');
          const valueMax = el.getAttribute('aria-valuemax');
          if (valueNow !== null && valueMax !== null) {
            const completed = parseInt(valueNow, 10);
            const total = parseInt(valueMax, 10);
            if (!isNaN(completed) && !isNaN(total) && total > 0 && completed <= total) {
              return {
                completedLectures: completed,
                totalLectures: total,
                source: 'aria-progressbar-values'
              };
            }
          }
        }
      }

      // -------------------------------------------------------------------
      // Strategy B: Curriculum Sidebar Input & ARIA Checkboxes
      // Finds checkboxes representing course items in the curriculum sidebar
      // -------------------------------------------------------------------
      const sidebarContainer = getCurriculumSidebar() || document.body;
      const checkboxElements = sidebarContainer.querySelectorAll(
        'input[type="checkbox"], [role="checkbox"]'
      );

      // Filter to checkboxes that appear inside lecture rows (ignoring autoplay/settings toggles)
      const lectureCheckboxes = Array.from(checkboxElements).filter((cb) => {
        // Exclude settings/autoplay/volume checkboxes if any
        const ariaLabel = (cb.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes('autoplay') || ariaLabel.includes('setting')) {
          return false;
        }
        return true;
      });

      if (lectureCheckboxes.length > 0) {
        const total = lectureCheckboxes.length;
        const completed = lectureCheckboxes.filter((cb) => {
          return (
            cb.checked === true ||
            cb.getAttribute('aria-checked') === 'true' ||
            cb.closest('[aria-checked="true"]') !== null
          );
        }).length;

        if (total > 0 && completed <= total) {
          return {
            completedLectures: completed,
            totalLectures: total,
            source: 'aria-curriculum-checkboxes'
          };
        }
      }

      // -------------------------------------------------------------------
      // Strategy C: ARIA Lecture Items / Listitems
      // Identifies lecture items and checks for completed badges/icons
      // -------------------------------------------------------------------
      const lectureItems = sidebarContainer.querySelectorAll(
        '[data-purpose*="curriculum-item"], [data-purpose*="lecture-item"], [role="listitem"][aria-label*="lecture" i]'
      );

      if (lectureItems.length > 0) {
        let completed = 0;
        for (const item of lectureItems) {
          const isCompleted =
            item.getAttribute('aria-checked') === 'true' ||
            (item.getAttribute('aria-label') || '').toLowerCase().includes('completed') ||
            item.querySelector('[data-purpose*="completed"]') !== null ||
            item.querySelector('[aria-label*="completed" i]') !== null;

          if (isCompleted) {
            completed++;
          }
        }

        return {
          completedLectures: completed,
          totalLectures: lectureItems.length,
          source: 'aria-lecture-items'
        };
      }

      // -------------------------------------------------------------------
      // Strategy D: Fallback - DOM Selectors Failed
      // Non-intrusively warn and notify popup without throwing or crashing
      // -------------------------------------------------------------------
      console.warn(
        '%c[Udemy Buddy Tracker]%c Unable to detect course lectures. Udemy DOM layout may have changed.',
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );

      notifyDomWarning();
      return null;
    } catch (err) {
      console.warn('[Udemy Buddy Tracker] Unexpected error in detectLectureProgress:', err.message);
      return null;
    }
  }

  /**
   * Helper to find curriculum sidebar element
   */
  function getCurriculumSidebar() {
    return document.querySelector(
      '[data-purpose*="curriculum-sidebar"], ' +
      '[data-purpose*="course-content-sidebar"], ' +
      '[data-purpose*="curriculum-section"], ' +
      '[role="region"][aria-label*="course content" i], ' +
      '[role="region"][aria-label*="curriculum" i], ' +
      'aside, ' +
      'nav[aria-label*="course" i]'
    );
  }

  /**
   * Notify extension popup if DOM detection fails
   */
  async function notifyDomWarning() {
    try {
      const { courseName } = extractCourseInfo();
      await chrome.storage.local.set({
        buddy_sync_data: {
          courseName,
          completedLectures: null,
          totalLectures: null,
          lastSyncAt: new Date().toISOString(),
          status: 'dom_detection_failed',
          warning: 'Could not detect lecture checklist in page DOM'
        }
      });
    } catch {
      // Ignore extension context invalidated errors during reload
    }
  }

  /**
   * 3. Offline Queueing & Exponential Backoff Re-sync
   */

  // Add failed payload to chrome.storage.local queue
  async function enqueueOfflinePayload(payload) {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY_QUEUE]);
      const queue = Array.isArray(data[STORAGE_KEY_QUEUE]) ? data[STORAGE_KEY_QUEUE] : [];

      // Coalesce updates: if an entry for this course already exists, replace with newer payload
      const existingIdx = queue.findIndex(
        (item) => item.courseName === payload.courseName
      );

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

      console.warn(
        `%c[Udemy Buddy Tracker]%c Queued progress update offline (${queue.length} item(s) in queue). Will retry when online.`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
    } catch (err) {
      console.error('[Udemy Buddy Tracker] Failed to enqueue offline payload:', err.message);
    }
  }

  // Attempt to process queued offline payloads with exponential backoff
  async function flushOfflineQueue() {
    if (!navigator.onLine) {
      console.log('[Udemy Buddy Tracker] Device is offline. Postponing queue flush.');
      return;
    }

    try {
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

      console.log(
        `%c[Udemy Buddy Tracker]%c Flushing offline queue (${queue.length} payload(s))...`,
        'color: #8b5cf6; font-weight: bold;',
        'color: inherit;'
      );

      const remainingQueue = [...queue];

      while (remainingQueue.length > 0) {
        const item = remainingQueue[0];
        const headers = {
          'Content-Type': 'application/json'
        };

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

          if (res.ok) {
            remainingQueue.shift(); // Successfully synced, remove from queue
            retryAttempt = 0; // Reset backoff on success
          } else if (res.status >= 400 && res.status < 500) {
            // Client error (e.g. invalid key or validation). Remove to prevent infinite queue loop.
            remainingQueue.shift();
            break;
          } else {
            // Server error (5xx). Trigger backoff retry.
            throw new Error(`Server returned status ${res.status}`);
          }
        } catch (fetchErr) {
          // Network failure or server down. Schedule exponential backoff retry.
          retryAttempt++;
          const backoffDelay = Math.min(
            MAX_BACKOFF_MS,
            BASE_BACKOFF_MS * Math.pow(2, retryAttempt)
          ) + Math.round(Math.random() * 1000);

          console.warn(
            `%c[Udemy Buddy Tracker]%c Retry attempt ${retryAttempt} failed. Backing off for ${Math.round(backoffDelay / 1000)}s...`,
            'color: #f59e0b; font-weight: bold;',
            'color: inherit;'
          );

          clearTimeout(retryTimer);
          retryTimer = setTimeout(flushOfflineQueue, backoffDelay);

          await chrome.storage.local.set({
            [STORAGE_KEY_QUEUE]: remainingQueue,
            buddy_sync_data: {
              courseName: item.courseName,
              completedLectures: item.completedLectures,
              totalLectures: item.totalLectures,
              lastSyncAt: new Date().toISOString(),
              status: 'retrying',
              nextRetrySec: Math.round(backoffDelay / 1000)
            }
          });
          return;
        }
      }

      // All items flushed successfully
      await chrome.storage.local.set({
        [STORAGE_KEY_QUEUE]: [],
        buddy_sync_data: {
          status: 'success',
          lastSyncAt: new Date().toISOString()
        }
      });

      console.log(
        '%c[Udemy Buddy Tracker]%c All queued offline updates successfully synchronized!',
        'color: #10b981; font-weight: bold;',
        'color: inherit;'
      );
    } catch (err) {
      console.error('[Udemy Buddy Tracker] Error during queue flush:', err.message);
    }
  }

  /**
   * 4. Synchronize Detected Progress with Backend API
   */
  async function syncProgressWithBackend() {
    if (isSyncInProgress) return;

    const { courseName, slug } = extractCourseInfo();
    const progress = detectLectureProgress();

    if (!progress || progress.totalLectures === 0) {
      return;
    }

    const { completedLectures, totalLectures, source } = progress;
    const currentSignature = `${slug || courseName}:${completedLectures}:${totalLectures}`;

    // Safeguard 1: Do not send duplicate requests if progress has not changed
    if (currentSignature === lastSyncedSignature) {
      return;
    }

    // Retrieve API key and API URL from chrome.storage.local
    const { buddy_api_key, buddy_jwt_token, buddy_api_url } = await chrome.storage.local.get([
      'buddy_api_key',
      'buddy_jwt_token',
      'buddy_api_url'
    ]);

    const apiKey = (buddy_api_key || buddy_jwt_token || '').trim();
    const apiUrl = (buddy_api_url || DEFAULT_API_URL).replace(/\/+$/, '');

    if (!apiKey) {
      console.warn(
        '%c[Udemy Buddy Tracker]%c No extension API key found. Open extension popup to configure your key.',
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
      await chrome.storage.local.set({
        buddy_sync_data: {
          courseName,
          completedLectures,
          totalLectures,
          lastSyncAt: new Date().toISOString(),
          status: 'missing_token'
        }
      });
      return;
    }

    const payload = {
      courseName,
      courseSlug: slug,
      udemyCourseId: slug,
      completedLectures,
      totalLectures,
      clientTimestamp: new Date().toISOString()
    };

    // If browser is currently offline, enqueue immediately without fetch attempt
    if (!navigator.onLine) {
      await enqueueOfflinePayload(payload);
      return;
    }

    isSyncInProgress = true;
    console.log(
      `%c[Udemy Buddy Tracker]%c Syncing progress for "${courseName}": ${completedLectures}/${totalLectures} lectures (${source})`,
      'color: #8b5cf6; font-weight: bold;',
      'color: inherit;'
    );

    try {
      // Primary: Delegate fetch to background service worker (bypasses page CSP and mixed-content restrictions)
      let syncedSuccessfully = false;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const bgRes = await chrome.runtime.sendMessage({
            action: 'SYNC_PROGRESS',
            payload
          });
          if (bgRes && bgRes.success) {
            syncedSuccessfully = true;
            lastSyncedSignature = currentSignature;
            console.log(
              '%c[Udemy Buddy Tracker]%c Successfully synced with backend via background worker!',
              'color: #10b981; font-weight: bold;',
              'color: inherit;',
              bgRes.data
            );
          }
        } catch (msgErr) {
          console.warn('[Udemy Buddy Tracker] Background worker message failed, falling back to direct fetch:', msgErr.message);
        }
      }

      if (!syncedSuccessfully) {
        // Fallback: Direct fetch
        const headers = {
          'Content-Type': 'application/json'
        };

        if (apiKey.startsWith('udemy_track_live_')) {
          headers['x-api-key'] = apiKey;
        } else {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${apiUrl}/progress/sync`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          lastSyncedSignature = currentSignature;
          console.log(
            '%c[Udemy Buddy Tracker]%c Successfully synced with backend!',
            'color: #10b981; font-weight: bold;',
            'color: inherit;',
            data
          );

          await chrome.storage.local.set({
            buddy_sync_data: {
              courseName,
              completedLectures,
              totalLectures,
              lastSyncAt: new Date().toISOString(),
              status: 'success'
            }
          });

          // Also check if any older offline queue items need flushing
          flushOfflineQueue();
        } else {
          // If server 5xx error, enqueue for offline retry
          if (response.status >= 500) {
            console.warn('[Udemy Buddy Tracker] Server unavailable (5xx). Enqueueing payload.');
            await enqueueOfflinePayload(payload);
          } else {
            console.error(
              '%c[Udemy Buddy Tracker]%c Backend rejected sync:',
              'color: #ef4444; font-weight: bold;',
              'color: inherit;',
              data.message || response.statusText
            );

            await chrome.storage.local.set({
              buddy_sync_data: {
                courseName,
                completedLectures,
                totalLectures,
                lastSyncAt: new Date().toISOString(),
                status: 'error',
                error: data.message || response.statusText
              }
            });
          }
        }
      }
    } catch (err) {
      // Network drop, timeout, or DNS failure: enqueue in offline queue
      console.warn(
        '%c[Udemy Buddy Tracker]%c Network error during sync. Enqueueing payload for re-sync when online.',
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;',
        err.message
      );
      await enqueueOfflinePayload(payload);
    } finally {
      isSyncInProgress = false;
    }
  }

  /**
   * 5. Throttled Debounce Trigger (2000ms)
   */
  function triggerDebouncedSync() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncProgressWithBackend();
    }, DEBOUNCE_DELAY_MS);
  }

  /**
   * 6. Scoped MutationObserver for Curriculum Sidebar
   * Observes the curriculum drawer rather than full document.body to avoid video playback CPU spikes.
   */
  function attachCurriculumObserver() {
    const sidebar = getCurriculumSidebar();
    const target = sidebar || document.body;

    // Avoid duplicate re-attachment to the same node
    if (activeObserver && currentObservedTarget === target) {
      return;
    }

    if (activeObserver) {
      activeObserver.disconnect();
    }

    activeObserver = new MutationObserver((mutations) => {
      let shouldTrigger = false;

      for (const mutation of mutations) {
        // Performance guard: completely ignore mutations from video/audio players
        const targetNode = mutation.target;
        if (
          targetNode &&
          (targetNode.nodeName === 'VIDEO' ||
            targetNode.nodeName === 'AUDIO' ||
            (targetNode.className && String(targetNode.className).includes('vjs-')) ||
            targetNode.closest?.('video, [data-purpose*="video-player"]'))
        ) {
          continue;
        }

        // Relevant DOM mutations: checkboxes toggled or items expanded
        if (mutation.type === 'attributes') {
          const attr = mutation.attributeName;
          if (attr === 'aria-checked' || attr === 'checked' || attr === 'aria-label') {
            shouldTrigger = true;
            break;
          }
        } else if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.matches?.('input[type="checkbox"], [role="checkbox"], [data-purpose*="curriculum"]') ||
                node.querySelector?.('input[type="checkbox"], [role="checkbox"]')
              ) {
                shouldTrigger = true;
                break;
              }
            }
          }
          if (shouldTrigger) break;
        }
      }

      if (shouldTrigger) {
        triggerDebouncedSync();
      }

      // If we were observing document.body and sidebar just mounted, re-scope to sidebar!
      if (!sidebar && getCurriculumSidebar()) {
        attachCurriculumObserver();
      }
    });

    activeObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked', 'checked', 'aria-label']
    });

    currentObservedTarget = target;
  }

  // 7. Event Listeners for Network Status
  window.addEventListener('online', () => {
    console.log(
      '%c[Udemy Buddy Tracker]%c Network online. Attempting re-sync of queued updates...',
      'color: #10b981; font-weight: bold;',
      'color: inherit;'
    );
    retryAttempt = 0;
    flushOfflineQueue();
  });

  window.addEventListener('offline', () => {
    console.warn(
      '%c[Udemy Buddy Tracker]%c Network offline. Progress updates will be queued locally.',
      'color: #f59e0b; font-weight: bold;',
      'color: inherit;'
    );
  });

  // 8. Lifecycle Initialization
  // Initial sync once DOM is ready
  setTimeout(() => {
    attachCurriculumObserver();
    syncProgressWithBackend();
    flushOfflineQueue();
  }, 1500);

  // SPA Route Transition Listener (polls for URL changes across lectures)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSyncedSignature = ''; // Reset signature for newly navigated course
      attachCurriculumObserver();
      triggerDebouncedSync();
    }
  }, 1000);
})();
