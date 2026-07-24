<#
    Daily portfolio refresh - runs unattended via Windows Task Scheduler.

        1. Detects whether any workbook in .\excel changed since the last run
        2. Re-imports the Excel book into src\data\holdings-snapshot.json
        3. Bakes the latest AMFI mutual-fund NAVs into the snapshot (non-fatal if offline)
        4. Pushes the snapshot to Supabase (skipped if no service key is available)
        5. Appends a one-line result to scripts\out\sync.log

    Manual run:
        powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1
        powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -Force
        powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -SkipSupabase

    Register it to run daily at 08:00 (run this once, from the project root):
        powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -Install
#>

param(
    [switch]$Force,          # re-import even if no workbook changed
    [switch]$SkipSupabase,   # snapshot only, no database write
    [switch]$Install,        # register the scheduled task and exit
    [string]$At = "08:00"    # time of day for -Install
)

$ErrorActionPreference = "Stop"
$Root    = Split-Path -Parent $PSScriptRoot
$OutDir  = Join-Path $Root "scripts\out"
$LogFile = Join-Path $OutDir "sync.log"
$StampFile = Join-Path $OutDir ".excel-fingerprint"

function Write-Log {
    param([string]$Level, [string]$Message)
    $line = "{0}  {1,-5}  {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

# -- Install mode ---------------------------------------------------------------
if ($Install) {
    $taskName = "SG Family Wealth - Daily Portfolio Sync"
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" `
        -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -Daily -At $At
    # Run whether or not the user is logged on is NOT used: that would require storing
    # the password. This runs on next logon if the machine was off at the trigger time.
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -DontStopIfGoingOnBatteries `
        -AllowStartIfOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description "Re-imports the SG Family Excel book and syncs Supabase." -Force | Out-Null

    Write-Log "INFO" "Registered scheduled task '$taskName' daily at $At"
    Write-Host ""
    Write-Host "  Inspect : Get-ScheduledTask -TaskName '$taskName'"
    Write-Host "  Run now : Start-ScheduledTask -TaskName '$taskName'"
    Write-Host "  Remove  : Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
    exit 0
}

# -- Normal run -----------------------------------------------------------------
Set-Location $Root
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

Write-Log "INFO" "--- daily sync starting ---"

# Resolve python
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command python3 -ErrorAction SilentlyContinue).Source }
if (-not $python) {
    Write-Log "ERROR" "python not found on PATH - cannot import the workbook."
    exit 2
}

# Fingerprint the workbooks so an unchanged book is a no-op.
$books = Get-ChildItem -Path (Join-Path $Root "excel") -Filter *.xlsx -ErrorAction SilentlyContinue
if (-not $books) {
    Write-Log "ERROR" "No .xlsx files found in .\excel - nothing to import."
    exit 2
}
$fingerprint = ($books | Sort-Object Name | ForEach-Object {
    "{0}|{1}|{2}" -f $_.Name, $_.Length, $_.LastWriteTimeUtc.Ticks
}) -join ";"

$previous = if (Test-Path $StampFile) { Get-Content $StampFile -Raw } else { "" }

# An unchanged workbook skips the *re-import* only. NAVs still publish daily, so the
# NAV bake-in and Supabase push run every day regardless.
$reimport = $Force -or ($fingerprint.Trim() -ne $previous.Trim())
if (-not $reimport) {
    Write-Log "INFO" "Workbooks unchanged - skipping re-import; refreshing NAVs only. (use -Force to re-import)"
}

foreach ($b in $books) {
    Write-Log "INFO" ("Workbook: {0}  ({1:N0} KB, modified {2})" -f $b.Name, ($b.Length/1KB), $b.LastWriteTime)
}

# 1. Import ---------------------------------------------------------------------
if ($reimport) {
    Write-Log "INFO" "Importing workbook -> src\data\holdings-snapshot.json"
    & $python (Join-Path $Root "scripts\import_excel.py") 2>&1 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR" "import_excel.py failed (exit $LASTEXITCODE). Snapshot NOT updated."
        exit 3
    }

    # Surface the headline figures into the log so the log alone tells the story.
    $snapPath = Join-Path $Root "src\data\holdings-snapshot.json"
    if (Test-Path $snapPath) {
        try {
            $snap = Get-Content $snapPath -Raw | ConvertFrom-Json
            $cr = [math]::Round($snap.totalValue / 10000000, 2)
            Write-Log "INFO" ("Imported {0} rows, as on {1}, value Rs {2} Cr" -f $snap.rowCount, $snap.asOnDate, $cr)
        } catch {
            Write-Log "WARN" "Could not read back the snapshot for logging: $($_.Exception.Message)"
        }
    }
}

# 2. Bake in live NAVs ----------------------------------------------------------
# Overlay the latest AMFI mutual-fund NAVs onto the freshly-imported snapshot so the
# dashboard loads current values by default. A missing feed is non-fatal: the workbook
# valuations already in the snapshot stand.
Write-Log "INFO" "Refreshing mutual-fund NAVs from AMFI"
& $python (Join-Path $Root "scripts\refresh_navs.py") 2>&1 | ForEach-Object { Write-Host "    $_" }
if ($LASTEXITCODE -eq 3) {
    Write-Log "WARN" "AMFI feed unavailable - snapshot keeps workbook NAVs."
} elseif ($LASTEXITCODE -ne 0) {
    Write-Log "WARN" "refresh_navs.py exited $LASTEXITCODE - snapshot keeps workbook NAVs."
} else {
    Write-Log "INFO" "Live NAVs baked into snapshot"
}

# 2b. Refresh index history -----------------------------------------------------
# Tops up src\data\index-history.json (NIFTY 50, Sensex) for the benchmark page.
# Independent of the workbook, so it runs on unchanged days too. Non-fatal.
Write-Log "INFO" "Refreshing index history (NIFTY 50, Sensex)"
& $python (Join-Path $Root "scripts\refresh_index.py") 2>&1 | ForEach-Object { Write-Host "    $_" }
if ($LASTEXITCODE -eq 3) {
    Write-Log "WARN" "Index feed unavailable - benchmark keeps existing history."
} elseif ($LASTEXITCODE -ne 0) {
    Write-Log "WARN" "refresh_index.py exited $LASTEXITCODE - benchmark keeps existing history."
} else {
    Write-Log "INFO" "Index history refreshed"
}

# 3. Push to Supabase -----------------------------------------------------------
if ($SkipSupabase) {
    Write-Log "INFO" "-SkipSupabase set - database not updated."
} else {
    Write-Log "INFO" "Pushing snapshot to Supabase"
    & $python (Join-Path $Root "scripts\sync_supabase.py") 2>&1 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -eq 3) {
        Write-Log "WARN" "No service key available - snapshot updated, Supabase left unchanged."
    } elseif ($LASTEXITCODE -ne 0) {
        # The dashboard reads the snapshot, so it is already current regardless.
        Write-Log "ERROR" "sync_supabase.py failed (exit $LASTEXITCODE). Dashboard snapshot IS current."
        Set-Content -Path $StampFile -Value $fingerprint -Encoding utf8
        exit 4
    } else {
        Write-Log "INFO" "Supabase sync OK"
    }
}

Set-Content -Path $StampFile -Value $fingerprint -Encoding utf8
Write-Log "INFO" "--- daily sync complete ---"
exit 0
