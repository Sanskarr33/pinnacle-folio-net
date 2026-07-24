#!/usr/bin/env python3
"""
Bake daily index history into src/data/index-history.json.

The benchmark page answers "what if the same money had gone into the index on the
same dates?", which needs a daily close going back to the earliest purchase in the
book. That series is append-only and small, so it ships with the app: the dashboard
then works offline and in local dev, and the Netlify function only has to top it up.

Source is Yahoo's chart endpoint (free, no key). It is unofficial, so every response
is validated before it is allowed to overwrite a good file.

Exit codes:
    0  history written (or already current)
    3  feed unreachable / rejected  (non-fatal: the existing file stands)
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "index-history.json"

# Symbol -> display name. NIFTY 50 and Sensex are PRICE indices: they exclude
# dividends, so they understate a real index investment by roughly 1-1.5% a year.
# The UI states this; do not silently "correct" for it here.
SYMBOLS = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "BSE Sensex",
}

RANGE = "10y"
MAX_FEED_AGE_DAYS = 7  # same staleness rule as the NAV feed


def log(msg: str) -> None:
    print(msg, flush=True)


def _ssl_context() -> ssl.SSLContext | None:
    for var in ("REQUESTS_CA_BUNDLE", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"):
        p = os.environ.get(var)
        if p and Path(p).exists():
            return ssl.create_default_context(cafile=p)
    return None


def fetch(symbol: str) -> dict[str, float]:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(symbol)}?range={RANGE}&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90, context=_ssl_context()) as resp:
        payload = json.load(resp)

    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("no result block")
    res = result[0]
    stamps = res.get("timestamp") or []
    closes = ((res.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    series: dict[str, float] = {}
    for t, c in zip(stamps, closes):
        if c is None or not (c > 0):
            continue
        series[datetime.fromtimestamp(t, timezone.utc).date().isoformat()] = round(float(c), 4)
    if len(series) < 250:
        raise ValueError(f"only {len(series)} points returned; expected a multi-year series")
    return series


def main() -> int:
    import urllib.parse  # noqa: F401  (referenced in fetch)

    existing: dict = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = {}

    out: dict[str, dict] = {"series": {}, "names": SYMBOLS}
    ok = 0
    for sym, name in SYMBOLS.items():
        try:
            series = fetch(sym)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, ssl.SSLError, KeyError) as e:
            log(f"WARN : {sym} ({name}) unavailable - {e}")
            prev = (existing.get("series") or {}).get(sym)
            if prev:
                out["series"][sym] = prev
                log(f"       kept the {len(prev)} points already on file")
            continue

        last = max(series)
        age = (datetime.now(timezone.utc).date() - datetime.fromisoformat(last).date()).days
        # Markets close at weekends and holidays, so a couple of days is normal.
        if age > MAX_FEED_AGE_DAYS:
            log(f"WARN : {sym} newest close is {last} ({age} days old) - stale feed, keeping existing file")
            prev = (existing.get("series") or {}).get(sym)
            if prev:
                out["series"][sym] = prev
            continue

        out["series"][sym] = series
        ok += 1
        log(f"{name:12s} {len(series):5d} days  {min(series)} -> {last}  last close {series[last]:,.1f}")

    if ok == 0:
        log("No symbol refreshed. Existing file left untouched.")
        return 3

    out["fetchedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    log(f"Wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    import urllib.parse  # used inside fetch()

    raise SystemExit(main())
