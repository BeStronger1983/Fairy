#!/bin/bash
# Fairy 自動重啟包裝腳本
# 當 Fairy 以 exit code 42 結束時，自動執行 npm install 並重新啟動

cd "$(dirname "$0")"

RESTART_CODE=42

while true; do
    npx tsx src/index.ts
    EXIT_CODE=$?

    if [ "$EXIT_CODE" -eq "$RESTART_CODE" ]; then
        echo "[Fairy] 偵測到程式碼變更，正在重新啟動…"
        npm install --silent 2>/dev/null
        sleep 1
        continue
    fi

    echo "[Fairy] 結束，exit code: $EXIT_CODE"
    exit "$EXIT_CODE"
done
