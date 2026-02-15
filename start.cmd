@echo off
REM Fairy 自動重啟包裝腳本 (Windows)
REM 當 Fairy 以 exit code 42 結束時，自動執行 npm install 並重新啟動

cd /d "%~dp0"

set RESTART_CODE=42

:loop
call npx tsx src/index.ts
set EXIT_CODE=%ERRORLEVEL%

if "%EXIT_CODE%"=="%RESTART_CODE%" (
    echo [Fairy] 偵測到程式碼變更，正在重新啟動…
    call npm install --silent 2>nul
    timeout /t 1 /nobreak >nul
    goto loop
)

echo [Fairy] 結束，exit code: %EXIT_CODE%
exit /b %EXIT_CODE%
