param(
    [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\\..')).Path
)

$ErrorActionPreference = 'Stop'
$dest = Join-Path ([Environment]::GetFolderPath('Desktop')) 'PromptBlueprint-opensource'

Write-Host "Source: $RepoRoot"
Write-Host "Desktop folder: $dest"

if (Test-Path $dest) {
    Remove-Item -LiteralPath $dest -Recurse -Force
}
New-Item -ItemType Directory -Path $dest | Out-Null

$dirs = @(
    'app',
    'components',
    'hooks',
    'services',
    'store',
    'db',
    'theme',
    'constants',
    'data',
    'plugins',
    'patches',
    'docs',
    'assets',
    'config',
    'scripts',
    'Plan.md'
)

foreach ($d in $dirs) {
    $from = Join-Path $RepoRoot $d
    if (Test-Path -LiteralPath $from) {
        Copy-Item -LiteralPath $from -Destination (Join-Path $dest $d) -Recurse -Force
    }
}

$files = @(
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'babel.config.js',
    'metro.config.js',
    'eslint.config.js',
    'app.config.ts',
    '.env.example',
    '.gitignore',
    'eas.json',
    'README.md',
    'OPTIMIZATIONS.md'
)

foreach ($f in $files) {
    $from = Join-Path $RepoRoot $f
    if (Test-Path -LiteralPath $from) {
        Copy-Item -LiteralPath $from -Destination (Join-Path $dest $f) -Force
    }
}

$vscodeDest = Join-Path $dest '.vscode'
New-Item -ItemType Directory -Path $vscodeDest -Force | Out-Null
$extSrc = Join-Path $RepoRoot '.vscode\extensions.json'
if (Test-Path -LiteralPath $extSrc) {
    Copy-Item -LiteralPath $extSrc -Destination (Join-Path $vscodeDest 'extensions.json') -Force
}

$templateApp = Join-Path $PSScriptRoot 'app.template.json'
Copy-Item -LiteralPath $templateApp -Destination (Join-Path $dest 'app.json') -Force

$note = Join-Path $PSScriptRoot 'OPEN_SOURCE_EXPORT.txt'
Copy-Item -LiteralPath $note -Destination (Join-Path $dest 'OPEN_SOURCE_EXPORT.txt') -Force

# Remove this export helper subtree from copied scripts so the bundle stays self-contained
$nestedExport = Join-Path $dest 'scripts\opensource-desktop-export'
if (Test-Path -LiteralPath $nestedExport) {
    Remove-Item -LiteralPath $nestedExport -Recurse -Force
}

Write-Host 'Export complete.'
