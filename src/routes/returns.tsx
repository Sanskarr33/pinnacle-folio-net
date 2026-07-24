import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Info, RotateCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Brush,
} from "recharts";
import { useBook, useTotals } from "@/hooks/use-book";
import { useUnits, formatMoney } from "@/lib/units";
import { pctSigned } from "@/lib/format";
import { normaliseEntity } from "@/lib/portfolio-analytics";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { xirrForRows, xirrByGroup, deploymentByMonth, entityKey, vintageKey } from "@/lib/xirr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Returns (XIRR) — SG Family Wealth" },
      {
        name: "description",
        content: "Money-weighted portfolio return from the book's own dated cashflows.",
      },
    ],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const { data, isLoading, error } = useBook();
  const { totals } = useTotals();
  const { unit, digits } = useUnits();
  const asOf = totals.asOnDate ?? new Date().toISOString().slice(0, 10);

  const cellUnit = unit === "auto" ? "crore" : unit;
  const money = (n: number | null | undefined) => formatMoney(n, cellUnit, digits);

  const rows = useMemo(() => data ?? [], [data]);

  // ── Interactive filters: toggle entities and focus a vintage year ──────────
  const allEntities = useMemo(
    () => [...new Set(rows.map(entityKey).filter(Boolean))].sort(),
    [rows],
  );
  const [offEntities, setOffEntities] = useState<Set<string>>(new Set());
  const [vintage, setVintage] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => !offEntities.has(entityKey(r)) && (vintage === null || vintageKey(r) === vintage),
      ),
    [rows, offEntities, vintage],
  );

  // Everything below recomputes the moment a chip or a year bar is clicked.
  const result = useMemo(() => xirrForRows(filtered, asOf), [filtered, asOf]);
  const byEntity = useMemo(
    () =>
      xirrByGroup(
        rows.filter((r) => vintage === null || vintageKey(r) === vintage),
        asOf,
        entityKey,
      )
        .filter((g) => g.rate != null)
        .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)),
    [rows, asOf, vintage],
  );
  const byVintage = useMemo(
    () =>
      xirrByGroup(
        rows.filter((r) => !offEntities.has(entityKey(r))),
        asOf,
        vintageKey,
      )
        .filter((g) => g.rate != null && g.key !== "—")
        .sort((a, b) => a.key.localeCompare(b.key)),
    [rows, asOf, offEntities],
  );
  const deployment = useMemo(() => deploymentByMonth(filtered, asOf), [filtered, asOf]);

  const timelineData = useMemo(() => {
    let cum = 0;
    return deployment.map((d) => {
      cum += d.invested;
      return {
        month: d.date,
        label: monthLabel(d.date),
        invested: d.invested / divisorFor(cellUnit),
        cumulative: cum / divisorFor(cellUnit),
        lots: d.lots,
      };
    });
  }, [deployment, cellUnit]);

  const entityChartData = useMemo(
    () => byEntity.map((g) => ({ name: g.key, xirr: (g.rate ?? 0) * 100, value: g.current })),
    [byEntity],
  );
  const vintageChartData = useMemo(
    () => byVintage.map((g) => ({ name: g.key, xirr: (g.rate ?? 0) * 100, value: g.current })),
    [byVintage],
  );

  async function exportExcel() {
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      await exportXlsx({
        fileName: "portfolio-xirr",
        unit,
        subtitle: `Money-weighted returns as on ${asOf} · ${result.coveredLots} lots covered · SG Family Office`,
        sheets: [
          {
            name: "By entity",
            freezeCols: 1,
            columns: [
              { header: "Entity", key: "k", type: "text", width: 20 },
              { header: "XIRR %", key: "x", type: "pct" },
              { header: "Invested", key: "inv", type: "money" },
              { header: "Current", key: "cur", type: "money" },
              { header: "Total return %", key: "tr", type: "pct" },
              { header: "Lots", key: "n", type: "number", width: 10 },
            ],
            rows: xirrByGroup(rows, asOf, entityKey).map((g) => ({
              k: g.key,
              x: (g.rate ?? 0) * 100,
              inv: g.invested,
              cur: g.current,
              tr: g.totalReturnPct,
              n: g.lots,
            })),
          },
          {
            name: "By vintage year",
            freezeCols: 1,
            columns: [
              { header: "Purchase year", key: "k", type: "text", width: 16 },
              { header: "XIRR %", key: "x", type: "pct" },
              { header: "Invested", key: "inv", type: "money" },
              { header: "Current", key: "cur", type: "money" },
              { header: "Lots", key: "n", type: "number", width: 10 },
            ],
            rows: xirrByGroup(rows, asOf, vintageKey)
              .filter((g) => g.key !== "—")
              .sort((a, b) => a.key.localeCompare(b.key))
              .map((g) => ({
                k: g.key,
                x: (g.rate ?? 0) * 100,
                inv: g.invested,
                cur: g.current,
                n: g.lots,
              })),
          },
        ],
      });
    } catch (err) {
      console.error(err);
    }
  }

  if (error) return <ErrorState error={error as Error} />;

  const filtersActive = offEntities.size > 0 || vintage !== null;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Money-Weighted Returns"
        description="The real portfolio XIRR from every lot's own dated cashflow — recomputed live as you filter."
        right={
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {/* ── Live headline ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-transparent px-5 sm:px-6 py-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                  Portfolio XIRR {filtersActive && "· filtered"}
                </p>
                <p className="text-[42px] sm:text-[52px] leading-none font-semibold tabular mt-2 text-foreground">
                  {result.rate != null ? `${(result.rate * 100).toFixed(2)}%` : "—"}
                </p>
                <p className="text-[12px] text-muted-foreground mt-2">
                  money-weighted, annualised · {result.coveredLots} lots ·{" "}
                  {money(result.investedCovered)} → {money(result.terminalCovered)}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <HeadStat
                  label="Total return"
                  value={pctSigned(result.totalReturnPct, 1)}
                  tone="up"
                />
                <HeadStat label="Capital deployed" value={money(result.investedCovered)} />
                <HeadStat label="Worth today" value={money(result.terminalCovered)} />
              </div>
            </div>
            <p className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
              The header shows a value-weighted average of per-lot XIRRs (
              {totals.weightedXirr != null ? `${totals.weightedXirr.toFixed(1)}%` : "—"}); this is
              the true money-weighted return solved from the actual cashflows — a different, more
              exact figure.
            </p>
          </div>

          {/* ── Interactive entity chips ─────────────────────────────────────── */}
          <Card
            title="Include / exclude entities"
            subtitle="Toggle any entity — every figure and chart on this page recomputes instantly."
            right={
              filtersActive ? (
                <button
                  onClick={() => {
                    setOffEntities(new Set());
                    setVintage(null);
                  }}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] hover:bg-secondary transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              ) : undefined
            }
          >
            <div className="flex flex-wrap gap-2">
              {allEntities.map((e) => {
                const on = !offEntities.has(e);
                return (
                  <button
                    key={e}
                    onClick={() =>
                      setOffEntities((prev) => {
                        const next = new Set(prev);
                        if (next.has(e)) next.delete(e);
                        else next.add(e);
                        return next;
                      })
                    }
                    className={cn(
                      "h-8 px-3 rounded-full border text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground/60 hover:bg-secondary line-through",
                    )}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            {vintage && (
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Focused on <span className="font-semibold text-foreground">{vintage}</span>{" "}
                purchases · click the year again to clear.
              </p>
            )}
          </Card>

          {/* ── Deployment timeline (scrubable) ──────────────────────────────── */}
          <Card
            title="Capital deployed over time"
            subtitle="When money went in. Drag the handles under the chart to zoom a period; hover any bar for detail."
          >
            {timelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No dated purchases in this selection.
              </p>
            ) : (
              <div className="h-[300px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--secondary)", opacity: 0.45 }}
                      contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [
                        `${v.toFixed(2)}${unitSuffixShort(cellUnit)}`,
                        name === "invested" ? "Deployed this month" : "Cumulative",
                      ]}
                      labelFormatter={(l) => l}
                    />
                    <Bar
                      dataKey="invested"
                      fill="var(--series-2)"
                      isAnimationActive={false}
                      radius={[3, 3, 0, 0]}
                    />
                    <Brush
                      dataKey="label"
                      height={22}
                      travellerWidth={8}
                      stroke="var(--series-1)"
                      fill="var(--secondary)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ── XIRR by entity & by vintage ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card
              title="XIRR by entity"
              subtitle="Money-weighted return of each entity's own book."
            >
              <RateChart data={entityChartData} money={money} />
            </Card>
            <Card
              title="XIRR by purchase year"
              subtitle="How money deployed in each year has done. Click a bar to focus that vintage."
            >
              <RateChart
                data={vintageChartData}
                money={money}
                activeKey={vintage}
                onSelect={(k) => setVintage((v) => (v === k ? null : k))}
              />
            </Card>
          </div>

          {/* ── Coverage ─────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-secondary/40 px-5 py-3.5 text-[11.5px] text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>
              Based on {result.coveredLots} lots carrying both a purchase date and an invested
              amount — {money(result.coveredValue)} of {money(result.bookValue)} in this selection (
              {result.bookValue > 0
                ? ((result.coveredValue / result.bookValue) * 100).toFixed(0)
                : 0}
              %). The remaining {money(result.uncoveredValue)} across {result.uncoveredLots} lots
              has no usable cashflow recorded and sits outside the calculation. Each lot is treated
              as a single purchase on its recorded date; the workbook carries no SIP instalment
              dates to split them further.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────────────────────────

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

function divisorFor(u: string) {
  return u === "lakh" ? 100_000 : u === "million" ? 1_000_000 : u === "raw" ? 1 : 10_000_000;
}
function unitSuffixShort(u: string) {
  return u === "lakh" ? " L" : u === "million" ? " Mn" : u === "raw" ? "" : " Cr";
}
function monthLabel(iso: string) {
  const [y, m] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
}

function HeadStat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={cn(
          "text-[18px] font-semibold tabular mt-1",
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RateChart({
  data,
  money,
  activeKey,
  onSelect,
}: {
  data: Array<{ name: string; xirr: number; value: number }>;
  money: (n: number | null | undefined) => string;
  activeKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nothing to show.</p>;
  }
  return (
    <div className="h-[300px] -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            angle={data.length > 6 ? -20 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 48 : 24}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit="%"
          />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.45 }}
            contentStyle={tooltipStyle}
            formatter={(v: number, _n: string, p: { payload?: { value?: number } }) => [
              `${v.toFixed(1)}% · ${money(p?.payload?.value)}`,
              "XIRR",
            ]}
          />
          <Bar
            dataKey="xirr"
            isAnimationActive={false}
            radius={[3, 3, 0, 0]}
            onClick={(d: { name?: string }) => onSelect && d?.name && onSelect(d.name)}
            cursor={onSelect ? "pointer" : undefined}
          >
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={
                  activeKey && d.name !== activeKey
                    ? "var(--muted-foreground)"
                    : d.xirr >= 0
                      ? "var(--series-1)"
                      : "var(--destructive)"
                }
                fillOpacity={activeKey && d.name !== activeKey ? 0.35 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
