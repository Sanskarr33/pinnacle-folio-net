// Data access for the SG Family Wealth dashboard.
//
// SOURCE OF TRUTH: src/data/holdings-snapshot.json, generated from the Excel book by
//   python scripts/import_excel.py
//
// Why the snapshot and not Supabase?
//   * The Supabase table is a 10-Jun-2026 snapshot; the workbook is 22-Jul-2026.
//   * The anon key is read-only (row-level security rejects writes), so the app
//     cannot refresh that table itself.
//   * The workbook is the book the family actually maintains, so importing from it
//     keeps the dashboard on the same figures as their own reporting pack.
//
// getSnapshotComparison() still reads Supabase so the Data Source page can show how
// far the database has drifted from the workbook.

import snapshot from "@/data/holdings-snapshot.json";
import transactions from "@/data/transactions-snapshot.json";
import { supabase } from "./supabase";
import type { PortfolioHolding } from "./types";

export interface CapitalGainRow {
  category: string;
  saleAmount: number;
  shortTermGain: number;
  shortTermTax: number;
  longTermGain: number;
  longTermTax: number;
  netGain: number;
  netTax: number;
}

export interface RealisedTrade {
  id: string;
  assetGroup: string | null;
  saleDate: string | null;
  securityName: string;
  entity: string | null;
  broker: string | null;
  folio: string | null;
  units: number | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  cost: number | null;
  salePrice: number | null;
  saleAmount: number | null;
  profitLoss: number;
}

export interface PurchaseTxn {
  id: string;
  assetGroup: string | null;
  date: string;
  securityName: string;
  entity: string | null;
  broker: string | null;
  units: number | null;
  price: number | null;
  amount: number;
}

export interface TransactionsSnapshot {
  source: string;
  capitalGains: {
    asOn: string | null;
    financialYear: string;
    byCategory: CapitalGainRow[];
    total: CapitalGainRow | null;
  };
  realisedLedger: {
    financialYear: string | null;
    from: string | null;
    to: string | null;
    trades: RealisedTrade[];
  };
  purchases: PurchaseTxn[];
  notes: string[];
}

const BOOK = snapshot.holdings as unknown as PortfolioHolding[];
const TXN = transactions as unknown as TransactionsSnapshot;

/** Metadata about the loaded snapshot, for provenance display. */
export const snapshotMeta = {
  source: snapshot.source as string,
  asOnDate: snapshot.asOnDate as string,
  rowCount: snapshot.rowCount as number,
  totalValue: snapshot.totalValue as number,
};

/** The whole book. Async to keep the React Query call sites unchanged. */
export async function fetchBook(): Promise<PortfolioHolding[]> {
  return BOOK;
}

export async function fetchTransactions(): Promise<TransactionsSnapshot> {
  return TXN;
}

/**
 * Clear cached reads after a write.
 *
 * The book itself is a bundled snapshot, so it cannot change at runtime — but the
 * Supabase-backed comparison and history queries can, and a page that has just
 * inserted a transaction should not keep showing pre-insert figures. Callers pass
 * their queryClient; without one this is a no-op rather than an error, so callers
 * outside React need no special case.
 */
export function invalidateCache(queryClient?: {
  invalidateQueries: (f: { queryKey: readonly unknown[] }) => void;
}) {
  if (!queryClient) return;
  for (const key of [["snapshotComparison"], ["portfolioHistory"], ["book"]]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

/**
 * Compare the bundled workbook snapshot against what is still sitting in Supabase.
 * Supabase failures are swallowed — this panel is informational, never load-bearing.
 */
export async function getSnapshotComparison(): Promise<{
  workbook: { rows: number; value: number; asOn: string | null; label: string };
  supabase: { rows: number; value: number; asOn: string | null; label: string } | null;
}> {
  const workbook = {
    rows: BOOK.length,
    value: BOOK.reduce((s, r) => s + (r.current_value ?? 0), 0),
    asOn: snapshotMeta.asOnDate,
    label: snapshotMeta.source,
  };

  let db: { rows: number; value: number; asOn: string | null; label: string } | null = null;
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("portfolio_detailed_holdings")
        .select("current_value,as_on_date");
      if (!error && data) {
        const rows = data as Array<{ current_value: number | null; as_on_date: string | null }>;
        db = {
          rows: rows.length,
          value: rows.reduce((s, r) => s + (r.current_value ?? 0), 0),
          asOn:
            rows
              .map((r) => r.as_on_date)
              .filter(Boolean)
              .sort()
              .pop() ?? null,
          label: "portfolio_detailed_holdings (Supabase)",
        };
      }
    }
  } catch {
    db = null;
  }

  return { workbook, supabase: db };
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryPoint {
  asOn: string;
  value: number;
  invested: number;
  gain: number;
  gainPct: number;
  rows: number;
  byAssetClass: Record<string, number>;
}

/**
 * Every dated snapshot Supabase holds, oldest first.
 *
 * This is the ONLY part of the app that needs the database: the bundled snapshot is
 * a single point in time, so trend can only come from the dated rows the daily sync
 * accumulates. Returns [] rather than throwing when Supabase is unreachable — a
 * missing trend chart should never take the page down.
 */
export async function fetchHistory(): Promise<HistoryPoint[]> {
  if (!supabase) return [];
  try {
    const byDate = new Map<
      string,
      { v: number; i: number; n: number; ac: Record<string, number> }
    >();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("portfolio_detailed_holdings")
        .select("as_on_date,current_value,invested_value,asset_class")
        .range(from, from + PAGE - 1);
      if (error) return [];
      const page = (data ?? []) as Array<{
        as_on_date: string | null;
        current_value: number | null;
        invested_value: number | null;
        asset_class: string | null;
      }>;
      for (const r of page) {
        if (!r.as_on_date) continue;
        const e = byDate.get(r.as_on_date) ?? { v: 0, i: 0, n: 0, ac: {} };
        const v = r.current_value ?? 0;
        e.v += v;
        e.i += r.invested_value ?? 0;
        e.n += 1;
        const k = r.asset_class?.trim() || "Unclassified";
        e.ac[k] = (e.ac[k] ?? 0) + v;
        byDate.set(r.as_on_date, e);
      }
      if (page.length < PAGE) break;
    }

    return [...byDate.entries()]
      .map(([asOn, e]) => ({
        asOn,
        value: e.v,
        invested: e.i,
        gain: e.v - e.i,
        gainPct: e.i > 0 ? ((e.v - e.i) / e.i) * 100 : 0,
        rows: e.n,
        byAssetClass: e.ac,
      }))
      .sort((a, b) => a.asOn.localeCompare(b.asOn));
  } catch {
    return [];
  }
}
