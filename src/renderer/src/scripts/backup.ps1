# scripts/backup.ps1 – DIPON PIM Datenbank-Backup
$ErrorActionPreference = "Stop"
$root       = Split-Path -Parent $PSScriptRoot
$dataDir    = "$root\data"
$backupDir  = "$dataDir\backups"
$ts         = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupPath = "$backupDir\dipon-pim_$ts"

Write-Host "`n  DIPON PIM – Backup`n" -ForegroundColor Cyan

New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

# DB-Datei(en) sichern
@("dipon-pim.db","dipon-pim.db-wal","dipon-pim.db-shm") | ForEach-Object {
    $src = "$dataDir\$_"
    if (Test-Path $src) {
        Copy-Item $src $backupPath
        Write-Host "  ✓ $_ gesichert" -ForegroundColor Green
    }
}

# Backup-Info
@{ timestamp=$ts; version="1.0.0"; db_size_kb=if(Test-Path "$dataDir\dipon-pim.db"){
    [math]::Round((Get-Item "$dataDir\dipon-pim.db").Length/1KB,1)}else{0}
} | ConvertTo-Json | Set-Content "$backupPath\info.json"

# Rotation: max. 30 Backups behalten
$all = Get-ChildItem $backupDir -Directory | Sort-Object Name
if ($all.Count -gt 30) {
    $all | Select-Object -First ($all.Count - 30) | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force
        Write-Host "  🗑  Altes Backup gelöscht: $($_.Name)" -ForegroundColor Gray
    }
}

$count = (Get-ChildItem $backupDir -Directory).Count
Write-Host "`n  ✅ Backup erstellt: dipon-pim_$ts" -ForegroundColor Green
Write-Host "     Pfad:    $backupPath" -ForegroundColor Gray
Write-Host "     Gesamt:  $count Backups`n" -ForegroundColor Gray
