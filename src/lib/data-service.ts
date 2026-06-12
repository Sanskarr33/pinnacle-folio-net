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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getAllHoldings(): Promise<SGHoldingRow[] | null> {
  return getRawHoldings();
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
  if (rows) {
    const totalAUM        = rows.reduce((s, r) => s + (r.current_value   ?? 0), 0);
    const invested        = rows.reduce((s, r) => s + (r.invested_value  ?? 0), 0);
    const unrealisedGain  = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);
    const unrealisedGainPct = invested > 0 ? (unrealisedGain / invested) * 100 : 0;
    return {
      totalAUM,
      invested,
      unrealisedGain,
      unrealisedGainPct: +unrealisedGainPct.toFixed(2),
      // Fields not available in holdings table — kept from dummy data
      dayChange:      familyKpis.dayChange,
      dayChangePct:   familyKpis.dayChangePct,
      realisedGain:   familyKpis.realisedGain,
      realisedGainPct: familyKpis.realisedGainPct,
      xirr:           familyKpis.xirr,
    };
  }
  return familyKpis;
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

