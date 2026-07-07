import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllHoldings } from "@/lib/data-service";
import type { SGHoldingRow } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSortableTable, SortableHeader } from "@/hooks/useSortableTable";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SG Family Wealth" },
      { name: "description", content: "Concentration, allocation, and performance analytics across the family portfolio." },
    ],
  }),
  component: AnalyticsPage,
});

const CR = 10_000_000;
const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "#a78bfa", "#f59e0b", "#10b981",
];

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4 shadow-elegant", accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface")}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</p>
      <p className="mt-2 text-[26px] font-semibold tabular-nums tracking-tight leading-none">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
};

const CONC_TH = "text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium py-2 sticky top-0 bg-surface cursor-pointer select-none group";

function AnalyticsPage() {
  const { data: rawRows, isLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const rows: SGHoldingRow[] = rawRows ?? [];
  const { formatAmount } = useCurrency();

  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const totalAUM = useMemo(() => rows.reduce((s, r) => s + (r.current_value ?? 0), 0), [rows]);

  // HHI — sum of squared market shares (basis points)
  const hhi = useMemo(() => {
    if (totalAUM === 0) return 0;
    const byName = new Map<string, number>();
    for (const r of rows) {
      const key = r.security_name?.trim() || "Unknown";
      byName.set(key, (byName.get(key) ?? 0) + (r.current_value ?? 0));
    }
    return Array.from(byName.values()).reduce((s, v) => {
      const share = (v / totalAUM) * 100;
      return s + share * share;
    }, 0);
  }, [rows, totalAUM]);

  const hhiLabel = hhi < 1500 ? "Well Diversified" : hhi < 2500 ? "Moderate Concentration" : "Concentrated";
  const hhiColor = hhi < 1500 ? "text-emerald-600" : hhi < 2500 ? "text-amber-500" : "text-destructive";

  // Top-10 holdings (chart data stays pre-divided to Cr)
  const top10 = useMemo(() => {
    const byName = new Map<string, number>();
    for (const r of rows) {
      const key = r.security_name?.trim() || "Unknown";
      byName.set(key, (byName.get(key) ?? 0) + (r.current_value ?? 0));
    }
    return Array.from(byName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({
        name: name.length > 28 ? name.slice(0, 27) + "…" : name,
        value: +(value / CR).toFixed(2),
        pct: totalAUM > 0 ? +((value / totalAUM) * 100).toFixed(1) : 0,
      }));
  }, [rows, totalAUM]);

  // Asset allocation donut (chart data stays pre-divided to Cr)
  const allocationData = useMemo(() => {
    const byClass = new Map<string, number>();
    for (const r of rows) {
      const cls = r.asset_class?.trim() || "Other";
      byClass.set(cls, (byClass.get(cls) ?? 0) + (r.current_value ?? 0));
    }
    return Array.from(byClass.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: +(value / CR).toFixed(2), raw: value, pct: totalAUM > 0 ? +((value / totalAUM) * 100).toFixed(1) : 0 }));
  }, [rows, totalAUM]);

  // Concentration risk table — raw values for formatAmount
  const concentrationTable = useMemo(() => {
    const byName = new Map<string, { value: number; asset_class: string }>();
    for (const r of rows) {
      const key = r.security_name?.trim() || "Unknown";
      const existing = byName.get(key);
      byName.set(key, {
        value: (existing?.value ?? 0) + (r.current_value ?? 0),
        asset_class: r.asset_class?.trim() || "Other",
      });
    }
    return Array.from(byName.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 20)
      .map(([name, { value, asset_class }], idx) => ({
        rank: idx + 1,
        name,
        asset_class,
        value,
        pct: totalAUM > 0 ? +((value / totalAUM) * 100).toFixed(2) : 0,
      }));
  }, [rows, totalAUM]);

  const { sorted: sortedConcentration, sortConfig: concSort, handleSort: concHandleSort } = useSortableTable(concentrationTable, "value", "desc");

  // Entity-wise stacked bar (chart data stays pre-divided to Cr)
  const { entityData, assetClasses } = useMemo(() => {
    const entityMap = new Map<string, Map<string, number>>();
    const classSet = new Set<string>();
    for (const r of rows) {
      const entity = r.entity_name?.trim() || "Unknown";
      const cls = r.asset_class?.trim() || "Other";
      classSet.add(cls);
      if (!entityMap.has(entity)) entityMap.set(entity, new Map());
      const em = entityMap.get(entity)!;
      em.set(cls, (em.get(cls) ?? 0) + (r.current_value ?? 0));
    }
    const assetClasses = Array.from(classSet);
    const entityData = Array.from(entityMap.entries())
      .sort((a, b) => {
        const totalA = Array.from(a[1].values()).reduce((s, v) => s + v, 0);
        const totalB = Array.from(b[1].values()).reduce((s, v) => s + v, 0);
        return totalB - totalA;
      })
      .map(([entity, clsMap]) => {
        const entry: Record<string, string | number> = { entity };
        for (const cls of assetClasses) {
          entry[cls] = +((clsMap.get(cls) ?? 0) / CR).toFixed(2);
        }
        return entry;
      });
    return { entityData, assetClasses };
  }, [rows]);

  // Gain/loss grouped bar chart by asset class (chart data stays pre-divided to Cr)
  const gainByClass = useMemo(() => {
    const byClass = new Map<string, { invested: number; current: number; gain: number }>();
    for (const r of rows) {
      const cls = r.asset_class?.trim() || "Other";
      const existing = byClass.get(cls) ?? { invested: 0, current: 0, gain: 0 };
      byClass.set(cls, {
        invested: existing.invested + (r.invested_value ?? 0),
        current: existing.current + (r.current_value ?? 0),
        gain: existing.gain + (r.unrealised_gain ?? 0),
      });
    }
    return Array.from(byClass.entries())
      .sort((a, b) => b[1].current - a[1].current)
      .map(([name, { invested, current, gain }]) => ({
        name: name.length > 14 ? name.slice(0, 13) + "…" : name,
        Invested: +(invested / CR).toFixed(2),
        Current: +(current / CR).toFixed(2),
        Gain: +(gain / CR).toFixed(2),
      }));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-xl" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Overview</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Concentration, allocation, and performance analytics across the family portfolio.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="HHI Concentration"
          value={hhi.toFixed(0)}
          sub={hhiLabel}
          accent
        />
        <KpiCard
          label="Total AUM"
          value={formatAmount(totalAUM)}
          sub={`${rows.length} raw positions`}
        />
        <KpiCard
          label="Unique Holdings"
          value={new Set(rows.map((r) => r.security_name?.trim()).filter(Boolean)).size.toString()}
          sub="Consolidated by name"
        />
        <KpiCard
          label="Top-10 Concentration"
          value={`${top10.reduce((s, r) => s + r.pct, 0).toFixed(1)}%`}
          sub="Of total portfolio"
        />
      </div>

      {/* HHI colour indicator */}
      <div className="flex items-center gap-3 text-[12px]">
        <span className="text-muted-foreground">Concentration risk:</span>
        <span className={cn("font-semibold", hhiColor)}>{hhiLabel} (HHI = {hhi.toFixed(0)})</span>
        <span className="text-muted-foreground/60">· below 1,500 = diversified · 1,500–2,500 = moderate · above 2,500 = concentrated</span>
      </div>

      {/* Top-10 holdings bar */}
      <SectionCard title="Top 10 Holdings" subtitle="Consolidated by security name · ₹ Crore">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v} Cr`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, _name: string, props: { payload?: { pct?: number } }) =>
                  [formatAmount((v as number) * CR) + ` (${props.payload?.pct ?? 0}%)`, "Value"]
                }
              />
              <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Asset allocation donut + legend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Asset Allocation" subtitle="Click a slice to highlight">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-[220px] w-full sm:w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    onClick={(_: unknown, index: number) =>
                      setActiveSlice(activeSlice === index ? null : index)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {allocationData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        opacity={activeSlice === null || activeSlice === i ? 1 : 0.35}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatAmount((v as number) * CR), "Value"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2">
              {allocationData.map((a, i) => (
                <li
                  key={a.name}
                  className={cn(
                    "flex items-center justify-between text-[12px] cursor-pointer rounded px-2 py-1 transition-colors",
                    activeSlice === i ? "bg-secondary/60" : "hover:bg-secondary/30",
                    activeSlice !== null && activeSlice !== i ? "opacity-40" : "",
                  )}
                  onClick={() => setActiveSlice(activeSlice === i ? null : i)}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground text-[11px]">{formatAmount(a.raw)}</span>
                    <span className="font-semibold w-10 text-right">{a.pct}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        {/* Concentration risk table */}
        <SectionCard title="Concentration Risk" subtitle="Top 20 holdings by portfolio weight · click column headers to sort">
          <div className="overflow-y-auto max-h-[320px]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${CONC_TH} text-left pr-3`}>#</th>
                  <SortableHeader label="Security"  sortKey="name"        sortConfig={concSort} onSort={concHandleSort} className={`${CONC_TH} text-left`} />
                  <SortableHeader label="Class"     sortKey="asset_class" sortConfig={concSort} onSort={concHandleSort} className={`${CONC_TH} text-left`} />
                  <SortableHeader label="Value"     sortKey="value"       sortConfig={concSort} onSort={concHandleSort} className={`${CONC_TH} text-right`} />
                  <SortableHeader label="Weight"    sortKey="pct"         sortConfig={concSort} onSort={concHandleSort} className={`${CONC_TH} text-right`} />
                </tr>
              </thead>
              <tbody>
                {sortedConcentration.map((r) => (
                  <tr key={r.rank} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 pr-3 text-muted-foreground tabular-nums">{r.rank}</td>
                    <td className="py-2 max-w-[140px] truncate font-medium">{r.name}</td>
                    <td className="py-2 text-muted-foreground text-[11px]">{r.asset_class}</td>
                    <td className="py-2 text-right tabular-nums">{formatAmount(r.value)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      <span className={cn(r.pct > 10 ? "text-amber-500" : r.pct > 20 ? "text-destructive" : "text-foreground")}>
                        {r.pct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* Entity-wise stacked bar */}
      <SectionCard title="Entity-wise Portfolio Breakdown" subtitle="Current value by entity and asset class · ₹ Crore">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={entityData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="entity"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v} Cr`}
                width={56}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatAmount((v as number) * CR), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {assetClasses.map((cls, i) => (
                <Bar
                  key={cls}
                  dataKey={cls}
                  stackId="a"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={i === assetClasses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Gain/loss by asset class */}
      <SectionCard title="Invested vs Current vs Gain by Asset Class" subtitle="₹ Crore · Gain shown separately">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gainByClass} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v}`}
                width={56}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatAmount((v as number) * CR), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Invested" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gain" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  );
}
