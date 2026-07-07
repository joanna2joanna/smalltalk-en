#!/bin/bash
# 批量补生成缺失的 Small Talk PNG
# 用法：
#   bash gen-catchup.sh          # 自动扫描 HTML 无对应 PNG 的日期
#   bash gen-catchup.sh 2026-06-07 2026-06-08  # 指定日期

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GEN_SCRIPT="$SCRIPT_DIR/gen-png.js"
OUT="$SCRIPT_DIR/issues"
NODE_BIN="/Users/joanna/.workbuddy/binaries/node/versions/22.12.0/bin/node"
export NODE_PATH="/Users/joanna/.workbuddy/binaries/node/workspace/node_modules"

if [ $# -gt 0 ]; then
  for date in "$@"; do
    html="$OUT/${date}-small-talk.html"
    png="$OUT/${date}-small-talk.png"
    if [ ! -f "$html" ]; then
      echo "⚠️  HTML not found for $date, skipping."
      continue
    fi
    echo "📸 Generating PNG for $date..."
    cd "$SCRIPT_DIR" && "$NODE_BIN" gen-png.js "$date"
    if [ -f "$png" ]; then
      echo "  ✅ $png"
    else
      echo "  ❌ Failed for $date"
    fi
  done
else
  echo "🔍 Scanning for HTML files without PNG..."
  for html in "$OUT"/*-small-talk.html; do
    [ -f "$html" ] || continue
    base=$(basename "$html" .html)
    date="${base%-small-talk}"
    png="$OUT/${base}.png"
    if [ ! -f "$png" ]; then
      echo "  → Missing PNG for $date, generating..."
      cd "$SCRIPT_DIR" && "$NODE_BIN" gen-png.js "$date"
      if [ -f "$png" ]; then
        echo "    ✅ Saved"
      else
        echo "    ❌ Failed"
      fi
    fi
  done
fi

echo "✅ Done."
