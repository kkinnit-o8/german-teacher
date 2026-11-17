@echo off
rem Creates a "German Teacher" shortcut on your desktop that runs start.cmd.
setlocal
cd /d "%~dp0"
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'German Teacher.lnk'));" ^
  "$s.TargetPath = Join-Path $env:APPDIR 'start.cmd';" ^
  "$s.WorkingDirectory = $env:APPDIR;" ^
  "$s.IconLocation = (Join-Path $env:APPDIR 'public\icon.ico') + ',0';" ^
  "$s.Description = 'Learn German every day';" ^
  "$s.Save();" ^
  "Write-Host ('Shortcut created: ' + (Join-Path $desktop 'German Teacher.lnk'))"

if errorlevel 1 (
  echo.
  echo  Could not create the shortcut. You can still start the app with start.cmd.
)
echo.
pause
endlocal
