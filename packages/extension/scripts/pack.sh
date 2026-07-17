#!/bin/zsh
# Package the extension for Chrome Web Store upload.
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -e "console.log(require('./manifest.json').version)")
mkdir -p ../../dist
zip -r "../../dist/dtd-extension-v$VERSION.zip" manifest.json popup.html popup.js options.html options.js setup.js icons -x "*.DS_Store" >/dev/null
echo "dist/dtd-extension-v$VERSION.zip"
