@echo off
echo ========================================
echo Starting Active Zone Hub Servers
echo ========================================
echo.
echo Starting Backend Server (Port 3001)...
start "Backend Server" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul

echo Starting Frontend Server (Port 5173)...
start "Frontend Server" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo Servers Started!
echo ========================================
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press any key to open the store page...
pause >nul
start http://localhost:5173/store.html
