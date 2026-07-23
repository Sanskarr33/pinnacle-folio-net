import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useExitLoads } from "@/hooks/use-book";
import { displayName, normaliseEntity } from "@/lib/portfolio-analytics";
import { inr, formatDate, humanDays, pct } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, EmptyState, Skeleton } from "@/components/common/States";
import { Lock, LockOpen, Coins, CalendarClock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exit-load")({
  head: () => ({
    meta: [
      { title: "Exit Load Tracker — SG Family Wealth" },
      {
        name: "description",
        content:
          "Which positions are still inside an exit-load window, what it costs, and when it clears.",
      },
    ],
  }),
  component: ExitLoadPage,
});

/**
 * The source stores exit load as shorthand like "1/365" — 1% if redeemed within
 * 365 days. Combined with `holding_period_days` and `purchase_date`, that turns
 * into a real answer: what would it cost to liquidate this position today, and on
 * what date does that cost disappear.
 */
function ExitLoadPage() {
  const { summary, isLoading, error, refetch } = useExitLoads();
  const [query, setQuery] = useState("");
  const [horizon, setHorizon] = useState<"all" | "90" | "180">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.locked.filter((p) => {
      if (horizon !== "all" && p.daysRemaining > Number(horizon)) return false;
      if (!q) return true;
      return (
        displayName(p.row).toLowerCase().includes(q) ||
        normaliseEntity(p.row.entity_name).toLowerCase().includes(q)
      );
    });
  }, [summary.locked, query, horizon]);

  const filteredCost = filtered.reduce((s, p) => s + p.costIfSoldToday, 0);
  const filteredValue = filtered.reduce((s, p) => s + (p.row.current_value ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Liquidity"
        title="Exit Load Tracker"
        description="Positions still inside a redemption penalty window, what liquidating them would cost today, and the date each penalty lapses."
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={Lock}
              label="Locked positions"
              value={String(summary.locked.length)}
              sub={`of ${summary.locked.length + summary.free} with a load term`}
              tone="warn"
            />
            <Kpi
              icon={Coins}
              label="Cost if sold today"
              value={inr(summary.totalCost)}
              sub="total exit load payable"
              tone="bad"
            />
            <Kpi
              icon={CalendarClock}
              label="Value locked"
              value={inr(summary.lockedValue)}
              sub={
                summary.locked.length > 0
                  ? `first clears in ${humanDays(summary.locked[0].daysRemaining)}`
                  : "—"
              }
              tone={null}
            />
            <Kpi
              icon={LockOpen}
              label="Free to redeem"
              value={String(summary.free)}
              sub="past their exit-load window"
              tone="good"
            />
          </div>

          <Card
            title="Locked positions"
            subtitle={`${filtered.length} shown · ${inr(filteredValue)} locked · ${inr(filteredCost)} exit cost`}
            right={
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="pl-8 h-8 w-[150px] text-[12px]"
                    aria-label="Search locked positions"
                  />
                </div>
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-secondary border border-border">
                  {(["90", "180", "all"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setHorizon(w)}
                      className={cn(
                        "text-[11px] font-medium px-2 py-1 rounded transition-colors tabular",
                        horizon === w
                          ? "bg-surface text-foreground shadow-elegant"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {w === "all" ? "All" : `≤${w}d`}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                message={
                  summary.locked.length === 0
                    ? "No positions are inside an exit-load window."
                    : "No locked positions match this filter."
                }
                hint={
                  summary.locked.length === 0
                    ? "Every holding with a recorded exit-load term has passed its window."
                    : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[12.5px] min-w-[880px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                      <th className="text-left font-semibold px-5 py-2.5">Security</th>
                      <th className="text-left font-semibold py-2.5">Entity</th>
                      <th className="text-right font-semibold py-2.5">Value</th>
                      <th className="text-right font-semibold py-2.5">Load</th>
                      <th className="text-right font-semibold py-2.5">Cost today</th>
                      <th className="text-right font-semibold py-2.5">Held</th>
                      <th className="text-left font-semibold py-2.5 w-[150px]">Time remaining</th>
                      <th className="text-right font-semibold px-5 py-2.5">Free on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const progress = (p.daysHeld / p.term.days) * 100;
                      const urgent = p.daysRemaining <= 90;
                      return (
                        <tr
                          key={p.row.id}
                          className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-5 py-2.5 font-medium max-w-[260px]">
                            <span className="block truncate" title={displayName(p.row)}>
                              {displayName(p.row)}
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {normaliseEntity(p.row.entity_name)}
                          </td>
                          <td className="py-2.5 text-right tabular font-semibold">
                            {inr(p.row.current_value)}
                          </td>
                          <td className="py-2.5 text-right tabular text-muted-foreground">
                            {pct(p.term.ratePct, 2)}
                          </td>
                          <td className="py-2.5 text-right tabular font-semibold text-destructive">
                            {inr(p.costIfSoldToday)}
                          </td>
                          <td className="py-2.5 text-right tabular text-muted-foreground whitespace-nowrap">
                            {humanDays(p.daysHeld)} / {humanDays(p.term.days)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden min-w-[52px]">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, progress)}%`,
                                    background: urgent ? "var(--warning)" : "var(--chart-1)",
                                  }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "tabular text-[11px] shrink-0 w-11 text-right",
                                  urgent ? "text-warning font-medium" : "text-muted-foreground",
                                )}
                              >
                                {humanDays(p.daysRemaining)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular text-muted-foreground whitespace-nowrap">
                            {formatDate(p.freeOn)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                      <td
                        className="px-5 py-2.5 text-[11.5px] text-muted-foreground font-normal"
                        colSpan={2}
                      >
                        {filtered.length} positions
                      </td>
                      <td className="py-2.5 text-right tabular">{inr(filteredValue)}</td>
                      <td />
                      <td className="py-2.5 text-right tabular text-destructive">
                        {inr(filteredCost)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          <Card title="Coverage" subtitle="How much of the book this analysis can actually see">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Coverage
                label="With a load term"
                value={summary.locked.length + summary.free}
                tone="good"
              />
              <Coverage label="Recorded as nil" value={summary.noTerm} tone={null} />
              <Coverage
                label="Unreadable term"
                value={summary.unparseable}
                tone={summary.unparseable > 0 ? "warn" : null}
              />
              <Coverage
                label="Currently locked"
                value={summary.locked.length}
                tone={summary.locked.length > 0 ? "warn" : "good"}
              />
            </div>
            <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
              Exit load is read from the source shorthand —{" "}
              <code className="bg-secondary px-1 rounded">1/365</code> means 1% if redeemed within
              365 days of purchase. The lapse date is purchase date plus the window; the cost is
              current value × the load rate.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 text-[22px] font-semibold tabular tracking-tight",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function Coverage({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | null;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-[20px] font-semibold tabular",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}
