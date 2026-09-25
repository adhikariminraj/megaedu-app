<#
.SYNOPSIS
  Applies pending Prisma migrations to the LOCAL development PostgreSQL database with psql.

.DESCRIPTION
  Prisma's schema engine cannot run on this Windows machine (Smart App Control), so
  `prisma migrate deploy` is not available locally (database-foundation decisions D1.a and
  C1). Migrations are generated and validated by .github/workflows/prisma-migrations.yml.
  This script applies the committed prisma/migrations/*/migration.sql files exactly as
  written and records each one in "_prisma_migrations" the way Prisma Migrate does, so the
  history stays compatible with `prisma migrate deploy` wherever the schema engine can run.

  For every migration folder, in ordinal name order:
    - already applied -> its recorded checksum must equal the file's SHA-256, otherwise STOP
    - pending         -> the migration and its history row are applied in ONE transaction
  It also stops on: a failed history row, a history row with no matching folder, a
  migration containing its own transaction control or CONCURRENTLY, or (with
  -ReferenceRows) any checksum that differs from what real Prisma recorded in CI.

  The password is read with a hidden prompt (or from PGPASSWORD if already set in this
  process) and removed from the environment when the script ends. It is never written
  anywhere.

.PARAMETER ReferenceRows
  prisma-migrations-rows.csv from the workflow artifact of the same commit. Every local
  migration must appear there with the same checksum before anything is applied.

.PARAMETER DryRun
  Only report what would be applied; change nothing.
#>
param(
  [string]$Database = "megaedu_dev",
  [string]$DbHost = "localhost",
  [int]$Port = 5432,
  [string]$User = "postgres",
  [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  [string]$ReferenceRows,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$migrationsDir = Join-Path $PSScriptRoot "migrations"

# Prisma 5.20's own definition of the history table (verified against the table
# `prisma migrate deploy` created in CI before first use).
$historyTableDdl = @'
CREATE TABLE "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);
'@

function Stop-Applier([string]$Message) { throw $Message }

function Invoke-Psql([string[]]$Arguments) {
  # psql writes notices to stderr; in Windows PowerShell 5.1 that must not be treated as
  # a terminating error, so the exit code is what decides success.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Psql -X -q -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $User -d $Database @Arguments 2>&1 |
      ForEach-Object { "$_" }
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($code -ne 0) { Stop-Applier ("psql exited with code $code`n" + ($output -join "`n")) }
  return $output
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding $false))
}

$ownsPassword = $false
$failed = $false
try {
  if (-not (Test-Path $Psql)) { Stop-Applier "psql not found at $Psql" }
  if (-not $env:PGPASSWORD) {
    $secure = Read-Host "PostgreSQL password for '$User'" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $ownsPassword = $true
  }
  $env:PGCLIENTENCODING = "UTF8"
  $env:PGOPTIONS = "-c client_min_messages=warning"

  # --- Local migrations ------------------------------------------------------------------
  [string[]]$names = @(Get-ChildItem -Path $migrationsDir -Directory | ForEach-Object { $_.Name })
  [Array]::Sort($names, [StringComparer]::Ordinal)
  if ($names.Count -eq 0) { Stop-Applier "no migration folders in $migrationsDir" }
  $local = [ordered]@{}
  foreach ($name in $names) {
    if ($name -notmatch '^[0-9A-Za-z_]+$') { Stop-Applier "unexpected migration folder name '$name'" }
    $file = Join-Path (Join-Path $migrationsDir $name) "migration.sql"
    if (-not (Test-Path $file)) { Stop-Applier "$name has no migration.sql" }
    if (Select-String -Path $file -Pattern '^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b' -Quiet) {
      Stop-Applier "$name contains its own transaction control"
    }
    if (Select-String -Path $file -Pattern 'CONCURRENTLY' -Quiet) { Stop-Applier "$name uses CONCURRENTLY, which cannot run in a transaction" }
    $local[$name] = [pscustomobject]@{ File = $file; Checksum = (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLowerInvariant() }
  }

  # --- Checksums must match what real Prisma recorded in CI ------------------------------
  if ($ReferenceRows) {
    $reference = @{}
    foreach ($row in (Import-Csv -Path $ReferenceRows)) { $reference[$row.migration_name] = $row.checksum }
    foreach ($name in $local.Keys) {
      if (-not $reference.ContainsKey($name)) { Stop-Applier "$name is not in the CI reference rows" }
      if ($reference[$name] -ne $local[$name].Checksum) { Stop-Applier "$name checksum differs from the CI reference" }
    }
    foreach ($name in $reference.Keys) {
      if (-not $local.Contains($name)) { Stop-Applier "CI reference has $name, which this checkout does not" }
    }
    Write-Host "Checksums match the CI reference for all $($local.Count) migrations."
  }

  # --- History already in the database ---------------------------------------------------
  # Queries passed with -c avoid double quotes: Windows PowerShell 5.1 strips them from
  # native-command arguments. _prisma_migrations is lowercase, so it needs no quoting.
  $hasHistory = ((Invoke-Psql @("-At", "-c", "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")) -join "") -eq "t"
  $applied = @{}
  if ($hasHistory) {
    $rows = Invoke-Psql @("-At", "-F", "|", "-c", "SELECT migration_name, checksum, finished_at IS NOT NULL, rolled_back_at IS NOT NULL FROM _prisma_migrations ORDER BY started_at")
    foreach ($line in $rows) {
      if (-not $line) { continue }
      $name, $checksum, $finished, $rolledBack = $line.Split("|")
      if ($rolledBack -eq "t") { continue }
      if ($finished -ne "t") { Stop-Applier "migration $name is recorded as started but not finished; resolve it before applying anything" }
      if (-not $local.Contains($name)) { Stop-Applier "the database has migration $name, which this checkout does not" }
      if ($local[$name].Checksum -ne $checksum) { Stop-Applier "migration $name was changed after it was applied (checksum mismatch)" }
      $applied[$name] = $true
    }
  }

  $pending = @($local.Keys | Where-Object { -not $applied.ContainsKey($_) })
  Write-Host "Database '$Database': $($applied.Count) applied, $($pending.Count) pending."
  foreach ($name in $pending) { Write-Host "  pending: $name  sha256=$($local[$name].Checksum)" }
  if ($DryRun -or $pending.Count -eq 0) { return }

  # --- Apply -----------------------------------------------------------------------------
  if (-not $hasHistory) {
    # Through a file, never -c: the DDL contains double quotes (see above).
    $ddlFile = Join-Path ([IO.Path]::GetTempPath()) ("prisma-history-" + [guid]::NewGuid().ToString("N") + ".sql")
    Write-Utf8NoBom $ddlFile $historyTableDdl
    try { Invoke-Psql @("-f", $ddlFile) | Out-Null }
    finally { Remove-Item -Path $ddlFile -ErrorAction SilentlyContinue }
    Write-Host "Created _prisma_migrations."
  }
  foreach ($name in $pending) {
    $wrapper = Join-Path ([IO.Path]::GetTempPath()) ("apply-" + $name + "-" + [guid]::NewGuid().ToString("N") + ".sql")
    $migrationPath = $local[$name].File.Replace("\", "/")
    Write-Utf8NoBom $wrapper (@(
      "BEGIN;",
      "\i '$migrationPath'",
      "INSERT INTO ""_prisma_migrations"" (""id"", ""checksum"", ""finished_at"", ""migration_name"", ""logs"", ""rolled_back_at"", ""started_at"", ""applied_steps_count"")",
      "VALUES (gen_random_uuid()::text, '$($local[$name].Checksum)', now(), '$name', NULL, NULL, now(), 1);",
      "COMMIT;"
    ) -join "`n")
    try { Invoke-Psql @("-f", $wrapper) | Out-Null }
    finally { Remove-Item -Path $wrapper -ErrorAction SilentlyContinue }
    Write-Host "Applied $name."
  }
  Write-Host "Done: $($pending.Count) migration(s) applied to '$Database'."
} catch {
  Write-Host "STOP: $($_.Exception.Message)" -ForegroundColor Red
  $failed = $true
} finally {
  if ($ownsPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}
if ($failed) { exit 1 }
