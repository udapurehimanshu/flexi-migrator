@echo off
title Intellinum Flexi PWA Migrator Suite
echo ============================================================
echo   INTELLINUM FLEXI PERSONALIZATION MIGRATOR (SSH to PWA)
echo   Oracle WMS Cloud / LogFire Personalization Suite
echo ============================================================
echo.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [Notice] Node.js not detected in PATH.
  echo Launching client-side offline web application directly in your browser...
  start "" "%~dp0public\index.html"
  echo.
  echo Press any key to exit.
  pause >nul
  exit /b
)

echo Starting local migration server on http://localhost:3000 ...
start "" http://localhost:3000
node server.js
pause
