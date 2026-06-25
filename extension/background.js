/**
 * background.js — Service Worker for Badge Updates
 *
 * Chrome's "always-on" background script for TabNest.
 * Its only job: keep the toolbar badge showing the current open tab count.
 *
 * Since we no longer have a server, we query chrome.tabs directly.
 * The badge counts real web tabs (skipping chrome:// and extension pages).
 *
 * Color coding gives a quick at-a-glance health signal:
 *   Green  (#3d7a4a) → 1–10 tabs  (focused, manageable)
 *   Amber  (#b8892e) → 11–20 tabs (getting busy)
 *   Red    (#b35a5a) → 21+ tabs   (time to cull!)
 */

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not chrome://, not extension pages, not about:blank.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    // Don't show "0" — an empty badge is cleaner
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Update badge when the extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

// Update badge when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is opened
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is closed
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
updateBadge();

// ─── Quick stash: toolbar icon click → one-tap stash current window ────────

/**
 * quickStashCurrentWindow()
 *
 * Called from chrome.action.onClicked. Saves every real web tab in the
 * current window as a new tabSession, closes those tabs, and lands the
 * user on the TabNest new tab page so they can see the new session.
 *
 * Storage shape MUST stay in sync with normalizeTabSession() in app.js.
 * If you change one, change both.
 */
async function quickStashCurrentWindow(windowId) {
  if (!Number.isFinite(windowId)) return;

  const tabs = await chrome.tabs.query({ windowId });
  const realTabs = tabs.filter(t => {
    const url = (t.url || '').trim();
    if (!url) return false;
    if (url.startsWith('chrome://')) return false;
    if (url.startsWith('chrome-extension://')) return false;
    if (url.startsWith('about:')) return false;
    if (url.startsWith('edge://')) return false;
    if (url.startsWith('brave://')) return false;
    if (url.startsWith('file://')) return false;
    if (url.startsWith('devtools://')) return false;
    return true;
  });

  if (realTabs.length === 0) return;

  const nextSession = {
    id: `session-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceType: 'current-window',
    name: '',
    pinned: false,
    tabs: realTabs.map((t, i) => ({
      url: (t.url || '').trim(),
      title: (t.title || t.url || '').trim(),
      windowId: t.windowId,
      favIconUrl: (t.favIconUrl || '').trim(),
      order: Number.isFinite(t.index) ? t.index : i,
    })),
  };

  const { tabSessions = [] } = await chrome.storage.local.get('tabSessions');
  const next = Array.isArray(tabSessions) ? tabSessions : [];
  next.unshift(nextSession);
  await chrome.storage.local.set({ tabSessions: next });

  const tabIds = realTabs.map(t => t.id).filter(Number.isFinite);
  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }

  // Land on TabNest new tab page so the new session is visible.
  const newtabUrl = chrome.runtime.getURL('index.html');
  let existing = null;
  try {
    existing = await chrome.tabs.query({ url: newtabUrl, windowId });
  } catch {
    existing = [];
  }
  if (!existing || existing.length === 0) {
    try { existing = await chrome.tabs.query({ url: newtabUrl }); } catch { existing = []; }
  }
  if (existing && existing[0]) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== windowId) {
      try { await chrome.windows.update(existing[0].windowId, { focused: true }); } catch {}
    }
  } else {
    await chrome.tabs.create({ url: newtabUrl });
  }

  updateBadge();
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab || !Number.isFinite(tab.windowId)) return;
  quickStashCurrentWindow(tab.windowId).catch(err => {
    console.warn('[tab-nest] quick stash failed:', err);
  });
});
