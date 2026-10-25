#!/bin/bash
# AIニュース専用 iOS TestFlight ビルド & App Store Connect 提出
# ※ Compath（life_Design_Simulator）とは別アプリ・別 Bundle ID・別 EAS プロジェクト
set -euo pipefail
cd "$(dirname "$0")/.."
unset CI
export EAS_NO_VCS=1
export EAS_PROJECT_ROOT="$(pwd)"
export EXPO_NO_CAPABILITY_SYNC="${EXPO_NO_CAPABILITY_SYNC:-1}"

if [[ -x /Library/Developer/CommandLineTools/usr/bin/git ]]; then
  export PATH="/Library/Developer/CommandLineTools/usr/bin:$PATH"
fi

if command -v eas >/dev/null 2>&1; then
  EAS=(eas)
elif [[ -x ./node_modules/.bin/eas ]]; then
  EAS=(./node_modules/.bin/eas)
else
  EAS=(npx --yes eas-cli@24.12.0)
fi

BUNDLE="$(node -e "const c=require('./app.json'); console.log(c.expo.ios.bundleIdentifier)")"
PROJECT_ID="$(node -e "const c=require('./app.json'); console.log(c.expo.extra?.eas?.projectId||'')")"
VER="$(node -e "const c=require('./app.json'); console.log(c.expo.version+'/'+c.expo.ios.buildNumber)")"

if [[ "${BUNDLE}" == "com.compath.app" ]] || [[ "${BUNDLE}" == *"compath"* ]]; then
  echo "ERROR: Bundle ID が Compath のままです (${BUNDLE})。app.json を確認してください。"
  exit 1
fi
if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: EAS projectId が未設定です。先に 'eas init' で専用プロジェクトを作成してください。"
  exit 1
fi

echo "=== AIニュース iOS → TestFlight 提出 ==="
echo "  app:     AIニュース"
echo "  bundle:  ${BUNDLE}"
echo "  project: ${PROJECT_ID}"
echo "  version: ${VER}"

"${EAS[@]}" whoami

echo "1) EAS iOS production ビルドを開始します..."
"${EAS[@]}" build --platform ios --profile production --non-interactive

BUILD_ID="$("${EAS[@]}" build:list --platform ios --limit 1 --non-interactive --json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const s=d.indexOf('[');const j=JSON.parse(s>=0?d.slice(s):d);console.log(j[0]?.id||'')})")"
if [[ -z "${BUILD_ID}" ]]; then
  echo "ERROR: BUILD_ID empty"
  exit 1
fi
echo "BUILD_ID=${BUILD_ID}"

echo "2) App Store Connect (TestFlight) へ提出します..."
echo "   ※ 初回は App Store Connect に com.soroa.ainews の新規アプリが必要です"
set +e
"${EAS[@]}" submit --platform ios --id "${BUILD_ID}" --profile production --non-interactive --verbose
SUBMIT_RC=$?
set -e

LIST="$("${EAS[@]}" submit:list --platform ios --limit 3 --non-interactive 2>&1 || true)"
echo "$LIST"

if [[ "$SUBMIT_RC" -ne 0 ]]; then
  echo "ERROR: submit failed (rc=$SUBMIT_RC)"
  exit 1
fi

echo "=== 完了 (${VER} TestFlight 提出済み) ==="
