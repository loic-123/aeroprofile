@echo off
REM Launch AeroProfile locally on Windows.
REM Usage: run_local.bat
REM
REM Prerequisites:
REM   pip install -e .
REM   cd frontend && npm install && npm run build

echo AeroProfile - lancement local
echo ==============================

if not exist "frontend\dist" (
    echo Build frontend...
    cd frontend
    call npm run build
    cd ..
)

echo.
echo Backend sur http://localhost:8000
echo Frontend: http://localhost:8000
echo API: http://localhost:8000/api/health
echo.
echo Ctrl+C pour arreter.
echo.

uvicorn aeroprofile.api.app:app --host 0.0.0.0 --port 8000 --reload
