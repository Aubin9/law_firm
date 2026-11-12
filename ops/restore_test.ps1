# ==============================================================================
# Firm Practice Management Platform - Windows Restore Verification (Step 20)
# ==============================================================================

param(
    [string]$BackupDir = "var\backups\lawfirm",
    [string]$TestDb = "lawfirm_restore_test",
    [string]$PostgresUser = "postgres",
    [string]$PostgresHost = "localhost",
    [int]$PostgresPort = 5432
)

$ErrorActionPreference = "Stop"

Write-Host "=== Starting Automated Restore Test ===" -ForegroundColor Cyan

$LatestDump = Get-ChildItem -Path $BackupDir -Filter "db_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $LatestDump) {
    Write-Error "No dump file found in $BackupDir. Run ops\backup.ps1 first."
}

Write-Host "--> Found latest dump: $($LatestDump.FullName)"
$env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }

# Recreate test database
Write-Host "--> Recreating test database: $TestDb..."
& psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -c "DROP DATABASE IF EXISTS $TestDb;" -c "CREATE DATABASE $TestDb;" | Out-Null

$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "--> Restoring database from dump..."
& pg_restore -h $PostgresHost -p $PostgresPort -U $PostgresUser -d $TestDb --no-owner $LatestDump.FullName

$Stopwatch.Stop()
$ElapsedSeconds = [int]$Stopwatch.Elapsed.TotalSeconds

Write-Host "--> Restore finished in $ElapsedSeconds seconds." -ForegroundColor Green

# Verify row counts
$UserCount = & psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d $TestDb -t -A -c 'SELECT count(*) FROM "User";'
Write-Host "--> Verification: $UserCount users restored."

# Cleanup
& psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -c "DROP DATABASE IF EXISTS $TestDb;" | Out-Null
Write-Host "=== Restore test passed in ${ElapsedSeconds}s ===" -ForegroundColor Green

