@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 20+ is required for Tuya EZ pairing. Install Node.js and run this file again.
 pause
 exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (echo npm not found. & pause & exit /b 1)
where py >nul 2>nul
if errorlevel 1 (echo Python 3 is required. & pause & exit /b 1)
if not exist "node_modules\@tuyapi\link\package.json" (
 echo Installing Wi-Fi EZ pairing module...
 call npm install --ignore-scripts --omit=dev --no-audit --no-fund
 if errorlevel 1 (echo Install failed. & pause & exit /b 1)
)
echo Opening M3 Max Wi-Fi setup in your browser...
start "" "http://127.0.0.1:8765/"
py -3 m3_wifi_local.py
pause
