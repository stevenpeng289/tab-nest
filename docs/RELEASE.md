# Release Checklist

Use this checklist when publishing a GitHub Release that users can download and install manually.

## 1. Prepare The Extension Zip

```bash
bash scripts/package-extension.sh
```

The script reads the version from `extension/manifest.json` and creates:

```text
dist/tab-nest-v<version>.zip
```

For the current `manifest.json`, the expected package is:

```text
dist/tab-nest-v1.2.0.zip
```

## 2. Create A GitHub Release

1. Open `https://github.com/Acorn2/tab-nest/releases/new`.
2. Create a tag such as `v1.2.0`.
3. Use a release title such as `TabNest v1.2.0`.
4. Upload the generated zip from `dist/`.
5. Publish the release.

Suggested release notes:

```markdown
## TabNest v1.2.0

Manual install package for TabNest.

### Install

1. Download `tab-nest-v1.2.0.zip`.
2. Unzip it.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the unzipped folder.
```

## 3. Update Repository About

GitHub repository sidebar suggestions:

- **Description**: `A local-first Chrome new tab workspace for tabs, bookmarks, and restorable sessions.`
- **Website**: GitHub Pages URL, if enabled.
- **Topics**:
  - `chrome-extension`
  - `manifest-v3`
  - `new-tab`
  - `tab-manager`
  - `bookmarks`
  - `productivity`
  - `local-first`
