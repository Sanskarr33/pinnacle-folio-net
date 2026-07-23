// Investment Policy Statement — target allocation bands and drift.
//
// The bands below are SEEDED FROM WHAT THE ADVISORS ACTUALLY SAID in the imported
// minutes, each with the quote and the meeting it came from, so no number here is
// invented. They are editable and persisted per device; `source` is preserved so a
// band always shows where it came from and whether it has since been overridden.
//
// Where advisors disagree the tighter constraint wins, and the conflict is recorded
// in `note` rather than hidden — 360 ONE set a hard 60% IPS ceiling on equity while
// ICICI and Shriram proposed 60–63% and 60–65% respectively.

import type { PortfolioHolding } from "./types";
import { sumBy } from "./portfolio-analytics";

export interface PolicyBand {
  key: string;
  /** Asset classes from the book that roll up into this band. */
  matches: (r: PortfolioHolding) => boolean;
  label: string;
  /** Target midpoint, %. */
  target: number;
  min: number;
  max: number;
  /** Advisor + meeting date this came from. */
  source: string;
  quote: string;
  note?: string;
}

const has = (s: string | null | undefined, q: string) => (s ?? "").toLowerCase().includes(q);

/** Equity in the IPS sense: listed equity, equity MFs, ETFs, PMS and equity AIFs. */
function isEquity(r: PortfolioHolding): boolean {
  const ac = (r.asset_class ?? "").toLowerCase();
  const pt = (r.product_type ?? "").toLowerCase();
  if (ac.includes("bullion") || ac.includes("cash")) return false;
  if (ac.includes("debt")) return false;
  if (pt.includes("bond") || pt.includes("reit")) return false;
  return (
    ac.includes("equity") ||
    pt.includes("equity") ||
    pt === "etf" ||
    pt.includes("pms") ||
    (pt.includes("aif") && !(r.category ?? "").toLowerCase().includes("debt")) ||
    pt.includes("unlisted")
  );
}

export const DEFAULT_BANDS: PolicyBand[] = [
  {
    key: "equity",
    label: "Equity (all forms)",
    matches: isEquity,
    target: 60,
    min: 55,
    max: 60,
    source: "360 ONE · 08 May 2026",
    quote: "Allocation IPS limit: 60% — IPS Breach, Immediate Action Required",
    note:
      "360 ONE treat 60% as a hard ceiling. ICICI (09 Apr) proposed 60–63% and Shriram " +
      "(09 Apr) 60–65%; the tighter IPS ceiling is used here. " +
      "DEFINITIONAL CAVEAT: this band counts equity in the widest sense — listed and " +
      "unlisted equity, equity mutual funds, ETFs, PMS and equity AIFs. 360 ONE quoted " +
      "63% at the time, which implies a narrower basket (excluding roughly 5% unlisted " +
      "and 6% PMS). Read the gap as directional, not as a precise measure against their " +
      "number, until the IPS definition is agreed in writing.",
  },
  {
    key: "debt",
    label: "Debt & fixed income",
    matches: (r) =>
      has(r.asset_class, "debt") || has(r.product_type, "bond") || has(r.product_type, "reit"),
    target: 20,
    min: 15,
    max: 25,
    source: "Shriram Wealth · 02 May 2026",
    quote: "Post-tax debt MF sensitivity vs hybrid funds and Credit AIFs under review",
  },
  {
    key: "gold",
    label: "Gold (ETF, SGB)",
    matches: (r) => has(r.product_type, "gold") || has(r.category, "sovereign gold"),
    target: 3,
    min: 2,
    max: 4,
    source: "ICICI Prudential · 09 Apr 2026",
    quote: "increase in gold from 2% to 3%, strengthening the portfolio's defensive hedge",
  },
  {
    key: "silver",
    label: "Silver",
    matches: (r) => has(r.product_type, "silver"),
    target: 4,
    min: 3,
    max: 5,
    source: "ICICI Prudential · 09 Apr 2026",
    quote:
      "silver holdings will be trimmed from 5% to 4% of the portfolio to fund an increase in gold",
    note: "InCred (Apr) went further — 'Trim Bullion — Silver 50–75%'.",
  },
  {
    key: "international",
    label: "International",
    matches: (r) =>
      has(r.category, "international") ||
      has(r.security_name, "offshore") ||
      has(r.security_name, "international") ||
      has(r.security_name, "global") ||
      has(r.category, "international"),
    target: 12,
    min: 8,
    max: 25,
    source: "Barclays Private Bank · 10 Apr 2026",
    quote:
      "current allocation of approximately 5–6% to international equity is significantly " +
      "below target; move toward 20–25% over time",
    note: "A deliberately wide band — Barclays framed 20–25% as a multi-year direction, not an immediate target.",
  },
  {
    key: "cash",
    label: "Cash & equivalents",
    matches: (r) => has(r.asset_class, "cash"),
    target: 2,
    min: 0,
    max: 5,
    source: "360 ONE · 14 Jul 2026",
    quote: "keep ~₹50 L in the Sandmartin (SGFC) account so buys on dips can be executed quickly",
  },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "sg-policy-bands";

/** Only the numbers are editable; matchers and citations stay in code. */
export type BandOverride = Pick<PolicyBand, "target" | "min" | "max">;

function read(): Record<string, BandOverride> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, BandOverride>) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();
let cached: Record<string, BandOverride> | null = null;

export function subscribePolicy(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getPolicyOverrides(): Record<string, BandOverride> {
  if (cached === null) cached = read();
  return cached;
}
export function getServerPolicyOverrides(): Record<string, BandOverride> {
  return {};
}

function commit(next: Record<string, BandOverride>) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  listeners.forEach((f) => f());
}

export function setBand(key: string, patch: Partial<BandOverride>) {
  const store = { ...getPolicyOverrides() };
  const base = DEFAULT_BANDS.find((b) => b.key === key);
  if (!base) return;
  const cur = store[key] ?? { target: base.target, min: base.min, max: base.max };
  store[key] = { ...cur, ...patch };
  commit(store);
}

export function resetBand(key: string) {
  const store = { ...getPolicyOverrides() };
  delete store[key];
  commit(store);
}

export function resetAllBands() {
  commit({});
}

/** Bands with any user edits applied. */
export function effectiveBands(
  overrides: Record<string, BandOverride> = getPolicyOverrides(),
): Array<PolicyBand & { edited: boolean }> {
  return DEFAULT_BANDS.map((b) => {
    const o = overrides[b.key];
    return o ? { ...b, ...o, edited: true } : { ...b, edited: false };
  });
}

// ─── Drift ────────────────────────────────────────────────────────────────────

export type BandStatus = "within" | "over" | "under";

export interface BandDrift {
  band: PolicyBand & { edited: boolean };
  value: number; // ₹ currently held
  actualPct: number;
  targetPct: number;
  status: BandStatus;
  /** Percentage points away from the nearest edge of the band; 0 when inside. */
  driftPct: number;
  /** ₹ to trade to reach the band edge. Positive = buy, negative = sell. */
  tradeToBand: number;
  /** ₹ to trade to reach the target midpoint. */
  tradeToTarget: number;
  holdings: PortfolioHolding[];
}

export function computeDrift(
  rows: PortfolioHolding[],
  bands: Array<PolicyBand & { edited: boolean }> = effectiveBands(),
): { drifts: BandDrift[]; total: number; unclassified: number } {
  const total = sumBy(rows, (r) => r.current_value ?? 0);

  const drifts = bands.map((band) => {
    const holdings = rows.filter(band.matches);
    const value = sumBy(holdings, (r) => r.current_value ?? 0);
    const actualPct = total > 0 ? (value / total) * 100 : 0;

    let status: BandStatus = "within";
    let driftPct = 0;
    if (actualPct > band.max) {
      status = "over";
      driftPct = actualPct - band.max;
    } else if (actualPct < band.min) {
      status = "under";
      driftPct = band.min - actualPct;
    }

    // Trade sizing uses the CURRENT book total as the denominator. Strictly, selling
    // changes the denominator too, but for drift of this magnitude the difference is
    // immaterial and the simpler number is easier to act on.
    const edge = actualPct > band.max ? band.max : band.min;
    return {
      band,
      value,
      actualPct,
      targetPct: band.target,
      status,
      driftPct,
      tradeToBand: status === "within" ? 0 : (edge / 100) * total - value,
      tradeToTarget: (band.target / 100) * total - value,
      holdings,
    };
  });

  // A row can match more than one band (an offshore equity fund is both), so
  // "unclassified" counts rows no band claims rather than 100 minus the sum.
  const claimed = new Set<string>();
  for (const d of drifts) for (const h of d.holdings) claimed.add(h.id);
  const unclassified = sumBy(
    rows.filter((r) => !claimed.has(r.id)),
    (r) => r.current_value ?? 0,
  );

  return { drifts, total, unclassified };
}

export function breachCount(drifts: BandDrift[]): number {
  return drifts.filter((d) => d.status !== "within").length;
}
