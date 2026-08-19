@echo off
echo Starting PhishVision AI...
echo.

:: Start backend in a new window
start "PhishVision Backend" cmd /k "cd /d %~dp0backend && python main.py"

:: Wait 3 seconds for backend to start
timeout /t 3 /nobreak > nul

:: Start frontend in a new window
start "PhishVision Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend starting at http://localhost:8000
echo Frontend starting at http://localhost:5173
echo.
echo Press any key to close this window (servers will keep running)
pause
