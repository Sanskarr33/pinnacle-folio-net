// One query, many views. Every component reads the same cached book and derives
// what it needs, so no two panels can show figures from different fetches.

import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { fetchBook, fetchTransactions, fetchHistory } from "@/lib/data-service";
import { useUnits } from "@/lib/units";
import {
  applyPrices,
  subscribePrices,
  getPriceSnapshot,
  getServerPriceSnapshot,
  type PriceCoverage,
  type PriceSnapshot,
} from "@/lib/prices";
import {
  subscribe as subscribeOverrides,
  getSnapshot as getOverrideSnapshot,
  getServerSnapshot as getServerOverrideSnapshot,
  applyOverrides,
  overrideCount,
} from "@/lib/overrides";
import {
  subscribeManual,
  getManualSnapshot,
  getServerManualSnapshot,
  applyManualLayer,
  type ManualStats,
} from "@/lib/manual-entries";
import type { PortfolioHolding } from "@/lib/types";
import {
  totals,
  sliceBy,
  consolidateSecurities,
  vehiclePartition,
  normaliseEntity,
  normaliseBroker,
  exitLoadSummary,
  taxSummary,
  harvestCandidates,
  concentration,
  deriveAlerts,
  deriveActions,
  dataHealth,
  filterProduct,
  type ProductKey,
} from "@/lib/portfolio-analytics";

const BOOK_KEY = ["book"] as const;

/**
 * The single source every view derives from. Three user layers are applied here, in
 * order, so the WHOLE dashboard moves together — totals, allocation, pivot, benchmark,
 * every grid — rather than an edit showing in one table and nowhere else:
 *
 *   1. overrides      — corrections to workbook rows (from overrides.ts)
 *   2. manual layer   — user-added holdings and removals (from manual-entries.ts)
 *   3. live NAVs      — the price overlay (from prices.ts)
 *
 * Allocation % is re-derived after the edits so shares stay internally consistent.
 */
export function useBook() {
  const q = useQuery({
    queryKey: BOOK_KEY,
    queryFn: fetchBook,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const overrides = useSyncExternalStore(
    subscribeOverrides,
    getOverrideSnapshot,
    getServerOverrideSnapshot,
  );
  const manual = useSyncExternalStore(subscribeManual, getManualSnapshot, getServerManualSnapshot);
  const prices = useSyncExternalStore(subscribePrices, getPriceSnapshot, getServerPriceSnapshot);

  const { edited, manualStats } = useMemo(() => {
    const base = q.data ?? [];
    // 1. corrections to existing rows
    const corrected =
      overrideCount(overrides) > 0 ? base.map((r) => applyOverrides(r, overrides)) : base;
    // 2. additions & removals, with allocation re-derived over the merged book
    const { rows, stats } = applyManualLayer(corrected, manual);
    return { edited: rows, manualStats: stats };
  }, [q.data, overrides, manual]);

  // 3. live NAV overlay (also re-derives allocation when it changes anything)
  const { rows, coverage } = useMemo(() => applyPrices(edited, prices), [edited, prices]);

  return {
    ...q,
    data: q.data ? rows : q.data,
    priceCoverage: coverage,
    prices,
    manualStats,
  };
}

/** Manual-layer stats (adds/removals), for the management page and badges. */
export function useManualStats(): ManualStats {
  const { manualStats } = useBook();
  return manualStats;
}

/** Just the live-price state, for the header control. Does not re-fetch the book. */
export function usePriceState(): {
  prices: PriceSnapshot | null;
  coverage: PriceCoverage | null;
} {
  const { prices, priceCoverage } = useBook();
  return { prices, coverage: priceCoverage };
}

/** The book filtered to one product page, plus the loading/error passthrough. */
export function useProductBook(key: ProductKey) {
  const q = useBook();
  const rows = useMemo(() => (q.data ? filterProduct(q.data, key) : []), [q.data, key]);
  return { ...q, rows };
}

export function useTotals() {
  const q = useBook();
  return { ...q, totals: useMemo(() => totals(q.data ?? []), [q.data]) };
}

export function useAssetAllocation() {
  const q = useBook();
  return {
    ...q,
    slices: useMemo(
      () => sliceBy(q.data ?? [], (r) => r.asset_class?.trim() || "Unclassified"),
      [q.data],
    ),
  };
}

export function useVehicleAllocation() {
  const q = useBook();
  return { ...q, slices: useMemo(() => vehiclePartition(q.data ?? []), [q.data]) };
}

export function useEntityAllocation() {
  const q = useBook();
  return {
    ...q,
    slices: useMemo(() => sliceBy(q.data ?? [], (r) => normaliseEntity(r.entity_name)), [q.data]),
  };
}

export function useBrokerAllocation() {
  const q = useBook();
  return {
    ...q,
    slices: useMemo(() => sliceBy(q.data ?? [], (r) => normaliseBroker(r.broker_name)), [q.data]),
  };
}

export function useTopSecurities(limit = 10) {
  const q = useBook();
  return {
    ...q,
    slices: useMemo(() => consolidateSecurities(q.data ?? []).slice(0, limit), [q.data, limit]),
  };
}

export function useExitLoads() {
  const q = useBook();
  return { ...q, summary: useMemo(() => exitLoadSummary(q.data ?? []), [q.data]) };
}

export function useTax(withinDays = 90) {
  const q = useBook();
  return {
    ...q,
    summary: useMemo(() => taxSummary(q.data ?? [], withinDays), [q.data, withinDays]),
  };
}

export function useHarvest() {
  const q = useBook();
  return { ...q, candidates: useMemo(() => harvestCandidates(q.data ?? []), [q.data]) };
}

export function useConcentration() {
  const q = useBook();
  return { ...q, risk: useMemo(() => concentration(q.data ?? []), [q.data]) };
}

export function useAlerts() {
  const q = useBook();
  const { money } = useUnits();
  return { ...q, alerts: useMemo(() => deriveAlerts(q.data ?? [], money), [q.data, money]) };
}

export function useActions(limit = 6) {
  const q = useBook();
  return { ...q, actions: useMemo(() => deriveActions(q.data ?? [], limit), [q.data, limit]) };
}

export function useDataHealth() {
  const q = useBook();
  return { ...q, health: useMemo(() => dataHealth(q.data ?? []), [q.data]) };
}

/** Best and worst performers by gain %, consolidated across entities. */
export function usePerformanceLeaders(limit = 5, minValue = 1_000_000) {
  const q = useBook();
  return useMemo(() => {
    const rows: PortfolioHolding[] = q.data ?? [];
    const secs = consolidateSecurities(rows).filter((s) => s.current >= minValue && s.invested > 0);
    const ranked = [...secs].sort((a, b) => b.gainPct - a.gainPct);
    return {
      ...q,
      best: ranked.slice(0, limit),
      worst: ranked
        .slice(-limit)
        .reverse()
        .filter((s) => s.gainPct < 0),
    };
  }, [q, limit, minValue]);
}

// ─── Realised gains & trade ledger (from the transaction workbook) ────────────

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
    staleTime: 5 * 60 * 1000,
  });
}

/** Current-FY realised capital gains, by asset category, with the tax liability. */
export function useRealisedGains() {
  const q = useTransactions();
  return {
    ...q,
    capitalGains: q.data?.capitalGains ?? null,
    ledger: q.data?.realisedLedger ?? null,
    purchases: q.data?.purchases ?? [],
  };
}

/** Dated snapshots from Supabase — the only source of trend in the app. */
export function useHistory() {
  return useQuery({
    queryKey: ["portfolioHistory"],
    queryFn: fetchHistory,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
