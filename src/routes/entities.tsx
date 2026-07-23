import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useBook, useEntityAllocation, useDataHealth } from "@/hooks/use-book";
import { sliceBy, normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";
import { inr, pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton, EmptyState } from "@/components/common/States";
import { DataGrid } from "@/components/grid/DataGrid";
import { COLS_FULL_BOOK } from "@/components/grid/columns";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/entities")({
  head: () => ({
    meta: [
      { title: "Entities — SG Family Wealth" },
      {
        name: "description",
        content: "Assets held by each family entity, with allocation and performance.",
      },
    ],
  }),
  component: EntitiesPage,
});

function EntitiesPage() {
  const { slices, isLoading, error, refetch } = useEntityAllocation();
  const { data: book = [] } = useBook();
  const { health } = useDataHealth();
  const [selected, setSelected] = useState<string | null>(null);

  const selectedRows = useMemo(
    () => (selected ? book.filter((r) => normaliseEntity(r.entity_name) === selected) : []),
    [book, selected],
  );

  const selectedMix = useMemo(
    () => sliceBy(selectedRows, (r) => r.asset_class?.trim() || "Unclassified"),
    [selectedRows],
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Overview · Structure"
        title="Family Entities"
        description="Assets held by each legal entity in the family structure — the basis for tax planning and succession."
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[400px] rounded-xl" />
      ) : (
        <>
          <Card
            title="Entity summary"
            subtitle={`${slices.length} entities hold assets · click a row to drill in`}
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[12.5px] min-w-[760px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                    <th className="text-left font-semibold px-5 py-2.5 w-8">#</th>
                    <th className="text-left font-semibold py-2.5">Entity</th>
                    <th className="text-right font-semibold py-2.5">Positions</th>
                    <th className="text-right font-semibold py-2.5">Invested</th>
                    <th className="text-right font-semibold py-2.5">Current</th>
                    <th className="text-right font-semibold py-2.5">Unrealised</th>
                    <th className="text-right font-semibold py-2.5">Gain %</th>
                    <th className="text-right font-semibold py-2.5">XIRR</th>
                    <th className="text-right font-semibold px-5 py-2.5">% Book</th>
                  </tr>
                </thead>
                <tbody>
                  {slices.map((e, i) => (
                    <tr
                      key={e.key}
                      onClick={() => setSelected(selected === e.key ? null : e.key)}
                      className={cn(
                        "border-b border-border/40 cursor-pointer transition-colors",
                        selected === e.key ? "bg-secondary/60" : "hover:bg-secondary/30",
                      )}
                    >
                      <td className="px-5 py-2.5 text-muted-foreground tabular">{i + 1}</td>
                      <td className="py-2.5 font-medium">{e.key}</td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">{e.count}</td>
                      <td className="py-2.5 text-right tabular">{inr(e.invested)}</td>
                      <td className="py-2.5 text-right tabular font-semibold">{inr(e.current)}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular font-semibold",
                          e.gain >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {inr(e.gain)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular",
                          e.gainPct >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {pctSigned(e.gainPct, 1)}
                      </td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">
                        {e.xirr != null ? pct(e.xirr, 1) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular font-semibold">
                        {pct(e.pctOfBook, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                    <td className="px-5 py-2.5" />
                    <td className="py-2.5">Total</td>
                    <td className="py-2.5 text-right tabular">
                      {slices.reduce((s, e) => s + e.count, 0)}
                    </td>
                    <td className="py-2.5 text-right tabular">
                      {inr(slices.reduce((s, e) => s + e.invested, 0))}
                    </td>
                    <td className="py-2.5 text-right tabular">
                      {inr(slices.reduce((s, e) => s + e.current, 0))}
                    </td>
                    <td className="py-2.5 text-right tabular text-success">
                      {inr(slices.reduce((s, e) => s + e.gain, 0))}
                    </td>
                    <td colSpan={2} />
                    <td className="px-5 py-2.5 text-right tabular">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {selected && (
            <>
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-6">
                  <Card
                    title={`${selected} · asset mix`}
                    subtitle={`${selectedRows.length} positions`}
                  >
                    <MixList slices={selectedMix} />
                  </Card>
                </div>
                <div className="col-span-12 lg:col-span-6">
                  <Card
                    title={`${selected} · custodians`}
                    subtitle="Where this entity's assets are held"
                  >
                    <MixList
                      slices={sliceBy(selectedRows, (r) => normaliseBroker(r.broker_name))}
                    />
                  </Card>
                </div>
              </div>

              <DataGrid
                rows={selectedRows}
                columns={COLS_FULL_BOOK}
                title={`${selected} holdings`}
                emptyMessage={`No holdings recorded for ${selected}.`}
              />
            </>
          )}

          {!selected && (
            <Card title="Drill-down">
              <EmptyState message="Select an entity above to see its asset mix, custodians and full holdings." />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MixList({ slices }: { slices: ReturnType<typeof sliceBy> }) {
  const max = Math.max(...slices.map((s) => s.current), 1);
  return (
    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
      {slices.map((s) => (
        <div key={s.key}>
          <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1">
            <span className="font-medium truncate">{s.key}</span>
            <div className="flex items-center gap-2.5 tabular shrink-0">
              <span className="text-muted-foreground">{inr(s.current)}</span>
              <span className="w-11 text-right text-muted-foreground">{pct(s.pctOfBook, 1)}</span>
              <span
                className={cn(
                  "w-14 text-right font-medium",
                  s.gainPct >= 0 ? "text-success" : "text-destructive",
                )}
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
  );
}
