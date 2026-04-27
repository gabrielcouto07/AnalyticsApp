@echo off
echo.
echo ========================================
echo  Starting Analytics Dashboard Frontend
echo  Next.js on http://localhost:3000
echo ========================================
echo.

cd /d "%~dp0\frontend"

if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting development server...
echo App: http://localhost:3000
echo.

npm run dev
