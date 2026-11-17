@echo off
rem German Teacher: double-click this file to start the app.
setlocal
cd /d "%~dp0"
title German Teacher

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo.
  echo  1. Go to https://nodejs.org and download the "LTS" version for Windows.
  echo  2. Run the installer and keep the default options.
  echo  3. Double-click start.cmd again.
  echo.
  pause
  exit /b 1
)

node scripts\start.mjs
if errorlevel 1 (
  echo.
  echo  The app could not start. Read the message above.
  echo  If you need help, copy the text in this window.
  echo.
  pause
  exit /b 1
)
endlocal
