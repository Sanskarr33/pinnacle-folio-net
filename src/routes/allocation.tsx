import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useBook,
  useAssetAllocation,
  useVehicleAllocation,
  useEntityAllocation,
  useBrokerAllocation,
  useConcentration,
} from "@/hooks/use-book";
import { inr, pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { DataGrid } from "@/components/grid/DataGrid";
import { COLS_FULL_BOOK } from "@/components/grid/columns";
import { ConcentrationPanel } from "@/components/dashboard/ConcentrationPanel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import type { Slice } from "@/lib/types";

export const Route = createFileRoute("/allocation")({
  head: () => ({
    meta: [
      { title: "Asset Allocation — SG Family Wealth" },
      {
        name: "description",
        content: "Allocation across asset class, vehicle, entity and custodian.",
      },
    ],
  }),
  component: AllocationPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "oklch(0.55 0.10 200)",
  "oklch(0.62 0.12 140)",
  "oklch(0.50 0.14 320)",
  "var(--muted-foreground)",
];

type Dim = "asset" | "vehicle" | "entity" | "custodian";

function AllocationPage() {
  const [dim, setDim] = useState<Dim>("asset");
  const asset = useAssetAllocation();
  const vehicle = useVehicleAllocation();
  const entity = useEntityAllocation();
  const custodian = useBrokerAllocation();
  const { risk } = useConcentration();
  const { data: book = [], isLoading, error, refetch } = useBook();

  const active: Record<Dim, { slices: Slice[]; label: string; note?: string }> = {
    asset: { slices: asset.slices, label: "Asset class" },
    vehicle: {
      slices: vehicle.slices,
      label: "Vehicle",
      note: "Mutually exclusive buckets — these sum exactly to total AUM.",
    },
    entity: { slices: entity.slices, label: "Entity" },
    custodian: {
      slices: custodian.slices,
      label: "Custodian",
      note: "Broker spellings normalised; rows without a broker show as Unattributed.",
    },
  };

  const { slices, note } = active[dim];
  const total = slices.reduce((s, x) => s + x.current, 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Overview · Allocation"
        title="Asset Allocation"
        description="The consolidated book sliced four ways, with measured concentration rather than target bands."
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-secondary border border-border w-fit">
            {(
              [
                ["asset", "By asset class"],
                ["vehicle", "By vehicle"],
                ["entity", "By entity"],
                ["custodian", "By custodian"],
              ] as Array<[Dim, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setDim(k)}
                className={cn(
                  "text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors",
                  dim === k
                    ? "bg-surface text-foreground shadow-elegant"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5">
              <Card title={active[dim].label} subtitle={note ?? `${slices.length} groups`}>
                {isLoading ? (
                  <Skeleton className="h-[260px]" />
                ) : (
                  <>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            isAnimationActive={false}
                            data={slices}
                            dataKey="current"
                            nameKey="key"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={92}
                            paddingAngle={2}
                            stroke="var(--surface)"
                            strokeWidth={2}
                          >
                            {slices.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "var(--foreground)",
                            }}
                            formatter={(v: number, n: string) => [inr(v), n]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-center text-[12px] text-muted-foreground -mt-1">
                      Total{" "}
                      <span className="tabular font-semibold text-foreground">{inr(total)}</span>
                    </p>
                  </>
                )}
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-7">
              <Card title="Breakdown" subtitle="Value, share of book and return on cost">
                {isLoading ? (
                  <Skeleton className="h-[280px]" />
                ) : (
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-[12.5px] min-w-[560px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                          <th className="text-left font-semibold px-5 py-2.5">
                            {active[dim].label}
                          </th>
                          <th className="text-right font-semibold py-2.5">Positions</th>
                          <th className="text-right font-semibold py-2.5">Invested</th>
                          <th className="text-right font-semibold py-2.5">Current</th>
                          <th className="text-right font-semibold py-2.5">Gain %</th>
                          <th className="text-right font-semibold px-5 py-2.5">% Book</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slices.map((s, i) => (
                          <tr
                            key={s.key}
                            className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                          >
                            <td className="px-5 py-2.5 font-medium">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                                  style={{ background: COLORS[i % COLORS.length] }}
                                />
                                <span className="truncate">{s.key}</span>
                              </span>
                            </td>
                            <td className="py-2.5 text-right tabular text-muted-foreground">
                              {s.count}
                            </td>
                            <td className="py-2.5 text-right tabular">{inr(s.invested)}</td>
                            <td className="py-2.5 text-right tabular font-semibold">
                              {inr(s.current)}
                            </td>
                            <td
                              className={cn(
                                "py-2.5 text-right tabular",
                                s.gainPct >= 0 ? "text-success" : "text-destructive",
                              )}
                            >
                              {pctSigned(s.gainPct, 1)}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular font-semibold">
                              {pct(s.pctOfBook, 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5">
              <ConcentrationPanel />
            </div>
            <div className="col-span-12 lg:col-span-7">
              <Card title="Concentration read" subtitle="What the numbers mean for this book">
                <div className="space-y-3 text-[12.5px] leading-relaxed">
                  <p>
                    The book holds{" "}
                    <span className="font-semibold tabular">
                      {book.length.toLocaleString("en-IN")}
                    </span>{" "}
                    positions but behaves like{" "}
                    <span className="font-semibold tabular">
                      {risk.effectiveHoldings.toFixed(0)}
                    </span>{" "}
                    equal-weight ones, because value is unevenly spread.
                  </p>
                  <p>
                    An HHI of <span className="font-semibold tabular">{risk.hhi.toFixed(0)}</span>{" "}
                    sits{" "}
                    {risk.hhi < 1500 ? (
                      <span className="text-success font-medium">
                        in the diversified band (below 1500)
                      </span>
                    ) : risk.hhi < 2500 ? (
                      <span className="text-warning font-medium">
                        in the moderately concentrated band
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">
                        in the highly concentrated band
                      </span>
                    )}
                    .
                  </p>
                  <p>
                    The largest single exposure is{" "}
                    <span className="font-medium">{risk.topSecurityName}</span> at{" "}
                    <span className="tabular font-semibold">{pct(risk.topSecurityPct, 2)}</span>;
                    the top ten together are{" "}
                    <span className="tabular font-semibold">{pct(risk.top10Pct, 1)}</span> of the
                    book.
                  </p>
                  <p className="text-muted-foreground">
                    Sector-level exposure isn't shown because the source table has no sector column
                    — adding one to{" "}
                    <code className="bg-secondary px-1 rounded">portfolio_detailed_holdings</code>{" "}
                    would let this page break equity risk down properly.
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <DataGrid
            rows={book}
            columns={COLS_FULL_BOOK}
            isLoading={isLoading}
            title="Full book"
            emptyMessage="The holdings book is empty."
          />
        </>
      )}
    </div>
  );
}
