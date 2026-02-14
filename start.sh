#!/bin/bash
# Fairy 自動重啟包裝腳本
# 當 Fairy 以 exit code 42 結束時，自動執行 npm install 並重新啟動

cd "$(dirname "$0")"

RESTART_CODE=42

# 更新 git submodules
update_submodules() {
    echo "[Fairy] 更新 git submodules…"
    git submodule update --init --recursive 2>/dev/null
    git submodule foreach --recursive 'git pull origin HEAD' 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "[Fairy] Git submodules 已更新至最新"
    else
        echo "[Fairy] Git submodules 更新時發生問題（可能沒有 submodule 或網路問題）"
    fi
}

# 啟動時更新 submodules
update_submodules

while true; do
    npx tsx src/index.ts
    EXIT_CODE=$?

    if [ "$EXIT_CODE" -eq "$RESTART_CODE" ]; then
        echo "[Fairy] 偵測到程式碼變更，正在重新啟動…"
        npm install --silent 2>/dev/null
        update_submodules
        sleep 1
        continue
    fi

    echo "[Fairy] 結束，exit code: $EXIT_CODE"
    exit "$EXIT_CODE"
done
