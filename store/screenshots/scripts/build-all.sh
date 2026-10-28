#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
python3 render-store-html.py
python3 compose-store-preview.py
echo "done → ../submit/ja と ../submit/en"
ls -1 ../submit/ja ../submit/en
