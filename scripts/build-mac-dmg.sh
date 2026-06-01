#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="AvatarLink Companion Studio"
BUNDLE_NAME="$APP_NAME.app"
ARTIFACTS_DIR="$ROOT/artifacts/macos"
STAGE_DIR="$ARTIFACTS_DIR/dmg-stage"
APP_DIR="$STAGE_DIR/$BUNDLE_NAME"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
APP_ROOT="$RESOURCES_DIR/app"
BIN_DIR="$APP_ROOT/bin"
DMG_PATH="$ARTIFACTS_DIR/avatarlink-companion-studio-mac.dmg"
README_PATH="$STAGE_DIR/README.txt"
STATUS_DOC="$ROOT/docs/MAC_DMG_PACKAGING.md"

rm -rf "$STAGE_DIR"
mkdir -p "$MACOS_DIR" "$APP_ROOT" "$BIN_DIR" "$ARTIFACTS_DIR"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>avatarlink-companion-studio</string>
  <key>CFBundleIdentifier</key>
  <string>com.avatarlink.companionstudio</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>AvatarLink Companion Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/avatarlink-companion-studio" <<'SH'
#!/bin/bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
NODE_BIN="$APP_DIR/bin/node"
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node || true)"
fi
if [[ -z "$NODE_BIN" ]]; then
  osascript -e 'display alert "AvatarLink Companion Studio" message "Node.js runtime not found inside the app bundle or on this Mac." as critical'
  exit 1
fi
export PATH="/usr/local/bin:${PATH}"
exec "$NODE_BIN" "$APP_DIR/scripts/local-app-launcher.mjs"
SH
chmod +x "$MACOS_DIR/avatarlink-companion-studio"

cp -R "$ROOT/dist" "$APP_ROOT/"
cp -R "$ROOT/public" "$APP_ROOT/"
mkdir -p "$APP_ROOT/scripts" "$APP_ROOT/artifacts"
cp "$ROOT/scripts/gemini-proxy.mjs" "$APP_ROOT/scripts/"
cp "$ROOT/scripts/local-app-launcher.mjs" "$APP_ROOT/scripts/"
cp "$ROOT/package.json" "$APP_ROOT/"
[[ -f "$ROOT/.env.example" ]] && cp "$ROOT/.env.example" "$APP_ROOT/" || true
[[ -f "$STATUS_DOC" ]] && cp "$STATUS_DOC" "$APP_ROOT/" || true
cp /usr/local/bin/node "$BIN_DIR/node"
chmod +x "$BIN_DIR/node"

cat > "$README_PATH" <<EOF
AvatarLink Companion Studio Mac package

What this DMG contains:
- $BUNDLE_NAME

How to use:
1. Drag $BUNDLE_NAME into /Applications or another writable folder.
2. Launch it.
3. The app starts a local static server and keeps the AI safe proxy on port 8787.
4. It opens the browser to the local app URL automatically.

Notes:
- Secrets are not bundled. For live GitHub Models/TTS proxy access on a new Mac, add a suitable .env.local next to the bundled app resources or configure the original project checkout.
- Launcher log: ~/Library/Logs/AvatarLink Companion Studio/launcher.log
- Packaging doc copied into the bundle resources when available.
EOF
ln -s /Applications "$STAGE_DIR/Applications"

rm -f "$DMG_PATH"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE_DIR" -ov -format UDZO "$DMG_PATH" >/tmp/avatarlink-hdiutil-create.log
printf '%s\n' "$DMG_PATH"
