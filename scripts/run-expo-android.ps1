#Requires -Version 5.1
# Pass-through for: npm run android:expo-run -- <expo run:android args>
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'setup-ascii-android-sdk.ps1') -Run @args
exit $LASTEXITCODE
