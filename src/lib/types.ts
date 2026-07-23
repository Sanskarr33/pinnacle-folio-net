// Data contracts for the SG Family Wealth dashboard.
//
// SOURCE OF TRUTH: `portfolio_detailed_holdings` in Supabase.
// It is the only table carrying xirr, exit_load, holding_term, purchase_date,
// taxation and broker_name — the columns every actionable view depends on.
// All monetary values are in Indian Rupees (₹).

/**
 * A row of `portfolio_detailed_holdings`, mirroring the live table exactly.
 * Nearly every column is nullable in practice — the import is reconciled from
 * broker statements of varying completeness, so treat absence as normal.
 */
export interface PortfolioHolding {
  id: string;
  as_on_date: string | null; // ISO — snapshot date of the whole book

  // Provenance
  report_section: string | null; // "Equity MF Detail", "Bullion Detail", …
  source_sheet: string | null;
  source_page: number | null;
  source_row: number | null;
  notes: string | null;
  created_at: string | null;

  // Ownership & custody
  entity_name: string | null; // "SG", "SMC", "Veer" — needs normalisation
  account_name: string | null;
  broker_name: string | null; // ~12 spellings of Kotak — needs normalisation
  advisor_name: string | null; // 100% null in the current dataset
  folio_number: string | null;

  // Classification
  asset_class: string | null; // "Equity Mutual Funds", "Bullion", …
  category: string | null; // "Large cap", "Flexi cap", …
  product_type: string | null; // "Mutual Fund", "Direct Equity", …
  taxation: string | null; // "Equity" | "Debt" | a numeric rate string
  scheme_type: string | null; // "Direct" | "Regular"
  fund_type: string | null; // "Growth" | "IDCW"
  isin: string | null;
  ticker: string | null;

  // Identity
  security_name: string | null;
  scheme_name: string | null;

  // Position
  quantity: number | null;
  units: number | null;
  purchase_date: string | null; // ISO
  purchase_price: number | null;
  purchase_nav: number | null;
  current_price: number | null;
  current_nav: number | null;

  // Valuation
  invested_value: number | null; // ₹
  current_value: number | null; // ₹
  unrealised_gain: number | null; // ₹
  gain_percent: number | null; // 119.0 means +119.0%
  allocation_percent: number | null;
  xirr: number | null; // 16.42 means 16.42%

  // Terms & tax
  exit_load: string | null; // "1/365" = 1% within 365 days; "Nil"; null
  holding_period_days: number | null;
  holding_term: string | null; // "Long Term" | "Short Term"

  // Rarely populated
  expense_ratio: number | null;
  pe_ratio: number | null;
  aum: number | null;
}

// ─── Derived analytics ────────────────────────────────────────────────────────

export interface PortfolioTotals {
  currentValue: number;
  investedValue: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  weightedXirr: number | null;
  xirrCoveragePct: number; // share of value that actually carries an XIRR
  holdingCount: number;
  entityCount: number;
  asOnDate: string | null;
}

export interface Slice {
  key: string;
  current: number;
  invested: number;
  gain: number;
  gainPct: number;
  pctOfBook: number;
  count: number;
  xirr: number | null;
}

export interface ExitLoadTerm {
  ratePct: number; // 1 means 1%
  days: number; // window length in days
}

export interface ExitLoadPosition {
  row: PortfolioHolding;
  term: ExitLoadTerm;
  daysHeld: number;
  daysRemaining: number; // 0 once free
  freeOn: string | null; // ISO date the load lapses
  costIfSoldToday: number; // ₹
  locked: boolean;
}

export interface ExitLoadSummary {
  locked: ExitLoadPosition[];
  free: number; // count of positions past their window
  lockedValue: number; // ₹
  totalCost: number; // ₹ payable if the entire locked book were sold today
  unparseable: number; // rows with an exit_load we could not read
  noTerm: number; // rows with no exit_load recorded
}

export interface TaxLot {
  row: PortfolioHolding;
  term: "Short Term" | "Long Term";
  regime: "Equity" | "Debt" | "Other";
  daysHeld: number;
  daysToLongTerm: number; // 0 when already long term
  maturesOn: string | null; // ISO date it turns long term
  gain: number; // ₹ unrealised
}

export interface TaxSummary {
  shortTerm: { count: number; value: number; gain: number };
  longTerm: { count: number; value: number; gain: number };
  maturingSoon: TaxLot[]; // short-term lots inside the countdown window
  maturingSoonGain: number; // ₹ gain that would reclassify
  unclassified: number;
}

export interface HarvestCandidate {
  row: PortfolioHolding;
  loss: number; // ₹, positive magnitude
  lossPct: number;
  term: string | null;
  exitLoadCost: number; // ₹ friction to realise the loss
}

export interface ConcentrationRisk {
  topSecurityPct: number;
  topSecurityName: string;
  topEntityPct: number;
  topEntityName: string;
  topCategoryPct: number;
  topCategoryName: string;
  top5Pct: number;
  top10Pct: number;
  hhi: number; // Herfindahl–Hirschman index over securities, 0–10000
  effectiveHoldings: number; // 1/Σw² — how many positions the book really behaves like
}

export type AlertSeverity = "high" | "medium" | "low";

export interface DerivedAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metric: string | null; // headline figure for the alert
  href: string | null; // page that lets you act on it
}

export interface DerivedAction {
  id: string;
  dueDate: string | null; // ISO
  title: string;
  detail: string;
  amount: number | null; // ₹ at stake
  href: string | null;
}

export interface DataHealth {
  totalRows: number;
  missingPurchaseDate: number;
  missingXirr: number;
  missingCategory: number;
  missingBroker: number;
  missingExitLoad: number;
  /** Broker spellings collapsed by normalisation, e.g. 12 spellings of Kotak → 1. */
  brokerAliasesMerged: number;
  /** Lots repeated on the same folio — the only reliable duplicate signal. */
  duplicateHoldings: number;
  /** Rows no product page can reach. */
  unreachableRows: number;
  /** exit_load strings we could not parse. */
  unparseableExitLoad: number;
}
