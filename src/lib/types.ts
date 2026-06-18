// All data contracts for the SG Family Wealth dashboard.
// These interfaces are the single source of truth — both dummy-data.ts
// and Supabase query mappers must conform to these shapes.

export interface FamilyKpis {
  totalAUM: number;            // ₹ in rupees — from sg_family_holdings_import
  invested: number;            // ₹ in rupees — from sg_family_holdings_import
  unrealisedGain: number;      // ₹ in rupees — from sg_family_holdings_import
  unrealisedGainPct: number;   // derived from invested/unrealisedGain
  // Not available in holdings table — null when data source is live Supabase
  dayChange: number | null;
  dayChangePct: number | null;
  realisedGain: number | null;
  realisedGainPct: number | null;
  xirr: number | null;
}

export interface AssetClass {
  name: string;    // "Equity", "Debt", etc.
  value: number;   // percentage, e.g. 60.54
  amount: number;  // ₹ in rupees
}

export interface ProductExposure {
  product: string; // "Direct Equity", "Mutual Funds", etc.
  value: number;   // ₹ in rupees
  pct: number;     // percentage
}

export interface EntityAllocation {
  entity: string;
  value: number; // ₹ in rupees
}

export interface WealthPoint {
  month: string; // "Jun '24"
  value: number; // ₹ Crore
}

export interface AdvisorAUM {
  advisor: string;
  aum: number;     // ₹ Crore
  returns: number; // percentage
}

export interface Holding {
  name: string;
  type: string;     // "Equity" | "MF" | "PMS" | "ETF" | "AIF"
  entity: string;
  qty: number;
  ltp: number;      // last traded price, 0 for non-traded instruments
  value: number;    // ₹ Crore
  gainPct: number;
}

export interface TopMovers {
  gainers: Mover[];
  losers: Mover[];
}

export interface Mover {
  name: string;
  change: number; // percentage
  value: number;  // ₹ Crore
}

export interface Transaction {
  date: string;       // ISO "YYYY-MM-DD"
  entity: string;
  instrument: string;
  type: string;       // "BUY" | "SELL" | "SIP" | "TOP-UP"
  qty: number;
  amount: number;     // ₹ in rupees
}

export interface RiskAlert {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface ActionItem {
  due: string;    // "10 Jun"
  title: string;
  owner: string;
}

export interface RiskHeatmapRow {
  sector: string;
  equity: number; // 0–1 concentration score
  debt: number;
  intl: number;
}

export interface MarketTicker {
  label: string;  // "NIFTY"
  value: string;  // "24,812"
  change: string; // "+0.42%"
  up: boolean;
}

// Row from portfolio_detailed_holdings.
// Monetary values assumed to be in Indian Rupees (₹).
// Adjust the CR constant in holdings components if your import stores values in Crore.
export interface PortfolioHolding {
  report_section: string | null;
  asset_class: string | null;
  category: string | null;
  product_type: string | null;
  security_name: string | null;
  scheme_name: string | null;
  current_value: number | null;    // ₹ rupees
  invested_value: number | null;   // ₹ rupees
  unrealised_gain: number | null;  // ₹ rupees
  gain_percent: number | null;     // e.g. 22.4 for 22.4%
  allocation_percent: number | null;
  xirr: number | null;             // e.g. 18.2 for 18.2%
  exit_load: string | null;        // free-form, e.g. "1% if redeemed within 1 year"
  holding_term: string | null;     // "Short Term" | "Long Term" | duration string
}

// Raw row shape of sg_family_holdings_import.
// All monetary values are in Indian Rupees (₹).
// Optional columns may not exist in every export — code handles their absence.
export interface SGHoldingRow {
  security_name: string;
  asset_class: string;
  product_type: string;
  current_value: number;    // ₹ rupees — source for AUM
  invested_value: number;   // ₹ rupees — source for invested amount
  unrealised_gain: number;  // ₹ rupees — source for unrealised P/L
  // Optional columns — present in some exports
  entity_name?: string | null;
  account_name?: string | null;
  quantity?: number | null;
  ltp?: number | null;           // last traded price (₹) — legacy alias
  current_price?: number | null;
  average_cost?: number | null;
  gain_pct?: number | null;      // legacy alias
  gain_percent?: number | null;  // unrealised gain %
  allocation_percent?: number | null;
  advisor_name?: string | null;
  adviser?: string | null;
  category?: string | null;
  isin?: string | null;
  ticker?: string | null;
  as_on_date?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
}
