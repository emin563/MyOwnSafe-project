#Requires -Version 5.1
<#
  Launches a local Android Virtual Device using the same SDK that Gradle/Expo use.
  Resolves SDK from: ANDROID_HOME, ANDROID_SDK_ROOT, android\local.properties (sdk.dir), then %LOCALAPPDATA%\Android\Sdk.

  Examples:
    npm run android:emulator
    npm run android:emulator:host
    .\\scripts\\start-android-emulator.ps1 -Name "Pixel_7_API_35"
#>
param(
  [string]$Name,
  [string]$Avd,
  [ValidateSet('host', 'swiftshader', 'swiftshader_indirect', 'angle_indirect', 'auto')]
  [string]$Gpu = 'auto',
  [switch]$WipeData,
  [switch]$NoAccel
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent

function Get-AndroidHome {
  if ($env:ANDROID_HOME) {
    if (Test-Path -LiteralPath $env:ANDROID_HOME) { return (Get-Item -LiteralPath $env:ANDROID_HOME).FullName }
  }
  if ($env:ANDROID_SDK_ROOT) {
    if (Test-Path -LiteralPath $env:ANDROID_SDK_ROOT) { return (Get-Item -LiteralPath $env:ANDROID_SDK_ROOT).FullName }
  }
  $lp = Join-Path $repoRoot 'android\local.properties'
  if (Test-Path -LiteralPath $lp) {
    $raw = Get-Content -LiteralPath $lp -Raw -ErrorAction SilentlyContinue
    if ($raw -and $raw -match 'sdk\.dir\s*=\s*(\S+)') {
      $p = $Matches[1].Trim() -replace '/', '\'
      if (Test-Path -LiteralPath $p) { return (Get-Item -LiteralPath $p).FullName }
    }
  }
  $def = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path -LiteralPath $def) { return (Get-Item -LiteralPath $def).FullName }
  throw 'Set ANDROID_HOME to your Android SDK, or set sdk.dir in android\local.properties (e.g. after npm run android:setup-sdk).'
}

$sdk = Get-AndroidHome
$emu = Join-Path $sdk 'emulator\emulator.exe'
if (-not (Test-Path -LiteralPath $emu)) {
  throw "emulator.exe not found in $emu. Install the Android Emulator package in Android Studio (SDK Manager)."
}

$target = $Name
if (-not $target) { $target = $Avd }
if (-not $target) { $target = $env:EXPO_AVD_NAME }

if (-not $target) {
  $all = & $emu -list-avds 2>&1 | ForEach-Object { if ($null -ne $_) { $_.ToString().Trim() } } | Where-Object { $_ -ne '' -and $_ -notmatch '^(INFO|WARNING|ERROR)' }
  if (-not $all -or $all.Count -lt 1) {
    throw 'No AVDs found. In Android Studio: More Actions > Virtual Device Manager > Create device.'
  }
  $target = $all[0]
  Write-Host "No -Name: using first AVD: $target"
} else {
  Write-Host "Using AVD: $target"
}

$emuArgs = [string[]]@('-avd', $target)
if ($WipeData) { $emuArgs += '-wipe-data' }
if ($NoAccel) {
  $emuArgs += '-no-accel'
} elseif ($Gpu -ne 'auto') {
  $g = if ($Gpu -eq 'swiftshader') { 'swiftshader_indirect' } else { $Gpu }
  $emuArgs += @('-gpu', $g)
}

Write-Host "emulator: $emu"
Write-Host "args: $($emuArgs -join ' ')"

& $emu $emuArgs
exit $LASTEXITCODE
