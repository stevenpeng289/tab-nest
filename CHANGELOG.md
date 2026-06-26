## [1.6.1] - 2026-06-26 09:16

### Added
- One-tap stash via the TabNest toolbar icon. Clicking the extension icon in the Chrome toolbar now stashes every real web tab in the current window as a new session, closes those tabs, and lands the user on the TabNest new tab page where the new session is already visible. Implemented in `extension/background.js` via `chrome.action.onClicked`. The toolbar click is a no-op if the current window has no real web tabs.
- Added a one-tap `Save current tabs as tab group` button on the open-tabs homepage header so users can save the current browser window’s tabs directly without first stashing them as a session.

### Changed
- Moved saved sessions from the old floating right-side panel onto the homepage as dedicated sections so they are visible without opening a separate panel.
- Removed dead floating-session-panel code and the unused sessions-viewed-count storage/listener path from `extension/app.js`.
- The homepage `Save as tab group` action now packs all existing sessions into one new tab-group session with unique URLs only, and restored sessions open in the current browser window instead of spawning a new window.
- Raised the pack-button gate from "2+ sessions" to "1+ session" so a single recent session can also be saved as a tab group.
- Switched the quick-link shortcut tooltip behavior to match the existing save-for-later button style: text is only shown on hover/focus, not always occupying space.

### Fixed
- Fixed a homepage layout break caused by the work-session heading block being closed too early, which left the new pack button outside the header and could distort the section layout.
- Added the missing work-sessions empty-state element in `extension/index.html` so the section can show its empty state instead of depending on missing markup.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-06-25 18:00

### Fixed
- Custom background image silently failed to render even though storage write succeeded and the "更换图片 / 恢复默认" buttons updated. Root cause: `applyBackgroundSelection` set `--custom-background-image` via `document.body.style.setProperty`, but Chrome caps inline `style` attributes at ~1-2MB; a 3.5MB data URL was rejected silently, so `body::before` never saw the value. The data URL is now injected through a dedicated `<style id="customBackgroundStyle">` element, which has a much higher ceiling. The bug surfaced as "I picked an image and nothing changed" while the storage and modal UI both looked correct.

### Changed
- `exportBackgroundCanvas` no longer returns the largest (last) candidate when every encoding attempt exceeds `MAX_BACKGROUND_STORAGE_LENGTH`. It now returns the smallest candidate, so oversized images come as close to fitting as possible before `prepareBackgroundImage` surfaces `background-too-large`.

### Added
- `console.error` diagnostics in the background image change handler and `saveBackgroundPreference` so the next time something fails, the console shows the file size, MIME type, final data URL size, and storage error reason instead of a bare `console.warn`. The success path also logs the data URL length.

## [1.5.0] - 2026-06-25 17:31

### Added
- One-tap stash via the toolbar icon. Clicking the TabNest toolbar icon now stashes every real web tab in the current window as a new session, closes those tabs, and lands the user on the TabNest new tab page where the new session is already visible. Implemented in `background.js` via `chrome.action.onClicked`. The toolbar click is a no-op if the current window has no real web tabs.

## [1.4.0] - 2026-06-25 17:24

### Added
- New "Tab groups" section on the homepage (between Quick links and Bookmark board) that lists every `sourceType: "tab-group"` session as a full-width card with its complete tab list. Each row shows favicon + title + a one-tap "open this single tab" button, plus a "Restore all" action. Empty state is hidden when no tab groups exist.

### Changed
- The floating sessions panel no longer renders tab-group sessions. Tab groups are now a first-class homepage section so their full tab list is visible. The pack button still counts every session when deciding whether it can run.

### Added
- New "Save as tab group" action on the sessions panel that packs every existing session into one new session tagged `sourceType: "tab-group"` (unique URLs only, blocked local/internal tabs filtered out). Tab group sessions get a blue "标签组 / Tab group" badge and stay separate from pinned sessions.

### Changed
- Lowered the pack button's gate from "at least 2 sessions" to "at least 1 session" so a single session (e.g. the most recent one) can be saved straight into a tab group, matching OneTab-style "save all tabs". The pack button now always has a blue tint to set it apart from the neutral close button.


## [1.2.4] - 2026-06-25 16:10

### Changed
- "Restore session" no longer spawns a new browser window. Every tab is now reopened via `chrome.tabs.create` in the current window so the user stays where they were.

## [1.2.3] - 2026-06-25 15:57

### Changed
- Removed the unused custom tooltip system in `app.js` (overlapping mouseover/mouseout listeners, dead globals, and helpers) that was left over from earlier iterations. The pin shortcut now relies solely on the native `title` attribute, matching the save-for-later button.

### Fixed
- Restored the missing `.chip-pin:hover` style (a v1.2.2 follow-up that was never committed) so the pin shortcut keeps its accent hover color.

## [1.2.2] - 2026-06-25 15:18

### Added
- Added an easier way to save an open tab as a quick link directly from the open tabs list and window view, so users no longer have to manually retype the page title and URL.

## [1.2.1] - 2026-06-25 14:35

### Fixed
- Restored sessions no longer fail when the saved session includes local `file://` tabs or other internal URLs that Chrome prevents TabNest from opening in Manifest V3.
- Session restore now skips unsupported local/internal tabs and continues restoring the remaining web tabs, then shows a clearer success toast with the restored and skipped counts.
