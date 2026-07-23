import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTax, useHarvest, useBook } from "@/hooks/use-book";
import { displayName, normaliseEntity } from "@/lib/portfolio-analytics";
import { inr, formatDate, humanDays, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, EmptyState, Skeleton } from "@/components/common/States";
import { DataGrid } from "@/components/grid/DataGrid";
import { COLS_TAX_GRID } from "@/components/grid/columns";
import { RealisedGains } from "@/components/dashboard/RealisedGains";
import { Hourglass, Clock3, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/capital-gains")({
  head: () => ({
    meta: [
      { title: "Capital Gains — SG Family Wealth" },
      {
        name: "description",
        content:
          "Short vs long term split, gains approaching long-term status, and harvestable losses.",
      },
    ],
  }),
  component: CapitalGainsPage,
});

type Tab = "maturing" | "harvest" | "all";

function CapitalGainsPage() {
  const [tab, setTab] = useState<Tab>("maturing");
  const [horizon, setHorizon] = useState(90);
  const { summary, isLoading, error, refetch } = useTax(horizon);
  const { candidates } = useHarvest();

  const totalLoss = candidates.reduce((s, c) => s + c.loss, 0);
  const totalFriction = candidates.reduce((s, c) => s + c.exitLoadCost, 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Tax"
        title="Capital Gains Planning"
        description="Unrealised position by holding term, gains about to reclassify as long term, and losses available to offset them."
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
              icon={Clock3}
              label="Short term"
              value={inr(summary.shortTerm.value)}
              sub={`${summary.shortTerm.count} lots · gain ${inr(summary.shortTerm.gain)}`}
              tone="warn"
            />
            <Kpi
              icon={Hourglass}
              label="Long term"
              value={inr(summary.longTerm.value)}
              sub={`${summary.longTerm.count} lots · gain ${inr(summary.longTerm.gain)}`}
              tone="good"
            />
            <Kpi
              icon={Hourglass}
              label={`Maturing ≤ ${horizon}d`}
              value={inr(summary.maturingSoonGain)}
              sub={`${summary.maturingSoon.length} lots reclassify to long term`}
              tone={summary.maturingSoon.length > 0 ? "warn" : null}
            />
            <Kpi
              icon={TrendingDown}
              label="Harvestable losses"
              value={inr(totalLoss)}
              sub={`${candidates.length} positions at a loss`}
              tone="bad"
            />
          </div>

          <RealisedGains />

          {/* Term split bar */}
          <Card title="Holding term split" subtitle="Share of book value by tax classification">
            <TermSplit
              st={summary.shortTerm.value}
              lt={summary.longTerm.value}
              stCount={summary.shortTerm.count}
              ltCount={summary.longTerm.count}
              unclassified={summary.unclassified}
            />
          </Card>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary border border-border w-fit">
            {(
              [
                ["maturing", `Approaching long term (${summary.maturingSoon.length})`],
                ["harvest", `Loss harvesting (${candidates.length})`],
                ["all", "All lots"],
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

          {tab === "maturing" && (
            <Card
              title="Gains approaching long-term status"
              subtitle="Selling before these dates forfeits the lower long-term rate"
              right={
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-secondary border border-border shrink-0">
                  {[30, 90, 180].map((d) => (
                    <button
                      key={d}
                      onClick={() => setHorizon(d)}
                      className={cn(
                        "text-[11px] font-medium px-2 py-1 rounded transition-colors tabular",
                        horizon === d
                          ? "bg-surface text-foreground shadow-elegant"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              }
            >
              {summary.maturingSoon.length === 0 ? (
                <EmptyState
                  message={`No short-term lots with gains cross the long-term threshold within ${horizon} days.`}
                  hint="Widen the horizon, or check the All lots tab for the full short-term book."
                />
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-[12.5px] min-w-[820px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                        <th className="text-left font-semibold px-5 py-2.5">Security</th>
                        <th className="text-left font-semibold py-2.5">Entity</th>
                        <th className="text-left font-semibold py-2.5">Regime</th>
                        <th className="text-right font-semibold py-2.5">Value</th>
                        <th className="text-right font-semibold py-2.5">Unrealised gain</th>
                        <th className="text-right font-semibold py-2.5">Held</th>
                        <th className="text-right font-semibold py-2.5">Days to LT</th>
                        <th className="text-right font-semibold px-5 py-2.5">Qualifies on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.maturingSoon.map((l) => (
                        <tr
                          key={l.row.id}
                          className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-5 py-2.5 font-medium max-w-[250px]">
                            <span className="block truncate" title={displayName(l.row)}>
                              {displayName(l.row)}
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {normaliseEntity(l.row.entity_name)}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{l.regime}</td>
                          <td className="py-2.5 text-right tabular font-semibold">
                            {inr(l.row.current_value)}
                          </td>
                          <td className="py-2.5 text-right tabular text-success font-semibold">
                            {inr(l.gain)}
                          </td>
                          <td className="py-2.5 text-right tabular text-muted-foreground">
                            {humanDays(l.daysHeld)}
                          </td>
                          <td className="py-2.5 text-right tabular font-semibold text-warning">
                            {l.daysToLongTerm}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular text-muted-foreground whitespace-nowrap">
                            {formatDate(l.maturesOn)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                Thresholds applied: 365 days for equity-taxed holdings, 1,095 days for debt-taxed.
                Only lots currently showing a <em>gain</em> are listed — holding a loser for tax
                status saves nothing.
              </p>
            </Card>
          )}

          {tab === "harvest" && (
            <Card
              title="Loss harvesting candidates"
              subtitle={`${inr(totalLoss)} of unrealised loss · ${inr(totalFriction)} of exit-load friction to realise it`}
            >
              {candidates.length === 0 ? (
                <EmptyState message="No positions are currently at a loss." />
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-[12.5px] min-w-[780px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                        <th className="text-left font-semibold px-5 py-2.5">Security</th>
                        <th className="text-left font-semibold py-2.5">Entity</th>
                        <th className="text-left font-semibold py-2.5">Term</th>
                        <th className="text-right font-semibold py-2.5">Value</th>
                        <th className="text-right font-semibold py-2.5">Loss</th>
                        <th className="text-right font-semibold py-2.5">Loss %</th>
                        <th className="text-right font-semibold px-5 py-2.5">Exit-load friction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.slice(0, 60).map((c) => (
                        <tr
                          key={c.row.id}
                          className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-5 py-2.5 font-medium max-w-[250px]">
                            <span className="block truncate" title={displayName(c.row)}>
                              {displayName(c.row)}
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {normaliseEntity(c.row.entity_name)}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{c.term ?? "—"}</td>
                          <td className="py-2.5 text-right tabular">{inr(c.row.current_value)}</td>
                          <td className="py-2.5 text-right tabular font-semibold text-destructive">
                            {inr(c.loss)}
                          </td>
                          <td className="py-2.5 text-right tabular text-destructive">
                            {pctSigned(-c.lossPct, 1)}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular">
                            {c.exitLoadCost > 0 ? (
                              <span className="text-warning">{inr(c.exitLoadCost)}</span>
                            ) : (
                              <span className="text-muted-foreground/50">none</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                        <td
                          className="px-5 py-2.5 text-[11.5px] text-muted-foreground font-normal"
                          colSpan={4}
                        >
                          {candidates.length > 60
                            ? `Showing 60 largest of ${candidates.length}`
                            : `${candidates.length} positions`}
                        </td>
                        <td className="py-2.5 text-right tabular text-destructive">
                          {inr(totalLoss)}
                        </td>
                        <td />
                        <td className="px-5 py-2.5 text-right tabular text-warning">
                          {inr(totalFriction)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                Friction is the exit load payable if the position were sold today. Realising a loss
                on a position still inside its window costs that amount on top of the loss.
              </p>
            </Card>
          )}

          {tab === "all" && <AllLots />}
        </>
      )}
    </div>
  );
}

/** Every lot that carries a holding period, with the tax-oriented column set. */
function AllLots() {
  const { data = [], isLoading } = useBook();
  const rows = useMemo(() => data.filter((r) => r.holding_period_days != null), [data]);
  return (
    <DataGrid
      rows={rows}
      columns={COLS_TAX_GRID}
      isLoading={isLoading}
      title="Capital gains lots"
      emptyMessage="No lots have a recorded holding period."
      emptyHint="holding_period_days is empty for these rows in the source table."
    />
  );
}

function TermSplit({
  st,
  lt,
  stCount,
  ltCount,
  unclassified,
}: {
  st: number;
  lt: number;
  stCount: number;
  ltCount: number;
  unclassified: number;
}) {
  const total = st + lt || 1;
  const stPct = (st / total) * 100;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        <div className="bg-warning transition-all duration-700" style={{ width: `${stPct}%` }} />
        <div
          className="bg-success transition-all duration-700"
          style={{ width: `${100 - stPct}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12px]">
        <div>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-warning" />
            <span className="font-medium">Short term</span>
          </span>
          <p className="mt-1 tabular text-[15px] font-semibold">{inr(st)}</p>
          <p className="text-[11px] text-muted-foreground">
            {stPct.toFixed(1)}% · {stCount} lots
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" />
            <span className="font-medium">Long term</span>
          </span>
          <p className="mt-1 tabular text-[15px] font-semibold">{inr(lt)}</p>
          <p className="text-[11px] text-muted-foreground">
            {(100 - stPct).toFixed(1)}% · {ltCount} lots
          </p>
        </div>
        {unclassified > 0 && (
          <div>
            <span className="font-medium text-muted-foreground">Unclassified</span>
            <p className="mt-1 tabular text-[15px] font-semibold text-muted-foreground">
              {unclassified}
            </p>
            <p className="text-[11px] text-muted-foreground">no holding period recorded</p>
          </div>
        )}
      </div>
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
          "mt-2.5 text-[21px] font-semibold tabular tracking-tight",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
