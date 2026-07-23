import { Card } from "./Card";
import { useAssetAllocation, useTotals } from "@/hooks/use-book";
import { pctSigned } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useUnits } from "@/lib/units";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--muted-foreground)",
];

export function AssetAllocationDonut() {
  const { money } = useUnits();
  const { slices, isLoading, error, refetch } = useAssetAllocation();
  const { totals } = useTotals();

  return (
    <Card title="Asset allocation" subtitle="Share of book by asset class">
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={slices.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[220px] w-full" />}
      >
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={slices}
                dataKey="current"
                nameKey="key"
                cx="50%"
                cy="50%"
                innerRadius={68}
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
                formatter={(v: number, n: string) => [money(v), n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Total AUM
            </span>
            <span className="text-[21px] font-semibold tabular tracking-tight mt-0.5">
              {money(totals.currentValue)}
            </span>
            <span className="text-[10.5px] tabular text-success">
              {pctSigned(totals.unrealisedGainPct)} on cost
            </span>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {slices.map((a, i) => (
            <li key={a.key} className="flex items-center justify-between gap-2 text-[12px]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-medium text-foreground truncate">{a.key}</span>
              </div>
              <div className="flex items-center gap-3 tabular shrink-0">
                <span className="text-muted-foreground text-[11px]">{money(a.current)}</span>
                <span className="font-semibold w-11 text-right">{a.pctOfBook.toFixed(1)}%</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Card>
  );
}
