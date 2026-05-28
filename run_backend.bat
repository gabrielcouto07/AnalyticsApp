@echo off
echo.
echo ========================================
echo  Starting Analytics Dashboard Backend
echo  FastAPI on http://localhost:8000
echo ========================================
echo.

cd /d "%~dp0"

if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt -q

echo.
echo Starting FastAPI server...
echo API Docs: http://localhost:8000/docs
echo.

python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
