@echo off
echo ====================================================
echo   Active Zone Hub - Backend Server
echo ====================================================
echo.
echo Starting backend server on port 3001...
echo.
echo API Endpoints:
echo   http://localhost:3001/api/health    - Health check
echo   http://localhost:3001/api/login     - Member login
echo   http://localhost:3001/api/products  - Get products
echo   http://localhost:3001/api/purchase  - Purchase products
echo   http://localhost:3001/api/orders    - Create order
echo.
echo Press Ctrl+C to stop the server
echo ====================================================
echo.
node server.js
pause
