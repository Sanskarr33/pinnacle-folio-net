import { Card } from "./Card";
import { Link } from "@tanstack/react-router";
import { useEntityAllocation } from "@/hooks/use-book";
import { pctSigned, CR } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useUnits } from "@/lib/units";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-4)",
];

export function EntityAllocationBar() {
  const { money } = useUnits();
  const { slices, isLoading, error, refetch } = useEntityAllocation();

  const data = slices.map((s) => ({ ...s, valueCr: +(s.current / CR).toFixed(2) }));

  return (
    <Card
      title="Entity-wise allocation"
      subtitle="AUM held by each family entity"
      right={
        <Link
          to="/entities"
          className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium shrink-0"
        >
          Detail →
        </Link>
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={data.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[320px] w-full" />}
      >
        <div style={{ height: Math.max(240, data.length * 32 + 40) }} className="-mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <YAxis
                type="category"
                dataKey="key"
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
                width={82}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "AUM"]}
              />
              <Bar isAnimationActive={false} dataKey="valueCr" radius={[0, 4, 4, 0]} barSize={16}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-border space-y-1.5 max-h-[150px] overflow-y-auto">
          {data.map((s, i) => (
            <div key={s.key} className="flex items-center justify-between gap-2 text-[11.5px]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-medium truncate">{s.key}</span>
                <span className="text-muted-foreground/70 shrink-0">{s.count} pos</span>
              </div>
              <div className="flex items-center gap-3 tabular shrink-0">
                <span className="text-muted-foreground">{money(s.current)}</span>
                <span className="w-11 text-right font-semibold">{s.pctOfBook.toFixed(1)}%</span>
                <span
                  className={`w-14 text-right ${s.gainPct >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {pctSigned(s.gainPct, 1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </Card>
  );
}
