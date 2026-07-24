// Date-matched index benchmark: "what if the same money had gone into the index
// on the same dates?"
//
// Why this shape and not a portfolio-vs-index line chart: the book has exactly two
// dated snapshots (10-Jun-2026 and 22-Jul-2026), so there is no portfolio time series
// to plot. What the book DOES have, for 825 lots, is a purchase date and the amount
// invested — enough to run each lot's own cash through the index and compare where it
// would have ended up. That is a money-weighted, date-matched comparison built only
// from recorded facts.
//
// Two honesty constraints are wired in rather than left to the caller:
//   1. Lots without a purchase date or invested amount are EXCLUDED and reported, so
//      the headline can never quietly cover 79% of the book while looking like 100%.
//   2. NIFTY 50 and Sensex are PRICE indices — they exclude dividends, so they
//      understate a real index investment by roughly 1–1.5% a year. The comparison is
//      therefore mildly flattering to the portfolio, and the UI says so.

import type { PortfolioHolding } from "./types";
import { displayName, normaliseEntity } from "./portfolio-analytics";

export interface IndexHistory {
  series: Record<string, Record<string, number>>; // symbol -> { ISO date: close }
  names: Record<string, string>;
  fetchedAt?: string;
}

export interface BenchmarkLot {
  row: PortfolioHolding;
  security: string;
  entity: string;
  assetClass: string;
  purchaseDate: string;
  invested: number;
  actual: number; // current value
  benchmark: number; // same cash into the index on that date
  alpha: number; // actual - benchmark
  actualReturnPct: number;
  indexReturnPct: number;
}

export interface BenchmarkResult {
  symbol: string;
  indexName: string;
  asOf: string;
  latestLevel: number;
  lots: BenchmarkLot[];
  invested: number;
  actual: number;
  benchmark: number;
  alpha: number;
  actualReturnPct: number;
  indexReturnPct: number;
  /** Lots that could not be compared, and why. */
  excluded: {
    noDateOrAmount: { count: number; value: number };
    beforeHistory: { count: number; value: number; earliest: string };
    implausibleDate: { count: number; value: number };
  };
  coveredValue: number;
  totalValue: number;
}

/** Anything older than this is a data error, not a real purchase (Excel epoch bugs). */
const MIN_PLAUSIBLE_DATE = "1990-01-01";

/**
 * Index close on or before `date`. Markets shut at weekends and holidays, so a
 * purchase dated on a non-trading day walks back to the previous close — never
 * forward, which would use information that did not exist yet.
 */
export function levelOnOrBefore(
  sortedDates: string[],
  series: Record<string, number>,
  date: string,
): number | null {
  if (sortedDates.length === 0) return null;
  if (date < sortedDates[0]) return null;
  let lo = 0;
  let hi = sortedDates.length - 1;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= date) {
      best = sortedDates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best ? series[best] : null;
}

export function computeBenchmark(
  rows: PortfolioHolding[],
  history: IndexHistory | null,
  symbol: string,
): BenchmarkResult | null {
  const series = history?.series?.[symbol];
  if (!series) return null;
  const dates = Object.keys(series).sort();
  if (dates.length === 0) return null;

  const asOf = dates[dates.length - 1];
  const latestLevel = series[asOf];
  const earliest = dates[0];

  const lots: BenchmarkLot[] = [];
  const excluded = {
    noDateOrAmount: { count: 0, value: 0 },
    beforeHistory: { count: 0, value: 0, earliest },
    implausibleDate: { count: 0, value: 0 },
  };
  let totalValue = 0;

  for (const r of rows) {
    const value = r.current_value ?? 0;
    totalValue += value;
    const invested = r.invested_value ?? 0;
    const pd = r.purchase_date ? r.purchase_date.slice(0, 10) : null;

    if (!pd || invested <= 0) {
      excluded.noDateOrAmount.count++;
      excluded.noDateOrAmount.value += value;
      continue;
    }
    if (pd < MIN_PLAUSIBLE_DATE) {
      excluded.implausibleDate.count++;
      excluded.implausibleDate.value += value;
      continue;
    }
    const level = levelOnOrBefore(dates, series, pd);
    if (level == null || !(level > 0)) {
      excluded.beforeHistory.count++;
      excluded.beforeHistory.value += value;
      continue;
    }

    const benchmark = (invested / level) * latestLevel;
    lots.push({
      row: r,
      security: displayName(r),
      entity: normaliseEntity(r.entity_name),
      assetClass: r.asset_class?.trim() || "Unclassified",
      purchaseDate: pd,
      invested,
      actual: value,
      benchmark,
      alpha: value - benchmark,
      actualReturnPct: ((value - invested) / invested) * 100,
      indexReturnPct: (latestLevel / level - 1) * 100,
    });
  }

  const sum = (f: (l: BenchmarkLot) => number) => lots.reduce((s, l) => s + f(l), 0);
  const invested = sum((l) => l.invested);
  const actual = sum((l) => l.actual);
  const benchmark = sum((l) => l.benchmark);

  return {
    symbol,
    indexName: history?.names?.[symbol] ?? symbol,
    asOf,
    latestLevel,
    lots,
    invested,
    actual,
    benchmark,
    alpha: actual - benchmark,
    actualReturnPct: invested > 0 ? ((actual - invested) / invested) * 100 : 0,
    indexReturnPct: invested > 0 ? ((benchmark - invested) / invested) * 100 : 0,
    excluded,
    coveredValue: actual,
    totalValue,
  };
}

export interface BenchmarkGroup {
  key: string;
  invested: number;
  actual: number;
  benchmark: number;
  alpha: number;
  actualReturnPct: number;
  indexReturnPct: number;
  lots: number;
}

/** Roll the compared lots up by any key — asset class, entity, whatever. */
export function groupBenchmark(
  lots: BenchmarkLot[],
  keyFn: (l: BenchmarkLot) => string,
): BenchmarkGroup[] {
  const map = new Map<string, BenchmarkLot[]>();
  for (const l of lots) {
    const k = keyFn(l);
    const list = map.get(k);
    if (list) list.push(l);
    else map.set(k, [l]);
  }
  const out: BenchmarkGroup[] = [];
  for (const [key, ls] of map) {
    const invested = ls.reduce((s, l) => s + l.invested, 0);
    const actual = ls.reduce((s, l) => s + l.actual, 0);
    const benchmark = ls.reduce((s, l) => s + l.benchmark, 0);
    out.push({
      key,
      invested,
      actual,
      benchmark,
      alpha: actual - benchmark,
      actualReturnPct: invested > 0 ? ((actual - invested) / invested) * 100 : 0,
      indexReturnPct: invested > 0 ? ((benchmark - invested) / invested) * 100 : 0,
      lots: ls.length,
    });
  }
  return out.sort((a, b) => b.actual - a.actual);
}

/** Asset classes that a broad equity index is a fair yardstick for. */
const EQUITY_LIKE = /equity|elss|flexi|large|mid|small|multi|index|international|pms/i;

export function isEquityLike(assetClass: string): boolean {
  return EQUITY_LIKE.test(assetClass);
}
