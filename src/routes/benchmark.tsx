import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Info, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useBook } from "@/hooks/use-book";
import { useUnits, formatMoney } from "@/lib/units";
import { pctSigned, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import {
  computeBenchmark,
  groupBenchmark,
  isEquityLike,
  type BenchmarkLot,
  type IndexHistory,
} from "@/lib/benchmark";
import historyJson from "@/data/index-history.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/benchmark")({
  head: () => ({
    meta: [
      { title: "Benchmark — SG Family Wealth" },
      {
        name: "description",
        content: "The book against the same money invested in the index on the same dates.",
      },
    ],
  }),
  component: BenchmarkPage,
});

const HISTORY = historyJson as unknown as IndexHistory;

function BenchmarkPage() {
  const { data, isLoading, error } = useBook();
  const { unit, digits } = useUnits();
  const [symbol, setSymbol] = useState("^NSEI");
  const [equityOnly, setEquityOnly] = useState(true);
  const [exporting, setExporting] = useState(false);

  const cellUnit = unit === "auto" ? "crore" : unit;
  const money = (n: number | null | undefined) => formatMoney(n, cellUnit, digits);

  const rows = useMemo(() => data ?? [], [data]);

  const scoped = useMemo(
    () => (equityOnly ? rows.filter((r) => isEquityLike(r.asset_class ?? "")) : rows),
    [rows, equityOnly],
  );

  const result = useMemo(() => computeBenchmark(scoped, HISTORY, symbol), [scoped, symbol]);

  const byAsset = useMemo(
    () => (result ? groupBenchmark(result.lots, (l) => l.assetClass) : []),
    [result],
  );
  const byEntity = useMemo(
    () => (result ? groupBenchmark(result.lots, (l) => l.entity) : []),
    [result],
  );

  const leaders = useMemo(() => {
    if (!result) return { best: [] as BenchmarkLot[], worst: [] as BenchmarkLot[] };
    const sig = result.lots.filter((l) => l.actual >= 2_000_000);
    const ranked = [...sig].sort((a, b) => b.alpha - a.alpha);
    return { best: ranked.slice(0, 6), worst: ranked.slice(-6).reverse() };
  }, [result]);

  const chartData = useMemo(
    () =>
      byAsset.slice(0, 9).map((g) => ({
        name: g.key.replace(/ Mutual Funds?/i, " MF"),
        Portfolio: g.actualReturnPct,
        Index: g.indexReturnPct,
      })),
    [byAsset],
  );

  async function exportExcel() {
    if (!result) return;
    setExporting(true);
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      await exportXlsx({
        fileName: `benchmark-${result.symbol.replace(/\W/g, "")}`,
        unit,
        subtitle: `Against ${result.indexName} as of ${result.asOf} · same cash, same dates · ${result.lots.length} lots · SG Family Office`,
        sheets: [
          {
            name: "By asset class",
            freezeCols: 1,
            columns: [
              { header: "Asset class", key: "k", type: "text", width: 30 },
              { header: "Invested", key: "inv", type: "money" },
              { header: "Actual value", key: "act", type: "money" },
              { header: "If bought index", key: "ben", type: "money" },
              { header: "Alpha", key: "alpha", type: "money" },
              { header: "Portfolio %", key: "ap", type: "pct" },
              { header: "Index %", key: "ip", type: "pct" },
              { header: "Lots", key: "n", type: "number", width: 10 },
            ],
            rows: byAsset.map((g) => ({
              k: g.key,
              inv: g.invested,
              act: g.actual,
              ben: g.benchmark,
              alpha: g.alpha,
              ap: g.actualReturnPct,
              ip: g.indexReturnPct,
              n: g.lots,
            })),
            totals: {
              k: "Total",
              inv: result.invested,
              act: result.actual,
              ben: result.benchmark,
              alpha: result.alpha,
              ap: result.actualReturnPct,
              ip: result.indexReturnPct,
              n: result.lots.length,
            },
          },
          {
            name: "Every lot",
            freezeCols: 1,
            columns: [
              { header: "Security", key: "s", type: "text", width: 46 },
              { header: "Entity", key: "e", type: "text", width: 16 },
              { header: "Asset class", key: "ac", type: "text", width: 26 },
              { header: "Purchased", key: "d", type: "date", width: 14 },
              { header: "Invested", key: "inv", type: "money" },
              { header: "Actual value", key: "act", type: "money" },
              { header: "If bought index", key: "ben", type: "money" },
              { header: "Alpha", key: "alpha", type: "money" },
              { header: "Portfolio %", key: "ap", type: "pct" },
              { header: "Index %", key: "ip", type: "pct" },
            ],
            rows: result.lots.map((l) => ({
              s: l.security,
              e: l.entity,
              ac: l.assetClass,
              d: new Date(l.purchaseDate),
              inv: l.invested,
              act: l.actual,
              ben: l.benchmark,
              alpha: l.alpha,
              ap: l.actualReturnPct,
              ip: l.indexReturnPct,
            })),
          },
        ],
      });
    } catch (err) {
      console.error("Benchmark export failed", err);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <ErrorState error={error as Error} />;

  const ahead = (result?.alpha ?? 0) >= 0;
  const excludedValue = result
    ? result.excluded.noDateOrAmount.value +
      result.excluded.beforeHistory.value +
      result.excluded.implausibleDate.value
    : 0;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Index Benchmark"
        description="Every lot's own cash, run through the index from its own purchase date."
        right={
          <button
            onClick={exportExcel}
            disabled={exporting || !result}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? "Building…" : "Excel"}
          </button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Benchmark
            </span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium outline-none focus:border-primary/60"
            >
              {Object.entries(HISTORY.names ?? {}).map(([s, n]) => (
                <option key={s} value={s}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input
              type="checkbox"
              checked={equityOnly}
              onChange={(e) => setEquityOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
            />
            <span className="text-muted-foreground">
              Equity-like holdings only{" "}
              <span className="text-foreground/70">(a fair yardstick)</span>
            </span>
          </label>
          {result && (
            <span className="ml-auto text-[11.5px] text-muted-foreground tabular">
              {result.indexName}{" "}
              {result.latestLevel.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · close{" "}
              {formatDate(result.asOf)}
            </span>
          )}
        </div>
      </Card>

      {isLoading || !result ? (
        <Skeleton className="h-64" />
      ) : result.lots.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground py-6 text-center">
            No lots in this selection carry both a purchase date and an invested amount.
          </p>
        </Card>
      ) : (
        <>
          {/* ── Headline ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Tile
              label="Invested"
              value={money(result.invested)}
              foot={`${result.lots.length} lots compared`}
            />
            <Tile
              label="What it is worth"
              value={money(result.actual)}
              foot={pctSigned(result.actualReturnPct, 1)}
              tone="up"
            />
            <Tile
              label={`Same cash into ${result.indexName}`}
              value={money(result.benchmark)}
              foot={pctSigned(result.indexReturnPct, 1)}
            />
            <Tile
              label={ahead ? "Ahead of the index by" : "Behind the index by"}
              value={money(Math.abs(result.alpha))}
              foot={`${pctSigned(result.actualReturnPct - result.indexReturnPct, 1)} points`}
              tone={ahead ? "up" : "down"}
              emphasis
            />
          </div>

          {/* ── Coverage, stated up front ────────────────────────────────────── */}
          {excludedValue > 0 && (
            <div className="rounded-xl border border-border bg-secondary/40 px-5 py-3.5 text-[11.5px] text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>
                Covers {money(result.coveredValue)} of {money(result.totalValue)} in this selection.{" "}
                {result.excluded.noDateOrAmount.count > 0 && (
                  <>
                    {result.excluded.noDateOrAmount.count} lots (
                    {money(result.excluded.noDateOrAmount.value)}) have no purchase date or invested
                    amount recorded
                    {result.excluded.beforeHistory.count > 0 ||
                    result.excluded.implausibleDate.count > 0
                      ? "; "
                      : " and are excluded."}
                  </>
                )}
                {result.excluded.beforeHistory.count > 0 && (
                  <>
                    {result.excluded.beforeHistory.count} pre-date the index history (from{" "}
                    {result.excluded.beforeHistory.earliest})
                    {result.excluded.implausibleDate.count > 0 ? "; " : "."}
                  </>
                )}
                {result.excluded.implausibleDate.count > 0 && (
                  <>
                    {result.excluded.implausibleDate.count} carry an implausible purchase date
                    (before 1990) and look like a data error worth fixing.
                  </>
                )}
              </span>
            </div>
          )}

          {/* ── By asset class ───────────────────────────────────────────────── */}
          <Card
            title="Return by asset class"
            subtitle="The portfolio's own return against what the index returned over the very same holding periods."
          >
            <div className="h-[320px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={62}
                  />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)", opacity: 0.45 }}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11.5, paddingTop: 4 }}
                    iconType="square"
                    iconSize={9}
                  />
                  <Bar
                    dataKey="Portfolio"
                    fill="var(--series-2)"
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                  <Bar
                    dataKey="Index"
                    fill="var(--series-1)"
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto -mx-5 px-5 mt-4">
              <table className="w-full text-[12px] border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <Th>Asset class</Th>
                    <Th right>Invested</Th>
                    <Th right>Actual</Th>
                    <Th right>If index</Th>
                    <Th right>Alpha</Th>
                    <Th right>Lots</Th>
                  </tr>
                </thead>
                <tbody>
                  {byAsset.map((g) => (
                    <tr key={g.key} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-1.5 border-b border-border/40 font-medium">{g.key}</td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                        {money(g.invested)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                        {money(g.actual)}{" "}
                        <span className="text-muted-foreground">
                          ({pctSigned(g.actualReturnPct, 0)})
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular text-muted-foreground">
                        {money(g.benchmark)} ({pctSigned(g.indexReturnPct, 0)})
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 border-b border-border/40 text-right tabular font-semibold",
                          g.alpha >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {money(g.alpha)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular text-muted-foreground">
                        {g.lots}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/60 font-semibold">
                    <td className="px-3 py-2 border-t-2 border-border">Total</td>
                    <td className="px-3 py-2 border-t-2 border-border text-right tabular">
                      {money(result.invested)}
                    </td>
                    <td className="px-3 py-2 border-t-2 border-border text-right tabular">
                      {money(result.actual)}
                    </td>
                    <td className="px-3 py-2 border-t-2 border-border text-right tabular">
                      {money(result.benchmark)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 border-t-2 border-border text-right tabular",
                        ahead ? "text-success" : "text-destructive",
                      )}
                    >
                      {money(result.alpha)}
                    </td>
                    <td className="px-3 py-2 border-t-2 border-border text-right tabular">
                      {result.lots.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* ── Leaders ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaderCard
              title="Beating the index by most"
              icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
              lots={leaders.best}
              money={money}
            />
            <LeaderCard
              title="Lagging the index by most"
              icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              lots={leaders.worst}
              money={money}
            />
          </div>

          {/* ── By entity ────────────────────────────────────────────────────── */}
          <Card
            title="By entity"
            subtitle="Which pockets of the family are adding value over the index."
          >
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-[12px] border-collapse min-w-[640px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <Th>Entity</Th>
                    <Th right>Actual</Th>
                    <Th right>If index</Th>
                    <Th right>Alpha</Th>
                    <Th right>Portfolio</Th>
                    <Th right>Index</Th>
                  </tr>
                </thead>
                <tbody>
                  {byEntity.map((g) => (
                    <tr key={g.key} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-1.5 border-b border-border/40 font-medium">{g.key}</td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                        {money(g.actual)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular text-muted-foreground">
                        {money(g.benchmark)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 border-b border-border/40 text-right tabular font-semibold",
                          g.alpha >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {money(g.alpha)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                        {pctSigned(g.actualReturnPct, 1)}
                      </td>
                      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular text-muted-foreground">
                        {pctSigned(g.indexReturnPct, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <p className="text-[11.5px] text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-px shrink-0" />
        <span>
          Each lot's invested amount is converted to index units at the close on or before its
          purchase date, then valued at the latest close — a money-weighted, date-matched
          comparison, not a rebased chart. {result?.indexName ?? "NIFTY 50"} is a{" "}
          <strong className="text-foreground/80">price index</strong>: it excludes dividends, worth
          roughly 1–1.5% a year, so the benchmark here is slightly understated and the comparison is
          mildly flattering to the portfolio. There are only two dated snapshots of this book, so a
          portfolio-versus-index time series is not available — this measures outcome, not path.
        </span>
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  foot,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: "up" | "down";
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface shadow-elegant px-5 py-4",
        emphasis ? "border-primary/40" : "border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={cn(
          "text-[22px] font-semibold tabular mt-1.5",
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {foot && <p className="text-[11px] text-muted-foreground mt-1">{foot}</p>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "font-semibold px-3 py-2 border-b border-border whitespace-nowrap",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function LeaderCard({
  title,
  icon,
  lots,
  money,
}: {
  title: string;
  icon: React.ReactNode;
  lots: BenchmarkLot[];
  money: (n: number | null | undefined) => string;
}) {
  return (
    <Card title={title} subtitle="Positions over ₹20 L, by rupee difference against the index.">
      {lots.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nothing to show.</p>
      ) : (
        <ul className="space-y-2.5">
          {lots.map((l, i) => (
            <li key={`${l.security}-${i}`} className="flex items-start gap-3">
              <span className="mt-0.5">{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium truncate">{l.security}</p>
                <p className="text-[11px] text-muted-foreground">
                  {l.entity} · bought {formatDate(l.purchaseDate)} ·{" "}
                  {pctSigned(l.actualReturnPct, 0)} vs {pctSigned(l.indexReturnPct, 0)} index
                </p>
              </div>
              <span
                className={cn(
                  "text-[12.5px] font-semibold tabular shrink-0",
                  l.alpha >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {money(l.alpha)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
