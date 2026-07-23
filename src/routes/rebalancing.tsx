import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Scale,
  Target,
  RotateCcw,
  ChevronRight,
  Quote,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { useBook } from "@/hooks/use-book";
import { useUnits } from "@/lib/units";
import { pct, humanDays } from "@/lib/format";
import { displayName, normaliseEntity, parseExitLoad } from "@/lib/portfolio-analytics";
import { cn } from "@/lib/utils";
import {
  computeDrift,
  effectiveBands,
  setBand,
  resetBand,
  resetAllBands,
  breachCount,
  subscribePolicy,
  getPolicyOverrides,
  getServerPolicyOverrides,
  type BandDrift,
} from "@/lib/policy";

export const Route = createFileRoute("/rebalancing")({
  head: () => ({
    meta: [
      { title: "Rebalancing — SG Family Wealth" },
      {
        name: "description",
        content:
          "Allocation against the policy bands your advisors set, and the trades to close the gap.",
      },
    ],
  }),
  component: RebalancingPage,
});

function RebalancingPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const overrides = useSyncExternalStore(
    subscribePolicy,
    getPolicyOverrides,
    getServerPolicyOverrides,
  );
  const { money } = useUnits();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const bands = useMemo(() => effectiveBands(overrides), [overrides]);
  const { drifts, total, unclassified } = useMemo(() => computeDrift(book, bands), [book, bands]);
  const breaches = breachCount(drifts);
  const edited = bands.filter((b) => b.edited).length;
  const maxDrift = drifts.length ? Math.max(...drifts.map((d) => d.driftPct)) : 0;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-5">
      <PageHeader
        eyebrow="Analysis · Policy"
        title="Rebalancing"
        description="Your book measured against the allocation bands your advisors set in the minutes — with the trades that would close each gap."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              {editing ? "Done" : "Edit bands"}
            </button>
            {edited > 0 && (
              <button
                onClick={() => resetAllBands()}
                title="Restore every band to the advisor-stated value"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset {edited}
              </button>
            )}
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[500px] rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              label="Bands breached"
              value={String(breaches)}
              sub={breaches === 0 ? "all within policy" : `of ${drifts.length} bands`}
              icon={breaches > 0 ? AlertTriangle : CheckCircle2}
              tone={breaches > 0 ? "bad" : "good"}
            />
            <Kpi
              label="Largest drift"
              value={drifts.length ? pct(maxDrift, 1) : "—"}
              sub={
                drifts.length
                  ? drifts.reduce((a, b) => (b.driftPct > a.driftPct ? b : a)).band.label
                  : ""
              }
              icon={Scale}
              tone={maxDrift > 3 ? "warn" : null}
            />
            <Kpi
              label="To rebalance"
              value={money(
                drifts
                  .filter((d) => d.status !== "within")
                  .reduce((s, d) => s + Math.abs(d.tradeToBand), 0),
              )}
              sub="total value to move"
              icon={ArrowUpRight}
            />
            <Kpi
              label="Unclassified"
              value={money(unclassified)}
              sub={total > 0 ? `${pct((unclassified / total) * 100, 1)} matches no band` : ""}
              icon={Info}
              tone={unclassified / (total || 1) > 0.15 ? "warn" : null}
            />
          </div>

          {breaches > 0 && (
            <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-[12px] min-w-0">
                <p className="font-semibold text-foreground">
                  {breaches} allocation band{breaches !== 1 ? "s" : ""} outside policy
                </p>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  {drifts
                    .filter((d) => d.status !== "within")
                    .map(
                      (d) =>
                        `${d.band.label} is ${pct(d.actualPct, 1)} against a ${d.band.min}–${d.band.max}% band`,
                    )
                    .join("; ")}
                  .
                </p>
              </div>
            </div>
          )}

          <Card
            title="Allocation vs policy"
            subtitle="Each band cites the meeting it came from · click a row for holdings and a suggested trade"
          >
            <div className="space-y-1 -mx-5">
              {drifts.map((d) => (
                <BandRow
                  key={d.band.key}
                  drift={d}
                  open={expanded === d.band.key}
                  onToggle={() => setExpanded(expanded === d.band.key ? null : d.band.key)}
                  editing={editing}
                  money={money}
                />
              ))}
            </div>
            {unclassified > 0 && (
              <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                {money(unclassified)} ({pct((unclassified / (total || 1)) * 100, 1)}) matches no
                band — PMS, ULIPs, PPF/NPS and the USD account have no target set. Bands may also
                overlap, so these percentages do not sum to 100.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── One band ─────────────────────────────────────────────────────────────────

function BandRow({
  drift,
  open,
  onToggle,
  editing,
  money,
}: {
  drift: BandDrift;
  open: boolean;
  onToggle: () => void;
  editing: boolean;
  money: (n: number | null | undefined) => string;
}) {
  const { band, actualPct, status, driftPct, value, holdings } = drift;

  // Scale to whichever is larger — the band ceiling or where we actually are — so a
  // breach is always visible rather than clipped at the right edge.
  const scaleMax = Math.max(band.max * 1.35, actualPct * 1.15, 5);
  const posOf = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;

  return (
    <div
      className={cn(
        "border-l-2 px-5 py-3 transition-colors",
        status === "within" ? "border-l-transparent" : "border-l-destructive bg-destructive/[0.03]",
      )}
    >
      <button onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <div className="flex items-center gap-2 flex-wrap">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="text-[13px] font-semibold">{band.label}</span>
          {band.edited && (
            <span className="text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--chart-3)]/15 text-[var(--chart-3)] font-semibold">
              edited
            </span>
          )}
          {status !== "within" && (
            <span className="text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-destructive/15 text-destructive font-semibold">
              {status === "over" ? "over band" : "under band"} · {pct(driftPct, 1)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3 tabular text-[12px] shrink-0">
            <span className="text-muted-foreground">{money(value)}</span>
            <span
              className={cn(
                "font-semibold w-14 text-right",
                status !== "within" && "text-destructive",
              )}
            >
              {pct(actualPct, 1)}
            </span>
            <span className="text-muted-foreground w-20 text-right text-[11px]">
              band {band.min}–{band.max}%
            </span>
          </span>
        </div>

        <div className="relative h-2.5 mt-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="absolute h-full bg-success/25"
            style={{
              left: posOf(band.min),
              width: `calc(${posOf(band.max)} - ${posOf(band.min)})`,
            }}
            title={`Policy band ${band.min}–${band.max}%`}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-success"
            style={{ left: posOf(band.target) }}
            title={`Target ${band.target}%`}
          />
          <div
            className={cn(
              "absolute top-0 h-full w-1.5 rounded-sm",
              status === "within" ? "bg-[var(--chart-1)]" : "bg-destructive",
            )}
            style={{ left: posOf(actualPct) }}
            title={`Actual ${actualPct.toFixed(2)}%`}
          />
        </div>
      </button>

      {editing && (
        <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px]">
          {(["min", "target", "max"] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
              <input
                type="number"
                value={band[k]}
                onChange={(e) => setBand(band.key, { [k]: Number(e.target.value) })}
                className="h-7 w-16 rounded border border-input bg-surface px-1.5 tabular text-[11.5px]"
              />
              <span className="text-muted-foreground">%</span>
            </label>
          ))}
          {band.edited && (
            <button
              onClick={() => resetBand(band.key)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              revert
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 pl-5 space-y-3">
          <div className="rounded-lg border border-border bg-secondary/25 p-3">
            <p className="flex items-start gap-2 text-[11.5px] text-muted-foreground leading-relaxed">
              <Quote className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                “{band.quote}”
                <span className="block mt-1 text-[10.5px] font-medium text-foreground">
                  — {band.source}
                </span>
              </span>
            </p>
            {band.note && (
              <p className="mt-2 pt-2 border-t border-border text-[10.5px] text-muted-foreground">
                {band.note}
              </p>
            )}
          </div>

          <TradePlan drift={drift} money={money} />

          {holdings.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-1.5">
                {holdings.length} holdings in this band
              </p>
              <ul className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1">
                {[...holdings]
                  .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
                  .slice(0, 25)
                  .map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between gap-2 text-[11.5px] py-0.5"
                    >
                      <span className="truncate">{displayName(h)}</span>
                      <span className="flex items-center gap-2.5 shrink-0 tabular text-muted-foreground">
                        <span>{normaliseEntity(h.entity_name)}</span>
                        <span className="w-20 text-right">{money(h.current_value)}</span>
                      </span>
                    </li>
                  ))}
              </ul>
              {holdings.length > 25 && (
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  … and {holdings.length - 25} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trade plan ───────────────────────────────────────────────────────────────

/**
 * What it would take to close the gap — and what that costs.
 *
 * A rebalancing figure is only useful if it accounts for friction: selling a lot
 * still inside its exit-load window has a real cost, and selling a short-term lot
 * forfeits the lower long-term rate. Both are surfaced against the specific lots the
 * sell would most likely come from.
 */
function TradePlan({
  drift,
  money,
}: {
  drift: BandDrift;
  money: (n: number | null | undefined) => string;
}) {
  const { status, tradeToBand, tradeToTarget, holdings } = drift;

  const sellPlan = useMemo(() => {
    if (tradeToTarget >= 0) return [];
    let remaining = Math.abs(tradeToTarget);
    const sorted = [...holdings].sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0));
    const picked: Array<{
      row: (typeof holdings)[number];
      take: number;
      exitCost: number;
      lockedDays: number | null;
      shortTerm: boolean;
    }> = [];
    for (const row of sorted) {
      if (remaining <= 0) break;
      const val = row.current_value ?? 0;
      if (val <= 0) continue;
      const take = Math.min(val, remaining);
      const term = parseExitLoad(row.exit_load);
      const held = row.holding_period_days;
      const locked = Boolean(term && held != null && held < term.days);
      picked.push({
        row,
        take,
        exitCost: locked && term ? take * (term.ratePct / 100) : 0,
        lockedDays: locked && term && held != null ? term.days - held : null,
        shortTerm: row.holding_term === "Short Term",
      });
      remaining -= take;
    }
    return picked;
  }, [holdings, tradeToTarget]);

  const totalExitCost = sellPlan.reduce((s, p) => s + p.exitCost, 0);
  const shortTermValue = sellPlan.filter((p) => p.shortTerm).reduce((s, p) => s + p.take, 0);

  if (status === "within" && Math.abs(tradeToTarget) < 1) {
    return (
      <p className="text-[11.5px] text-success inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Within band and at target — no trade needed.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11.5px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            To reach band edge
          </p>
          <p
            className={cn(
              "mt-0.5 text-[14px] font-semibold tabular inline-flex items-center gap-1",
              tradeToBand >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {tradeToBand >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {tradeToBand >= 0 ? "Buy " : "Sell "}
            {money(Math.abs(tradeToBand))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            To reach target
          </p>
          <p
            className={cn(
              "mt-0.5 text-[14px] font-semibold tabular",
              tradeToTarget >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {tradeToTarget >= 0 ? "Buy " : "Sell "}
            {money(Math.abs(tradeToTarget))}
          </p>
        </div>
        {sellPlan.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Friction to execute
            </p>
            <p
              className={cn(
                "mt-0.5 text-[14px] font-semibold tabular",
                totalExitCost > 0 ? "text-warning" : "text-muted-foreground",
              )}
            >
              {totalExitCost > 0 ? money(totalExitCost) : "none"}
            </p>
          </div>
        )}
      </div>

      {sellPlan.length > 0 && (
        <>
          <p className="mt-3 pt-2.5 border-t border-border text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-1.5">
            Largest-first sell plan ({sellPlan.length} lots)
          </p>
          <ul className="space-y-1">
            {sellPlan.slice(0, 8).map((p) => (
              <li key={p.row.id} className="flex items-center gap-2 text-[11.5px]">
                <span className="truncate flex-1">{displayName(p.row)}</span>
                <span className="text-muted-foreground shrink-0">
                  {normaliseEntity(p.row.entity_name)}
                </span>
                {p.shortTerm && (
                  <span
                    title="Short term — selling now forfeits the lower long-term rate"
                    className="text-[9.5px] rounded px-1 py-px bg-warning/15 text-warning font-semibold shrink-0"
                  >
                    ST
                  </span>
                )}
                {p.lockedDays != null && (
                  <span
                    title={`Inside its exit-load window for ${p.lockedDays} more days`}
                    className="inline-flex items-center gap-0.5 text-[9.5px] rounded px-1 py-px bg-destructive/15 text-destructive font-semibold shrink-0"
                  >
                    <Lock className="h-2.5 w-2.5" />
                    {humanDays(p.lockedDays)}
                  </span>
                )}
                <span className="tabular w-20 text-right shrink-0">{money(p.take)}</span>
                {p.exitCost > 0 && (
                  <span className="tabular w-16 text-right text-destructive shrink-0">
                    −{money(p.exitCost)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {(totalExitCost > 0 || shortTermValue > 0) && (
            <p className="mt-2 pt-2 border-t border-border text-[10.5px] text-muted-foreground leading-relaxed">
              {totalExitCost > 0 && (
                <>
                  Executing this plan as listed costs{" "}
                  <span className="text-warning font-medium">{money(totalExitCost)}</span> in exit
                  load.{" "}
                </>
              )}
              {shortTermValue > 0 && (
                <>
                  <span className="text-warning font-medium">{money(shortTermValue)}</span> of it is
                  short term — check Capital Gains before selling.
                </>
              )}
            </p>
          )}
        </>
      )}

      {tradeToTarget > 0 && (
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          This band is under-allocated — deploying here needs new capital or proceeds from an
          over-allocated band.
        </p>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "good" | "warn" | "bad" | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-elegant">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[20px] font-semibold tabular tracking-tight truncate",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground truncate">{sub}</p>
    </div>
  );
}
