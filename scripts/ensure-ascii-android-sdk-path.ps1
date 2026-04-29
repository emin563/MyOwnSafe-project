#Requires -Version 5.1
# Back-compat wrapper — use: npm run android:setup-sdk
& (Join-Path $PSScriptRoot 'setup-ascii-android-sdk.ps1') @args
exit $LASTEXITCODE
