import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getEntityAllocation } from "@/lib/data-service";
import { entityAllocation as fallback, inr } from "@/lib/dummy-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-3)", "var(--chart-4)", "var(--chart-1)", "var(--chart-2)"];

export function EntityAllocationBar() {
  const { data: allocation = fallback } = useQuery({
    queryKey: ["entityAllocation"],
    queryFn: getEntityAllocation,
    staleTime: 5 * 60 * 1000,
  });

  const data = allocation.map((e) => ({ ...e, cr: e.value / 10000000 }));

  return (
    <Card title="Entity-wise allocation" subtitle="AUM held by each family entity">
      <div className="h-[320px] -mx-2">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v} Cr`} />
            <YAxis type="category" dataKey="entity" tick={{ fontSize: 11, fill: "var(--foreground)" }} axisLine={false} tickLine={false} width={130} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [inr(v * 10000000, { compact: true }), "AUM"]}
            />
            <Bar dataKey="cr" radius={[0, 4, 4, 0]} barSize={18}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
