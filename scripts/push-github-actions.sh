#!/usr/bin/env bash
# GitHub Actions 用 workflow を push するために workflow スコープを付与してから push する
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Requesting GitHub OAuth scopes: repo, workflow ..."
gh auth refresh -h github.com -s repo,workflow,read:org

echo "Pushing main (includes .github/workflows/ingest.yml) ..."
git push -u origin main

echo "Triggering workflow_dispatch ..."
gh workflow run "Ingest AI news (JA+EN)" --repo contactsoroa-design/ai-news-app-starter
echo "Watch: gh run list --repo contactsoroa-design/ai-news-app-starter --workflow=ingest.yml -L 5"
