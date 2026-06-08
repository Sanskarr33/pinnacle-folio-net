// Data service — all async functions the dashboard components call.
// Each function tries Supabase first, falls back to dummy-data when not configured.
// To connect real data: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local
// and ensure the Supabase tables have the matching schema.

import { supabase } from "./supabase";
import type {
  FamilyKpis, AssetClass, ProductExposure, EntityAllocation,
  WealthPoint, AdvisorAUM, Holding, TopMovers, Transaction,
  RiskAlert, ActionItem, RiskHeatmapRow, MarketTicker,
} from "./types";
import {
  familyKpis, assetAllocation, productExposure, entityAllocation,
  wealthOverTime, advisorAUM, topHoldings, topMovers, recentTransactions,
  riskAlerts, actionItems, riskHeatmap, marketTickers,
} from "./dummy-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ])
  ) as T;
}

async function fromTable<T>(table: string): Promise<T[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(table).select("*");
  if (error || !data) return null;
  return (data as Record<string, unknown>[]).map((row) => snakeToCamel<T>(row));
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function getFamilyKpis(): Promise<FamilyKpis> {
  if (supabase) {
    const { data, error } = await supabase.from("family_kpis").select("*").order("updated_at", { ascending: false }).limit(1).single();
    if (!error && data) return snakeToCamel<FamilyKpis>(data as Record<string, unknown>);
  }
  return familyKpis;
}

export async function getAssetAllocation(): Promise<AssetClass[]> {
  const rows = await fromTable<AssetClass>("asset_allocation");
  return rows ?? assetAllocation;
}

export async function getProductExposure(): Promise<ProductExposure[]> {
  const rows = await fromTable<ProductExposure>("product_exposure");
  return rows ?? productExposure;
}

export async function getEntityAllocation(): Promise<EntityAllocation[]> {
  const rows = await fromTable<EntityAllocation>("entity_allocation");
  return rows ?? entityAllocation;
}

export async function getWealthTimeline(): Promise<WealthPoint[]> {
  if (supabase) {
    const { data, error } = await supabase.from("wealth_timeline").select("month, value").order("recorded_at", { ascending: true });
    if (!error && data) return data as WealthPoint[];
  }
  return wealthOverTime;
}

export async function getAdvisorAUM(): Promise<AdvisorAUM[]> {
  const rows = await fromTable<AdvisorAUM>("advisor_aum");
  return rows ?? advisorAUM;
}

export async function getTopHoldings(): Promise<Holding[]> {
  if (supabase) {
    const { data, error } = await supabase.from("holdings").select("*").order("value", { ascending: false }).limit(10);
    if (!error && data) return (data as Record<string, unknown>[]).map((r) => snakeToCamel<Holding>(r));
  }
  return topHoldings;
}

export async function getTopMovers(): Promise<TopMovers> {
  if (supabase) {
    const { data, error } = await supabase.from("top_movers").select("*");
    if (!error && data && (data as { side: string }[]).length > 0) {
      const typed = data as { side: string; name: string; change: number; value: number }[];
      return {
        gainers: typed.filter((r) => r.side === "gainer").map(({ name, change, value }) => ({ name, change, value })),
        losers: typed.filter((r) => r.side === "loser").map(({ name, change, value }) => ({ name, change, value })),
      };
    }
  }
  return topMovers;
}

export async function getRecentTransactions(): Promise<Transaction[]> {
  if (supabase) {
    const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false }).limit(10);
    if (!error && data) return (data as Record<string, unknown>[]).map((r) => snakeToCamel<Transaction>(r));
  }
  return recentTransactions;
}

export async function getRiskAlerts(): Promise<RiskAlert[]> {
  if (supabase) {
    const { data, error } = await supabase.from("risk_alerts").select("*").eq("is_active", true).order("severity");
    if (!error && data) return (data as Record<string, unknown>[]).map((r) => snakeToCamel<RiskAlert>(r));
  }
  return riskAlerts;
}

export async function getActionItems(): Promise<ActionItem[]> {
  if (supabase) {
    const { data, error } = await supabase.from("action_items").select("*").eq("is_completed", false).order("due_date", { ascending: true });
    if (!error && data) return (data as Record<string, unknown>[]).map((r) => snakeToCamel<ActionItem>(r));
  }
  return actionItems;
}

export async function getRiskHeatmap(): Promise<RiskHeatmapRow[]> {
  const rows = await fromTable<RiskHeatmapRow>("risk_heatmap");
  return rows ?? riskHeatmap;
}

export async function getMarketTickers(): Promise<MarketTicker[]> {
  if (supabase) {
    const { data, error } = await supabase.from("market_tickers").select("label, value, change, is_up");
    if (!error && data) {
      return (data as { label: string; value: string; change: string; is_up: boolean }[]).map((r) => ({
        label: r.label, value: r.value, change: r.change, up: r.is_up,
      }));
    }
  }
  return marketTickers;
}
