"""
Push the generated holdings snapshot into Supabase.

    python scripts/sync_supabase.py [--dry-run]

CREDENTIALS — tried in this order, first hit wins:
  1. $SUPABASE_SERVICE_KEY / $SUPABASE_SERVICE_ROLE_KEY
  2. .env.local  (SUPABASE_SERVICE_KEY=...)
  3. supabase CLI:  supabase projects api-keys --project-ref <ref> --reveal
     — requires a one-time `supabase login`; nothing is stored by this script.

The publishable/anon key CANNOT be used: row-level security rejects writes.

Idempotent. Rows for the snapshot's valuation date are deleted and reinserted, so
running twice is harmless and other dates are never touched.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "src" / "data" / "holdings-snapshot.json"

# The project that actually holds the holdings tables. NOTE: supabase/config.toml
# and .env point at a different project ref — see README_SYNC.md.
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "bdjwhgwoztdocwdvzrem")
PROJECT_URL = os.environ.get("SUPABASE_URL", f"https://{PROJECT_REF}.supabase.co")
TABLE = "portfolio_detailed_holdings"
BATCH = 250

# `id` is a server-generated uuid; never send our synthetic keys.
SKIP_COLUMNS = {"id"}


def log(msg: str) -> None:
    print(msg, flush=True)


def read_env_local() -> dict[str, str]:
    out: dict[str, str] = {}
    p = ROOT / ".env.local"
    if not p.exists():
        return out
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def key_from_cli() -> str | None:
    """Ask the Supabase CLI for the secret key. Requires a prior `supabase login`."""
    try:
        r = subprocess.run(
            ["supabase", "projects", "api-keys", "--project-ref", PROJECT_REF,
             "--reveal", "--output", "json"],
            capture_output=True, text=True, timeout=90,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        detail = (r.stderr or r.stdout or "").strip().splitlines()
        if detail:
            log(f"  supabase CLI: {detail[0][:120]}")
        return None
    try:
        keys = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    # Prefer an explicit secret/service_role entry.
    for k in keys:
        name = str(k.get("name", "")).lower()
        val = k.get("api_key") or k.get("apiKey") or ""
        if not val:
            continue
        if "service" in name or "secret" in name or str(val).startswith("sb_secret_"):
            return str(val)
    return None


def resolve_key() -> tuple[str | None, str]:
    for var in ("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        if os.environ.get(var):
            return os.environ[var], f"environment ${var}"
    env = read_env_local()
    for var in ("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        if env.get(var):
            return env[var], f".env.local ({var})"
    k = key_from_cli()
    if k:
        return k, "supabase CLI"
    return None, "none"


def request(method: str, path: str, key: str, body: bytes | None = None, prefer: str | None = None):
    url = f"{PROJECT_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, method=method, data=body)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except urllib.error.URLError as e:
        return 0, str(e)


def main() -> int:
    dry = "--dry-run" in sys.argv

    if not SNAPSHOT.exists():
        log(f"ERROR: {SNAPSHOT.relative_to(ROOT)} not found — run scripts/import_excel.py first.")
        return 2

    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    rows = snap["holdings"]
    as_on = snap["asOnDate"]
    total = snap["totalValue"]
    log(f"Snapshot : {snap['source']}")
    log(f"As on    : {as_on}   rows {len(rows)}   value Rs {total/1e7:.2f} Cr")
    log(f"Project  : {PROJECT_URL}")

    key, origin = resolve_key()
    if not key:
        log("")
        log("ERROR: no service-role key available.")
        log("  Fix with ONE of:")
        log("    supabase login          then re-run this script")
        log("    echo SUPABASE_SERVICE_KEY=sb_secret_... >> .env.local")
        log("  The anon/publishable key will not work — RLS blocks writes.")
        return 3
    log(f"Key from : {origin}")

    # PostgREST bulk insert requires every object in a batch to carry the SAME keys
    # ("All object keys must match"), so nulls are sent explicitly rather than omitted.
    columns = [c for c in rows[0].keys() if c not in SKIP_COLUMNS]
    payload = [{c: r.get(c) for c in columns} for r in rows]

    if dry:
        log(f"\nDRY RUN — would delete as_on_date={as_on} and insert {len(payload)} rows.")
        return 0

    log(f"\nDeleting existing rows for {as_on} …")
    status, text = request("DELETE", f"{TABLE}?as_on_date=eq.{as_on}", key, prefer="return=minimal")
    if status not in (200, 204):
        log(f"ERROR: delete failed ({status}): {text[:300]}")
        return 4

    log(f"Inserting {len(payload)} rows in batches of {BATCH} …")
    done = 0
    for i in range(0, len(payload), BATCH):
        chunk = payload[i:i + BATCH]
        status, text = request(
            "POST", TABLE, key,
            body=json.dumps(chunk, default=str).encode("utf-8"),
            prefer="return=minimal",
        )
        if status not in (200, 201, 204):
            log(f"ERROR: insert batch at {i} failed ({status}): {text[:400]}")
            return 5
        done += len(chunk)
        log(f"  {done}/{len(payload)}")

    # Verify what actually landed.
    status, text = request("GET", f"{TABLE}?select=current_value&as_on_date=eq.{as_on}", key)
    if status == 200:
        try:
            got = json.loads(text)
            s = sum(r.get("current_value") or 0 for r in got)
            log(f"\nVerified : {len(got)} rows, Rs {s/1e7:.2f} Cr in Supabase for {as_on}")
            if len(got) != len(payload):
                log(f"WARNING  : expected {len(payload)} rows, found {len(got)}")
                return 6
        except json.JSONDecodeError:
            pass

    log("Sync OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
