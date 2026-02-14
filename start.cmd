@echo off
REM Fairy 自動重啟包裝腳本 (Windows)
REM 當 Fairy 以 exit code 42 結束時，自動執行 npm install 並重新啟動

cd /d "%~dp0"

set RESTART_CODE=42

REM 啟動時更新 git submodules
echo [Fairy] 更新 git submodules…
git submodule update --init --recursive 2>nul
git submodule foreach --recursive "git pull origin HEAD" 2>nul
if %ERRORLEVEL%==0 (
    echo [Fairy] Git submodules 已更新至最新
) else (
    echo [Fairy] Git submodules 更新時發生問題（可能沒有 submodule 或網路問題）
)

:loop
call npx tsx src/index.ts
set EXIT_CODE=%ERRORLEVEL%

if "%EXIT_CODE%"=="%RESTART_CODE%" (
    echo [Fairy] 偵測到程式碼變更，正在重新啟動…
    call npm install --silent 2>nul
    echo [Fairy] 更新 git submodules…
    git submodule update --init --recursive 2>nul
    git submodule foreach --recursive "git pull origin HEAD" 2>nul
    timeout /t 1 /nobreak >nul
    goto loop
)

echo [Fairy] 結束，exit code: %EXIT_CODE%
exit /b %EXIT_CODE%
