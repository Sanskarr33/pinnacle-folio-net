// All data contracts for the SG Family Wealth dashboard.
// These interfaces are the single source of truth — both dummy-data.ts
// and Supabase query mappers must conform to these shapes.

export interface FamilyKpis {
  totalAUM: number;       // ₹ in rupees
  dayChange: number;      // ₹ in rupees
  dayChangePct: number;   // e.g. 0.142
  unrealisedGain: number; // ₹ in rupees
  unrealisedGainPct: number;
  realisedGain: number;   // ₹ in rupees
  realisedGainPct: number;
  xirr: number;           // e.g. 17.8
  invested: number;       // ₹ in rupees
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
  quantity?: number | null;
  ltp?: number | null;           // last traded price (₹)
  gain_pct?: number | null;      // unrealised gain % (derived if absent)
  adviser?: string | null;
  isin?: string | null;
}
