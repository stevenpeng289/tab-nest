#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/extension/manifest.json"
VERSION="$(grep -E '"version":' "$MANIFEST" | sed -E 's/.*"version": "([^"]+)".*/\1/')"
OUT_DIR="$ROOT_DIR/dist"
ZIP_NAME="tab-nest-v${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/$ZIP_NAME"

(
  cd "$ROOT_DIR/extension"
  zip -r "$OUT_DIR/$ZIP_NAME" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "config.local.js"
)

echo "$OUT_DIR/$ZIP_NAME"
