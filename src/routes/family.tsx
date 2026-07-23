import { createFileRoute } from "@tanstack/react-router";
import {
  useEntityAllocation,
  useTotals,
  useConcentration,
  useAssetAllocation,
} from "@/hooks/use-book";
import { inr, pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { ExecutiveSummary } from "@/components/dashboard/ExecutiveSummary";
import { GainBridge } from "@/components/dashboard/GainBridge";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family Overview — SG Family Wealth" },
      {
        name: "description",
        content: "Consolidated family position and how it is spread across entities.",
      },
    ],
  }),
  component: FamilyPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "oklch(0.55 0.10 200)",
];

function FamilyPage() {
  const { slices, isLoading, error, refetch } = useEntityAllocation();
  const { totals } = useTotals();
  const { risk } = useConcentration();
  const { slices: assets } = useAssetAllocation();

  const treeData = slices.map((s, i) => ({
    name: s.key,
    size: s.current,
    fill: COLORS[i % COLORS.length],
    pctOfBook: s.pctOfBook,
  }));

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Overview · Family"
        title="Family Overview"
        description="The consolidated position and how wealth is distributed across the family structure."
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <ExecutiveSummary />

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <Card
                title="Wealth distribution"
                subtitle="Area is proportional to each entity's share of the book"
              >
                {isLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        isAnimationActive={false}
                        data={treeData}
                        dataKey="size"
                        stroke="var(--surface)"
                        content={<TreeCell />}
                      >
                        <Tooltip
                          contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--foreground)",
                          }}
                          formatter={(v: number) => [inr(v), "AUM"]}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <Card title="Structure summary" subtitle="How concentrated the family book is">
                {isLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : (
                  <div className="space-y-4">
                    <Row label="Entities holding assets" value={String(totals.entityCount)} />
                    <Row
                      label="Largest entity"
                      value={`${risk.topEntityName} · ${pct(risk.topEntityPct, 1)}`}
                      tone={risk.topEntityPct >= 50 ? "warn" : null}
                    />
                    <Row label="Asset classes in use" value={String(assets.length)} />
                    <Row
                      label="Total positions"
                      value={totals.holdingCount.toLocaleString("en-IN")}
                    />
                    <Row
                      label="Return on cost"
                      value={pctSigned(totals.unrealisedGainPct)}
                      tone={totals.unrealisedGainPct >= 0 ? "good" : "warn"}
                    />
                    <Row
                      label="Portfolio XIRR"
                      value={
                        totals.weightedXirr != null
                          ? `${pct(totals.weightedXirr)} (${totals.xirrCoveragePct.toFixed(0)}% coverage)`
                          : "N/A"
                      }
                    />

                    <div className="pt-3 border-t border-border space-y-2">
                      {slices.map((s, i) => (
                        <div key={s.key}>
                          <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1">
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <span
                                className="h-2.5 w-2.5 rounded-sm shrink-0"
                                style={{ background: COLORS[i % COLORS.length] }}
                              />
                              <span className="font-medium truncate">{s.key}</span>
                            </span>
                            <span className="tabular text-muted-foreground shrink-0">
                              {inr(s.current)} · {pct(s.pctOfBook, 1)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
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
                  </div>
                )}
              </Card>
            </div>
          </div>

          <GainBridge />
        </>
      )}
    </div>
  );
}

/** Custom treemap cell — recharts' default omits labels below a size threshold. */
function TreeCell(props: unknown) {
  const p = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    fill?: string;
    pctOfBook?: number;
  };
  const { x, y, width, height, name, fill, pctOfBook } = p;
  if (width == null || height == null) return null;
  const showLabel = width > 56 && height > 34;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: fill ?? "var(--chart-1)", stroke: "var(--surface)", strokeWidth: 2 }}
      />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 20} fill="white" fontSize={12} fontWeight={600}>
            {name}
          </text>
          <text x={x + 8} y={y + 36} fill="white" fontSize={11} opacity={0.8}>
            {pctOfBook != null ? `${pctOfBook.toFixed(1)}%` : ""}
          </text>
        </>
      )}
    </g>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular text-right",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </span>
    </div>
  );
}
