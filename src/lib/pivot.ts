// Pivot engine — the ad-hoc slicing Excel is normally kept around for.
//
// Any dimension on rows, any dimension on columns, any measure in the cells, with
// subtotals and a drill-down back to the underlying lots. Everything is derived from
// the same book every other view reads, so a pivot can never disagree with a page.
//
// Measures are split into two kinds, because they do NOT aggregate the same way:
//   - additive  (value, invested, gain, count)  -> plain sum
//   - derived   (gain %, XIRR, allocation %)    -> recomputed from summed parts,
//     never averaged. Averaging percentages across lots of different sizes is the
//     classic spreadsheet error this is built to avoid.

import type { PortfolioHolding } from "./types";
import { normaliseEntity, normaliseBroker, displayName, taxRegime } from "./portfolio-analytics";

// ─── Dimensions ───────────────────────────────────────────────────────────────

export interface PivotDimension {
  key: string;
  label: string;
  /** Bucket a row belongs to. Must always return a string — blanks become "—". */
  get: (r: PortfolioHolding) => string;
}

const blank = (s: string | null | undefined) => {
  const v = (s ?? "").toString().trim();
  return v === "" ? "—" : v;
};

export const DIMENSIONS: PivotDimension[] = [
  { key: "entity", label: "Entity", get: (r) => normaliseEntity(r.entity_name) },
  { key: "broker", label: "Custodian / Broker", get: (r) => normaliseBroker(r.broker_name) },
  { key: "asset_class", label: "Asset Class", get: (r) => blank(r.asset_class) },
  { key: "category", label: "Category", get: (r) => blank(r.category) },
  { key: "product_type", label: "Product Type", get: (r) => blank(r.product_type) },
  { key: "taxation", label: "Tax Regime", get: (r) => taxRegime(r.taxation) },
  { key: "scheme_type", label: "Direct / Regular", get: (r) => blank(r.scheme_type) },
  { key: "fund_type", label: "Growth / IDCW", get: (r) => blank(r.fund_type) },
  { key: "holding_term", label: "Holding Term", get: (r) => blank(r.holding_term) },
  { key: "security", label: "Security", get: (r) => displayName(r) },
  { key: "folio_number", label: "Folio", get: (r) => blank(r.folio_number) },
  { key: "report_section", label: "Source Section", get: (r) => blank(r.report_section) },
  {
    key: "purchase_year",
    label: "Purchase Year",
    get: (r) => (r.purchase_date ? r.purchase_date.slice(0, 4) : "—"),
  },
  { key: "none", label: "(none)", get: () => "All" },
];

export function dimension(key: string): PivotDimension {
  return DIMENSIONS.find((d) => d.key === key) ?? DIMENSIONS[DIMENSIONS.length - 1];
}

// ─── Measures ─────────────────────────────────────────────────────────────────

export type MeasureFormat = "money" | "pct" | "pctSigned" | "number";

export interface PivotMeasure {
  key: string;
  label: string;
  format: MeasureFormat;
  /** Sign-aware colouring (gain can be negative). */
  signed?: boolean;
  /** Computed from a set of rows. Derived measures use sums, never averages. */
  compute: (rows: PortfolioHolding[], grandTotal: number) => number | null;
}

const sum = (rows: PortfolioHolding[], f: (r: PortfolioHolding) => number | null | undefined) =>
  rows.reduce((s, r) => s + (f(r) ?? 0), 0);

export const MEASURES: PivotMeasure[] = [
  {
    key: "current_value",
    label: "Current Value",
    format: "money",
    compute: (rows) => sum(rows, (r) => r.current_value),
  },
  {
    key: "invested_value",
    label: "Invested",
    format: "money",
    compute: (rows) => sum(rows, (r) => r.invested_value),
  },
  {
    key: "unrealised_gain",
    label: "Unrealised Gain",
    format: "money",
    signed: true,
    compute: (rows) => sum(rows, (r) => r.unrealised_gain),
  },
  {
    key: "gain_percent",
    label: "Gain %",
    format: "pctSigned",
    signed: true,
    // Recomputed from summed parts — NOT the average of per-lot percentages.
    compute: (rows) => {
      const inv = sum(rows, (r) => r.invested_value);
      const cur = sum(rows, (r) => r.current_value);
      return inv > 0 ? ((cur - inv) / inv) * 100 : null;
    },
  },
  {
    key: "allocation_percent",
    label: "% of Book",
    format: "pct",
    compute: (rows, grandTotal) =>
      grandTotal > 0 ? (sum(rows, (r) => r.current_value) / grandTotal) * 100 : null,
  },
  {
    key: "xirr",
    label: "XIRR (wtd)",
    format: "pctSigned",
    signed: true,
    // Value-weighted across lots that actually report an XIRR.
    compute: (rows) => {
      const withX = rows.filter((r) => r.xirr != null && (r.current_value ?? 0) > 0);
      const w = sum(withX, (r) => r.current_value);
      if (w <= 0) return null;
      return withX.reduce((s, r) => s + (r.xirr as number) * (r.current_value as number), 0) / w;
    },
  },
  {
    key: "lot_count",
    label: "Lots",
    format: "number",
    compute: (rows) => rows.length,
  },
];

export function measure(key: string): PivotMeasure {
  return MEASURES.find((m) => m.key === key) ?? MEASURES[0];
}

// ─── Computation ──────────────────────────────────────────────────────────────

export interface PivotCell {
  value: number | null;
  rows: PortfolioHolding[];
}

export interface PivotResult {
  rowKeys: string[];
  colKeys: string[];
  /** cells[rowKey][colKey] */
  cells: Record<string, Record<string, PivotCell>>;
  rowTotals: Record<string, PivotCell>;
  colTotals: Record<string, PivotCell>;
  grand: PivotCell;
  measure: PivotMeasure;
}

export interface PivotConfig {
  rowDim: string;
  colDim: string;
  measureKey: string;
  /** Sort rows by their total, descending. Otherwise alphabetical. */
  sortByValue?: boolean;
  /** Hide rows whose total is zero/blank — usually noise. */
  hideEmpty?: boolean;
}

/**
 * Build the cross-tab. `grandTotal` for the "% of book" measure is the total current
 * value of the rows passed in, so a filtered pivot shows shares of the filtered set.
 */
export function computePivot(rows: PortfolioHolding[], cfg: PivotConfig): PivotResult {
  const rd = dimension(cfg.rowDim);
  const cd = dimension(cfg.colDim);
  const m = measure(cfg.measureKey);
  const grandTotal = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);

  const buckets = new Map<string, Map<string, PortfolioHolding[]>>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const r of rows) {
    const rk = rd.get(r);
    const ck = cd.get(r);
    rowSet.add(rk);
    colSet.add(ck);
    let byCol = buckets.get(rk);
    if (!byCol) {
      byCol = new Map();
      buckets.set(rk, byCol);
    }
    const list = byCol.get(ck);
    if (list) list.push(r);
    else byCol.set(ck, [r]);
  }

  const cells: Record<string, Record<string, PivotCell>> = {};
  const rowTotals: Record<string, PivotCell> = {};
  const colAcc: Record<string, PortfolioHolding[]> = {};

  for (const rk of rowSet) {
    cells[rk] = {};
    const rowRows: PortfolioHolding[] = [];
    for (const ck of colSet) {
      const cellRows = buckets.get(rk)?.get(ck) ?? [];
      cells[rk][ck] = {
        value: cellRows.length ? m.compute(cellRows, grandTotal) : null,
        rows: cellRows,
      };
      rowRows.push(...cellRows);
      (colAcc[ck] ??= []).push(...cellRows);
    }
    rowTotals[rk] = {
      value: rowRows.length ? m.compute(rowRows, grandTotal) : null,
      rows: rowRows,
    };
  }

  const colTotals: Record<string, PivotCell> = {};
  for (const ck of colSet) {
    const list = colAcc[ck] ?? [];
    colTotals[ck] = { value: list.length ? m.compute(list, grandTotal) : null, rows: list };
  }

  let rowKeys = [...rowSet];
  let colKeys = [...colSet];

  if (cfg.hideEmpty) {
    rowKeys = rowKeys.filter((k) => (rowTotals[k]?.rows.length ?? 0) > 0);
    colKeys = colKeys.filter((k) => (colTotals[k]?.rows.length ?? 0) > 0);
  }

  // "—" (unclassified) always sorts last so it never leads the table.
  const dash = (k: string) => (k === "—" ? 1 : 0);
  const byValue = (a: string, b: string) =>
    dash(a) - dash(b) || Math.abs(rowTotals[b]?.value ?? 0) - Math.abs(rowTotals[a]?.value ?? 0);
  const byName = (a: string, b: string) => dash(a) - dash(b) || a.localeCompare(b);

  rowKeys.sort(cfg.sortByValue === false ? byName : byValue);
  colKeys.sort((a, b) =>
    cfg.sortByValue === false
      ? byName(a, b)
      : dash(a) - dash(b) ||
        Math.abs(colTotals[b]?.value ?? 0) - Math.abs(colTotals[a]?.value ?? 0),
  );

  return {
    rowKeys,
    colKeys,
    cells,
    rowTotals,
    colTotals,
    grand: { value: rows.length ? m.compute(rows, grandTotal) : null, rows },
    measure: m,
  };
}

/** Flatten a pivot to a rectangular grid of strings/numbers for CSV / xlsx export. */
export function pivotToMatrix(
  res: PivotResult,
  rowLabel: string,
  fmt: (v: number | null, m: PivotMeasure) => string | number,
): (string | number)[][] {
  const head = [rowLabel, ...res.colKeys, "Total"];
  const body = res.rowKeys.map((rk) => [
    rk,
    ...res.colKeys.map((ck) => fmt(res.cells[rk]?.[ck]?.value ?? null, res.measure)),
    fmt(res.rowTotals[rk]?.value ?? null, res.measure),
  ]);
  const foot = [
    "Total",
    ...res.colKeys.map((ck) => fmt(res.colTotals[ck]?.value ?? null, res.measure)),
    fmt(res.grand.value, res.measure),
  ];
  return [head, ...body, foot];
}
