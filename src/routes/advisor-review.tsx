import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useBook, useBrokerAllocation, useTotals } from "@/hooks/use-book";
import { sliceBy, normaliseBroker } from "@/lib/portfolio-analytics";
import { inr, pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { CR } from "@/lib/format";

export const Route = createFileRoute("/advisor-review")({
  head: () => ({
    meta: [
      { title: "Custodian Review — SG Family Wealth" },
      {
        name: "description",
        content: "Performance and concentration by custodian, since advisor data is unavailable.",
      },
    ],
  }),
  component: AdvisorReviewPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--muted-foreground)",
];

/**
 * Intended as an advisor scorecard, but `advisor_name` is null for every row in
 * the source. Custodian is the closest populated dimension, so this reviews
 * performance by where assets are held.
 */
function AdvisorReviewPage() {
  const { slices, isLoading, error, refetch } = useBrokerAllocation();
  const { data: book = [] } = useBook();
  const { totals } = useTotals();

  const scatter = useMemo(
    () =>
      slices
        .filter((s) => s.xirr != null)
        .map((s, i) => ({
          name: s.key,
          xirr: +s.xirr!.toFixed(2),
          value: +(s.current / CR).toFixed(2),
          gainPct: s.gainPct,
          fill: COLORS[i % COLORS.length],
        })),
    [slices],
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Review"
        title="Custodian Review"
        description="Where the family's assets are held, how each pool has performed, and how much sits with any one counterparty."
      />

      <div className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">
            Advisor scoring isn't possible with this data.
          </span>{" "}
          The <code className="bg-secondary px-1 rounded">advisor_name</code> column is empty for
          all {book.length} rows. This page reviews by{" "}
          <code className="bg-secondary px-1 rounded">broker_name</code> instead. Populating advisor
          at source would turn this into a genuine mandate scorecard.
        </p>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <Card
                title="Return vs size"
                subtitle="Each custodian plotted by value-weighted XIRR against assets held"
              >
                {scatter.length === 0 ? (
                  <p className="py-12 text-center text-[13px] text-muted-foreground">
                    No custodian has enough XIRR coverage to plot.
                  </p>
                ) : (
                  <div className="h-[300px] -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 16 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="value"
                          name="AUM"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `₹${v}`}
                          label={{
                            value: "AUM (₹ Cr)",
                            position: "insideBottom",
                            offset: -8,
                            style: { fontSize: 10, fill: "var(--muted-foreground)" },
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="xirr"
                          name="XIRR"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                          width={46}
                        />
                        <ZAxis type="number" dataKey="value" range={[80, 500]} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--foreground)",
                          }}
                          formatter={(v: number, n: string) =>
                            n === "XIRR" ? [`${v}%`, "XIRR"] : [`₹${v} Cr`, "AUM"]
                          }
                          labelFormatter={() => ""}
                        />
                        <Scatter isAnimationActive={false} data={scatter} name="Custodian">
                          {scatter.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {scatter.map((d) => (
                    <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <Card
                title="Counterparty concentration"
                subtitle="Share of book held at each custodian"
              >
                <div className="space-y-3">
                  {slices.map((s, i) => (
                    <div key={s.key}>
                      <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                        <span className="font-medium truncate">{s.key}</span>
                        <span className="tabular shrink-0 font-semibold">
                          {pct(s.pctOfBook, 1)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${s.pctOfBook}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {slices[0] && slices[0].pctOfBook >= 40 && (
                  <p className="mt-4 pt-3 border-t border-border text-[11.5px] text-warning leading-relaxed">
                    {slices[0].key} holds {pct(slices[0].pctOfBook, 1)} of the family book. Worth
                    reviewing single-counterparty exposure.
                  </p>
                )}
              </Card>
            </div>
          </div>

          <Card title="Custodian scorecard" subtitle="Ranked by assets held">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[12.5px] min-w-[720px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                    <th className="text-left font-semibold px-5 py-2.5">Custodian</th>
                    <th className="text-right font-semibold py-2.5">Positions</th>
                    <th className="text-right font-semibold py-2.5">Invested</th>
                    <th className="text-right font-semibold py-2.5">Current</th>
                    <th className="text-right font-semibold py-2.5">Gain</th>
                    <th className="text-right font-semibold py-2.5">Gain %</th>
                    <th className="text-right font-semibold py-2.5">XIRR</th>
                    <th className="text-right font-semibold px-5 py-2.5">% Book</th>
                  </tr>
                </thead>
                <tbody>
                  {slices.map((s) => (
                    <tr key={s.key} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="px-5 py-2.5 font-medium">{s.key}</td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">{s.count}</td>
                      <td className="py-2.5 text-right tabular">{inr(s.invested)}</td>
                      <td className="py-2.5 text-right tabular font-semibold">{inr(s.current)}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular",
                          s.gain >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {inr(s.gain)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular font-semibold",
                          s.gainPct >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {pctSigned(s.gainPct, 1)}
                      </td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">
                        {s.xirr != null ? pct(s.xirr, 1) : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular font-semibold">
                        {pct(s.pctOfBook, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                    <td className="px-5 py-2.5">Book</td>
                    <td className="py-2.5 text-right tabular">{totals.holdingCount}</td>
                    <td className="py-2.5 text-right tabular">{inr(totals.investedValue)}</td>
                    <td className="py-2.5 text-right tabular">{inr(totals.currentValue)}</td>
                    <td className="py-2.5 text-right tabular text-success">
                      {inr(totals.unrealisedGain)}
                    </td>
                    <td className="py-2.5 text-right tabular text-success">
                      {pctSigned(totals.unrealisedGainPct, 1)}
                    </td>
                    <td className="py-2.5 text-right tabular">
                      {totals.weightedXirr != null ? pct(totals.weightedXirr, 1) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
