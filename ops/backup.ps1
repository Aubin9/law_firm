# ==============================================================================
# Firm Practice Management Platform - Windows Automated Backup (Step 20)
# ==============================================================================

param(
    [string]$BackupDir = "var\backups\lawfirm",
    [string]$PostgresDb = "lawfirm_db",
    [string]$PostgresUser = "postgres",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432
)

$ErrorActionPreference = "Stop"
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$DumpFile = Join-Path $BackupDir "db_${PostgresDb}_${Timestamp}.dump"

Write-Host "=== Starting Automated Backup for ${PostgresDb} ===" -ForegroundColor Cyan

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }

Write-Host "--> Running pg_dump to ${DumpFile}..."
& pg_dump -h $PostgresHost -p $PostgresPort -U $PostgresUser -F c -b -f $DumpFile $PostgresDb

if ($LASTEXITCODE -eq 0 -and (Test-Path $DumpFile)) {
    $FileSize = (Get-Item $DumpFile).Length
    $Hash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash
    Write-Host "    Backup complete: $DumpFile ($FileSize bytes, SHA-256: $Hash)" -ForegroundColor Green
} else {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
}

