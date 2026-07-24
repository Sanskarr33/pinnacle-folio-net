import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Bookmark, BookmarkPlus, Table2, Trash2, X, Flame, FileSpreadsheet } from "lucide-react";
import { useBook } from "@/hooks/use-book";
import { useUnits, formatMoney } from "@/lib/units";
import { pct, pctSigned, num } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { DataGrid } from "@/components/grid/DataGrid";
import { COLS_FULL_BOOK } from "@/components/grid/columns";
import {
  DIMENSIONS,
  MEASURES,
  computePivot,
  dimension,
  type PivotCell,
  type PivotConfig,
  type PivotMeasure,
} from "@/lib/pivot";
import {
  subscribeViews,
  getViewsSnapshot,
  getServerViewsSnapshot,
  viewsFor,
  saveView,
  deleteView,
} from "@/lib/saved-views";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pivot")({
  head: () => ({
    meta: [
      { title: "Pivot — SG Family Wealth" },
      {
        name: "description",
        content: "Cross-tab any dimension against any other, with drill-down to lots.",
      },
    ],
  }),
  component: PivotPage,
});

const SCOPE = "pivot";

function PivotPage() {
  const { data, isLoading, error } = useBook();
  const { unit, digits } = useUnits();

  // A cross-tab is read by comparing cells down a column, so every cell must share one
  // unit. "Auto" would scale each cell independently (₹5.78 Cr beside ₹66.93 L), which
  // defeats that — so Auto resolves to Crore here, as it does in the grids.
  const cellUnit = unit === "auto" ? "crore" : unit;

  const [cfg, setCfg] = useState<PivotConfig>({
    rowDim: "entity",
    colDim: "asset_class",
    measureKey: "current_value",
    sortByValue: true,
    hideEmpty: true,
  });
  const [drill, setDrill] = useState<{ label: string; cell: PivotCell } | null>(null);
  const [heat, setHeat] = useState(true);
  const [newName, setNewName] = useState("");
  const [exporting, setExporting] = useState(false);

  const viewStore = useSyncExternalStore(subscribeViews, getViewsSnapshot, getServerViewsSnapshot);
  const saved = useMemo(() => viewsFor<PivotConfig>(SCOPE, viewStore), [viewStore]);

  const rows = useMemo(() => data ?? [], [data]);
  const res = useMemo(() => computePivot(rows, cfg), [rows, cfg]);

  const fmt = (v: number | null, m: PivotMeasure) => {
    if (v == null) return "—";
    if (m.format === "money") return formatMoney(v, cellUnit, digits);
    if (m.format === "pct") return pct(v, 1);
    if (m.format === "pctSigned") return pctSigned(v, 1);
    return num(v, 0);
  };

  // Heat scale is per-pivot, based on the largest absolute cell, so colour always
  // spans the data actually on screen rather than an arbitrary fixed range.
  const maxAbs = useMemo(() => {
    let mx = 0;
    for (const rk of res.rowKeys)
      for (const ck of res.colKeys) {
        const v = res.cells[rk]?.[ck]?.value;
        if (v != null) mx = Math.max(mx, Math.abs(v));
      }
    return mx;
  }, [res]);

  const heatStyle = (v: number | null) => {
    if (!heat || v == null || maxAbs <= 0) return undefined;
    const t = Math.min(1, Math.abs(v) / maxAbs);
    // Negative cells read red, positive read as the brand accent.
    const hue = res.measure.signed && v < 0 ? "var(--destructive)" : "var(--chart-1)";
    return { backgroundColor: `color-mix(in oklch, ${hue} ${(t * 26).toFixed(1)}%, transparent)` };
  };

  // The pivot exports as real numbers with the measure's format, so the sheet stays
  // sortable and summable — plus a second tab listing every lot behind the cross-tab.
  async function exportExcel() {
    setExporting(true);
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      const rowLabel = dimension(cfg.rowDim).label;
      const type =
        res.measure.format === "money"
          ? ("money" as const)
          : res.measure.format === "number"
            ? ("number" as const)
            : ("pct" as const);

      const columns = [
        { header: rowLabel, key: "__row", type: "text" as const, width: 34 },
        ...res.colKeys.map((ck) => ({ header: ck, key: ck, type, width: 16 })),
        { header: "Total", key: "__total", type, width: 18 },
      ];
      const sheetRows = res.rowKeys.map((rk) => {
        const rec: Record<string, unknown> = { __row: rk };
        for (const ck of res.colKeys) rec[ck] = res.cells[rk]?.[ck]?.value ?? null;
        rec.__total = res.rowTotals[rk]?.value ?? null;
        return rec;
      });
      const totals: Record<string, unknown> = { __row: "Total" };
      for (const ck of res.colKeys) totals[ck] = res.colTotals[ck]?.value ?? null;
      totals.__total = res.grand.value;

      await exportXlsx({
        fileName: `pivot-${cfg.rowDim}-by-${cfg.colDim}`,
        unit,
        subtitle: `${rowLabel} × ${dimension(cfg.colDim).label} · ${res.measure.label} · ${rows.length} lots · SG Family Office`,
        sheets: [
          { name: "Pivot", columns, rows: sheetRows, totals, freezeCols: 1 },
          {
            name: "Underlying lots",
            freezeCols: 1,
            columns: [
              { header: "Security", key: "security", type: "text", width: 40 },
              { header: "Entity", key: "entity", type: "text", width: 18 },
              { header: "Custodian", key: "broker", type: "text", width: 22 },
              { header: "Folio", key: "folio", type: "text", width: 18 },
              { header: "Asset Class", key: "asset", type: "text", width: 22 },
              { header: "Invested", key: "invested", type: "money" },
              { header: "Current Value", key: "current", type: "money" },
              { header: "Gain", key: "gain", type: "money" },
              { header: "Gain %", key: "gainPct", type: "pct" },
            ],
            rows: rows.map((r) => ({
              security: r.security_name || r.scheme_name || "",
              entity: r.entity_name ?? "",
              broker: r.broker_name ?? "",
              folio: r.folio_number ?? "",
              asset: r.asset_class ?? "",
              invested: r.invested_value,
              current: r.current_value,
              gain: r.unrealised_gain,
              gainPct: r.gain_percent,
            })),
          },
        ],
      });
    } catch (err) {
      console.error("Pivot export failed", err);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <ErrorState error={error as Error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis"
        title="Pivot"
        description="Cross-tab any dimension against any other. Click a cell to see the lots behind it."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHeat((h) => !h)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11.5px] font-medium transition-colors",
                heat
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              Heat map
            </button>
            <button
              onClick={exportExcel}
              disabled={exporting || res.rowKeys.length === 0}
              title="Download this pivot, plus the underlying lots, as a formatted Excel workbook"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting ? "Building…" : "Excel"}
            </button>
          </div>
        }
      />

      {/* ── Builder ─────────────────────────────────────────────────────────── */}
      <Card title="Layout" subtitle="Pick what goes on rows, columns and in the cells.">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Rows">
            <Select
              value={cfg.rowDim}
              onChange={(v) => setCfg({ ...cfg, rowDim: v })}
              options={DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))}
            />
          </Field>
          <Field label="Columns">
            <Select
              value={cfg.colDim}
              onChange={(v) => setCfg({ ...cfg, colDim: v })}
              options={DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))}
            />
          </Field>
          <Field label="Measure">
            <Select
              value={cfg.measureKey}
              onChange={(v) => setCfg({ ...cfg, measureKey: v })}
              options={MEASURES.map((m) => ({ value: m.key, label: m.label }))}
            />
          </Field>
          <Field label="Sort">
            <Select
              value={cfg.sortByValue === false ? "name" : "value"}
              onChange={(v) => setCfg({ ...cfg, sortByValue: v === "value" })}
              options={[
                { value: "value", label: "By value" },
                { value: "name", label: "A–Z" },
              ]}
            />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground pb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.hideEmpty !== false}
              onChange={(e) => setCfg({ ...cfg, hideEmpty: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
            />
            Hide empty
          </label>

          <button
            onClick={() => setCfg({ ...cfg, rowDim: cfg.colDim, colDim: cfg.rowDim })}
            title="Swap rows and columns"
            className="ml-auto h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            ⇄ Swap axes
          </button>
        </div>

        {/* Saved views */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-2">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {saved.length === 0 && (
            <span className="text-[11.5px] text-muted-foreground">No saved views yet.</span>
          )}
          {saved.map((v) => (
            <span
              key={v.id}
              className="group inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 pl-2.5 pr-1 h-7 text-[11.5px]"
            >
              <button
                onClick={() => setCfg(v.config)}
                className="font-medium hover:text-primary transition-colors"
              >
                {v.name}
              </button>
              <button
                onClick={() => deleteView(SCOPE, v.id)}
                title={`Delete "${v.name}"`}
                className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  saveView(SCOPE, newName, cfg);
                  setNewName("");
                }
              }}
              placeholder="Name this view…"
              className="h-7 w-40 rounded-lg border border-border bg-background px-2.5 text-[11.5px] outline-none focus:border-primary/60"
            />
            <button
              onClick={() => {
                if (!newName.trim()) return;
                saveView(SCOPE, newName, cfg);
                setNewName("");
              }}
              disabled={!newName.trim()}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] font-medium hover:bg-secondary disabled:opacity-40 transition-colors"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save
            </button>
          </span>
        </div>
      </Card>

      {/* ── The cross-tab ───────────────────────────────────────────────────── */}
      <Card
        title={`${dimension(cfg.rowDim).label} × ${dimension(cfg.colDim).label}`}
        subtitle={`${res.measure.label} · ${res.rowKeys.length} rows × ${res.colKeys.length} columns · ${rows.length} lots`}
        right={
          <span className="text-[11px] text-muted-foreground tabular">
            Grand total {fmt(res.grand.value, res.measure)}
          </span>
        }
      >
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : res.rowKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No rows match this layout.
          </p>
        ) : (
          <div className="overflow-auto max-h-[70vh] -mx-5 px-5">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface">
                  <th className="sticky left-0 z-20 bg-surface text-left font-semibold px-3 py-2 border-b border-border whitespace-nowrap">
                    {dimension(cfg.rowDim).label}
                  </th>
                  {res.colKeys.map((ck) => (
                    <th
                      key={ck}
                      className="text-right font-semibold px-3 py-2 border-b border-border whitespace-nowrap text-muted-foreground"
                    >
                      {ck}
                    </th>
                  ))}
                  <th className="text-right font-semibold px-3 py-2 border-b-2 border-border whitespace-nowrap bg-secondary/40">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {res.rowKeys.map((rk) => (
                  <tr key={rk} className="hover:bg-secondary/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-surface font-medium px-3 py-1.5 border-b border-border/40 whitespace-nowrap">
                      {rk}
                    </td>
                    {res.colKeys.map((ck) => {
                      const cell = res.cells[rk]?.[ck];
                      const v = cell?.value ?? null;
                      return (
                        <td
                          key={ck}
                          style={heatStyle(v)}
                          onClick={() =>
                            cell?.rows.length && setDrill({ label: `${rk} · ${ck}`, cell })
                          }
                          className={cn(
                            "text-right tabular px-3 py-1.5 border-b border-border/40 whitespace-nowrap",
                            cell?.rows.length && "cursor-pointer hover:underline",
                            res.measure.signed && v != null && v < 0 && "text-destructive",
                          )}
                          title={
                            cell?.rows.length
                              ? `${cell.rows.length} lots — click to drill in`
                              : undefined
                          }
                        >
                          {fmt(v, res.measure)}
                        </td>
                      );
                    })}
                    <td
                      onClick={() =>
                        res.rowTotals[rk]?.rows.length &&
                        setDrill({ label: rk, cell: res.rowTotals[rk] })
                      }
                      className={cn(
                        "text-right tabular font-semibold px-3 py-1.5 border-b border-border/40 bg-secondary/40 whitespace-nowrap cursor-pointer hover:underline",
                        res.measure.signed &&
                          (res.rowTotals[rk]?.value ?? 0) < 0 &&
                          "text-destructive",
                      )}
                    >
                      {fmt(res.rowTotals[rk]?.value ?? null, res.measure)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0">
                <tr className="bg-secondary">
                  <td className="sticky left-0 z-20 bg-secondary font-semibold px-3 py-2 border-t-2 border-border whitespace-nowrap">
                    Total
                  </td>
                  {res.colKeys.map((ck) => (
                    <td
                      key={ck}
                      onClick={() =>
                        res.colTotals[ck]?.rows.length &&
                        setDrill({ label: ck, cell: res.colTotals[ck] })
                      }
                      className={cn(
                        "text-right tabular font-semibold px-3 py-2 border-t-2 border-border whitespace-nowrap cursor-pointer hover:underline",
                        res.measure.signed &&
                          (res.colTotals[ck]?.value ?? 0) < 0 &&
                          "text-destructive",
                      )}
                    >
                      {fmt(res.colTotals[ck]?.value ?? null, res.measure)}
                    </td>
                  ))}
                  <td className="text-right tabular font-bold px-3 py-2 border-t-2 border-border whitespace-nowrap">
                    {fmt(res.grand.value, res.measure)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {res.measure.key === "gain_percent" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Gain % is recomputed from summed invested and current value — not an average of per-lot
            percentages, which would over-weight small holdings.
          </p>
        )}
        {res.measure.key === "xirr" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            XIRR is value-weighted across the lots that report one; lots without an XIRR are
            excluded rather than treated as zero.
          </p>
        )}
      </Card>

      {/* ── Drill-down ──────────────────────────────────────────────────────── */}
      {drill && (
        <Card
          title={`Lots behind ${drill.label}`}
          subtitle={`${drill.cell.rows.length} holdings`}
          right={
            <button
              onClick={() => setDrill(null)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          }
        >
          <DataGrid rows={drill.cell.rows} columns={COLS_FULL_BOOK} />
        </Card>
      )}

      {!drill && !isLoading && res.rowKeys.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5" />
          Click any cell, row total or column total to open the underlying lots.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium outline-none focus:border-primary/60 min-w-[150px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
