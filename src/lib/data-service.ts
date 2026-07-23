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
