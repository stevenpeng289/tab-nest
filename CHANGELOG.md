# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-25 16:21

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
