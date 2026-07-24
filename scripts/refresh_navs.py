#!/usr/bin/env python3
"""
Bake live mutual-fund NAVs into the bundled snapshot.

Fetches AMFI's daily NAVAll dump, overlays the latest NAV onto every holding that
carries a matched ISIN (attached at import time), and rewrites
src/data/holdings-snapshot.json with recomputed current_value / unrealised_gain /
gain_percent / allocation_percent and an updated totalValue.

This is the daily "bake-in" counterpart to the in-browser Refresh NAVs button. The
button overlays NAVs live per-device; this makes the same figures the default the
dashboard loads with (and what Supabase receives on the next sync).

Only fund/ETF units with a matched ISIN move. Equities, PMS, AIF, SGBs, ULIP and cash
have no NAV feed and keep their last known value. A live NAV more than SANITY_TOLERANCE
away from the stored NAV is treated as a bad ISIN match and ignored — the exact rule
used client-side in src/lib/prices.ts, so button and bake-in never disagree.

Exit codes:
    0  snapshot updated (or nothing to update)
    2  snapshot file missing
    3  feed unreachable / empty  (non-fatal: caller keeps the existing snapshot)
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "src" / "data" / "holdings-snapshot.json"

# AMFI moved the feed to portal.amfiindia.com; the old www host now 302-redirects here.
AMFI_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"

# Reject a live NAV more than this fraction away from the stored NAV: almost always a
# bad ISIN match rather than a real one-day move. Mirrors SANITY_TOLERANCE in prices.ts.
SANITY_TOLERANCE = 0.4


def log(msg: str) -> None:
    print(msg, flush=True)


def _ssl_context() -> ssl.SSLContext | None:
    """Honour a corporate CA bundle if one is configured, else system trust."""
    for var in ("REQUESTS_CA_BUNDLE", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"):
        path = os.environ.get(var)
        if path and Path(path).exists():
            log(f"TLS      : using CA bundle from ${var}")
            return ssl.create_default_context(cafile=path)
    return None


def fetch_navs() -> tuple[dict[str, float], str]:
    """Return ({ISIN -> NAV}, feed_date). Raises on network / parse failure."""
    ctx = _ssl_context()
    req = urllib.request.Request(AMFI_URL, headers={"Accept": "text/plain", "User-Agent": "sg-family-office/1.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        text = resp.read().decode("utf-8", "replace")

    by_isin: dict[str, float] = {}
    as_of = ""
    schemes = 0
    # ';'-delimited: Scheme Code;ISIN Growth;ISIN Reinvest;Scheme Name;NAV;Date
    for line in text.splitlines():
        parts = line.split(";")
        if len(parts) < 6:
            continue
        isin_growth = parts[1].strip()
        isin_reinvest = parts[2].strip()
        try:
            nav = float(parts[4])
        except ValueError:
            continue
        if not nav > 0:
            continue
        date = parts[5].strip()
        if isin_growth.startswith("IN"):
            by_isin[isin_growth] = nav
        if isin_reinvest.startswith("IN"):
            by_isin[isin_reinvest] = nav
        if date:
            as_of = date
        schemes += 1

    if schemes == 0:
        raise ValueError("AMFI feed parsed to zero schemes")
    return by_isin, as_of


def units_of(row: dict) -> float | None:
    u = row.get("units")
    if u is None:
        u = row.get("quantity")
    try:
        return float(u) if u is not None else None
    except (TypeError, ValueError):
        return None


def main() -> int:
    dry = "--dry-run" in sys.argv

    if not SNAPSHOT.exists():
        log(f"ERROR: {SNAPSHOT.relative_to(ROOT)} not found - run scripts/import_excel.py first.")
        return 2

    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    rows = snap["holdings"]

    try:
        by_isin, as_of = fetch_navs()
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, ssl.SSLError) as e:
        log(f"WARN : AMFI feed unavailable ({e}). Snapshot left unchanged.")
        return 3

    log(f"Feed     : AMFI  as of {as_of or 'unknown'}  {len(by_isin)} ISINs")

    matched_lots = 0
    matched_value = 0.0
    moved_value = 0.0
    skipped_sanity = 0

    for r in rows:
        isin = r.get("isin")
        if not isin:
            continue
        nav = by_isin.get(isin)
        if nav is None:
            continue
        units = units_of(r)
        if not units or units <= 0:
            continue
        anchor = r.get("current_nav")
        if anchor and anchor > 0:
            drift = abs(nav - anchor) / anchor
            if drift > SANITY_TOLERANCE:
                skipped_sanity += 1
                continue

        new_value = units * nav
        invested = r.get("invested_value") or 0.0
        before = r.get("current_value") or 0.0

        matched_lots += 1
        matched_value += new_value
        moved_value += new_value - before

        if not dry:
            r["current_nav"] = nav
            r["current_value"] = new_value
            r["unrealised_gain"] = new_value - invested
            r["gain_percent"] = ((new_value - invested) / invested * 100.0) if invested else r.get("gain_percent")

    if matched_lots == 0:
        log(f"Result   : no holdings repriced (0 ISIN matches, {skipped_sanity} rejected on sanity).")
        return 0

    # Re-derive allocation % and the book total so the snapshot stays self-consistent.
    total = sum((r.get("current_value") or 0.0) for r in rows) or 1.0
    if not dry:
        for r in rows:
            r["allocation_percent"] = (r.get("current_value") or 0.0) / total * 100.0
        snap["totalValue"] = total
        snap["navRefreshedAt"] = datetime.now(timezone.utc).isoformat()
        snap["navAsOf"] = as_of
        SNAPSHOT.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")

    sign = "+" if moved_value >= 0 else "-"
    log(
        f"Repriced : {matched_lots} funds  "
        f"Rs {matched_value/1e7:.2f} Cr live  "
        f"{sign}Rs {abs(moved_value)/1e7:.2f} Cr vs book  "
        f"({skipped_sanity} rejected on sanity)"
    )
    log(f"Book     : Rs {total/1e7:.2f} Cr total" + ("   [dry-run, not written]" if dry else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
