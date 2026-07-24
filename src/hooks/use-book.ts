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
 * The single source every view derives from. Live NAVs (when a refresh has run)
 * are overlaid here, so the whole dashboard moves together — no panel can show a
 * pre-refresh figure while another shows a post-refresh one.
 */
export function useBook() {
  const q = useQuery({
    queryKey: BOOK_KEY,
    queryFn: fetchBook,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const prices = useSyncExternalStore(subscribePrices, getPriceSnapshot, getServerPriceSnapshot);
  const { rows, coverage } = useMemo(() => applyPrices(q.data ?? [], prices), [q.data, prices]);
  return { ...q, data: q.data ? rows : q.data, priceCoverage: coverage, prices };
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
