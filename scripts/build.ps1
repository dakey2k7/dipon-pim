# scripts/build.ps1 – DIPON PIM Production Build + Windows Installer
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "`n  DIPON PIM – Production Build`n" -ForegroundColor Cyan

Set-Location $root

Write-Host "  [1/2] electron-vite build ..." -ForegroundColor Yellow
npx electron-vite build
Write-Host "        ✓ out/ erstellt" -ForegroundColor Green

Write-Host "  [2/2] electron-builder (Windows NSIS Installer) ..." -ForegroundColor Yellow
npx electron-builder --win --x64
Write-Host "        ✓ release/ erstellt" -ForegroundColor Green

Write-Host "`n  ✅ Build abgeschlossen!" -ForegroundColor Green
Write-Host "     Installer: release\DIPON PIM Setup*.exe`n" -ForegroundColor White
