// Data service — all async functions the dashboard components call.
//
// PRIMARY DATA SOURCE: sg_family_holdings_import (Supabase)
//   All KPI, allocation, and holdings data is derived from this single table.
//   Activate by setting VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local
//   at the project root (not inside src/).
//
// FALLBACK: dummy-data.ts values are used when Supabase is not configured
//   or when a fetch fails, so the dashboard always renders.
//
// ASSUMPTION: monetary values in sg_family_holdings_import are in Indian Rupees (₹).
//   If your table stores values in Crore, multiply results by 10,000,000 before
//   passing them to these functions.

import { supabase } from "./supabase";
import type {
  FamilyKpis, AssetClass, ProductExposure, EntityAllocation,
  WealthPoint, AdvisorAUM, Holding, TopMovers, Transaction,
  RiskAlert, ActionItem, RiskHeatmapRow, MarketTicker, SGHoldingRow,
  PortfolioHolding,
} from "./types";
import {
  familyKpis, assetAllocation, productExposure, entityAllocation,
  wealthOverTime, advisorAUM, topHoldings, topMovers, recentTransactions,
  riskAlerts, actionItems, riskHeatmap, marketTickers,
} from "./dummy-data";

// ─── Internal raw-holdings cache ──────────────────────────────────────────────
// All five derived functions share a single Supabase request.
// The promise is stored so concurrent calls dedup to one network round-trip.

let _rawHoldingsPromise: Promise<SGHoldingRow[] | null> | null = null;
let _rawHoldingsExpiry = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds — short enough that a manual Refresh Prices always hits Supabase

// Call this before invalidating React Query caches so the next fetch hits Supabase.
export function invalidateCache(): void {
  _rawHoldingsPromise = null;
  _rawHoldingsExpiry = 0;
  _detailedPromise = null;
  _detailedExpiry = 0;
}

export async function getAllHoldings(): Promise<SGHoldingRow[] | null> {
  return getRawHoldings();
}

export async function getLastAsOnDate(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("sg_family_holdings_import")
      .select("as_on_date")
      .not("as_on_date", "is", null)
      .order("as_on_date", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return (data as { as_on_date: string }).as_on_date;
  } catch {
    return null;
  }
}

// Detailed holdings — separate table for product drill-downs.
// Returns PortfolioHolding[]: empty array on missing-config / fetch error / empty table.
let _detailedPromise: Promise<PortfolioHolding[]> | null = null;
let _detailedExpiry = 0;

export async function getDetailedHoldings(): Promise<PortfolioHolding[]> {
  if (!supabase) return [];
  const now = Date.now();
  if (_detailedPromise && now < _detailedExpiry) return _detailedPromise;
  _detailedExpiry = now + CACHE_TTL;
  _detailedPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("portfolio_detailed_holdings")
        .select("*");
      if (error) {
        console.error("[data-service] portfolio_detailed_holdings fetch error:", error.message);
        _detailedPromise = null;
        _detailedExpiry = 0;
        return [];
      }
      return (data ?? []) as PortfolioHolding[];
    } catch (err) {
      console.error("[data-service] getDetailedHoldings exception:", err);
      _detailedPromise = null;
      _detailedExpiry = 0;
      return [];
    }
  })();
  return _detailedPromise;
}

async function getRawHoldings(): Promise<SGHoldingRow[] | null> {
  if (!supabase) {
    console.error("[data-service] Supabase client not configured");
    return null;
  }
  const now = Date.now();
  if (_rawHoldingsPromise && now < _rawHoldingsExpiry) return _rawHoldingsPromise;

  _rawHoldingsExpiry = now + CACHE_TTL;
  _rawHoldingsPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("sg_family_holdings_import")
        .select("*");
      if (error) {
        console.error("[data-service] sg_family_holdings_import fetch error:", error.message);
        _rawHoldingsPromise = null;
        _rawHoldingsExpiry = 0;
        return null;
      }
      const rows = (data ?? []) as SGHoldingRow[];
      console.log("[data-service] sg_family_holdings_import rows returned:", rows.length);
      const rawSum = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);
      console.log("[data-service] raw current_value sum:", rawSum);
      console.log("[data-service] displayed AUM in ₹ Cr:", (rawSum / 10_000_000).toFixed(2));
      if (rows.length === 0) {
        _rawHoldingsPromise = null;
        _rawHoldingsExpiry = 0;
        return null;
      }
      return rows;
    } catch (err) {
      console.error("[data-service] getRawHoldings exception:", err);
      _rawHoldingsPromise = null;
      _rawHoldingsExpiry = 0;
      return null;
    }
  })();

  return _rawHoldingsPromise;
}

// ─── Derived from sg_family_holdings_import ───────────────────────────────────

export async function getFamilyKpis(): Promise<FamilyKpis> {
  const rows = await getRawHoldings();
  if (!rows) {
    console.error("[data-service] getFamilyKpis: dummy fallback was used = false; throwing connection error");
    throw new Error("Supabase connection error");
  }
  console.log("[data-service] getFamilyKpis: dummy fallback was used = false");
  const totalAUM        = rows.reduce((s, r) => s + (r.current_value   ?? 0), 0);
  const invested        = rows.reduce((s, r) => s + (r.invested_value  ?? 0), 0);
  const unrealisedGain  = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);
  const unrealisedGainPct = invested > 0 ? (unrealisedGain / invested) * 100 : 0;
  return {
    totalAUM,
    invested,
    unrealisedGain,
    unrealisedGainPct: +unrealisedGainPct.toFixed(2),
    dayChange:      familyKpis.dayChange,
    dayChangePct:   familyKpis.dayChangePct,
    realisedGain:   familyKpis.realisedGain,
    realisedGainPct: familyKpis.realisedGainPct,
    xirr:           familyKpis.xirr,
  };
}

export async function getAssetAllocation(): Promise<AssetClass[]> {
  const rows = await getRawHoldings();
  if (rows) {
    const byClass = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const cls = r.asset_class?.trim() || "Other";
      const val = r.current_value ?? 0;
      byClass.set(cls, (byClass.get(cls) ?? 0) + val);
      total += val;
    }
    return Array.from(byClass.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        value: total > 0 ? +((amount / total) * 100).toFixed(2) : 0,
        amount,
      }));
  }
  return assetAllocation;
}

export async function getProductExposure(): Promise<ProductExposure[]> {
  const rows = await getRawHoldings();
  if (rows) {
    const byProduct = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const pt  = r.product_type?.trim() || "Other";
      const val = r.current_value ?? 0;
      byProduct.set(pt, (byProduct.get(pt) ?? 0) + val);
      total += val;
    }
    return Array.from(byProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([product, value]) => ({
        product,
        value,
        pct: total > 0 ? +((value / total) * 100).toFixed(2) : 0,
      }));
  }
  return productExposure;
}

export async function getEntityAllocation(): Promise<EntityAllocation[]> {
  const rows = await getRawHoldings();
  if (rows) {
    const byEntity = new Map<string, number>();
    for (const r of rows) {
      const entity = r.entity_name?.trim();
      if (!entity) continue;
      byEntity.set(entity, (byEntity.get(entity) ?? 0) + (r.current_value ?? 0));
    }
    if (byEntity.size > 0) {
      return Array.from(byEntity.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([entity, value]) => ({ entity, value }));
    }
  }
  return entityAllocation;
}

export async function getTopHoldings(): Promise<Holding[]> {
  const rows = await getRawHoldings();
  if (rows) {
    return rows
      .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
      .slice(0, 10)
      .map((r) => {
        const invested   = r.invested_value  ?? 0;
        const unrealised = r.unrealised_gain ?? 0;
        // Use gain_pct column if present; otherwise derive from amounts
        const gainPct = r.gain_pct != null
          ? r.gain_pct
          : invested > 0 ? (unrealised / invested) * 100 : 0;
        return {
          name:    r.security_name,
          type:    r.product_type?.trim()  || r.asset_class?.trim() || "—",
          entity:  r.entity_name?.trim()   || "—",
          qty:     r.quantity ?? 0,
          ltp:     r.ltp      ?? 0,
          value:   +((r.current_value ?? 0) / 10000000).toFixed(2), // ₹ → Cr
          gainPct: +gainPct.toFixed(2),
        };
      });
  }
  return topHoldings;
}

// ─── Consolidated view: one row per security name, summed across folios/lots ──
// Used by the drill-down pages (equity, MF, ETF, PMS, AIF) so each security
// appears once regardless of how many purchase lots or folios it has.

export async function getConsolidatedHoldings(
  assetClasses: string | string[],
): Promise<PortfolioHolding[]> {
  if (!supabase) return [];
  const classes = Array.isArray(assetClasses) ? assetClasses : [assetClasses];
  try {
    const { data, error } = await supabase
      .from("sg_family_holdings_import")
      .select(
        "security_name,asset_class,category,product_type," +
        "quantity,invested_value,current_value,unrealised_gain," +
        "gain_percent,gain_pct,allocation_percent",
      )
      .in("asset_class", classes)
      .not("current_value", "is", null);

    if (error || !data) {
      if (error) console.error("[data-service] getConsolidatedHoldings error:", error.message);
      return [];
    }

    // Group by security_name, summing numeric fields
    const byName = new Map<string, {
      security_name: string;
      asset_class: string | null;
      category: string | null;
      product_type: string | null;
      quantity: number;
      invested_value: number;
      current_value: number;
      unrealised_gain: number;
      allocation_percent: number;
    }>();

    for (const r of data as SGHoldingRow[]) {
      const key = (r.security_name ?? "").trim();
      if (!key) continue;
      const g = byName.get(key);
      if (g) {
        g.quantity        += r.quantity           ?? 0;
        g.invested_value  += r.invested_value     ?? 0;
        g.current_value   += r.current_value      ?? 0;
        g.unrealised_gain += r.unrealised_gain    ?? 0;
        g.allocation_percent += r.allocation_percent ?? 0;
      } else {
        byName.set(key, {
          security_name:    key,
          asset_class:      r.asset_class   ?? null,
          category:         r.category      ?? null,
          product_type:     r.product_type  ?? null,
          quantity:         r.quantity           ?? 0,
          invested_value:   r.invested_value     ?? 0,
          current_value:    r.current_value      ?? 0,
          unrealised_gain:  r.unrealised_gain    ?? 0,
          allocation_percent: r.allocation_percent ?? 0,
        });
      }
    }

    return Array.from(byName.values())
      .sort((a, b) => b.current_value - a.current_value)
      .map((g) => ({
        report_section:     null,
        asset_class:        g.asset_class,
        category:           g.category,
        product_type:       g.product_type,
        security_name:      g.security_name,
        scheme_name:        null,
        current_value:      g.current_value,
        invested_value:     g.invested_value,
        unrealised_gain:    g.unrealised_gain,
        gain_percent:       g.invested_value > 0
          ? ((g.current_value - g.invested_value) / g.invested_value) * 100
          : null,
        allocation_percent: g.allocation_percent || null,
        xirr:               null,
        exit_load:          null,
        holding_term:       null,
      }));
  } catch (err) {
    console.error("[data-service] getConsolidatedHoldings exception:", err);
    return [];
  }
}

// ─── Not yet derived from holdings — remain on dummy data ─────────────────────

export async function getWealthTimeline(): Promise<WealthPoint[]> {
  return wealthOverTime;
}

export async function getAdvisorAUM(): Promise<AdvisorAUM[]> {
  return advisorAUM;
}

export async function getTopMovers(): Promise<TopMovers> {
  return topMovers;
}

export async function getRecentTransactions(): Promise<Transaction[]> {
  return recentTransactions;
}

export async function getRiskAlerts(): Promise<RiskAlert[]> {
  return riskAlerts;
}

export async function getActionItems(): Promise<ActionItem[]> {
  return actionItems;
}

export async function getRiskHeatmap(): Promise<RiskHeatmapRow[]> {
  return riskHeatmap;
}

export async function getMarketTickers(): Promise<MarketTicker[]> {
  return marketTickers;
}

