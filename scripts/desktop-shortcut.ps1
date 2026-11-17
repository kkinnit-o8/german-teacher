# Puts a "German Teacher" shortcut (with the app's icon) on the desktop.
#
# start.cmd runs this when the app is started from a folder for the first time:
#   - no shortcut yet: create it (once; if you delete it, it stays deleted)
#   - the shortcut points to another folder (the app was moved): point it here
# add-to-desktop.cmd runs it with -Force to create the shortcut again.
#
# Works in Windows PowerShell 5.1. Keep this file ASCII-only.
param([switch]$Force)

$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$target = Join-Path $app 'start.cmd'
$marker = Join-Path $app '.desktop-shortcut'

try {
  # GetFolderPath also finds a desktop that OneDrive has moved
  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not $desktop) { throw 'Windows did not say where the desktop is.' }
  $lnk = Join-Path $desktop 'German Teacher.lnk'
  $shell = New-Object -ComObject WScript.Shell

  if (Test-Path -LiteralPath $lnk) {
    $needed = $Force -or ($shell.CreateShortcut($lnk).TargetPath -ne $target)
    $verb = 'updated'
  } else {
    $needed = $Force -or -not (Test-Path -LiteralPath $marker)
    $verb = 'created'
  }

  if ($needed) {
    $s = $shell.CreateShortcut($lnk)
    $s.TargetPath = $target
    $s.WorkingDirectory = $app
    $s.IconLocation = (Join-Path $app 'public\icon.ico') + ',0'
    $s.Description = 'Learn German every day'
    $s.Save()
    Write-Host ''
    Write-Host (' Desktop shortcut ' + $verb + ': ' + $lnk)
    Write-Host ' From now on, double-click "German Teacher" on your desktop to start the app.'
    Write-Host ''
  }
} catch {
  Write-Host ''
  Write-Host (' Could not put a shortcut on the desktop: ' + $_.Exception.Message)
  Write-Host ' You can still start the app with start.cmd.'
  Write-Host ''
  if ($Force) { exit 1 }
  exit 0
}

# remember the folder, so start.cmd can skip this script on later starts
try { Set-Content -LiteralPath $marker -Value $app -Encoding ASCII } catch { }
exit 0
