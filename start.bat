@echo off
cd /d "%~dp0"

if not exist "node_modules" (
    echo running npm install...
    call npm install
    if errorlevel 1 (
        echo npm install failed
        pause
        exit /b 1
    )
)

call npm start

if exist "error.log" (
    echo --- error.log ---
    type error.log
    echo -----------------
    pause
)
