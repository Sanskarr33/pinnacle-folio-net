import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getWealthTimeline } from "@/lib/data-service";
import { pct } from "@/lib/dummy-data";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";
import { BarChart2 } from "lucide-react";

const ranges = ["1M", "3M", "6M", "1Y", "3Y", "ALL"] as const;

export function WealthMovementChart() {
  const [range, setRange] = useState<(typeof ranges)[number]>("1Y");

  const { data: allPoints = [], isLoading } = useQuery({
    queryKey: ["wealthTimeline"],
    queryFn: getWealthTimeline,
    staleTime: 5 * 60 * 1000,
  });

  const sliceMap: Record<string, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, ALL: 9999 };
  const points = allPoints.slice(-sliceMap[range]);

  const first = points[0]?.value ?? 0;
  const last  = points[points.length - 1]?.value ?? 0;
  const appreciation = first > 0 ? ((last - first) / first) * 100 : 0;
  const hasData = allPoints.length > 0;

  const rangeButtons = (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-secondary/70 border border-border">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => hasData && setRange(r)}
          disabled={!hasData}
          className={`text-[11px] font-medium px-2.5 py-1 rounded transition-colors tabular ${
            r === range && hasData
              ? "bg-surface text-foreground shadow-elegant"
              : "text-muted-foreground/40 cursor-not-allowed"
          }`}
        >{r}</button>
      ))}
    </div>
  );

  return (
    <Card
      title="Wealth movement"
      subtitle="Consolidated NAV across all entities · ₹ Cr"
      right={rangeButtons}
    >
      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground animate-pulse">
          Loading…
        </div>
      ) : !hasData ? (
        <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground">Historical data not configured</p>
            <p className="mt-1 text-[12px] text-muted-foreground max-w-xs">
              Populate a <code className="text-foreground">wealth_timeline</code> table in Supabase and wire{" "}
              <code className="text-foreground">getWealthTimeline()</code> to display this chart.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-[300px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `₹${v}`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)" }}
                  formatter={(v: number) => [`₹${v.toFixed(0)} Cr`, "AUM"]}
                />
                <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#wealthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-4 gap-4 text-[11px]">
            <Mini label="Starting"             value={`₹${first.toFixed(0)} Cr`} />
            <Mini label="Current"              value={`₹${last.toFixed(0)} Cr`} />
            <Mini label="Net inflow"           value="—" />
            <Mini label="Capital appreciation" value={pct(appreciation)} positive={appreciation >= 0} />
          </div>
        </>
      )}
    </Card>
  );
}

function Mini({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</p>
      <p className={`mt-1 text-[14px] font-semibold tabular ${
        positive === true  ? "text-success" :
        positive === false ? "text-destructive" :
        "text-foreground"
      }`}>{value}</p>
    </div>
  );
}
