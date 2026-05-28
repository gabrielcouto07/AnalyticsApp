@echo off
echo.
echo ========================================
echo  Starting Analytics Dashboard (Streamlit)
echo  App on http://localhost:8501
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
echo Starting Streamlit server...
echo App: http://localhost:8501
echo.

streamlit run app.py
