# scripts/dev.ps1 – DIPON PIM Electron Dev-Start (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "`n  DIPON PIM – Electron Dev`n" -ForegroundColor Cyan

# node_modules prüfen
if (-not (Test-Path "$root\node_modules")) {
    Write-Host "  ⚠  node_modules fehlt – Bootstrap wird ausgeführt ..." -ForegroundColor Yellow
    & "$PSScriptRoot\bootstrap.ps1"
}

# data/ sicherstellen
New-Item -ItemType Directory -Path "$root\data" -Force | Out-Null

Write-Host "  🚀 Starte Electron ..." -ForegroundColor Green
Write-Host "  Stoppen: Fenster schließen oder Ctrl+C`n" -ForegroundColor Gray

Set-Location $root
npx electron-vite dev
