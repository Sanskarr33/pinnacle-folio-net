# Daily portfolio sync

Keeps the dashboard and Supabase in step with the Excel reporting pack.

```
excel/*.xlsx  ──▶  import_excel.py  ──▶  src/data/*.json   (what the app reads)
                                    └─▶  sync_supabase.py  (optional DB mirror)
```

## One-time setup

**1. Install the scheduled task** (run once, from the project root, in PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -Install
```

Runs daily at 08:00. Pass `-At "19:30"` for a different time.

```powershell
Get-ScheduledTask  -TaskName "SG Family Wealth - Daily Portfolio Sync"   # inspect
Start-ScheduledTask -TaskName "SG Family Wealth - Daily Portfolio Sync"  # run now
Unregister-ScheduledTask -TaskName "SG Family Wealth - Daily Portfolio Sync" -Confirm:$false
```

It runs as you, on next logon if the machine was off at the trigger time. It is *not*
configured to run when logged out, because that requires storing your Windows password.

**2. Supabase credentials** — one of:

| Method | How |
|---|---|
| Supabase CLI *(in use)* | `supabase login` once. The sync reads the key via `supabase projects api-keys --reveal`. Nothing is stored by these scripts. |
| Env file | `SUPABASE_SERVICE_KEY=sb_secret_...` in `.env.local` (gitignored) |
| Environment | `$env:SUPABASE_SERVICE_KEY` |

The **publishable/anon key will not work** — row-level security rejects writes.

## Daily behaviour

1. Fingerprints `excel/*.xlsx` (name + size + mtime). Unchanged → exits immediately.
2. Re-imports the workbook, reconciles against `R1_Summary`, rewrites the snapshots.
3. Pushes to Supabase, replacing only rows for that valuation date.
4. Appends to `scripts/out/sync.log`.

Drop a newer workbook into `excel/` and the importer picks the latest automatically —
no code change needed.

## Manual use

```bash
python scripts/import_excel.py            # re-import only
python scripts/sync_supabase.py --dry-run # check credentials, write nothing
python scripts/sync_supabase.py           # push to Supabase
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -Force          # ignore fingerprint
powershell -ExecutionPolicy Bypass -File scripts\daily_sync.ps1 -SkipSupabase   # snapshot only
```

## Advisor meetings

Meeting notes and actionables are **authored**, not imported — the daily sync never
touches them. They live in browser localStorage with JSON backup/restore on the page.
Run `scripts/out/meetings.sql` in the Supabase SQL editor to move them server-side.

## Things to know

* **The dashboard reads `src/data/holdings-snapshot.json`, not Supabase.** If the DB push
  fails the dashboard is still correct; the log says so explicitly. Rebuild/redeploy the
  app to publish new figures.
* **Reconciliation variances are expected.** `R6_Summary_Bullion` contains `#REF!` errors,
  so R1 understates bullion by ~₹2.50 Cr and bonds by ~₹0.56 Cr. Lot-level detail wins.
  Full breakdown each run in `scripts/out/reconciliation.txt`.
* **The importer fails loudly** if a section stops reconciling — a silent format change in
  the workbook will surface in the log rather than quietly corrupting the dashboard.
* **Project ref mismatch:** `supabase/config.toml` and `.env` point at
  `pjduslfcpzqpnmrvlyie`, but the holdings live in `bdjwhgwoztdocwdvzrem`, which is what
  the app and these scripts use. Override with `$env:SUPABASE_PROJECT_REF` if that changes.
* **`daily_sync.ps1` must stay ASCII + UTF-8 BOM.** Windows PowerShell 5.1 misparses
  UTF-8 without a BOM, which breaks the script in non-obvious ways.
