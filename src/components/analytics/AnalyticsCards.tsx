import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Treemap,
  LineChart,
  Line,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import type { PortfolioHolding, Slice } from "@/lib/types";
import {
  sliceBy,
  consolidateSecurities,
  displayName,
  taxLots,
  parseExitLoad,
} from "@/lib/portfolio-analytics";
import { DIMENSION_ACCESSOR, type FilterKey } from "./FilterBar";
import { useUnits } from "@/lib/units";
import { pct, pctSigned, humanDays } from "@/lib/format";
import { EmptyState } from "@/components/common/States";
import { cn } from "@/lib/utils";

export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "oklch(0.55 0.10 200)",
  "oklch(0.62 0.12 140)",
  "oklch(0.50 0.14 320)",
  "oklch(0.60 0.13 40)",
  "oklch(0.45 0.10 170)",
  "var(--muted-foreground)",
];

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

// ─── 1. Composition (click a slice to cross-filter) ───────────────────────────

export function CompositionCard({
  rows,
  dimension,
  onDimension,
  onSelect,
  selected,
}: {
  rows: PortfolioHolding[];
  dimension: FilterKey;
  onDimension: (d: FilterKey) => void;
  onSelect: (key: FilterKey, value: string) => void;
  selected: string[];
}) {
  const { money, suffix, divisor } = useUnits();
  const slices = useMemo(() => sliceBy(rows, DIMENSION_ACCESSOR[dimension]), [rows, dimension]);
  if (!slices.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div>
      <DimensionTabs value={dimension} onChange={onDimension} />
      <div className="h-[260px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="current"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              onClick={(d: unknown) => {
                const k = (d as { key?: string })?.key;
                if (k) onSelect(dimension, k);
              }}
            >
              {slices.map((s, i) => (
                <Cell
                  key={s.key}
                  fill={PALETTE[i % PALETTE.length]}
                  opacity={selected.length && !selected.includes(s.key) ? 0.25 : 1}
                  className="cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number, n: string) => [money(v), n]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 max-h-[150px] overflow-y-auto pr-1">
        {slices.map((s, i) => (
          <li key={s.key}>
            <button
              onClick={() => onSelect(dimension, s.key)}
              className={cn(
                "w-full flex items-center justify-between gap-2 text-[11.5px] rounded px-1.5 py-1 hover:bg-secondary/60 transition-colors",
                selected.includes(s.key) && "bg-secondary",
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate">{s.key}</span>
              </span>
              <span className="flex items-center gap-2.5 tabular shrink-0 text-muted-foreground">
                <span>{money(s.current)}</span>
                <span className="w-11 text-right">{pct(s.pctOfBook, 1)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">Click a segment to filter the page.</p>
    </div>
  );
}

// ─── 2. Risk / return scatter ─────────────────────────────────────────────────

export function RiskReturnCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money, divisor, suffix } = useUnits();
  const data = useMemo(
    () =>
      consolidateSecurities(rows)
        .filter((s) => s.invested > 0 && s.current > 0)
        .map((s) => ({
          name: s.key,
          size: +(s.current / divisor).toFixed(3),
          gain: +s.gainPct.toFixed(2),
          xirr: s.xirr,
          current: s.current,
        })),
    [rows, divisor],
  );
  if (!data.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="size"
            name="Value"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `₹${v}`}
            label={{
              value: `Position size (₹${suffix.trim() || ""})`,
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 10, fill: "var(--muted-foreground)" },
            }}
          />
          <YAxis
            type="number"
            dataKey="gain"
            name="Return"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={48}
          />
          <ZAxis type="number" dataKey="size" range={[30, 420]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={tooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div style={tooltipStyle} className="px-2.5 py-2">
                  <p className="font-semibold max-w-[240px] truncate">{d.name}</p>
                  <p className="tabular">{money(d.current)}</p>
                  <p className={d.gain >= 0 ? "text-success tabular" : "text-destructive tabular"}>
                    {pctSigned(d.gain)} on cost
                  </p>
                  {d.xirr != null && (
                    <p className="tabular text-muted-foreground">XIRR {pct(d.xirr)}</p>
                  )}
                </div>
              );
            }}
          />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.gain >= 0 ? "var(--chart-2)" : "var(--chart-4)"}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 3. Top / bottom performers ───────────────────────────────────────────────

export function LeadersCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money, divisor } = useUnits();
  const [mode, setMode] = useState<"best" | "worst">("best");
  const [n, setN] = useState(10);

  const data = useMemo(() => {
    const secs = consolidateSecurities(rows).filter((s) => s.invested > 0);
    const sorted = [...secs].sort((a, b) => b.gainPct - a.gainPct);
    const picked = mode === "best" ? sorted.slice(0, n) : sorted.slice(-n).reverse();
    return picked.map((s) => ({
      name: s.key.length > 26 ? `${s.key.slice(0, 26)}…` : s.key,
      full: s.key,
      gain: +s.gainPct.toFixed(2),
      current: s.current,
    }));
  }, [rows, mode, n]);

  if (!data.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-secondary border border-border">
          {(["best", "worst"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-[11px] font-medium px-2 py-1 rounded transition-colors capitalize",
                mode === m ? "bg-surface text-foreground shadow-elegant" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-label="How many to show"
          className="h-7 rounded-md border border-input bg-surface px-1.5 text-[11px]"
        >
          {[5, 10, 15, 20].map((v) => (
            <option key={v} value={v}>
              Top {v}
            </option>
          ))}
        </select>
      </div>
      <div style={{ height: Math.max(220, data.length * 26 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 44, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--foreground)" }}
              axisLine={false}
              tickLine={false}
              width={170}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.35 }}
              contentStyle={tooltipStyle}
              formatter={(v: number, _n, p) => [
                `${v}%  ·  ${money((p.payload as { current: number }).current)}`,
                "Return on cost",
              ]}
              labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""}
            />
            <Bar dataKey="gain" radius={[0, 3, 3, 0]} barSize={14} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.gain >= 0 ? "var(--chart-2)" : "var(--chart-4)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 4. Cost vs value by dimension ────────────────────────────────────────────

export function CostValueCard({
  rows,
  dimension,
  onDimension,
}: {
  rows: PortfolioHolding[];
  dimension: FilterKey;
  onDimension: (d: FilterKey) => void;
}) {
  const { money, divisor, suffix } = useUnits();
  const data = useMemo(
    () =>
      sliceBy(rows, DIMENSION_ACCESSOR[dimension]).map((s) => ({
        name: s.key.length > 16 ? `${s.key.slice(0, 16)}…` : s.key,
        full: s.key,
        invested: +(s.invested / divisor).toFixed(3),
        gain: +(s.gain / divisor).toFixed(3),
        gainPct: s.gainPct,
      })),
    [rows, dimension, divisor],
  );
  if (!data.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div>
      <DimensionTabs value={dimension} onChange={onDimension} />
      <div className="h-[290px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-28}
              textAnchor="end"
              height={62}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₹${v}`}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.35 }}
              contentStyle={tooltipStyle}
              formatter={(v: number, n: string) => [
                `₹${v}${suffix}`,
                n === "invested" ? "Invested" : "Unrealised gain",
              ]}
              labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => (v === "invested" ? "Invested" : "Unrealised gain")}
            />
            <Bar dataKey="invested" stackId="v" fill="var(--chart-1)" isAnimationActive={false} />
            <Bar
              dataKey="gain"
              stackId="v"
              fill="var(--chart-2)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 5. Concentration (Pareto) ────────────────────────────────────────────────

export function ConcentrationCurveCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money } = useUnits();
  const data = useMemo(() => {
    const secs = consolidateSecurities(rows);
    const total = secs.reduce((s, x) => s + x.current, 0) || 1;
    let acc = 0;
    return secs.slice(0, 60).map((s, i) => {
      acc += s.current;
      return {
        rank: i + 1,
        name: s.key,
        cumulative: +((acc / total) * 100).toFixed(2),
        share: +((s.current / total) * 100).toFixed(3),
        value: s.current,
      };
    });
  }, [rows]);
  if (!data.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="rank"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Positions ranked by size",
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 10, fill: "var(--muted-foreground)" },
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={42}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div style={tooltipStyle} className="px-2.5 py-2">
                  <p className="font-semibold">Top {d.rank} positions</p>
                  <p className="tabular">{d.cumulative}% of book</p>
                  <p className="text-muted-foreground max-w-[220px] truncate">
                    #{d.rank}: {d.name} ({d.share}%)
                  </p>
                  <p className="tabular text-muted-foreground">{money(d.value)}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 6. Holding-period distribution ───────────────────────────────────────────

const BUCKETS = [
  { label: "< 3m", max: 90 },
  { label: "3–6m", max: 182 },
  { label: "6–12m", max: 365 },
  { label: "1–2y", max: 730 },
  { label: "2–3y", max: 1095 },
  { label: "3–5y", max: 1825 },
  { label: "5y+", max: Infinity },
];

export function HoldingPeriodCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money, divisor, suffix } = useUnits();
  const data = useMemo(() => {
    const acc = BUCKETS.map((b) => ({ label: b.label, value: 0, count: 0, gain: 0 }));
    for (const r of rows) {
      const d = r.holding_period_days;
      if (d == null) continue;
      const i = BUCKETS.findIndex((b) => d < b.max);
      const idx = i === -1 ? BUCKETS.length - 1 : i;
      acc[idx].value += r.current_value ?? 0;
      acc[idx].gain += r.unrealised_gain ?? 0;
      acc[idx].count += 1;
    }
    return acc.map((a) => ({ ...a, scaled: +(a.value / divisor).toFixed(3) }));
  }, [rows, divisor]);

  return (
    <div className="h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `₹${v}`}
            width={52}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.35 }}
            contentStyle={tooltipStyle}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div style={tooltipStyle} className="px-2.5 py-2">
                  <p className="font-semibold">Held {label}</p>
                  <p className="tabular">
                    {money(d.value)} · {d.count} lots
                  </p>
                  <p className={cn("tabular", d.gain >= 0 ? "text-success" : "text-destructive")}>
                    gain {money(d.gain)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="scaled" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={64}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 7. Treemap ───────────────────────────────────────────────────────────────

export function TreemapCard({
  rows,
  dimension,
  onDimension,
  onSelect,
}: {
  rows: PortfolioHolding[];
  dimension: FilterKey;
  onDimension: (d: FilterKey) => void;
  onSelect: (key: FilterKey, value: string) => void;
}) {
  const { money } = useUnits();
  const slices = useMemo(() => sliceBy(rows, DIMENSION_ACCESSOR[dimension]), [rows, dimension]);
  const data = slices.map((s, i) => ({
    name: s.key,
    size: s.current,
    pct: s.pctOfBook,
    gainPct: s.gainPct,
    fill: PALETTE[i % PALETTE.length],
  }));
  if (!data.length) return <EmptyState message="Nothing matches the current filters." />;

  return (
    <div>
      <DimensionTabs value={dimension} onChange={onDimension} />
      <div className="h-[300px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="var(--surface)"
            isAnimationActive={false}
            // recharts types `content` as a bare element, so the click handler is
            // threaded through a closure rather than a typed prop.
            content={
              (
                <TreemapCell onSelect={(v: string) => onSelect(dimension, v)} />
              ) as unknown as React.ReactElement
            }
          >
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [money(v), "Value"]} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TreemapCell(props: { onSelect?: (v: string) => void } & Record<string, unknown>) {
  const p = props as unknown as {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    fill?: string;
    pct?: number;
    gainPct?: number;
    onSelect?: (v: string) => void;
  };
  const { x, y, width, height, name, fill, pct: share, onSelect } = p;
  if (width == null || height == null) return null;
  const label = width > 62 && height > 32;
  return (
    <g onClick={() => name && onSelect?.(name)} style={{ cursor: name ? "pointer" : "default" }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: fill ?? "var(--chart-1)", stroke: "var(--surface)", strokeWidth: 2 }}
      />
      {label && (
        <>
          <text x={x + 7} y={y + 18} fill="white" fontSize={11} fontWeight={600}>
            {String(name).length > Math.floor(width / 7)
              ? `${String(name).slice(0, Math.floor(width / 7))}…`
              : name}
          </text>
          <text x={x + 7} y={y + 33} fill="white" fontSize={10} opacity={0.85}>
            {share != null ? `${share.toFixed(1)}%` : ""}
          </text>
        </>
      )}
    </g>
  );
}

// ─── 8. Tax & lock-in posture ─────────────────────────────────────────────────

export function TaxPostureCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money } = useUnits();
  const stats = useMemo(() => {
    const lots = taxLots(rows);
    const st = lots.filter((l) => l.term === "Short Term");
    const lt = lots.filter((l) => l.term === "Long Term");
    let lockedValue = 0,
      lockedCost = 0,
      lockedCount = 0;
    for (const r of rows) {
      const t = parseExitLoad(r.exit_load);
      const d = r.holding_period_days;
      if (t && d != null && d < t.days) {
        lockedCount++;
        lockedValue += r.current_value ?? 0;
        lockedCost += (r.current_value ?? 0) * (t.ratePct / 100);
      }
    }
    const sum = (a: typeof st) => a.reduce((s, l) => s + (l.row.current_value ?? 0), 0);
    return {
      stValue: sum(st),
      ltValue: sum(lt),
      stCount: st.length,
      ltCount: lt.length,
      stGain: st.reduce((s, l) => s + l.gain, 0),
      ltGain: lt.reduce((s, l) => s + l.gain, 0),
      lockedValue,
      lockedCost,
      lockedCount,
    };
  }, [rows]);

  const total = stats.stValue + stats.ltValue || 1;
  const stPct = (stats.stValue / total) * 100;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
          <div className="bg-warning transition-all" style={{ width: `${stPct}%` }} />
          <div className="bg-success transition-all" style={{ width: `${100 - stPct}%` }} />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-3 text-[11.5px]">
          <div>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-warning" />
              <span className="font-medium">Short term</span>
            </span>
            <p className="mt-1 tabular text-[15px] font-semibold">{money(stats.stValue)}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {stPct.toFixed(1)}% · {stats.stCount} lots · gain {money(stats.stGain)}
            </p>
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-success" />
              <span className="font-medium">Long term</span>
            </span>
            <p className="mt-1 tabular text-[15px] font-semibold">{money(stats.ltValue)}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {(100 - stPct).toFixed(1)}% · {stats.ltCount} lots · gain {money(stats.ltGain)}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border grid grid-cols-2 gap-3 text-[11.5px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Locked by exit load
          </p>
          <p className="mt-1 tabular text-[15px] font-semibold text-warning">
            {money(stats.lockedValue)}
          </p>
          <p className="text-[10.5px] text-muted-foreground">{stats.lockedCount} positions</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cost to exit today
          </p>
          <p className="mt-1 tabular text-[15px] font-semibold text-destructive">
            {money(stats.lockedCost)}
          </p>
          <p className="text-[10.5px] text-muted-foreground">if liquidated now</p>
        </div>
      </div>
    </div>
  );
}

// ─── 9. Gain distribution histogram ───────────────────────────────────────────

const GAIN_BINS = [
  { label: "< −50%", min: -Infinity, max: -50 },
  { label: "−50..−25", min: -50, max: -25 },
  { label: "−25..0", min: -25, max: 0 },
  { label: "0..25", min: 0, max: 25 },
  { label: "25..50", min: 25, max: 50 },
  { label: "50..100", min: 50, max: 100 },
  { label: "100..200", min: 100, max: 200 },
  { label: "200%+", min: 200, max: Infinity },
];

export function GainHistogramCard({ rows }: { rows: PortfolioHolding[] }) {
  const { money, divisor } = useUnits();
  const data = useMemo(() => {
    const acc = GAIN_BINS.map((b) => ({ label: b.label, count: 0, value: 0 }));
    for (const r of rows) {
      const g = r.gain_percent;
      if (g == null) continue;
      const i = GAIN_BINS.findIndex((b) => g >= b.min && g < b.max);
      if (i === -1) continue;
      acc[i].count += 1;
      acc[i].value += r.current_value ?? 0;
    }
    return acc;
  }, [rows]);

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 26 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-22}
            textAnchor="end"
            height={46}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.35 }}
            contentStyle={tooltipStyle}
            formatter={(v: number, _n, p) => [
              `${v} lots · ${money((p.payload as { value: number }).value)}`,
              "In this band",
            ]}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={54}>
            {data.map((d, i) => (
              <Cell key={i} fill={GAIN_BINS[i].max <= 0 ? "var(--chart-4)" : "var(--chart-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── shared ───────────────────────────────────────────────────────────────────

const DIM_LABELS: Array<{ key: FilterKey; label: string }> = [
  { key: "assetClass", label: "Asset class" },
  { key: "entity", label: "Entity" },
  { key: "broker", label: "Custodian" },
  { key: "category", label: "Category" },
  { key: "term", label: "Term" },
];

export function DimensionTabs({
  value,
  onChange,
}: {
  value: FilterKey;
  onChange: (d: FilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-0.5 rounded-md bg-secondary border border-border w-fit">
      {DIM_LABELS.map((d) => (
        <button
          key={d.key}
          onClick={() => onChange(d.key)}
          className={cn(
            "text-[11px] font-medium px-2 py-1 rounded transition-colors",
            value === d.key
              ? "bg-surface text-foreground shadow-elegant"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
