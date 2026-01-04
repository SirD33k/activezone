@echo off
echo ============================================
echo   Active Zone Hub - Build & Preview
echo ============================================
echo.
echo Building production version...
echo.
cd /d "%~dp0"
call npm run build
echo.
echo ============================================
echo Build complete! Starting preview server...
echo ============================================
echo.
call npm run preview
pause
