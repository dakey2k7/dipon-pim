# scripts/bootstrap.ps1 – DIPON PIM Ersteinrichtung (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "`n  DIPON PIM – Bootstrap`n" -ForegroundColor Cyan

# Node.js prüfen
try { $v = node --version; Write-Host "  ✓ Node.js $v" -ForegroundColor Green }
catch { Write-Host "  ✗ Node.js fehlt → https://nodejs.org" -ForegroundColor Red; exit 1 }

# data/ anlegen
New-Item -ItemType Directory -Path "$root\data" -Force | Out-Null
Write-Host "  ✓ data/ Verzeichnis" -ForegroundColor Green

# npm install
Write-Host "  ⚙  npm install (kann 2-3 Min dauern) ..." -ForegroundColor Yellow
Set-Location $root
npm install

Write-Host "`n  ✅ Fertig! Starten mit:" -ForegroundColor Green
Write-Host "     .\scripts\dev.ps1`n" -ForegroundColor White
