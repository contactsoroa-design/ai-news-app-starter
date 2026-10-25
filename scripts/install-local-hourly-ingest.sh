#!/usr/bin/env bash
# 無料枠 Lite の手元自動収集（GitHub Actions の workflow スコープが無い間の代替）
# 毎時 0 分に npm run ingest を実行する LaunchAgent をインストールする
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.soroa.ainews.ingest"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$ROOT/tmp/ingest-logs"
NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>${NPM_BIN}</string>
    <string>run</string>
    <string>ingest</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}"
echo "Installed ${PLIST}"
echo "Hourly ingest at :00 using ${NPM_BIN} (cwd ${ROOT})"
echo "Logs: ${LOG_DIR}"
echo "Run once now: npm run ingest"
echo "Unload later: launchctl bootout gui/\$(id -u)/${LABEL}"
# silence unused
: "$NODE_BIN"
