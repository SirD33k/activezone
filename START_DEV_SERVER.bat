@echo off
echo ============================================
echo   Active Zone Hub - Development Server
echo ============================================
echo.
echo Starting development server...
echo Please wait...
echo.
cd /d "%~dp0"
call npm run dev
pause
