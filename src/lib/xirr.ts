// Money-weighted return (XIRR) from the book's own dated cashflows.
//
// The header's XIRR is a value-weighted AVERAGE of the per-lot xirr the workbook
// reports — a reasonable summary, but not a true portfolio return. This computes the
// real thing: every lot's invested amount is a cash outflow on its purchase date, the
// current value of those same lots is one inflow today, and the single rate that makes
// them balance is the money-weighted return on capital still invested.
//
// Honesty constraints, wired in rather than left to the caller:
//   - Only lots with BOTH a purchase date and an invested amount contribute. The
//     terminal inflow is the current value of exactly those lots — never the whole
//     book, or the return is inflated by value that had no matching outflow.
//   - Coverage (value in / out of the calc) is returned so the UI can state it.
//   - A lot is treated as a single lump sum on its purchase date. SIP lots therefore
//     use their aggregate cost at the recorded date; the workbook carries no
//     instalment dates to do better, and this is the standard lot-level treatment.

import type { PortfolioHolding } from "./types";
import { normaliseEntity } from "./portfolio-analytics";

export interface Cashflow {
  date: string; // ISO
  amount: number; // negative = invested, positive = value returned
  row?: PortfolioHolding;
}

export interface XirrResult {
  /** Annualised money-weighted rate, e.g. 0.1313 for 13.13%. Null if unsolvable. */
  rate: number | null;
  investedCovered: number; // ₹ that entered the calc as outflows
  terminalCovered: number; // ₹ current value of the covered lots
  totalReturnPct: number; // simple (terminal/invested - 1)
  coveredLots: number;
  coveredValue: number; // == terminalCovered, named for the coverage story
  uncoveredLots: number;
  uncoveredValue: number; // book value with no usable cashflow
  bookValue: number; // whole selection's current value
  asOf: string;
}

const MIN_DATE = "1990-01-01";

/** Build (outflows, terminal) from lots. Terminal is the covered lots' current value. */
export function buildCashflows(
  rows: PortfolioHolding[],
  asOf: string,
): {
  flows: Cashflow[];
  investedCovered: number;
  terminalCovered: number;
  coveredLots: number;
  uncoveredLots: number;
  uncoveredValue: number;
  bookValue: number;
} {
  const flows: Cashflow[] = [];
  let investedCovered = 0;
  let terminalCovered = 0;
  let coveredLots = 0;
  let uncoveredLots = 0;
  let uncoveredValue = 0;
  let bookValue = 0;

  for (const r of rows) {
    const cv = r.current_value ?? 0;
    bookValue += cv;
    const pd = r.purchase_date ? r.purchase_date.slice(0, 10) : null;
    const iv = r.invested_value ?? 0;
    if (pd && iv > 0 && pd >= MIN_DATE && pd <= asOf) {
      flows.push({ date: pd, amount: -iv, row: r });
      investedCovered += iv;
      terminalCovered += cv;
      coveredLots++;
    } else {
      uncoveredLots++;
      uncoveredValue += cv;
    }
  }

  return {
    flows,
    investedCovered,
    terminalCovered,
    coveredLots,
    uncoveredLots,
    uncoveredValue,
    bookValue,
  };
}

function yearsBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / (365 * 86_400_000);
}

/**
 * Solve for the XIRR of a set of cashflows. Newton's method from a sensible guess,
 * with a bisection fallback so a pathological set still converges (or returns null
 * rather than a wrong number). Requires at least one flow of each sign.
 */
export function computeXirr(flows: Cashflow[]): number | null {
  if (flows.length < 2) return null;
  let hasPos = false;
  let hasNeg = false;
  for (const f of flows) {
    if (f.amount > 0) hasPos = true;
    else if (f.amount < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return null;

  const t0 = flows.reduce((m, f) => (f.date < m ? f.date : m), flows[0].date);
  const npv = (rate: number) =>
    flows.reduce((s, f) => s + f.amount / Math.pow(1 + rate, yearsBetween(t0, f.date)), 0);
  const dnpv = (rate: number) =>
    flows.reduce((s, f) => {
      const t = yearsBetween(t0, f.date);
      return s - (f.amount * t) / Math.pow(1 + rate, t + 1);
    }, 0);

  // Newton
  let rate = 0.15;
  for (let i = 0; i < 60; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-10) break;
    let next = rate - f / df;
    if (next <= -0.9999) next = (rate - 0.9999) / 2; // stay in the domain
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }
  if (Number.isFinite(rate) && Math.abs(npv(rate)) < 1) return rate;

  // Bisection fallback over a wide bracket.
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo);
  const fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid);
    if (Math.abs(fmid) < 1e-6 || (hi - lo) / 2 < 1e-9) return mid;
    if (flo * fmid < 0) hi = mid;
    else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/** Full result for a set of rows: XIRR plus the coverage story. */
export function xirrForRows(rows: PortfolioHolding[], asOf: string): XirrResult {
  const b = buildCashflows(rows, asOf);
  const flows: Cashflow[] =
    b.terminalCovered > 0 ? [...b.flows, { date: asOf, amount: b.terminalCovered }] : b.flows;
  const rate = computeXirr(flows);
  return {
    rate,
    investedCovered: b.investedCovered,
    terminalCovered: b.terminalCovered,
    totalReturnPct: b.investedCovered > 0 ? (b.terminalCovered / b.investedCovered - 1) * 100 : 0,
    coveredLots: b.coveredLots,
    coveredValue: b.terminalCovered,
    uncoveredLots: b.uncoveredLots,
    uncoveredValue: b.uncoveredValue,
    bookValue: b.bookValue,
    asOf,
  };
}

export interface XirrGroup {
  key: string;
  rate: number | null;
  invested: number;
  current: number;
  totalReturnPct: number;
  lots: number;
}

/** XIRR computed independently for each group (entity, asset class, vintage year…). */
export function xirrByGroup(
  rows: PortfolioHolding[],
  asOf: string,
  keyFn: (r: PortfolioHolding) => string,
): XirrGroup[] {
  const map = new Map<string, PortfolioHolding[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  const out: XirrGroup[] = [];
  for (const [key, ls] of map) {
    const res = xirrForRows(ls, asOf);
    if (res.coveredLots === 0) continue;
    out.push({
      key,
      rate: res.rate,
      invested: res.investedCovered,
      current: res.terminalCovered,
      totalReturnPct: res.totalReturnPct,
      lots: res.coveredLots,
    });
  }
  return out;
}

export const entityKey = (r: PortfolioHolding) => normaliseEntity(r.entity_name);
export const assetClassKey = (r: PortfolioHolding) => r.asset_class?.trim() || "Unclassified";
export const vintageKey = (r: PortfolioHolding) =>
  r.purchase_date ? r.purchase_date.slice(0, 4) : "—";

export interface DeployPoint {
  date: string;
  invested: number; // ₹ deployed on this date (sum of that day's lots)
  lots: number;
}

/** Money deployed over time (outflows only), bucketed by month, for the timeline. */
export function deploymentByMonth(rows: PortfolioHolding[], asOf: string): DeployPoint[] {
  const by = new Map<string, { invested: number; lots: number }>();
  for (const r of rows) {
    const pd = r.purchase_date ? r.purchase_date.slice(0, 10) : null;
    const iv = r.invested_value ?? 0;
    if (!pd || iv <= 0 || pd < MIN_DATE || pd > asOf) continue;
    const key = pd.slice(0, 7);
    const cur = by.get(key) ?? { invested: 0, lots: 0 };
    cur.invested += iv;
    cur.lots++;
    by.set(key, cur);
  }
  return [...by.entries()]
    .map(([date, v]) => ({ date, invested: v.invested, lots: v.lots }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
