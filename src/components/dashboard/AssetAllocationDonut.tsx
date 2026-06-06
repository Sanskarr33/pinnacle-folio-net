import { Card } from "./Card";
import { assetAllocation, inr } from "@/lib/dummy-data";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-3)", "var(--chart-4)"];

export function AssetAllocationDonut() {
  return (
    <Card title="Asset allocation" subtitle="Strategic mix · target band ±3%">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={assetAllocation}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {assetAllocation.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total AUM</span>
          <span className="text-[22px] font-semibold tabular tracking-tight mt-0.5">₹300 Cr</span>
          <span className="text-[10.5px] text-success tabular">+0.14% today</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5">
        {assetAllocation.map((a, i) => (
          <li key={a.name} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />
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
