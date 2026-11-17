# German Teacher: set up (or update) the app on Windows with one command.
#
# Paste this into PowerShell or Command Prompt:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm https://raw.githubusercontent.com/kkinnit-o8/german-teacher/HEAD/setup.ps1 | iex"
#
# What it does:
#   1. installs Node.js (LTS) and Git with winget, if they are missing,
#   2. downloads the app to %USERPROFILE%\german-teacher, or updates it if it is already there,
#   3. runs start.cmd, which puts a "German Teacher" shortcut on the desktop, asks for your
#      OpenRouter key (the first time), builds the app and opens it in your browser.
# Run the same command again to update the app. Your progress and key are kept.
#
# Works in Windows PowerShell 5.1. It is run with Invoke-Expression, so it must not call exit.
# Keep this file ASCII-only.

& {
  $repo = 'https://github.com/kkinnit-o8/german-teacher.git'
  $dir = Join-Path $env:USERPROFILE 'german-teacher'

  function Say([string]$text) { Write-Host (' ' + $text) }
  function Fail([string]$text) { Write-Host ''; Write-Host (' ' + $text) -ForegroundColor Red }
  function Has([string]$cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
  function Update-PathFromWindows {
    # programs installed just now are only on the PATH of new windows; read it again
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  function NodeIsOk {
    if (-not (Has 'node')) { return $false }
    try { return ([version]((& node -v).Trim().TrimStart('v')) -ge [version]'20.9') } catch { return $false }
  }
  function Install-Program([string]$id, [string]$name, [string]$url) {
    if (-not (Has 'winget')) {
      Fail ($name + ' is needed, and winget (which installs it) is not available on this computer.')
      Say ('Install ' + $name + ' from ' + $url + ' with the default options, then run this command again.')
      return
    }
    Write-Host ''
    Say ('Installing ' + $name + '. Windows may ask for permission: click Yes.')
    winget install --id $id --exact --source winget --accept-package-agreements --accept-source-agreements
    Update-PathFromWindows
  }

  Write-Host ''
  Write-Host ' German Teacher setup' -ForegroundColor Cyan
  Write-Host ''

  if ($env:OS -ne 'Windows_NT') {
    Fail 'This setup is for Windows. On other systems, see the README (For developers).'
    return
  }

  # 1. Node.js and Git
  if (-not (NodeIsOk)) { Install-Program 'OpenJS.NodeJS.LTS' 'Node.js' 'https://nodejs.org' }
  if (-not (NodeIsOk)) {
    Fail 'Node.js 20.9 or newer is not available in this window yet.'
    Say 'If it was just installed: close this window, open a new one and paste the command again.'
    return
  }
  if (-not (Has 'git')) { Install-Program 'Git.Git' 'Git' 'https://git-scm.com/download/win' }
  if (-not (Has 'git')) {
    Fail 'Git is not available in this window yet.'
    Say 'If it was just installed: close this window, open a new one and paste the command again.'
    return
  }
  Say ('Node.js ' + (& node -v) + ' and ' + (& git --version) + ' are ready.')

  # 2. Download or update the app
  Write-Host ''
  if (Test-Path -LiteralPath (Join-Path $dir '.git')) {
    Say ('Updating the app in ' + $dir)
    & git -C $dir pull --ff-only
    if ($LASTEXITCODE -ne 0) { Say 'Could not update (see the message above). Starting the version you have.' }
  } elseif (Test-Path -LiteralPath $dir) {
    Fail ('The folder ' + $dir + ' already exists, but this setup did not create it.')
    Say 'Rename or delete that folder (keep data\progress.sqlite and .env.local if you need them), then run this command again.'
    return
  } else {
    Say ('Downloading the app to ' + $dir)
    & git clone $repo $dir
    if ($LASTEXITCODE -ne 0) {
      Fail 'The download did not work (see the message above). Check your internet connection and run the command again.'
      return
    }
  }

  # 3. Start it: start.cmd makes the desktop shortcut, asks for the key, builds and opens the browser
  Write-Host ''
  Say 'Starting the app. The first start takes a few minutes.'
  Say 'Keep this window open while you use the app; close it to stop the app.'
  Say 'Next time, double-click "German Teacher" on your desktop.'
  Write-Host ''
  & (Join-Path $dir 'start.cmd')
}
