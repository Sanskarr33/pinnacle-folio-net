import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
  Download,
  FileSpreadsheet,
  Columns3,
  ChevronRight,
  Pencil,
  RotateCcw,
  Check,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/lib/types";
import { displayName, normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";
import { useUnits, formatMoney, unitColumnLabel } from "@/lib/units";
import {
  applyOverrides,
  clearOverride,
  editedFields,
  getServerSnapshot,
  getSnapshot,
  isEdited,
  setOverride,
  subscribe,
  type EditableField,
} from "@/lib/overrides";
import { formatDate, humanDays, num, pctSigned, pct } from "@/lib/format";
import { EmptyState, Skeleton } from "@/components/common/States";
import { RowDetail } from "./RowDetail";
import { groupLots, type LotGroup } from "./grouping";

// ─── Column model ─────────────────────────────────────────────────────────────

export type GridFormat =
  | "text"
  | "money"
  | "moneySigned"
  | "pct"
  | "pctSigned"
  | "number"
  | "date"
  | "days";

export interface GridColumn {
  key: string;
  label: string;
  format?: GridFormat;
  align?: "left" | "right";
  width?: number;
  /** Raw comparable/exportable value. Defaults to row[key]. */
  value?: (r: PortfolioHolding) => string | number | null;
  /** Field written when the cell is edited. Omit to make the column read-only. */
  editable?: EditableField;
  /** Include in the totals row. */
  total?: boolean;
  /** Hidden until enabled in the column picker. */
  hidden?: boolean;
}

const DEFAULT_WIDTHS: Record<GridFormat | "default", number> = {
  text: 150,
  money: 120,
  moneySigned: 130,
  pct: 90,
  pctSigned: 95,
  number: 110,
  date: 110,
  days: 85,
  default: 130,
};

export function colWidth(c: GridColumn): number {
  return c.width ?? DEFAULT_WIDTHS[c.format ?? "default"] ?? 130;
}

// ─── Value access ─────────────────────────────────────────────────────────────

export function rawValue(r: PortfolioHolding, c: GridColumn): string | number | null {
  if (c.value) return c.value(r);
  const v = (r as unknown as Record<string, unknown>)[c.key];
  return v == null ? null : (v as string | number);
}

/** Grid formats collapse to the smaller set the sheet writer understands. */
function gridFormatToXlsx(f?: GridFormat): "text" | "money" | "number" | "pct" | "date" {
  switch (f) {
    case "money":
    case "moneySigned":
      return "money";
    case "pct":
    case "pctSigned":
      return "pct";
    case "number":
    case "days":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

function isNumericFormat(f?: GridFormat) {
  return (
    f === "money" ||
    f === "moneySigned" ||
    f === "pct" ||
    f === "pctSigned" ||
    f === "number" ||
    f === "days"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataGrid({
  rows,
  columns: initialColumns,
  isLoading = false,
  title = "holdings",
  emptyMessage = "No rows to show.",
  emptyHint,
  pageSize = 100,
  dense: initialDense = true,
  enableEditing = true,
  enableDetail = true,
  grouped = true,
}: {
  rows: PortfolioHolding[];
  columns: GridColumn[];
  isLoading?: boolean;
  title?: string;
  emptyMessage?: string;
  emptyHint?: string;
  pageSize?: number;
  dense?: boolean;
  enableEditing?: boolean;
  enableDetail?: boolean;
  /** Consolidate lots into one row per security, expandable to each holder. */
  grouped?: boolean;
}) {
  const { unit, digits, label } = useUnits();
  // A spreadsheet column must be homogeneous: "Auto" would render ₹2.00 Cr next to
  // ₹100.00 L in the same column, which is unreadable when scanning down. Inside the
  // grid, Auto resolves to Crore so every money cell shares one scale.
  const gridUnit = unit === "auto" ? "crore" : unit;
  const money = (n: number | null | undefined) => formatMoney(n, gridUnit, digits);
  const colLabel = (base: string) => unitColumnLabel(base, gridUnit);

  // Re-render when a correction is saved anywhere in the app.
  const overrideStore = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [sortKey, setSortKey] = useState<string>(
    initialColumns.find((c) => c.format === "money")?.key ?? initialColumns[0]?.key ?? "",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("All");
  const [page, setPage] = useState(0);
  const [dense, setDense] = useState(initialDense);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  /** Which single lot has its full detail panel open (independent of group expansion). */
  const [detailFor, setDetailFor] = useState<string | null>(null);

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const [editing, setEditing] = useState<{ key: string; col: string } | null>(null);
  const [picker, setPicker] = useState(false);

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialColumns.map((c) => [c.key, colWidth(c)])),
  );
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialColumns.map((c) => [c.key, !c.hidden])),
  );

  const columns = useMemo(
    () => initialColumns.filter((c) => visible[c.key] !== false),
    [initialColumns, visible],
  );

  // Corrections applied before anything is sorted, filtered or totalled.
  const data = useMemo(
    () => rows.map((r) => applyOverrides(r, overrideStore)),
    [rows, overrideStore],
  );

  const entities = useMemo(
    () => ["All", ...Array.from(new Set(data.map((r) => normaliseEntity(r.entity_name)))).sort()],
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      if (entity !== "All" && normaliseEntity(r.entity_name) !== entity) return false;
      if (!q) return true;
      return (
        displayName(r).toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q) ||
        (r.asset_class ?? "").toLowerCase().includes(q) ||
        (r.product_type ?? "").toLowerCase().includes(q) ||
        normaliseBroker(r.broker_name).toLowerCase().includes(q) ||
        (r.folio_number ?? "").toLowerCase().includes(q) ||
        normaliseEntity(r.entity_name).toLowerCase().includes(q)
      );
    });
  }, [data, query, entity]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = rawValue(a, col);
      const bv = rawValue(b, col);
      // Nulls sink regardless of direction — an empty cell is not "smallest".
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, columns, sortKey, sortDir]);

  /**
   * Consolidate lots into one line per security, then sort the GROUPS by their
   * aggregate. Sorting the lots first and grouping after would scatter a security's
   * holders across the page.
   */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const col = columns.find((c) => c.key === sortKey);
    const gs = groupLots(filtered);
    if (!col) return gs;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...gs].sort((a, b) => {
      const av = rawValue(a.aggregate, col);
      const bv = rawValue(b.aggregate, col);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [grouped, filtered, columns, sortKey, sortDir]);

  const unitCount = grouped ? (groups?.length ?? 0) : sorted.length;
  const pageCount = Math.max(1, Math.ceil(unitCount / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const visibleGroups = groups?.slice(safePage * pageSize, safePage * pageSize + pageSize) ?? [];

  // Totals always sum the underlying LOTS, never the aggregates, so grouping can
  // never change the footer figure.
  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of columns) {
      if (!c.total) continue;
      acc[c.key] = filtered.reduce((s, r) => s + ((rawValue(r, c) as number) ?? 0), 0);
    }
    return acc;
  }, [filtered, columns]);

  // ── Column resizing ────────────────────────────────────────────────────────
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      drag.current = { key, startX: e.clientX, startW: widths[key] ?? 130 };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [widths],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const d = drag.current;
      const next = Math.max(56, d.startW + (e.clientX - d.startX));
      setWidths((w) => ({ ...w, [d.key]: next }));
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const autoFit = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (!col) return;
      const longest = sorted.reduce((m, r) => {
        const s = renderText(r, col, gridUnit, digits);
        return Math.max(m, s.length);
      }, col.label.length);
      setWidths((w) => ({ ...w, [key]: Math.min(420, Math.max(70, longest * 7.4 + 28)) }));
    },
    [columns, sorted, unit, digits],
  );

  function toggleSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function exportCsv() {
    const head = ["#", ...columns.map((c) => `"${label(c.label)}"`)].join(",");
    const body = sorted
      .map((r, i) =>
        [
          i + 1,
          ...columns.map((c) => {
            const v = rawValue(r, c);
            return typeof v === "number" ? v : `"${String(v ?? "").replace(/"/g, '""')}"`;
          }),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      // Only the visible columns, in the order shown — the export mirrors the screen.
      const cols = columns.map((c) => ({
        header: label(c.label),
        key: c.key,
        type: gridFormatToXlsx(c.format),
        width: c.format === "text" || !c.format ? 34 : 16,
      }));
      const data = sorted.map((r) => {
        const rec: Record<string, unknown> = {};
        for (const c of columns) rec[c.key] = rawValue(r, c);
        return rec;
      });
      // Totals only for columns the grid itself totals, so the sheet agrees with the UI.
      const totals: Record<string, unknown> = {};
      let anyTotal = false;
      for (const c of columns) {
        if (!c.total) continue;
        anyTotal = true;
        totals[c.key] = sorted.reduce((s, r) => {
          const v = rawValue(r, c);
          return s + (typeof v === "number" ? v : 0);
        }, 0);
      }
      if (anyTotal) totals[columns[0].key] = "Total";

      await exportXlsx({
        fileName: title.toLowerCase().replace(/\s+/g, "-"),
        unit,
        subtitle: `${title} · ${sorted.length} rows · SG Family Office`,
        sheets: [
          {
            name: title,
            columns: cols,
            rows: data,
            totals: anyTotal ? totals : undefined,
            freezeCols: 1,
          },
        ],
      });
    } catch (err) {
      console.error("Excel export failed", err);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-elegant p-3 space-y-1.5">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  const rowH = dense ? "h-[30px]" : "h-[38px]";
  const cellPad = dense ? "px-2 py-1" : "px-3 py-2";

  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary/25">
        <div className="relative flex-1 min-w-[190px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search security, entity, folio, custodian…"
            aria-label="Search rows"
            className="w-full h-8 pl-8 pr-7 rounded-md border border-input bg-surface text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {entities.length > 2 && (
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(0);
            }}
            aria-label="Filter by entity"
            className="h-8 rounded-md border border-input bg-surface px-2 text-[12px]"
          >
            {entities.map((e) => (
              <option key={e} value={e}>
                {e === "All" ? "All entities" : e}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="tabular hidden sm:inline">
            {grouped
              ? `${unitCount.toLocaleString("en-IN")} securities · ${filtered.length.toLocaleString("en-IN")} lots`
              : `${sorted.length.toLocaleString("en-IN")}${
                  sorted.length !== rows.length ? ` / ${rows.length.toLocaleString("en-IN")}` : ""
                } rows`}
          </span>

          <div className="relative">
            <button
              onClick={() => setPicker((v) => !v)}
              title="Show / hide columns"
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-2 font-medium hover:bg-secondary transition-colors"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Columns</span>
            </button>
            {picker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPicker(false)} />
                <div className="absolute right-0 mt-1.5 w-56 max-h-[320px] overflow-y-auto rounded-lg border border-border bg-surface shadow-elevated z-50 py-1">
                  {initialColumns.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setVisible((v) => ({ ...v, [c.key]: v[c.key] === false }))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-secondary/70"
                    >
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          visible[c.key] !== false ? "text-success" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {grouped && (
            <button
              onClick={() =>
                setExpanded((prev) =>
                  prev.size > 0 ? new Set() : new Set((groups ?? []).map((g) => g.key)),
                )
              }
              title="Expand or collapse every security"
              className="h-8 px-2 rounded-md border border-border font-medium hover:bg-secondary transition-colors"
            >
              {expanded.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          )}

          <button
            onClick={() => setDense((d) => !d)}
            title={dense ? "Comfortable rows" : "Compact rows"}
            className="h-8 px-2 rounded-md border border-border font-medium hover:bg-secondary transition-colors"
          >
            {dense ? "Compact" : "Cosy"}
          </button>

          <button
            onClick={exportExcel}
            disabled={sorted.length === 0 || exporting}
            title="Download as a formatted Excel workbook"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-2 font-medium hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{exporting ? "Building…" : "Excel"}</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={sorted.length === 0}
            title="Download as raw CSV"
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-2 font-medium hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">CSV</span>
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          message={rows.length === 0 ? emptyMessage : "No rows match your search or filter."}
          hint={rows.length === 0 ? emptyHint : "Try clearing the search box or entity filter."}
        />
      ) : (
        <>
          <div className="overflow-auto max-h-[70vh]">
            <table
              className="text-[12px] border-collapse"
              style={{
                width:
                  columns.reduce((s, c) => s + (widths[c.key] ?? colWidth(c)), 0) +
                  (enableDetail ? 30 : 0) +
                  46,
              }}
            >
              <thead className="sticky top-0 z-20">
                <tr className="bg-secondary/90 backdrop-blur">
                  {enableDetail && (
                    <th className="w-[30px] border-b border-r border-border sticky left-0 z-30 bg-secondary/90" />
                  )}
                  <th
                    className="w-[46px] border-b border-r border-border text-[10px] font-semibold text-muted-foreground sticky z-30 bg-secondary/90"
                    style={{ left: enableDetail ? 30 : 0 }}
                  >
                    #
                  </th>
                  {columns.map((c) => {
                    const active = c.key === sortKey;
                    return (
                      <th
                        key={c.key}
                        style={{ width: widths[c.key] ?? colWidth(c) }}
                        className={cn(
                          "relative border-b border-r border-border select-none group",
                          "text-[10px] uppercase tracking-[0.08em] font-semibold",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <button
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            "w-full flex items-center gap-1 px-2 py-1.5 hover:text-foreground transition-colors",
                            c.align === "right" ? "justify-end" : "justify-start",
                          )}
                          title={`Sort by ${c.label}`}
                        >
                          <span className="truncate">
                            {c.format === "money" || c.format === "moneySigned"
                              ? colLabel(c.label)
                              : c.label}
                          </span>
                          {active ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3 shrink-0" />
                            ) : (
                              <ArrowDown className="h-3 w-3 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 shrink-0 opacity-20 group-hover:opacity-60" />
                          )}
                        </button>
                        {/* drag to resize, double-click to auto-fit */}
                        <span
                          onMouseDown={(e) => onResizeStart(e, c.key)}
                          onDoubleClick={() => autoFit(c.key)}
                          title="Drag to resize · double-click to fit"
                          className="absolute top-0 right-0 h-full w-[5px] cursor-col-resize hover:bg-[var(--chart-1)]/50 active:bg-[var(--chart-1)]"
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {grouped
                  ? visibleGroups.map((g, idx) => (
                      <GroupRows
                        key={g.key}
                        group={g}
                        index={safePage * pageSize + idx + 1}
                        columns={columns}
                        widths={widths}
                        rowH={rowH}
                        cellPad={cellPad}
                        isOpen={expanded.has(g.key)}
                        onToggle={() => toggleExpanded(g.key)}
                        detailKey={detailFor}
                        onDetail={setDetailFor}
                        editing={editing}
                        setEditing={setEditing}
                        enableEditing={enableEditing}
                        enableDetail={enableDetail}
                        overrideStore={overrideStore}
                        gridUnit={gridUnit}
                      />
                    ))
                  : visibleRows.map((r, idx) => (
                      <RowGroup
                        key={r.id}
                        row={r}
                        index={safePage * pageSize + idx + 1}
                        columns={columns}
                        widths={widths}
                        rowH={rowH}
                        cellPad={cellPad}
                        isOpen={expanded.has(r.id)}
                        onToggle={() => toggleExpanded(r.id)}
                        editing={editing}
                        setEditing={setEditing}
                        enableEditing={enableEditing}
                        enableDetail={enableDetail}
                        overrideStore={overrideStore}
                        gridUnit={gridUnit}
                      />
                    ))}
              </tbody>

              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-secondary/95 backdrop-blur font-semibold">
                  {enableDetail && (
                    <td className="border-t-2 border-r border-border sticky left-0 z-30 bg-secondary/95" />
                  )}
                  <td
                    className="border-t-2 border-r border-border text-[10px] text-muted-foreground text-center sticky z-30 bg-secondary/95"
                    style={{ left: enableDetail ? 30 : 0 }}
                  >
                    Σ
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ width: widths[c.key] ?? colWidth(c) }}
                      className={cn(
                        "border-t-2 border-r border-border tabular-nums whitespace-nowrap",
                        cellPad,
                        c.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {c.total ? (
                        c.format === "moneySigned" ? (
                          <span
                            className={totals[c.key] >= 0 ? "text-success" : "text-destructive"}
                          >
                            {formatMoney(totals[c.key], gridUnit, digits, { signed: true })}
                          </span>
                        ) : (
                          money(totals[c.key])
                        )
                      ) : c.key === columns[0]?.key ? (
                        <span className="text-muted-foreground font-normal text-[11px]">
                          {grouped
                            ? `${unitCount.toLocaleString("en-IN")} securities`
                            : `${sorted.length.toLocaleString("en-IN")} rows`}
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border bg-secondary/20 text-[11.5px]">
            <span className="text-muted-foreground tabular">
              {unitCount === 0
                ? "0"
                : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, unitCount)}`}{" "}
              of {unitCount.toLocaleString("en-IN")} {grouped ? "securities" : "rows"}
              {enableEditing && (
                <span className="ml-3 hidden md:inline text-muted-foreground/70">
                  Click ▸ to see every portfolio holding it · double-click a cell to correct it
                </span>
              )}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="h-7 px-2.5 rounded-md border border-border font-medium hover:bg-secondary disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2 text-muted-foreground tabular">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="h-7 px-2.5 rounded-md border border-border font-medium hover:bg-secondary disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Grouped rows: one security, expanding to each portfolio that holds it ────

/**
 * Text for a cell on the consolidated line.
 *
 * Where the lots disagree, the aggregate carries null — and rendering that through
 * the normal accessors would print "Unattributed" (the label for a genuinely missing
 * entity), implying the data is absent when in fact it is simply varied. So mixed
 * descriptive fields report their distinct count instead.
 */
function groupCellText(
  c: GridColumn,
  g: LotGroup,
  gridUnit: Parameters<typeof formatMoney>[1],
  digits: number,
): string {
  const distinct = (f: (r: PortfolioHolding) => string | null | undefined) =>
    new Set(g.lots.map((r) => (f(r) ?? "").trim()).filter(Boolean)).size;

  switch (c.key) {
    case "entity_name": {
      const n = g.entityCount;
      return n === 1 ? normaliseEntity(g.lots[0].entity_name) : `${n} entities`;
    }
    case "broker_name": {
      const n = g.brokerCount;
      return n === 1 ? normaliseBroker(g.lots[0].broker_name) : `${n} custodians`;
    }
    case "folio_number": {
      const n = distinct((r) => r.folio_number);
      if (n === 0) return "—";
      return n === 1 ? (g.lots[0].folio_number ?? "—") : `${n} folios`;
    }
    case "purchase_date": {
      const dates = g.lots
        .map((r) => r.purchase_date)
        .filter(Boolean)
        .sort() as string[];
      if (!dates.length) return "—";
      return dates.length === 1 || dates[0] === dates[dates.length - 1]
        ? formatDate(dates[0])
        : `${formatDate(dates[0])} →`;
    }
    default:
      return renderText(g.aggregate, c, gridUnit, digits);
  }
}

function GroupRows({
  group,
  index,
  columns,
  widths,
  rowH,
  cellPad,
  isOpen,
  onToggle,
  detailKey,
  onDetail,
  editing,
  setEditing,
  enableEditing,
  enableDetail,
  overrideStore,
  gridUnit,
}: {
  group: LotGroup;
  index: number;
  columns: GridColumn[];
  widths: Record<string, number>;
  rowH: string;
  cellPad: string;
  isOpen: boolean;
  onToggle: () => void;
  detailKey: string | null;
  onDetail: (id: string | null) => void;
  editing: { key: string; col: string } | null;
  setEditing: (v: { key: string; col: string } | null) => void;
  enableEditing: boolean;
  enableDetail: boolean;
  overrideStore: ReturnType<typeof getSnapshot>;
  gridUnit: Parameters<typeof formatMoney>[1];
}) {
  const { digits } = useUnits();
  const { aggregate, lots, entityCount, brokerCount } = group;
  const multi = lots.length > 1;
  const colCount = columns.length + (enableDetail ? 2 : 1);

  return (
    <>
      {/* Security line — the consolidated position */}
      <tr
        className={cn(
          "group transition-colors",
          rowH,
          isOpen ? "bg-secondary/50" : "hover:bg-secondary/40",
        )}
      >
        {enableDetail && (
          <td
            className={cn(
              "border-b border-r border-border p-0 text-center sticky left-0 z-10",
              isOpen ? "bg-secondary/50" : "bg-surface group-hover:bg-secondary/40",
            )}
          >
            <button
              onClick={onToggle}
              aria-label={isOpen ? "Collapse holders" : "Show holders"}
              aria-expanded={isOpen}
              className="h-full w-full flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          </td>
        )}
        <td
          className={cn(
            "border-b border-r border-border text-[10.5px] text-muted-foreground tabular-nums text-center sticky z-10",
            isOpen ? "bg-secondary/50" : "bg-surface group-hover:bg-secondary/40",
          )}
          style={{ left: enableDetail ? 30 : 0 }}
        >
          {index}
        </td>

        {columns.map((c) => {
          const isName = c.key === "display_name";
          const text = groupCellText(c, group, gridUnit, digits);
          return (
            <td
              key={c.key}
              style={{ width: widths[c.key] ?? colWidth(c) }}
              className={cn(
                "border-b border-r border-border overflow-hidden whitespace-nowrap font-semibold",
                cellPad,
                c.align === "right" ? "text-right tabular-nums" : "text-left",
                toneFor(aggregate, c),
              )}
              title={isName ? group.key : undefined}
            >
              {isName ? (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{group.key}</span>
                  {multi && (
                    <span className="shrink-0 text-[9.5px] font-medium rounded px-1 py-px bg-[var(--chart-1)]/12 text-[var(--chart-1)] tabular">
                      {lots.length} lots · {entityCount} {entityCount === 1 ? "entity" : "entities"}
                    </span>
                  )}
                </span>
              ) : (
                <span className="block truncate">{text}</span>
              )}
            </td>
          );
        })}
      </tr>

      {/* Holder lines — mirrors the workbook's "Portfolio: … / Folio No. …" block */}
      {isOpen &&
        lots.map((lot) => (
          <LotRow
            key={lot.id}
            lot={lot}
            columns={columns}
            widths={widths}
            rowH={rowH}
            cellPad={cellPad}
            enableDetail={enableDetail}
            enableEditing={enableEditing}
            editing={editing}
            setEditing={setEditing}
            overrideStore={overrideStore}
            gridUnit={gridUnit}
            detailOpen={detailKey === lot.id}
            onDetail={() => onDetail(detailKey === lot.id ? null : lot.id)}
            colCount={colCount}
          />
        ))}

      {isOpen && multi && (
        <tr>
          <td
            colSpan={colCount}
            className="border-b-2 border-border bg-secondary/25 px-3 py-1 text-[10.5px] text-muted-foreground"
          >
            {lots.length} holdings of{" "}
            <span className="font-medium text-foreground">{group.key}</span> across {entityCount}{" "}
            {entityCount === 1 ? "entity" : "entities"}
            {brokerCount > 1 && <> and {brokerCount} custodians</>} · totalling{" "}
            <span className="tabular font-medium text-foreground">
              {formatMoney(aggregate.current_value, gridUnit, digits)}
            </span>
          </td>
        </tr>
      )}
    </>
  );
}

/** One holder line under a security: entity + folio shown prominently, like the workbook. */
function LotRow({
  lot,
  columns,
  widths,
  rowH,
  cellPad,
  enableDetail,
  enableEditing,
  editing,
  setEditing,
  overrideStore,
  gridUnit,
  detailOpen,
  onDetail,
  colCount,
}: {
  lot: PortfolioHolding;
  columns: GridColumn[];
  widths: Record<string, number>;
  rowH: string;
  cellPad: string;
  enableDetail: boolean;
  enableEditing: boolean;
  editing: { key: string; col: string } | null;
  setEditing: (v: { key: string; col: string } | null) => void;
  overrideStore: ReturnType<typeof getSnapshot>;
  gridUnit: Parameters<typeof formatMoney>[1];
  detailOpen: boolean;
  onDetail: () => void;
  colCount: number;
}) {
  const { digits } = useUnits();
  const edits = editedFields(lot, overrideStore);

  return (
    <>
      <tr className={cn("group bg-secondary/10 hover:bg-secondary/40 transition-colors", rowH)}>
        {enableDetail && (
          <td className="border-b border-r border-border p-0 text-center sticky left-0 z-10 bg-[color-mix(in_oklch,var(--surface),var(--secondary)_10%)] group-hover:bg-secondary/40">
            <button
              onClick={onDetail}
              title={detailOpen ? "Hide full detail" : "Show full detail"}
              aria-expanded={detailOpen}
              className="h-full w-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground"
            >
              <Info className="h-3 w-3" />
            </button>
          </td>
        )}
        <td
          className="border-b border-r border-border sticky z-10 bg-[color-mix(in_oklch,var(--surface),var(--secondary)_10%)] group-hover:bg-secondary/40"
          style={{ left: enableDetail ? 30 : 0 }}
        />

        {columns.map((c) => {
          const editingThis = editing?.key === lot.id && editing?.col === c.key;
          const edited = Boolean(edits[c.key]);
          const canEdit = enableEditing && Boolean(c.editable);
          const isName = c.key === "display_name";

          return (
            <td
              key={c.key}
              style={{ width: widths[c.key] ?? colWidth(c) }}
              onDoubleClick={() => canEdit && setEditing({ key: lot.id, col: c.key })}
              className={cn(
                "border-b border-r border-border relative overflow-hidden whitespace-nowrap",
                cellPad,
                c.align === "right" ? "text-right tabular-nums" : "text-left",
                toneFor(lot, c),
                canEdit && "cursor-cell",
                edited && "bg-[var(--chart-3)]/10",
              )}
              title={
                edited ? `Edited — original: ${String(edits[c.key].original ?? "—")}` : undefined
              }
            >
              {editingThis ? (
                <CellEditor row={lot} column={c} onDone={() => setEditing(null)} />
              ) : (
                <>
                  {isName ? (
                    // The security name is already on the parent line, so this cell
                    // carries the holder identity instead — as the workbook prints it.
                    <span className="flex flex-col leading-tight pl-3 border-l-2 border-[var(--chart-1)]/30">
                      <span className="text-[11.5px] font-medium truncate">
                        Portfolio: {normaliseEntity(lot.entity_name)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        {lot.folio_number ? `Folio No. ${lot.folio_number}` : "No folio recorded"}
                      </span>
                    </span>
                  ) : (
                    <span className="block truncate text-muted-foreground">
                      {renderText(lot, c, gridUnit, digits)}
                    </span>
                  )}
                  {edited && (
                    <Pencil className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-[var(--chart-3)]" />
                  )}
                </>
              )}
            </td>
          );
        })}
      </tr>

      {detailOpen && (
        <tr>
          <td colSpan={colCount} className="p-0 border-b border-border">
            <RowDetail row={lot} edits={edits} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Flat row (ungrouped mode) ────────────────────────────────────────────────

function RowGroup({
  row,
  index,
  columns,
  widths,
  rowH,
  cellPad,
  isOpen,
  onToggle,
  editing,
  setEditing,
  enableEditing,
  enableDetail,
  overrideStore,
  gridUnit,
}: {
  row: PortfolioHolding;
  index: number;
  columns: GridColumn[];
  widths: Record<string, number>;
  rowH: string;
  cellPad: string;
  isOpen: boolean;
  onToggle: () => void;
  editing: { key: string; col: string } | null;
  setEditing: (v: { key: string; col: string } | null) => void;
  enableEditing: boolean;
  enableDetail: boolean;
  overrideStore: ReturnType<typeof getSnapshot>;
  gridUnit: Parameters<typeof formatMoney>[1];
}) {
  const { digits } = useUnits();
  const edits = editedFields(row, overrideStore);

  return (
    <>
      <tr className={cn("group hover:bg-secondary/40 transition-colors", rowH)}>
        {enableDetail && (
          <td className="border-b border-r border-border p-0 text-center sticky left-0 z-10 bg-surface group-hover:bg-secondary/40">
            <button
              onClick={onToggle}
              aria-label={isOpen ? "Collapse details" : "Expand details"}
              aria-expanded={isOpen}
              className="h-full w-full flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          </td>
        )}
        <td
          className="border-b border-r border-border text-[10.5px] text-muted-foreground tabular-nums text-center sticky z-10 bg-surface group-hover:bg-secondary/40"
          style={{ left: enableDetail ? 30 : 0 }}
        >
          {index}
        </td>

        {columns.map((c) => {
          const editingThis = editing?.key === row.id && editing?.col === c.key;
          const edited = Boolean(edits[c.key]);
          const canEdit = enableEditing && Boolean(c.editable);

          return (
            <td
              key={c.key}
              style={{ width: widths[c.key] ?? colWidth(c) }}
              onDoubleClick={() => canEdit && setEditing({ key: row.id, col: c.key })}
              className={cn(
                "border-b border-r border-border relative overflow-hidden whitespace-nowrap",
                cellPad,
                c.align === "right" ? "text-right tabular-nums" : "text-left",
                isNumericFormat(c.format) && "tabular-nums",
                toneFor(row, c),
                canEdit && "cursor-cell",
                edited && "bg-[var(--chart-3)]/10",
              )}
              title={
                edited ? `Edited — original: ${String(edits[c.key].original ?? "—")}` : undefined
              }
            >
              {editingThis ? (
                <CellEditor row={row} column={c} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <span className="block truncate">{renderText(row, c, gridUnit, digits)}</span>
                  {edited && (
                    <Pencil className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-[var(--chart-3)]" />
                  )}
                </>
              )}
            </td>
          );
        })}
      </tr>

      {isOpen && (
        <tr>
          <td
            colSpan={columns.length + (enableDetail ? 2 : 1)}
            className="p-0 border-b border-border"
          >
            <RowDetail row={row} edits={edits} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Cell editor ──────────────────────────────────────────────────────────────

function CellEditor({
  row,
  column,
  onDone,
}: {
  row: PortfolioHolding;
  column: GridColumn;
  onDone: () => void;
}) {
  const raw = rawValue(row, column);
  const [draft, setDraft] = useState(raw == null ? "" : String(raw));
  const ref = useRef<HTMLInputElement>(null);
  const numeric = isNumericFormat(column.format);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (!column.editable) return onDone();
    const next = draft.trim() === "" ? null : numeric ? Number(draft.replace(/,/g, "")) : draft;
    if (numeric && next !== null && Number.isNaN(next as number)) return onDone();
    setOverride(row, column.editable, next);
    onDone();
  };

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onDone();
      }}
      inputMode={numeric ? "decimal" : "text"}
      className="absolute inset-0 w-full h-full px-2 bg-surface border-2 border-[var(--chart-1)] outline-none text-[12px] tabular-nums z-20"
    />
  );
}

// ─── Rendering ────────────────────────────────────────────────────────────────

export function renderText(
  r: PortfolioHolding,
  c: GridColumn,
  unit: Parameters<typeof formatMoney>[1],
  digits: number,
): string {
  const v = rawValue(r, c);
  if (v == null || v === "") return "—";
  switch (c.format) {
    case "money":
      return formatMoney(v as number, unit, digits);
    case "moneySigned":
      return formatMoney(v as number, unit, digits, { signed: true });
    case "pct":
      return pct(v as number);
    case "pctSigned":
      return pctSigned(v as number);
    case "number":
      return num(v as number, 3);
    case "date":
      return formatDate(v as string);
    case "days":
      return humanDays(v as number);
    default:
      return String(v);
  }
}

function toneFor(r: PortfolioHolding, c: GridColumn): string {
  if (c.format !== "moneySigned" && c.format !== "pctSigned") return "";
  const v = rawValue(r, c);
  if (v == null) return "";
  return (v as number) >= 0 ? "text-success" : "text-destructive";
}

export { clearOverride, isEdited };
