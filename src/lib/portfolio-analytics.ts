// Pure derivations over `portfolio_detailed_holdings`. No I/O, no React.
//
// TIME ANCHOR: every countdown is measured from the book's `as_on_date`, not the
// wall clock. The table's `holding_period_days` was computed at snapshot time, so
// anchoring anywhere else would make our arithmetic disagree with the source data.

import type {
  PortfolioHolding,
  PortfolioTotals,
  Slice,
  ExitLoadTerm,
  ExitLoadPosition,
  ExitLoadSummary,
  TaxLot,
  TaxSummary,
  HarvestCandidate,
  ConcentrationRisk,
  DerivedAlert,
  DerivedAction,
  DataHealth,
} from "./types";
import { CR, inr, addDays } from "./format";

// ─── Normalisation ────────────────────────────────────────────────────────────
// The import carries free-text entity and broker names straight from broker
// statements. "Veer" and "VEER" are one person; twelve spellings are one broker.
// Without this, every group-by silently fragments the book.

/**
 * Display names for the entity codes used across the import. Case-folding is the
 * ONLY merge performed ("VEER"/"Veer" are one owner); distinct codes stay distinct.
 *
 * SGQ / SGO / AYUTH are confirmed SEPARATE legal entities, not variants of SG —
 * each holds its own folio numbers in the source register. They are expanded to
 * their real portfolio names here. Do not add prefix-based alias merging: three
 * entities subscribing the same amount to the same fund on the same day produce
 * identical unit counts, which looks like duplication but is not.
 */
const ENTITY_CASING: Record<string, string> = {
  sg: "SG",
  smc: "SMC",
  smo: "SMO",
  ssg: "SSG",
  ssi: "SSI",
  veer: "Veer",
  suhel: "Suhel",
  sgq: "SGQuantum",
  sgo: "SGOutsour",
  ayuth: "Ayuthaya",
  "sg family": "SG Family",
  // The workbook's own label for family-level positions with no single owning
  // entity (PMS, AIFs, ULIP, unlisted shares, PPF, NPS, the USD account, cash).
  group: "Group",
};

/** Canonical entity name — case/whitespace only. Distinct codes stay distinct. */
export function normaliseEntity(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "Unattributed";
  return ENTITY_CASING[t.toLowerCase()] ?? t;
}

/**
 * Genuinely duplicated lots.
 *
 * An earlier version guessed at duplicates by matching entity-code prefixes (SG vs
 * SGQ vs SGO) and was wrong every time: those are separate entities that happen to
 * share a prefix, each with its own folio number. Two entities buying an identical
 * amount of the same fund on the same day produce identical units — which looks like
 * a copy-paste error but isn't.
 *
 * The folio number is what actually identifies a holding, so that is what we match
 * on. A repeat of (security + folio + units + purchase date) is a real duplicate.
 */
export function duplicateHoldings(
  rows: PortfolioHolding[],
): Array<{ key: string; rows: PortfolioHolding[] }> {
  const groups = new Map<string, PortfolioHolding[]>();
  for (const r of rows) {
    if (!r.folio_number) continue; // no folio → nothing reliable to match on
    const key = [
      displayName(r).toLowerCase(),
      r.folio_number.trim(),
      r.units ?? r.quantity ?? "",
      r.purchase_date ?? "",
    ].join("|");
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  return Array.from(groups.entries())
    .filter(([, g]) => g.length > 1)
    .map(([key, g]) => ({ key, rows: g }));
}

/**
 * Canonical broker/custodian. Matches on a squashed key so spacing, case and
 * punctuation drop out — the source carries ~28 spellings of 6 real counterparties
 * ("Kotak Secu", "KotakSec", "kotak Sec", "ksecu", "Kotaksec", "Kotak - 1", …).
 *
 * Order matters: the more specific tests run before the generic "kotak" prefix,
 * because Kotak Bank and the Kotak/InCred bond desk are NOT Kotak Securities and
 * collapsing them would misstate custodian concentration.
 */
export function normaliseBroker(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "Unattributed";
  const k = t.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (k.includes("incred")) return "Kotak / InCred";
  if (k === "kotakbnk" || k.startsWith("kotakbank")) return "Kotak Bank";
  if (k.startsWith("kotak") || k.startsWith("ksec")) return "Kotak Securities";
  if (k.startsWith("icic")) return "ICICI Securities";
  if (k.startsWith("5paisa")) return "5paisa";
  if (k.includes("360one") || k.startsWith("iifl")) return "360 ONE / IIFL";
  if (k.startsWith("interactive")) return "Interactive Brokers";
  if (k.startsWith("barclays")) return "Barclays";
  if (k.startsWith("hdfc")) return "HDFC Securities";
  if (k.startsWith("zerodha")) return "Zerodha";
  return t;
}

/** Best available display name for a position. */
export function displayName(r: PortfolioHolding): string {
  return (r.security_name || r.scheme_name || "Unnamed holding").trim();
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

const val = (r: PortfolioHolding) => r.current_value ?? 0;
const inv = (r: PortfolioHolding) => r.invested_value ?? 0;
const gain = (r: PortfolioHolding) => r.unrealised_gain ?? 0;

export function sumBy<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((s, r) => s + (f(r) || 0), 0);
}

/**
 * Value-weighted XIRR. Rows without an XIRR are excluded from both the numerator
 * and the weight base, so a partially-populated column doesn't drag the mean to zero.
 */
export function weightedXirr(rows: PortfolioHolding[]): {
  xirr: number | null;
  coveragePct: number;
} {
  const withX = rows.filter((r) => r.xirr != null && Number.isFinite(r.xirr) && val(r) > 0);
  const base = sumBy(withX, val);
  const all = sumBy(rows, val);
  if (base <= 0) return { xirr: null, coveragePct: 0 };
  return {
    xirr: sumBy(withX, (r) => r.xirr! * val(r)) / base,
    coveragePct: all > 0 ? (base / all) * 100 : 0,
  };
}

export function totals(rows: PortfolioHolding[]): PortfolioTotals {
  const currentValue = sumBy(rows, val);
  const investedValue = sumBy(rows, inv);
  const unrealisedGain = sumBy(rows, gain);
  const { xirr, coveragePct } = weightedXirr(rows);
  const entities = new Set(rows.map((r) => normaliseEntity(r.entity_name)));
  const dates = rows
    .map((r) => r.as_on_date)
    .filter(Boolean)
    .sort();
  return {
    currentValue,
    investedValue,
    unrealisedGain,
    unrealisedGainPct: investedValue > 0 ? (unrealisedGain / investedValue) * 100 : 0,
    weightedXirr: xirr,
    xirrCoveragePct: coveragePct,
    holdingCount: rows.length,
    entityCount: entities.size,
    asOnDate: dates[dates.length - 1] ?? null,
  };
}

/** Group rows by a key function and return slices sorted by value, descending. */
export function sliceBy(rows: PortfolioHolding[], keyFn: (r: PortfolioHolding) => string): Slice[] {
  const groups = new Map<string, PortfolioHolding[]>();
  for (const r of rows) {
    const k = keyFn(r) || "Other";
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const book = sumBy(rows, val);
  return Array.from(groups.entries())
    .map(([key, g]) => {
      const current = sumBy(g, val);
      const invested = sumBy(g, inv);
      const gn = sumBy(g, gain);
      return {
        key,
        current,
        invested,
        gain: gn,
        gainPct: invested > 0 ? (gn / invested) * 100 : 0,
        pctOfBook: book > 0 ? (current / book) * 100 : 0,
        count: g.length,
        xirr: weightedXirr(g).xirr,
      };
    })
    .sort((a, b) => b.current - a.current);
}

/** Consolidate the same security held across several entities into one line. */
export function consolidateSecurities(rows: PortfolioHolding[]): Slice[] {
  return sliceBy(rows, (r) => displayName(r));
}

// ─── Exit load ────────────────────────────────────────────────────────────────

/**
 * Parse the exit-load shorthand used in the source sheets.
 * "1/365" → 1% if redeemed within 365 days. "Nil"/"0"/"" → no load.
 * Anything unrecognised returns undefined so callers can count it as unparseable.
 */
export function parseExitLoad(raw: string | null | undefined): ExitLoadTerm | null | undefined {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^(nil|na|n\/a|none|0|0%)$/i.test(t)) return null;
  // "1/365", "0.25/7", "1%/365", "1/365 days"
  const m = t.match(/^(\d*\.?\d+)\s*%?\s*\/\s*(\d+)\s*(?:days?)?$/i);
  if (!m) return undefined;
  const ratePct = parseFloat(m[1]);
  const days = parseInt(m[2], 10);
  if (!Number.isFinite(ratePct) || !Number.isFinite(days) || days <= 0) return undefined;
  return { ratePct, days };
}

export function exitLoadSummary(rows: PortfolioHolding[]): ExitLoadSummary {
  const locked: ExitLoadPosition[] = [];
  let free = 0,
    unparseable = 0,
    noTerm = 0;

  for (const r of rows) {
    const term = parseExitLoad(r.exit_load);
    if (term === undefined) {
      unparseable++;
      continue;
    }
    if (term === null) {
      noTerm++;
      continue;
    }

    const daysHeld = r.holding_period_days ?? -1;
    if (daysHeld < 0) {
      unparseable++;
      continue;
    }

    if (daysHeld >= term.days) {
      free++;
      continue;
    }

    const daysRemaining = term.days - daysHeld;
    locked.push({
      row: r,
      term,
      daysHeld,
      daysRemaining,
      // The window runs from purchase, so the lapse date is purchase + window.
      freeOn: r.purchase_date
        ? addDays(r.purchase_date, term.days).toISOString().slice(0, 10)
        : null,
      costIfSoldToday: val(r) * (term.ratePct / 100),
      locked: true,
    });
  }

  locked.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return {
    locked,
    free,
    lockedValue: sumBy(locked, (p) => val(p.row)),
    totalCost: sumBy(locked, (p) => p.costIfSoldToday),
    unparseable,
    noTerm,
  };
}

// ─── Tax lots ─────────────────────────────────────────────────────────────────

/** Days a lot must be held to qualify as long term, by taxation regime. */
const LONG_TERM_DAYS = { Equity: 365, Debt: 1095, Other: 1095 } as const;

/** Map the free-text `taxation` column onto a regime. Numeric rates imply debt-like. */
export function taxRegime(raw: string | null | undefined): "Equity" | "Debt" | "Other" {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "Other";
  if (t === "equity") return "Equity";
  if (t === "debt") return "Debt";
  if (/^\d*\.?\d+$/.test(t)) return "Debt"; // a slab rate was recorded instead of a label
  return "Other";
}

/**
 * Build tax lots. `holding_term` from the source is authoritative for the current
 * classification; the threshold is used only to compute the countdown to long term.
 */
export function taxLots(rows: PortfolioHolding[]): TaxLot[] {
  const lots: TaxLot[] = [];
  for (const r of rows) {
    const daysHeld = r.holding_period_days;
    if (daysHeld == null) continue;
    const regime = taxRegime(r.taxation);
    const threshold = LONG_TERM_DAYS[regime];
    const declared =
      r.holding_term === "Long Term" || r.holding_term === "Short Term"
        ? r.holding_term
        : daysHeld >= threshold
          ? "Long Term"
          : "Short Term";
    const daysToLongTerm = declared === "Long Term" ? 0 : Math.max(0, threshold - daysHeld);
    lots.push({
      row: r,
      term: declared,
      regime,
      daysHeld,
      daysToLongTerm,
      maturesOn:
        daysToLongTerm > 0 && r.purchase_date
          ? addDays(r.purchase_date, threshold).toISOString().slice(0, 10)
          : null,
      gain: gain(r),
    });
  }
  return lots;
}

/** @param withinDays countdown window for "about to become long term". */
export function taxSummary(rows: PortfolioHolding[], withinDays = 90): TaxSummary {
  const lots = taxLots(rows);
  const st = lots.filter((l) => l.term === "Short Term");
  const lt = lots.filter((l) => l.term === "Long Term");
  // Only gains are worth timing — holding a loser for tax status saves nothing.
  const maturingSoon = st
    .filter((l) => l.daysToLongTerm > 0 && l.daysToLongTerm <= withinDays && l.gain > 0)
    .sort((a, b) => a.daysToLongTerm - b.daysToLongTerm);

  return {
    shortTerm: {
      count: st.length,
      value: sumBy(st, (l) => val(l.row)),
      gain: sumBy(st, (l) => l.gain),
    },
    longTerm: {
      count: lt.length,
      value: sumBy(lt, (l) => val(l.row)),
      gain: sumBy(lt, (l) => l.gain),
    },
    maturingSoon,
    maturingSoonGain: sumBy(maturingSoon, (l) => l.gain),
    unclassified: rows.length - lots.length,
  };
}

// ─── Loss harvesting ──────────────────────────────────────────────────────────

/** Losing positions, worst first, with the exit-load friction of realising each. */
export function harvestCandidates(rows: PortfolioHolding[]): HarvestCandidate[] {
  return rows
    .filter((r) => gain(r) < 0)
    .map((r) => {
      const term = parseExitLoad(r.exit_load);
      const daysHeld = r.holding_period_days ?? Number.MAX_SAFE_INTEGER;
      const stillLocked = term && daysHeld < term.days;
      return {
        row: r,
        loss: Math.abs(gain(r)),
        lossPct: Math.abs(r.gain_percent ?? (inv(r) > 0 ? (gain(r) / inv(r)) * 100 : 0)),
        term: r.holding_term,
        exitLoadCost: stillLocked ? val(r) * (term.ratePct / 100) : 0,
      };
    })
    .sort((a, b) => b.loss - a.loss);
}

// ─── Concentration ────────────────────────────────────────────────────────────

export function concentration(rows: PortfolioHolding[]): ConcentrationRisk {
  const book = sumBy(rows, val);
  const empty: ConcentrationRisk = {
    topSecurityPct: 0,
    topSecurityName: "—",
    topEntityPct: 0,
    topEntityName: "—",
    topCategoryPct: 0,
    topCategoryName: "—",
    top5Pct: 0,
    top10Pct: 0,
    hhi: 0,
    effectiveHoldings: 0,
  };
  if (book <= 0) return empty;

  const secs = consolidateSecurities(rows);
  const ents = sliceBy(rows, (r) => normaliseEntity(r.entity_name));
  const cats = sliceBy(rows, (r) => r.asset_class?.trim() || "Unclassified");

  const weights = secs.map((s) => s.current / book);
  const hhi = weights.reduce((s, w) => s + w * w, 0);

  return {
    topSecurityPct: secs[0]?.pctOfBook ?? 0,
    topSecurityName: secs[0]?.key ?? "—",
    topEntityPct: ents[0]?.pctOfBook ?? 0,
    topEntityName: ents[0]?.key ?? "—",
    topCategoryPct: cats[0]?.pctOfBook ?? 0,
    topCategoryName: cats[0]?.key ?? "—",
    top5Pct: secs.slice(0, 5).reduce((s, x) => s + x.pctOfBook, 0),
    top10Pct: secs.slice(0, 10).reduce((s, x) => s + x.pctOfBook, 0),
    hhi: hhi * 10000,
    effectiveHoldings: hhi > 0 ? 1 / hhi : 0,
  };
}

// ─── Derived alerts ───────────────────────────────────────────────────────────
// Everything here is computed from the book. Nothing is authored by hand.

export type MoneyFormatter = (n: number | null | undefined) => string;

export function deriveAlerts(rows: PortfolioHolding[], fmt: MoneyFormatter = inr): DerivedAlert[] {
  if (rows.length === 0) return [];
  const out: DerivedAlert[] = [];
  const conc = concentration(rows);
  const el = exitLoadSummary(rows);
  const tax = taxSummary(rows);
  const harvest = harvestCandidates(rows);
  const book = sumBy(rows, val);

  // Single-security concentration — the classic family-office breach.
  if (conc.topSecurityPct >= 5) {
    out.push({
      id: "conc-security",
      severity: conc.topSecurityPct >= 10 ? "high" : "medium",
      title: "Single-security concentration",
      detail: `${conc.topSecurityName} is ${conc.topSecurityPct.toFixed(1)}% of the consolidated book.`,
      metric: `${conc.topSecurityPct.toFixed(1)}%`,
      href: "/allocation",
    });
  }

  // Top-10 concentration.
  if (conc.top10Pct >= 35) {
    out.push({
      id: "conc-top10",
      severity: conc.top10Pct >= 50 ? "high" : "medium",
      title: "Top-10 concentration",
      detail: `The ten largest positions carry ${conc.top10Pct.toFixed(1)}% of book value; it behaves like ${Math.round(conc.effectiveHoldings)} equal-weight holdings.`,
      metric: `${conc.top10Pct.toFixed(1)}%`,
      href: "/allocation",
    });
  }

  // Entity concentration.
  if (conc.topEntityPct >= 40) {
    out.push({
      id: "conc-entity",
      severity: conc.topEntityPct >= 55 ? "medium" : "low",
      title: "Entity concentration",
      detail: `${conc.topEntityName} holds ${conc.topEntityPct.toFixed(1)}% of family assets — review succession and tax spread.`,
      metric: `${conc.topEntityPct.toFixed(1)}%`,
      href: "/entities",
    });
  }

  // Capital locked behind exit loads.
  if (el.locked.length > 0) {
    out.push({
      id: "exit-load",
      severity: el.totalCost >= 0.5 * CR ? "high" : "medium",
      title: "Capital inside exit-load windows",
      detail: `${el.locked.length} positions worth ${fmt(el.lockedValue)} would cost ${fmt(el.totalCost)} in exit load if liquidated today.`,
      metric: fmt(el.totalCost),
      href: "/exit-load",
    });
  }

  // Gains about to reclassify to long term.
  if (tax.maturingSoon.length > 0) {
    out.push({
      id: "tax-maturing",
      severity: "medium",
      title: "Gains approaching long-term status",
      detail: `${tax.maturingSoon.length} short-term lots holding ${fmt(tax.maturingSoonGain)} of gains cross the long-term threshold within 90 days — selling early forfeits the lower rate.`,
      metric: fmt(tax.maturingSoonGain),
      href: "/capital-gains",
    });
  }

  // Harvestable losses.
  const totalLoss = sumBy(harvest, (h) => h.loss);
  if (harvest.length > 0 && totalLoss > 0.1 * CR) {
    out.push({
      id: "harvest",
      severity: "low",
      title: "Unrealised losses available to harvest",
      detail: `${harvest.length} positions carry ${fmt(totalLoss)} of unrealised loss that could offset realised gains this financial year.`,
      metric: fmt(totalLoss),
      href: "/capital-gains",
    });
  }

  // Idle cash.
  const cash = sumBy(
    rows.filter((r) => /cash/i.test(r.asset_class ?? "")),
    val,
  );
  if (cash > 0.02 * book) {
    out.push({
      id: "cash-drag",
      severity: "low",
      title: "Cash drag",
      detail: `${fmt(cash)} sits in cash (${((cash / book) * 100).toFixed(1)}% of book) — consider deploying to liquid funds.`,
      metric: fmt(cash),
      href: "/allocation",
    });
  }

  // Data quality is itself a risk in a reconciled book.
  const health = dataHealth(rows);
  if (health.missingXirr > rows.length * 0.2) {
    out.push({
      id: "data-xirr",
      severity: "low",
      title: "Incomplete performance data",
      detail: `${health.missingXirr} of ${health.totalRows} positions have no XIRR recorded, so portfolio return is computed on partial coverage.`,
      metric: `${Math.round((health.missingXirr / health.totalRows) * 100)}%`,
      href: "/data-import",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ─── Derived actions ──────────────────────────────────────────────────────────
// Dated, monetised items pulled from real deadlines in the book.

export function deriveActions(rows: PortfolioHolding[], limit = 6): DerivedAction[] {
  const out: DerivedAction[] = [];
  const el = exitLoadSummary(rows);
  const tax = taxSummary(rows, 120);

  for (const p of el.locked.slice(0, 4)) {
    out.push({
      id: `exit-${p.row.id}`,
      dueDate: p.freeOn,
      title: `Exit load lapses — ${displayName(p.row)}`,
      detail: `${p.term.ratePct}% load for ${p.daysRemaining} more days · ${normaliseEntity(p.row.entity_name)}`,
      amount: p.costIfSoldToday,
      href: "/exit-load",
    });
  }

  for (const l of tax.maturingSoon.slice(0, 4)) {
    out.push({
      id: `ltcg-${l.row.id}`,
      dueDate: l.maturesOn,
      title: `Turns long term — ${displayName(l.row)}`,
      detail: `${l.daysToLongTerm} days to the ${l.regime.toLowerCase()} long-term threshold · ${normaliseEntity(l.row.entity_name)}`,
      amount: l.gain,
      href: "/capital-gains",
    });
  }

  return out
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, limit);
}

// ─── Data health ──────────────────────────────────────────────────────────────

export function dataHealth(rows: PortfolioHolding[]): DataHealth {
  const rawBrokers = new Set(rows.map((r) => (r.broker_name ?? "").trim()).filter(Boolean));
  const normBrokers = new Set(
    rows.map((r) => normaliseBroker(r.broker_name)).filter((b) => b !== "Unattributed"),
  );

  return {
    totalRows: rows.length,
    missingPurchaseDate: rows.filter((r) => !r.purchase_date).length,
    missingXirr: rows.filter((r) => r.xirr == null).length,
    missingCategory: rows.filter((r) => !r.category).length,
    missingBroker: rows.filter((r) => !r.broker_name).length,
    missingExitLoad: rows.filter((r) => !r.exit_load).length,
    brokerAliasesMerged: Math.max(0, rawBrokers.size - normBrokers.size),
    duplicateHoldings: duplicateHoldings(rows).length,
    unreachableRows: unreachableRows(rows).length,
    unparseableExitLoad: rows.filter((r) => parseExitLoad(r.exit_load) === undefined).length,
  };
}

// ─── Product filtering ────────────────────────────────────────────────────────
// One place that decides what belongs on each product page, so the pages stay
// consistent and a reclassified row can't fall through every filter at once.

export type ProductKey =
  | "equity"
  | "mutual-funds"
  | "etfs"
  | "pms"
  | "aifs"
  | "ulips"
  | "bonds-fds"
  | "international"
  | "bullion"
  | "other";

const has = (s: string | null | undefined, q: string) => (s ?? "").toLowerCase().includes(q);

/**
 * NOTE: these are lenses, not a partition. A row can legitimately appear on more
 * than one page — an offshore fund-of-funds is both a Mutual Fund and International
 * exposure. Only `vehiclePartition()` below is safe to sum across.
 */
export const PRODUCT_FILTERS: Record<ProductKey, (r: PortfolioHolding) => boolean> = {
  equity: (r) => has(r.product_type, "direct equity") || has(r.product_type, "unlisted"),
  "mutual-funds": (r) => has(r.product_type, "mutual fund"),
  etfs: (r) => r.product_type?.trim().toLowerCase() === "etf",
  pms: (r) => has(r.product_type, "pms"),
  aifs: (r) => has(r.product_type, "aif"),
  ulips: (r) => has(r.product_type, "ulip"),
  "bonds-fds": (r) =>
    has(r.product_type, "bond") ||
    has(r.product_type, "reit") ||
    has(r.asset_class, "debt") ||
    has(r.product_type, "fd"),
  international: (r) =>
    has(r.security_name, "offshore") ||
    has(r.security_name, "international") ||
    has(r.security_name, "global") ||
    has(r.security_name, "us ") ||
    has(r.category, "international") ||
    has(r.scheme_name, "offshore"),
  bullion: (r) =>
    has(r.asset_class, "bullion") || has(r.product_type, "gold") || has(r.product_type, "silver"),
  // Catch-all so nothing in the book is unreachable from the UI.
  other: (r) =>
    has(r.product_type, "other") || has(r.product_type, "cash") || has(r.asset_class, "cash"),
};

export function filterProduct(rows: PortfolioHolding[], key: ProductKey): PortfolioHolding[] {
  return rows.filter(PRODUCT_FILTERS[key]);
}

/**
 * Mutually-exclusive vehicle buckets — every row lands in exactly one, so these
 * sum to the book total. Use this for allocation charts; use PRODUCT_FILTERS for pages.
 */
export function vehiclePartition(rows: PortfolioHolding[]): Slice[] {
  return sliceBy(rows, (r) => {
    const pt = (r.product_type ?? "").trim().toLowerCase();
    if (!pt) return "Unclassified";
    if (pt.includes("mutual fund")) return "Mutual Funds";
    if (pt.includes("direct equity")) return "Direct Equity";
    if (pt.includes("unlisted")) return "Unlisted Equity";
    if (pt.includes("gold") || pt.includes("silver")) return "Bullion";
    if (pt === "etf") return "ETFs";
    if (pt.includes("pms")) return "PMS";
    if (pt.includes("aif")) return "AIFs";
    if (pt.includes("ulip")) return "ULIPs";
    if (pt.includes("bond") || pt.includes("reit")) return "Bonds & REITs";
    if (pt.includes("cash")) return "Cash";
    return "Other Investments";
  });
}

/** Rows not reachable from any product page — a coverage guard for the data-import view. */
export function unreachableRows(rows: PortfolioHolding[]): PortfolioHolding[] {
  const keys = Object.keys(PRODUCT_FILTERS) as ProductKey[];
  return rows.filter((r) => !keys.some((k) => PRODUCT_FILTERS[k](r)));
}
