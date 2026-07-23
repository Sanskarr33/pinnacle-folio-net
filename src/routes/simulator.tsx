import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  TrendingUp,
  History,
  FlaskConical,
  Search,
  X,
  ArrowRight,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton, EmptyState } from "@/components/common/States";
import { useBook, useHistory } from "@/hooks/use-book";
import { useUnits } from "@/lib/units";
import { pct, pctSigned, formatDate, humanDays } from "@/lib/format";
import {
  displayName,
  normaliseEntity,
  parseExitLoad,
  concentration,
  taxSummary,
  sumBy,
} from "@/lib/portfolio-analytics";
import {
  computeDrift,
  effectiveBands,
  subscribePolicy,
  getPolicyOverrides,
  getServerPolicyOverrides,
} from "@/lib/policy";
import type { PortfolioHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Simulator — SG Family Wealth" },
      {
        name: "description",
        content: "Model trades before placing them, and track the book across dated snapshots.",
      },
    ],
  }),
  component: SimulatorPage,
});

type Tab = "simulate" | "history";

/** A hypothetical trade. Sells reference a specific lot; buys are notional. */
interface Trade {
  id: string;
  kind: "sell" | "buy";
  lotId: string | null;
  label: string;
  amount: number;
  assetClass: string;
}

function SimulatorPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const [tab, setTab] = useState<Tab>("simulate");

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-5">
      <PageHeader
        eyebrow="Analysis · Planning"
        title="Simulator & History"
        description="Model a trade before you place it, and see how the book has moved across dated snapshots."
      />

      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary border border-border w-fit">
        {(
          [
            ["simulate", "What-if simulator"],
            ["history", "Wealth over time"],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors",
              tab === k
                ? "bg-surface text-foreground shadow-elegant"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : tab === "simulate" ? (
        <Simulator book={book} />
      ) : (
        <HistoryView />
      )}
    </div>
  );
}

// ─── What-if simulator ────────────────────────────────────────────────────────

function Simulator({ book }: { book: PortfolioHolding[] }) {
  const { money } = useUnits();
  const overrides = useSyncExternalStore(
    subscribePolicy,
    getPolicyOverrides,
    getServerPolicyOverrides,
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [query, setQuery] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyClass, setBuyClass] = useState("Equity Mutual Funds");

  const assetClasses = useMemo(
    () => Array.from(new Set(book.map((r) => r.asset_class ?? "Unclassified"))).sort(),
    [book],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return book
      .filter(
        (r) =>
          displayName(r).toLowerCase().includes(q) ||
          normaliseEntity(r.entity_name).toLowerCase().includes(q),
      )
      .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
      .slice(0, 8);
  }, [book, query]);

  /**
   * Apply the trades to a copy of the book.
   *
   * Sells reduce the matching lot's value (and its cost proportionally, so the gain
   * on what remains stays correct). Buys are added as synthetic rows at cost, since a
   * position bought today has no gain yet.
   */
  const after = useMemo(() => {
    const byId = new Map(book.map((r) => [r.id, { ...r }]));
    const extra: PortfolioHolding[] = [];

    for (const t of trades) {
      if (t.kind === "sell" && t.lotId) {
        const row = byId.get(t.lotId);
        if (!row) continue;
        const val = row.current_value ?? 0;
        const take = Math.min(val, t.amount);
        const fraction = val > 0 ? take / val : 0;
        row.current_value = val - take;
        row.invested_value = (row.invested_value ?? 0) * (1 - fraction);
        row.unrealised_gain = (row.current_value ?? 0) - (row.invested_value ?? 0);
      } else if (t.kind === "buy") {
        extra.push({
          ...book[0],
          id: `sim-${t.id}`,
          security_name: t.label,
          scheme_name: t.label,
          asset_class: t.assetClass,
          category: "Simulated",
          product_type: "Mutual Fund",
          entity_name: "Simulated",
          broker_name: null,
          folio_number: null,
          current_value: t.amount,
          invested_value: t.amount,
          unrealised_gain: 0,
          gain_percent: 0,
          xirr: null,
          exit_load: null,
          holding_period_days: 0,
          holding_term: "Short Term",
          purchase_date: new Date().toISOString().slice(0, 10),
        } as PortfolioHolding);
      }
    }
    return [...byId.values(), ...extra].filter((r) => (r.current_value ?? 0) > 0.01);
  }, [book, trades]);

  const bands = useMemo(() => effectiveBands(overrides), [overrides]);
  const before = useMemo(
    () => ({
      total: sumBy(book, (r) => r.current_value ?? 0),
      conc: concentration(book),
      tax: taxSummary(book),
      drift: computeDrift(book, bands),
    }),
    [book, bands],
  );
  const sim = useMemo(
    () => ({
      total: sumBy(after, (r) => r.current_value ?? 0),
      conc: concentration(after),
      tax: taxSummary(after),
      drift: computeDrift(after, bands),
    }),
    [after, bands],
  );

  // Cost of executing: exit load on any lot still inside its window.
  const friction = useMemo(() => {
    let exitCost = 0;
    let shortTermProceeds = 0;
    let realisedGain = 0;
    for (const t of trades) {
      if (t.kind !== "sell" || !t.lotId) continue;
      const row = book.find((r) => r.id === t.lotId);
      if (!row) continue;
      const val = row.current_value ?? 0;
      const take = Math.min(val, t.amount);
      const term = parseExitLoad(row.exit_load);
      const held = row.holding_period_days;
      if (term && held != null && held < term.days) exitCost += take * (term.ratePct / 100);
      const fraction = val > 0 ? take / val : 0;
      realisedGain += (row.unrealised_gain ?? 0) * fraction;
      if (row.holding_term === "Short Term") shortTermProceeds += take;
    }
    return { exitCost, shortTermProceeds, realisedGain };
  }, [trades, book]);

  const addSell = (row: PortfolioHolding, amount: number) => {
    setTrades((t) => [
      ...t,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "sell",
        lotId: row.id,
        label: displayName(row),
        amount,
        assetClass: row.asset_class ?? "Unclassified",
      },
    ]);
    setQuery("");
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5">
          <Card title="Build a trade" subtitle="Search a holding to sell, or add a notional buy">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a holding to sell…"
                aria-label="Search holdings"
                className="w-full h-9 pl-8 pr-8 rounded-md border border-input bg-surface text-[12.5px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {matches.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-[240px] overflow-y-auto">
                {matches.map((r) => {
                  const term = parseExitLoad(r.exit_load);
                  const locked =
                    term && r.holding_period_days != null && r.holding_period_days < term.days;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => addSell(r, r.current_value ?? 0)}
                        className="w-full text-left rounded-md border border-border px-2.5 py-2 hover:bg-secondary/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium truncate flex-1">
                            {displayName(r)}
                          </span>
                          {locked && <Lock className="h-3 w-3 text-destructive shrink-0" />}
                          <span className="text-[11.5px] tabular text-muted-foreground shrink-0">
                            {money(r.current_value)}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5">
                          {normaliseEntity(r.entity_name)} · {r.holding_term ?? "—"}
                          {locked && term && (
                            <span className="text-destructive"> · {term.ratePct}% exit load</span>
                          )}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">
                Add a notional buy
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="Amount in ₹"
                  className="h-8 flex-1 min-w-[120px] rounded-md border border-input bg-surface px-2 text-[12px]"
                />
                <select
                  value={buyClass}
                  onChange={(e) => setBuyClass(e.target.value)}
                  className="h-8 rounded-md border border-input bg-surface px-2 text-[12px]"
                >
                  {assetClasses.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!Number(buyAmount)}
                  onClick={() => {
                    setTrades((t) => [
                      ...t,
                      {
                        id: `${Date.now()}`,
                        kind: "buy",
                        lotId: null,
                        label: `New ${buyClass}`,
                        amount: Number(buyAmount),
                        assetClass: buyClass,
                      },
                    ]);
                    setBuyAmount("");
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border text-[12px] font-medium hover:bg-secondary disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            {trades.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                    Planned trades ({trades.length})
                  </p>
                  <button
                    onClick={() => setTrades([])}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {trades.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                    >
                      <span
                        className={cn(
                          "text-[9.5px] uppercase tracking-wider font-bold rounded px-1.5 py-0.5 shrink-0",
                          t.kind === "sell"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success",
                        )}
                      >
                        {t.kind}
                      </span>
                      <span className="text-[11.5px] truncate flex-1">{t.label}</span>
                      <input
                        type="number"
                        value={t.amount}
                        onChange={(e) =>
                          setTrades((all) =>
                            all.map((x) =>
                              x.id === t.id ? { ...x, amount: Number(e.target.value) } : x,
                            ),
                          )
                        }
                        className="h-7 w-28 rounded border border-input bg-surface px-1.5 text-[11px] tabular"
                      />
                      <button
                        onClick={() => setTrades((all) => all.filter((x) => x.id !== t.id))}
                        aria-label="Remove trade"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <Card
            title="Impact"
            subtitle={
              trades.length === 0
                ? "Add a trade to see its effect"
                : `${trades.length} trade${trades.length !== 1 ? "s" : ""} modelled`
            }
          >
            {trades.length === 0 ? (
              <EmptyState
                message="No trades planned."
                hint="Search a holding on the left to model selling it, or add a notional buy."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-4 border-b border-border">
                  <Delta label="Book value" before={before.total} after={sim.total} fmt={money} />
                  <Delta
                    label="Effective holdings"
                    before={before.conc.effectiveHoldings}
                    after={sim.conc.effectiveHoldings}
                    fmt={(n) => n.toFixed(0)}
                    higherIsBetter
                  />
                  <Delta
                    label="Top-10 share"
                    before={before.conc.top10Pct}
                    after={sim.conc.top10Pct}
                    fmt={(n) => pct(n, 1)}
                    lowerIsBetter
                  />
                  <Delta
                    label="Short-term value"
                    before={before.tax.shortTerm.value}
                    after={sim.tax.shortTerm.value}
                    fmt={money}
                    lowerIsBetter
                  />
                  <Delta
                    label="Bands breached"
                    before={before.drift.drifts.filter((d) => d.status !== "within").length}
                    after={sim.drift.drifts.filter((d) => d.status !== "within").length}
                    fmt={(n) => String(n)}
                    lowerIsBetter
                  />
                  <Delta
                    label="HHI"
                    before={before.conc.hhi}
                    after={sim.conc.hhi}
                    fmt={(n) => n.toFixed(0)}
                    lowerIsBetter
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4 border-b border-border">
                  <Cost
                    label="Exit load incurred"
                    value={money(friction.exitCost)}
                    tone={friction.exitCost > 0 ? "bad" : "good"}
                    sub={friction.exitCost > 0 ? "payable on execution" : "no locked lots sold"}
                  />
                  <Cost
                    label="Gain realised"
                    value={money(friction.realisedGain)}
                    tone={friction.realisedGain > 0 ? "warn" : "good"}
                    sub={friction.realisedGain > 0 ? "becomes taxable" : "no gain crystallised"}
                  />
                  <Cost
                    label="From short-term lots"
                    value={money(friction.shortTermProceeds)}
                    tone={friction.shortTermProceeds > 0 ? "warn" : "good"}
                    sub={
                      friction.shortTermProceeds > 0 ? "taxed at the higher rate" : "all long term"
                    }
                  />
                </div>

                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mt-4 mb-2">
                  Policy bands after these trades
                </p>
                <div className="space-y-2">
                  {sim.drift.drifts.map((d, i) => {
                    const wasStatus = before.drift.drifts[i]?.status;
                    const changed = wasStatus !== d.status;
                    return (
                      <div key={d.band.key} className="flex items-center gap-2 text-[11.5px]">
                        <span className="w-36 truncate">{d.band.label}</span>
                        <span className="tabular text-muted-foreground w-14 text-right">
                          {pct(before.drift.drifts[i]?.actualPct ?? 0, 1)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span
                          className={cn(
                            "tabular font-semibold w-14 text-right",
                            d.status !== "within" ? "text-destructive" : "text-success",
                          )}
                        >
                          {pct(d.actualPct, 1)}
                        </span>
                        <span className="text-muted-foreground text-[10.5px] w-20">
                          band {d.band.min}–{d.band.max}%
                        </span>
                        {changed &&
                          (d.status === "within" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              back in band
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              now breached
                            </span>
                          ))}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 pt-3 border-t border-border text-[10.5px] text-muted-foreground leading-relaxed">
                  Nothing here is executed — this only models the arithmetic. Buys are added at cost
                  with no gain, and sells reduce the lot's cost proportionally so the gain on what
                  remains stays correct.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Delta({
  label,
  before,
  after,
  fmt,
  lowerIsBetter,
  higherIsBetter,
}: {
  label: string;
  before: number;
  after: number;
  fmt: (n: number) => string;
  lowerIsBetter?: boolean;
  higherIsBetter?: boolean;
}) {
  const diff = after - before;
  const material = Math.abs(diff) > Math.abs(before) * 0.0001;
  const good = lowerIsBetter ? diff < 0 : higherIsBetter ? diff > 0 : undefined;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-semibold tabular flex items-center gap-1.5 flex-wrap">
        <span className="text-muted-foreground font-normal">{fmt(before)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <span>{fmt(after)}</span>
      </p>
      {material && (
        <p
          className={cn(
            "text-[10.5px] tabular mt-0.5",
            good === true
              ? "text-success"
              : good === false
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {diff > 0 ? "+" : ""}
          {fmt(diff)}
        </p>
      )}
    </div>
  );
}

function Cost({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-semibold tabular",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Wealth over time ─────────────────────────────────────────────────────────

function HistoryView() {
  const { data: history = [], isLoading, error } = useHistory();
  const { money, divisor, suffix } = useUnits();

  const data = useMemo(
    () =>
      history.map((h) => ({
        date: formatDate(h.asOn),
        asOn: h.asOn,
        value: +(h.value / divisor).toFixed(3),
        invested: +(h.invested / divisor).toFixed(3),
        gain: +(h.gain / divisor).toFixed(3),
        gainPct: +h.gainPct.toFixed(2),
        rows: h.rows,
        raw: h,
      })),
    [history, divisor],
  );

  const first = history[0];
  const last = history[history.length - 1];
  const change = first && last ? last.value - first.value : 0;

  if (isLoading) return <Skeleton className="h-[420px] rounded-xl" />;

  if (error || history.length === 0) {
    return (
      <Card title="Wealth over time">
        <EmptyState
          message="No dated snapshots available."
          hint="Trend comes from the dated rows in Supabase, which the daily sync accumulates. If Supabase is unreachable from this network, this chart stays empty — the rest of the dashboard is unaffected."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Snapshots" value={String(history.length)} sub="dated points on file" />
        <Kpi
          label="First"
          value={first ? formatDate(first.asOn) : "—"}
          sub={first ? money(first.value) : ""}
        />
        <Kpi
          label="Latest"
          value={last ? formatDate(last.asOn) : "—"}
          sub={last ? money(last.value) : ""}
        />
        <Kpi
          label="Change"
          value={money(change)}
          sub={
            first && first.value > 0
              ? `${pctSigned((change / first.value) * 100, 2)} over the period`
              : ""
          }
          tone={change >= 0 ? "good" : "bad"}
        />
      </div>

      {history.length < 3 && (
        <p className="text-[11.5px] text-muted-foreground border border-border rounded-lg bg-secondary/25 px-3 py-2">
          Only {history.length} snapshot{history.length !== 1 ? "s" : ""} so far, so this is a line
          between points rather than a trend. Each daily sync adds one — it becomes meaningful over
          a few weeks.
        </p>
      )}

      <Card title="Book value and cost" subtitle={`₹${suffix.trim() || "Cr"} · by valuation date`}>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v}`}
                width={54}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                formatter={(v: number, n: string) => [
                  `₹${v}${suffix}`,
                  n === "value" ? "Market value" : n === "invested" ? "Invested" : "Gain",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(v) =>
                  v === "value" ? "Market value" : v === "invested" ? "Invested" : "Gain"
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="gain"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-6">
          <Card title="Return on cost" subtitle="Unrealised gain as a percentage of invested">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    width={46}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.35 }}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                    formatter={(v: number) => [`${v}%`, "Return on cost"]}
                  />
                  <Bar
                    dataKey="gainPct"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                    maxBarSize={70}
                  >
                    {data.map((d, i) => (
                      <Cell key={i} fill={d.gainPct >= 0 ? "var(--chart-2)" : "var(--chart-4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card title="Snapshot detail" subtitle="What each dated import contained">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[12.5px] min-w-[440px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                    <th className="text-left font-semibold px-5 py-2.5">Valued</th>
                    <th className="text-right font-semibold py-2.5">Rows</th>
                    <th className="text-right font-semibold py-2.5">Invested</th>
                    <th className="text-right font-semibold py-2.5">Value</th>
                    <th className="text-right font-semibold px-5 py-2.5">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h) => (
                    <tr key={h.asOn} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="px-5 py-2.5 tabular">{formatDate(h.asOn)}</td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">{h.rows}</td>
                      <td className="py-2.5 text-right tabular">{money(h.invested)}</td>
                      <td className="py-2.5 text-right tabular font-semibold">{money(h.value)}</td>
                      <td
                        className={cn(
                          "px-5 py-2.5 text-right tabular",
                          h.gainPct >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {pctSigned(h.gainPct, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 pt-2.5 border-t border-border text-[10.5px] text-muted-foreground leading-relaxed">
              Row counts differ between snapshots because the source workbook changes shape, not
              only its values — 10 Jun carried 738 lots, 22 Jul carries 862. Treat value change
              between two dates as combined market movement <em>and</em> coverage change.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-elegant">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground truncate">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[19px] font-semibold tabular tracking-tight truncate",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground truncate">{sub}</p>
    </div>
  );
}

export { TrendingUp, History, FlaskConical };
