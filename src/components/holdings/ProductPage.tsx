import { useMemo } from "react";
import { useBook, useProductBook } from "@/hooks/use-book";
import { sliceBy, normaliseEntity } from "@/lib/portfolio-analytics";
import type { ProductKey } from "@/lib/portfolio-analytics";
import { pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/States";
import { HoldingsKpiBar } from "./HoldingsKpiBar";
import { DataGrid, type GridColumn } from "@/components/grid/DataGrid";
import { COLS_PRODUCT } from "@/components/grid/columns";
import { Card } from "@/components/dashboard/Card";
import { useUnits } from "@/lib/units";

/**
 * Shared shell for every product page: KPI strip, a category/entity split, and
 * the sortable holdings table. Keeps the nine product routes to a few lines each.
 */
export function ProductPage({
  productKey,
  eyebrow,
  title,
  description,
  columns = COLS_PRODUCT,
  splitBy = "category",
  emptyMessage,
  overlapNote,
}: {
  productKey: ProductKey;
  eyebrow: string;
  title: string;
  description: string;
  columns?: GridColumn[];
  splitBy?: "category" | "asset_class" | "product_type";
  emptyMessage?: string;
  overlapNote?: string;
}) {
  const { rows, isLoading, error, refetch } = useProductBook(productKey);
  const { data: book } = useBook();

  const bookValue = useMemo(
    () => (book ?? []).reduce((s, r) => s + (r.current_value ?? 0), 0),
    [book],
  );

  const splits = useMemo(
    () => sliceBy(rows, (r) => (r[splitBy] ?? "").toString().trim() || "Uncategorised"),
    [rows, splitBy],
  );

  const entities = useMemo(() => sliceBy(rows, (r) => normaliseEntity(r.entity_name)), [rows]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <HoldingsKpiBar rows={rows} isLoading={isLoading} bookValue={bookValue} />

          {overlapNote && !isLoading && rows.length > 0 && (
            <p className="text-[11.5px] text-muted-foreground border border-border rounded-lg bg-secondary/25 px-3 py-2">
              {overlapNote}
            </p>
          )}

          {!isLoading && rows.length > 0 && (
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-7">
                <BreakdownCard
                  title={splitBy === "category" ? "By category" : "By type"}
                  subtitle={`${splits.length} groups`}
                  slices={splits}
                />
              </div>
              <div className="col-span-12 lg:col-span-5">
                <BreakdownCard
                  title="By entity"
                  subtitle={`${entities.length} entities hold this`}
                  slices={entities}
                />
              </div>
            </div>
          )}

          <DataGrid
            rows={rows}
            columns={columns}
            isLoading={isLoading}
            title={title}
            emptyMessage={emptyMessage ?? `No ${title.toLowerCase()} holdings in the current book.`}
            emptyHint="This is filtered from the reconciled holdings table — if you expect rows here, check the product_type values on the Data Import page."
          />
        </>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  slices,
}: {
  title: string;
  subtitle: string;
  slices: ReturnType<typeof sliceBy>;
}) {
  const { money } = useUnits();
  const max = Math.max(...slices.map((s) => s.current), 1);
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
        {slices.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1">
              <span className="font-medium truncate">{s.key}</span>
              <div className="flex items-center gap-2.5 tabular shrink-0">
                <span className="text-muted-foreground">{money(s.current)}</span>
                <span className="w-11 text-right text-muted-foreground">{pct(s.pctOfBook, 1)}</span>
                <span
                  className={`w-14 text-right font-medium ${
                    s.gainPct >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {pctSigned(s.gainPct, 1)}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--chart-1)] transition-all duration-700"
                style={{ width: `${(s.current / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
