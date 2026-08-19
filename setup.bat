@echo off
echo ============================================
echo  PhishVision AI - Setup Script
echo ============================================
echo.

echo [1/4] Installing Python backend dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed. Make sure Python 3.9+ is installed.
    pause & exit /b 1
)

echo.
echo [2/4] Installing Playwright browsers (for screenshots)...
python -m playwright install chromium
if errorlevel 1 (
    echo WARNING: Playwright install failed. Screenshot capture will be disabled.
)

echo.
echo [3/4] Installing Node.js frontend dependencies...
cd ..\frontend
npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Make sure Node.js 18+ is installed.
    pause & exit /b 1
)

cd ..
echo.
echo [4/4] Setup complete!
echo.
echo ============================================
echo  To start PhishVision:
echo  1. Backend:  cd backend && python main.py
echo  2. Frontend: cd frontend && npm run dev
echo  3. Open:     http://localhost:5173
echo ============================================
pause
