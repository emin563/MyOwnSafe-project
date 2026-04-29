#Requires -Version 5.1
<#
  One-shot setup for NDK/CMake on Windows with non-ASCII usernames (e.g. ş in the profile path):
  1) Chooses a destination with an all-ASCII path (sibling to repo, .expo-ascii-sdk in repo, C:\Android\Sdk, Public\, D:\, or EXPO_ASCII_ANDROID_SDK)
  2) Copies the existing SDK from %LOCALAPPDATA%\Android\Sdk with robocopy (skipped if dest already has platform-tools\adb)
  3) Sets User ANDROID_HOME and ANDROID_SDK_ROOT in Windows (persistent)
  4) Writes android\local.properties
  5) -Run : runs npx expo run:android (pass through extra args after -- in npm)

  Examples:
    npm run android:setup-sdk              # copy + env + local.properties only
    npm run android:expo                 # full: setup + expo run:android
    npm run android:expo -- --device     # with forwarded args
#>
param(
  [switch]$Run,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $repoRoot 'app.json'))) {
  throw "Run from project root (app.json not found in $repoRoot)"
}

$src = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path (Join-Path $src 'platform-tools\adb.exe'))) {
  throw "No Android SDK in $src. Install Android Studio / SDK first."
}

function New-DirSafe([string] $p) {
  if (-not (Test-Path -LiteralPath $p)) {
    $null = New-Item -ItemType Directory -Path $p -Force
  }
}

# Pick an all-ASCII destination that Java will not re-resolve to a Unicode profile path
$dest = $null
if ($env:EXPO_ASCII_ANDROID_SDK) {
  if (-not (Test-Path -LiteralPath $env:EXPO_ASCII_ANDROID_SDK)) {
    throw "EXPO_ASCII_ANDROID_SDK is set to a path that does not exist: $($env:EXPO_ASCII_ANDROID_SDK)"
  }
  $dest = (Resolve-Path -LiteralPath $env:EXPO_ASCII_ANDROID_SDK).Path
  Write-Host "Using EXPO_ASCII_ANDROID_SDK: $dest"
}

if (-not $dest) {
  $sibling = Join-Path (Split-Path -LiteralPath $repoRoot) 'ExpoAndroidSdk'
  $inRepo = Join-Path $repoRoot '.expo-ascii-sdk'
  $tried = @(
    $sibling,
    $inRepo,
    'C:\Android\Sdk',
    'C:\Users\Public\ExpoAndroidSdk',
    'D:\Android\Sdk'
  )
  foreach ($c in $tried) {
    if (-not $c) { continue }
    try {
      New-DirSafe $c
      $dest = (Resolve-Path -LiteralPath $c).Path
      Write-Host "Using destination: $dest"
      break
    } catch {
      Write-Warning "Could not use $c : $($_.Exception.Message)"
      continue
    }
  }
  if (-not $dest) {
    throw "Could not create any mirror folder (sibling: $sibling, or in-repo: $inRepo, or C:\Android\Sdk). Set EXPO_ASCII_ANDROID_SDK to an existing empty ASCII-only path you can write to, or run as Administrator if only C: root is blocked. Then re-run."
  }
}

# Copy SDK if the mirror is missing adb
$needCopy = -not (Test-Path (Join-Path $dest 'platform-tools\adb.exe'))
if ($needCopy) {
  Write-Warning "Copying Android SDK to ASCII path (can take 10+ minutes, ~5+ GB)..."
  Write-Host "  from: $src"
  Write-Host "  to:   $dest"
  if ((Get-ChildItem -Path $dest -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.' }).Count -gt 0) {
    Write-Warning "Destination is not empty; robocopy will merge/update."
  }
  & robocopy.exe $src $dest /E /R:1 /W:1 /MT:8 /NFL /NDL /NJH /NJS /NC /NS /NP
  $ec = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
  if ($ec -ge 8) { throw "robocopy failed with exit code $ec" }
  if (-not (Test-Path (Join-Path $dest 'platform-tools\adb.exe'))) { throw "Copy finished but platform-tools\adb.exe missing. Check free disk space and permissions." }
  Write-Host "Copy finished (robocopy exit $ec, 0-7 = success)"
} else {
  Write-Host "Destination already has platform-tools; skipping copy."
}

# Persist User environment (replaces any previous User ANDROID_HOME / ANDROID_SDK_ROOT)
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $dest, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $dest, 'User')
$env:ANDROID_HOME = $dest
$env:ANDROID_SDK_ROOT = $dest
$ndk = Get-ChildItem (Join-Path $dest 'ndk') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($ndk) {
  $env:ANDROID_NDK = $ndk.FullName
  $env:ANDROID_NDK_HOME = $ndk.FullName
}

# Project local
$fd = $dest -replace '\\', '/'
$lp = "sdk.dir=$fd"
$propPath = Join-Path $repoRoot 'android\local.properties'
$lp | Set-Content -Path $propPath -Encoding ascii
Write-Host "Wrote $propPath with $lp"
Write-Host "Set User environment ANDROID_HOME / ANDROID_SDK_ROOT to: $dest"

if ($Run) {
  Set-Location $repoRoot
  & (Join-Path $repoRoot 'android\gradlew.bat') --stop 2>$null | Out-Null
  if ($RemainingArgs -and $RemainingArgs.Count -gt 0) {
    & npx --yes expo run:android @RemainingArgs
  } else {
    & npx --yes expo run:android
  }
  exit $LASTEXITCODE
}

Write-Host "Done. In new terminals, ANDROID_HOME is already in User env; restart IDE/terminal to pick it up. To build+run in one step: npm run android:expo"
exit 0
