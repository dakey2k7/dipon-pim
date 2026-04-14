# scripts/web.ps1 – DIPON PIM im Browser öffnen (Web-Modus)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "`n  DIPON PIM – Web-Modus (Browser)`n" -ForegroundColor Cyan
Write-Host "  Server  → http://localhost:3001/api" -ForegroundColor Green
Write-Host "  Browser → http://localhost:5173" -ForegroundColor Green
Write-Host "  Stoppen → Ctrl+C`n" -ForegroundColor Gray

if (-not (Test-Path "$root\node_modules")) {
    Write-Host "  ⚠  Bootstrap läuft ..." -ForegroundColor Yellow
    & "$PSScriptRoot\bootstrap.ps1"
}

New-Item -ItemType Directory -Path "$root\data" -Force | Out-Null
Set-Location $root
npx concurrently -n "SERVER,CLIENT" -c "cyan,magenta" `
    "npx ts-node-dev --respawn --transpile-only --project server/tsconfig.json server/src/index.ts" `
    "npx vite --config vite.web.config.ts"
