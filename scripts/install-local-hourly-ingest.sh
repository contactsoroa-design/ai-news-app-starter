#!/usr/bin/env bash
# 20分おきに GitHub Actions の ingest を起動する LaunchAgent を（再）インストールする。
# （Desktop TCC 回避。実収集は Actions 側の secrets / vars を使う）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.soroa.ainews.ingest"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SUPPORT="$HOME/Library/Application Support/ai-news-ingest"
RUNNER_SRC="$ROOT/scripts/run-local-ingest.sh"
RUNNER_DST="$SUPPORT/run-local-ingest.sh"
LOG_DIR="$HOME/Library/Logs/ai-news-ingest"
REPO="${AI_NEWS_INGEST_REPO:-contactsoroa-design/ai-news-app-starter}"

mkdir -p "$SUPPORT" "$LOG_DIR" "$HOME/Library/LaunchAgents"
chmod +x "$RUNNER_SRC"
cp "$RUNNER_SRC" "$RUNNER_DST"
chmod +x "$RUNNER_DST"

# StartCalendarInterval を 0/20/40 分に分割（配列）
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${HOME}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>AI_NEWS_INGEST_REPO</key>
    <string>${REPO}</string>
    <key>AI_NEWS_INGEST_WORKFLOW</key>
    <string>Ingest AI news (JA+EN)</string>
    <key>AI_NEWS_INGEST_LOG_DIR</key>
    <string>${LOG_DIR}</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RUNNER_DST}</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
    <dict>
      <key>Minute</key>
      <integer>20</integer>
    </dict>
    <dict>
      <key>Minute</key>
      <integer>40</integer>
    </dict>
  </array>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/stderr.log</string>
</dict>
</plist>
EOF

UID_NUM="$(id -u)"
launchctl bootout "gui/${UID_NUM}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST"
launchctl enable "gui/${UID_NUM}/${LABEL}"

TOKEN_FILE="$SUPPORT/github_token"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo ""
  echo "【重要】毎回の gh auth は不要です。一度だけ PAT を置いてください。"
  echo "  1) https://github.com/settings/tokens で classic token を作成"
  echo "     権限: repo, workflow　／　有効期限: No expiration（推奨）"
  echo "  2) トークンをコピーしたあと:"
  echo "     pbpaste > \"$TOKEN_FILE\" && chmod 600 \"$TOKEN_FILE\""
  echo "  （キーチェーンの対話ログインは LaunchAgent だと切れやすいです）"
  echo ""
elif [[ "$(stat -f '%A' "$TOKEN_FILE" 2>/dev/null || echo '')" != "600" ]]; then
  chmod 600 "$TOKEN_FILE" 2>/dev/null || true
fi

echo "Installed ${PLIST}"
echo "Runner: ${RUNNER_DST}"
echo "Token:  ${TOKEN_FILE} ($([ -f "$TOKEN_FILE" ] && echo 'あり' || echo '未設定'))"
echo "Every 20 min (:00/:20/:40) → gh workflow run (repo ${REPO})"
echo "Also scheduled on GitHub Actions cron (*/20 UTC) — こちらは Mac 認証不要"
echo "Logs: ${LOG_DIR}"
echo "Test: launchctl kickstart -k gui/${UID_NUM}/${LABEL}"
echo "Unload: launchctl bootout gui/${UID_NUM}/${LABEL}"
