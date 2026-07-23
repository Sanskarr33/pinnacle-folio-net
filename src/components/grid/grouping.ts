// Consolidation for the grid.
//
// The source book stores one row per LOT. A single fund is routinely held by
// several family entities, each with its own folio number — the workbook prints
// this as one bold security line followed by an indented "Portfolio: … / Folio No. …"
// line per holder, and the grid mirrors that.

import type { PortfolioHolding } from "@/lib/types";
import { displayName, normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";

export interface LotGroup {
  key: string;
  /** Synthetic parent row carrying the aggregate, shaped like a holding so the
   *  same column definitions render it without special-casing every column. */
  aggregate: PortfolioHolding;
  lots: PortfolioHolding[];
  entityCount: number;
  brokerCount: number;
}

/** Sentinel written into fields whose lots disagree, so the parent never implies a
 *  single value where several exist (e.g. three different folio numbers). */
export const MIXED = "—";

function uniform<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const first = values[0];
  return values.every((v) => v === first) ? first : null;
}

function sum(rows: PortfolioHolding[], f: (r: PortfolioHolding) => number | null | undefined) {
  return rows.reduce((s, r) => s + (f(r) ?? 0), 0);
}

/**
 * Build the parent row for a set of lots.
 *
 * Additive fields are summed. Rates are recomputed from the sums (never averaged —
 * averaging gain% across differently-sized lots is wrong). Descriptive fields are
 * kept only when every lot agrees; otherwise they are blanked so the parent cannot
 * misreport, and the count is surfaced separately.
 */
function buildAggregate(key: string, lots: PortfolioHolding[]): PortfolioHolding {
  const first = lots[0];
  const invested = sum(lots, (r) => r.invested_value);
  const current = sum(lots, (r) => r.current_value);
  const gain = sum(lots, (r) => r.unrealised_gain);

  // Value-weighted XIRR over the lots that actually record one.
  const withX = lots.filter((r) => r.xirr != null && (r.current_value ?? 0) > 0);
  const xBase = sum(withX, (r) => r.current_value);
  const xirr =
    xBase > 0 ? withX.reduce((s, r) => s + r.xirr! * (r.current_value ?? 0), 0) / xBase : null;

  // Longest-held lot drives the displayed holding period; term is only stated when
  // every lot agrees, since a mixed group has both short and long term exposure.
  const days = lots.map((r) => r.holding_period_days).filter((d): d is number => d != null);
  const terms = lots.map((r) => r.holding_term).filter(Boolean);

  return {
    ...first,
    id: `grp:${key}`,
    security_name: key,
    scheme_name: uniform(lots.map((r) => r.scheme_name)) ?? key,
    entity_name: uniform(lots.map((r) => normaliseEntity(r.entity_name))),
    broker_name: uniform(lots.map((r) => normaliseBroker(r.broker_name))),
    folio_number: uniform(lots.map((r) => r.folio_number)),
    account_name: uniform(lots.map((r) => r.account_name)),
    category: uniform(lots.map((r) => r.category)),
    asset_class: uniform(lots.map((r) => r.asset_class)) ?? first.asset_class,
    product_type: uniform(lots.map((r) => r.product_type)) ?? first.product_type,
    taxation: uniform(lots.map((r) => r.taxation)),
    scheme_type: uniform(lots.map((r) => r.scheme_type)),
    fund_type: uniform(lots.map((r) => r.fund_type)),
    exit_load: uniform(lots.map((r) => r.exit_load)),
    holding_term: terms.length && uniform(terms) ? uniform(terms)! : terms.length ? "Mixed" : null,

    units: sum(lots, (r) => r.units) || null,
    quantity: sum(lots, (r) => r.quantity) || null,
    invested_value: invested,
    current_value: current,
    unrealised_gain: gain,
    gain_percent: invested !== 0 ? (gain / invested) * 100 : null,
    allocation_percent: sum(lots, (r) => r.allocation_percent),
    xirr,

    // Prices are per-unit, so they are only meaningful when identical across lots.
    current_nav: uniform(lots.map((r) => r.current_nav)),
    current_price: uniform(lots.map((r) => r.current_price)),
    purchase_nav: null,
    purchase_price: null,
    purchase_date: null,
    holding_period_days: days.length ? Math.max(...days) : null,
    notes: null,
  };
}

/** Group lots by security name, largest group first. */
export function groupLots(
  rows: PortfolioHolding[],
  keyOf: (r: PortfolioHolding) => string = displayName,
): LotGroup[] {
  const map = new Map<string, PortfolioHolding[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const g = map.get(k);
    if (g) g.push(r);
    else map.set(k, [r]);
  }

  return Array.from(map.entries()).map(([key, lots]) => ({
    key,
    aggregate: buildAggregate(key, lots),
    lots,
    entityCount: new Set(lots.map((r) => normaliseEntity(r.entity_name))).size,
    brokerCount: new Set(lots.map((r) => normaliseBroker(r.broker_name))).size,
  }));
}
