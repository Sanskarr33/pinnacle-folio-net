import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getAssetAllocation, getFamilyKpis } from "@/lib/data-service";
import { inr } from "@/lib/dummy-data";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-3)", "var(--chart-4)"];

export function AssetAllocationDonut() {
  const { data: allocation, isLoading: allocLoading, isError: allocError } = useQuery({
    queryKey: ["assetAllocation"],
    queryFn: getAssetAllocation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useQuery({
    queryKey: ["familyKpis"],
    queryFn: getFamilyKpis,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isLoading = allocLoading || kpisLoading;
  const isError   = allocError   || kpisError;

  if (isLoading) {
    return (
      <Card title="Asset allocation" subtitle="Strategic mix · target band ±3%">
        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground animate-pulse">
          Loading…
        </div>
      </Card>
    );
  }

  if (isError || !allocation || !kpis) {
    return (
      <Card title="Asset allocation" subtitle="Strategic mix · target band ±3%">
        <div className="h-[220px] flex items-center justify-center text-sm text-destructive">
          Supabase connection error
        </div>
      </Card>
    );
  }

  return (
    <Card title="Asset allocation" subtitle="Strategic mix · target band ±3%">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allocation}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {allocation.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total AUM</span>
          <span className="text-[22px] font-semibold tabular tracking-tight mt-0.5">
            {inr(kpis.totalAUM, { compact: true })}
          </span>
          <span className="text-[10.5px] tabular text-muted-foreground">
            {inr(kpis.invested, { compact: true })} invested
          </span>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5">
        {allocation.map((a, i) => (
          <li key={a.name} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="font-medium text-foreground">{a.name}</span>
            </div>
            <div className="flex items-center gap-3 tabular">
              <span className="text-muted-foreground text-[11px]">{inr(a.amount, { compact: true })}</span>
              <span className="font-semibold w-12 text-right">{a.value.toFixed(2)}%</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
