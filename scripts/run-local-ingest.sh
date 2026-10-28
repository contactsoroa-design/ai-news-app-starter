#!/usr/bin/env bash
# LaunchAgent 用。Desktop 配下は macOS TCC で node/npm が読めないため、
# ローカル実行せず GitHub Actions の ingest ワークフローを起動する。
#
# 認証はキーチェーンの `gh auth` に依存しない。
# ~/Library/Application Support/ai-news-ingest/github_token に
# fine-grained / classic PAT（workflow 起動権限）を置けば、画面ロック中でも動く。
set -euo pipefail

cd "$HOME"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

REPO="${AI_NEWS_INGEST_REPO:-contactsoroa-design/ai-news-app-starter}"
WORKFLOW="${AI_NEWS_INGEST_WORKFLOW:-Ingest AI news (JA+EN)}"
SUPPORT="${AI_NEWS_INGEST_SUPPORT:-$HOME/Library/Application Support/ai-news-ingest}"
TOKEN_FILE="${AI_NEWS_INGEST_TOKEN_FILE:-$SUPPORT/github_token}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh が見つかりません（GitHub CLI をインストールしてください）" >&2
  exit 1
fi

# LaunchAgent はキーチェーンを読めないことが多いので、ファイルの PAT を優先する
if [[ -f "$TOKEN_FILE" ]]; then
  # 末尾改行だけ除去（PAT 本体は触らない）
  GH_TOKEN="$(tr -d '\r\n' <"$TOKEN_FILE")"
  if [[ -z "$GH_TOKEN" ]]; then
    echo "トークンファイルが空です: $TOKEN_FILE" >&2
    exit 1
  fi
  export GH_TOKEN
  export GH_PROMPT_DISABLED=1
elif ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "認証がありません。" >&2
  echo "一度だけ PAT を用意してください:" >&2
  echo "  1) https://github.com/settings/tokens で token（repo + workflow）を作成" >&2
  echo "  2) 有効期限は No expiration または長めを推奨" >&2
  echo "  3) 次を実行:" >&2
  echo "     mkdir -p \"$SUPPORT\" && chmod 700 \"$SUPPORT\"" >&2
  echo "     pbpaste > \"$TOKEN_FILE\" && chmod 600 \"$TOKEN_FILE\"" >&2
  echo "（対話ログイン gh auth login は LaunchAgent では切れやすいです）" >&2
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] dispatch workflow: $WORKFLOW ($REPO)"
gh workflow run "$WORKFLOW" --repo "$REPO"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] dispatched"
