// Live NAV overlay.
//
// Holdings carry an ISIN (attached at import time by matching the workbook's AMFI
// dump). A refresh fetches current NAVs keyed by ISIN and overlays them onto the
// book: current_value = units × NAV, with unrealised gain recomputed. Because every
// derived view reads the book through `useBook`, refreshing prices there updates the
// entire dashboard at once.
//
// Only fund/ETF units with a matched ISIN move. Equities, PMS, AIF, unlisted, ULIP
// and cash have no NAV feed and keep their last known value. Nothing is ever guessed.

import type { PortfolioHolding } from "./types";

export interface PriceSnapshot {
  /** ISIN → latest NAV. */
  byIsin: Record<string, number>;
  /** Feed date, e.g. AMFI's published date. */
  asOf: string;
  /** When this device fetched it (ISO). */
  fetchedAt: string;
  source: string;
}

const STORAGE_KEY = "sg-prices";

// A wrong ISIN match would swap in an unrelated NAV. The holding's stored NAV (from
// the workbook, days old) is a sanity anchor: a live NAV more than this far from it
// is treated as a bad match and ignored, so a mis-key can never distort the book.
const SANITY_TOLERANCE = 0.4;

// AMFI publishes every business day. A feed older than this is a stale cache (a
// filtering proxy serving an old copy, say), not "the latest NAVs" — applying it would
// drag the book backwards in time. Mirrors MAX_FEED_AGE_DAYS in scripts/refresh_navs.py.
const MAX_FEED_AGE_DAYS = 7;

/** AMFI stamps dates as "23-Jul-2026". Returns null if unparseable. */
export function parseFeedDate(s: string): Date | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec((s ?? "").trim());
  if (!m) return null;
  const months = "JanFebMarAprMayJunJulAugSepOctNovDec";
  const mi = months.indexOf(m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()) / 3;
  if (!Number.isInteger(mi) || mi < 0) return null;
  const d = new Date(Date.UTC(Number(m[3]), mi, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Reason this feed must not be applied, or null when it is safe. */
export function feedStaleReason(asOf: string): string | null {
  const feed = parseFeedDate(asOf);
  if (!feed) return `Feed date "${asOf}" is unreadable — not applying NAVs blind.`;
  const ageDays = Math.floor((Date.now() - feed.getTime()) / 86_400_000);
  if (ageDays > MAX_FEED_AGE_DAYS) {
    return `The NAV feed is dated ${asOf} — ${ageDays} days old. That is a stale cached copy, not today's NAVs, so it was not applied.`;
  }
  return null;
}

function read(): PriceSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PriceSnapshot) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let cached: PriceSnapshot | null | undefined; // undefined = not yet read

export function subscribePrices(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getPriceSnapshot(): PriceSnapshot | null {
  if (cached === undefined) cached = read();
  return cached;
}
export function getServerPriceSnapshot(): PriceSnapshot | null {
  return null;
}

export function setPrices(snap: PriceSnapshot) {
  cached = snap;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((f) => f());
}

export function clearPrices() {
  cached = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f());
}

/** True when a live NAV is safe to apply to this holding. */
function canApply(row: PortfolioHolding, nav: number): boolean {
  if (!(nav > 0)) return false;
  const units = row.units ?? row.quantity;
  if (!units || units <= 0) return false;
  const anchor = row.current_nav;
  if (anchor && anchor > 0) {
    const drift = Math.abs(nav - anchor) / anchor;
    if (drift > SANITY_TOLERANCE) return false; // implausible → likely a bad ISIN match
  }
  return true;
}

export interface PriceCoverage {
  matchedLots: number;
  matchedValue: number; // ₹ now priced live
  movedValue: number; // ₹ change vs the snapshot
  skippedSanity: number; // matches rejected as implausible
}

/**
 * Return a new book with live NAVs applied. Rows without an ISIN, without units, or
 * whose live NAV fails the sanity check are returned unchanged. If nothing applies
 * the ORIGINAL array is returned by reference, so React skips the re-render.
 */
export function applyPrices(
  rows: PortfolioHolding[],
  snap: PriceSnapshot | null,
): { rows: PortfolioHolding[]; coverage: PriceCoverage | null } {
  if (!snap || !snap.byIsin) return { rows, coverage: null };

  let matchedLots = 0;
  let matchedValue = 0;
  let movedValue = 0;
  let skippedSanity = 0;
  let changed = false;

  const out = rows.map((r) => {
    const isin = r.isin;
    if (!isin) return r;
    const nav = snap.byIsin[isin];
    if (nav == null) return r;
    if (!canApply(r, nav)) {
      skippedSanity++;
      return r;
    }
    const units = (r.units ?? r.quantity) as number;
    const newValue = units * nav;
    const invested = r.invested_value ?? 0;
    const before = r.current_value ?? 0;

    matchedLots++;
    matchedValue += newValue;
    movedValue += newValue - before;
    changed = true;

    return {
      ...r,
      current_nav: nav,
      current_value: newValue,
      unrealised_gain: newValue - invested,
      gain_percent: invested !== 0 ? ((newValue - invested) / invested) * 100 : r.gain_percent,
    } as PortfolioHolding;
  });

  if (!changed)
    return { rows, coverage: { matchedLots: 0, matchedValue: 0, movedValue: 0, skippedSanity } };

  // Re-derive allocation % against the new total so the book stays internally consistent.
  const total = out.reduce((s, r) => s + (r.current_value ?? 0), 0) || 1;
  const reallocated = out.map((r) => ({
    ...r,
    allocation_percent: ((r.current_value ?? 0) / total) * 100,
  }));

  return { rows: reallocated, coverage: { matchedLots, matchedValue, movedValue, skippedSanity } };
}

/** Fetch the live NAV feed from the deployed proxy and store it. Returns coverage-less snapshot. */
export async function refreshPrices(): Promise<PriceSnapshot> {
  const res = await fetch("/.netlify/functions/prices", { method: "GET" });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Live prices are only available on the deployed site, not in local dev."
        : `Price feed returned ${res.status}`,
    );
  }
  const data = (await res.json()) as {
    byIsin: Record<string, number>;
    asOf: string;
    source: string;
  };
  if (!data.byIsin || Object.keys(data.byIsin).length === 0) {
    throw new Error("Price feed returned no NAVs.");
  }
  // Refuse a stale feed outright rather than storing it — a cached copy served by a
  // filtering proxy would otherwise quietly regress every valuation on the dashboard.
  const stale = feedStaleReason(data.asOf);
  if (stale) throw new Error(stale);

  const snap: PriceSnapshot = {
    byIsin: data.byIsin,
    asOf: data.asOf || new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    source: data.source || "AMFI",
  };
  setPrices(snap);
  return snap;
}
