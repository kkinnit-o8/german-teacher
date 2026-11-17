@echo off
rem start.cmd already puts a "German Teacher" shortcut on your desktop the first time.
rem Run this if you deleted the shortcut and want it back.
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\desktop-shortcut.ps1" -Force
pause
endlocal
