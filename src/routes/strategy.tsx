import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Trash2,
  Save,
  BookMarked,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useBook, useTotals } from "@/hooks/use-book";
import { useUnits, formatMoney } from "@/lib/units";
import { pct, pctSigned, formatDate } from "@/lib/format";
import { xirrForRows } from "@/lib/xirr";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import {
  subscribeStrategies,
  getStrategiesSnapshot,
  getServerStrategiesSnapshot,
  getStrategy,
  saveStrategy,
  deleteStrategy,
  savedScopes,
  hasStrategy,
  emptyStrategy,
  OUTLOOKS,
  CONVICTIONS,
  SECTOR_SUGGESTIONS,
  type Strategy,
  type Outlook,
  type Conviction,
} from "@/lib/strategy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "Strategy — SG Family Wealth" },
      { name: "description", content: "Your written strategy per asset class, sector and theme." },
    ],
  }),
  component: StrategyPage,
});

interface ClassStat {
  scope: string;
  value: number;
  invested: number;
  gain: number;
  gainPct: number;
  pctOfBook: number;
  count: number;
  xirr: number | null;
}

function StrategyPage() {
  const { data, isLoading, error } = useBook();
  const { totals } = useTotals();
  const { unit, digits } = useUnits();
  const money = (n: number | null | undefined) =>
    formatMoney(n, unit === "auto" ? "crore" : unit, digits);

  const rows = useMemo(() => data ?? [], [data]);
  const asOf = totals.asOnDate ?? new Date().toISOString().slice(0, 10);

  // Live stats per asset class, so the strategy sits next to what it is about.
  const classStats = useMemo<Record<string, ClassStat>>(() => {
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.asset_class?.trim() || "Unclassified";
      const list = groups.get(k);
      if (list) list.push(r);
      else groups.set(k, [r]);
    }
    const total = rows.reduce((s, r) => s + (r.current_value ?? 0), 0) || 1;
    const out: Record<string, ClassStat> = {};
    for (const [k, list] of groups) {
      const value = list.reduce((s, r) => s + (r.current_value ?? 0), 0);
      const invested = list.reduce((s, r) => s + (r.invested_value ?? 0), 0);
      const xr = xirrForRows(list, asOf);
      out[k] = {
        scope: k,
        value,
        invested,
        gain: value - invested,
        gainPct: invested > 0 ? ((value - invested) / invested) * 100 : 0,
        pctOfBook: (value / total) * 100,
        count: list.length,
        xirr: xr.rate,
      };
    }
    return out;
  }, [rows, asOf]);

  const assetClasses = useMemo(
    () =>
      Object.values(classStats)
        .sort((a, b) => b.value - a.value)
        .map((c) => c.scope),
    [classStats],
  );

  const store = useSyncExternalStore(
    subscribeStrategies,
    getStrategiesSnapshot,
    getServerStrategiesSnapshot,
  );
  const saved = useMemo(() => savedScopes(store), [store]);

  const [scope, setScope] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");

  // Default to the largest asset class once the book loads.
  useEffect(() => {
    if (!scope && assetClasses.length) setScope(assetClasses[0]);
  }, [assetClasses, scope]);

  const stat = classStats[scope];

  if (error) return <ErrorState error={error as Error} />;

  // Options: book asset classes, then sector/theme suggestions + any saved custom scopes.
  const savedScopeNames = saved.map((s) => s.scope);
  const themeOptions = [...new Set([...SECTOR_SUGGESTIONS, ...savedScopeNames])].filter(
    (s) => !assetClasses.includes(s),
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Strategy"
        description="Your written view for each asset class, sector or theme — sitting next to what it's actually worth."
      />

      {/* ── Scope picker ────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Strategy for
            </span>
            <select
              value={customMode ? "__custom" : scope}
              onChange={(e) => {
                if (e.target.value === "__custom") {
                  setCustomMode(true);
                } else {
                  setCustomMode(false);
                  setScope(e.target.value);
                }
              }}
              className="h-9 min-w-[240px] rounded-lg border border-border bg-background px-2.5 text-[13px] font-medium outline-none focus:border-primary/60"
            >
              <optgroup label="Asset classes">
                {assetClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {store[c] ? "  ✓" : ""}
                  </option>
                ))}
              </optgroup>
              {themeOptions.length > 0 && (
                <optgroup label="Sectors & themes">
                  {themeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                      {store[c] ? "  ✓" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="__custom">+ Custom sector / theme…</option>
            </select>
          </div>

          {customMode && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  New theme name
                </span>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customName.trim()) {
                      setScope(customName.trim());
                      setCustomMode(false);
                      setCustomName("");
                    }
                  }}
                  autoFocus
                  placeholder="e.g. Private credit"
                  className="h-9 w-52 rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/60"
                />
              </div>
              <button
                onClick={() => {
                  if (!customName.trim()) return;
                  setScope(customName.trim());
                  setCustomMode(false);
                  setCustomName("");
                }}
                disabled={!customName.trim()}
                className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40"
              >
                Use
              </button>
            </div>
          )}

          {saved.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <BookMarked className="h-3.5 w-3.5" />
              {saved.length} saved
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Live context ──────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            <Card title="Where it stands" subtitle={`As on ${formatDate(asOf)}`}>
              {stat ? (
                <div className="space-y-3">
                  <Stat label="Current value" value={money(stat.value)} big />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="% of book" value={pct(stat.pctOfBook, 1)} />
                    <Stat label="Holdings" value={String(stat.count)} />
                    <Stat
                      label="Gain"
                      value={pctSigned(stat.gainPct, 1)}
                      tone={stat.gainPct >= 0 ? "up" : "down"}
                    />
                    <Stat
                      label="XIRR"
                      value={stat.xirr != null ? pct(stat.xirr * 100, 1) : "—"}
                      tone={(stat.xirr ?? 0) >= 0 ? "up" : "down"}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[12.5px] text-muted-foreground py-2">
                  <span className="font-medium text-foreground">{scope}</span> is a sector / theme
                  with no direct line in the book. Your strategy is captured here; the numbers above
                  apply to full asset classes.
                </p>
              )}
            </Card>

            {saved.length > 0 && (
              <Card title="Saved strategies">
                <ul className="space-y-1.5">
                  {saved.map((s) => (
                    <li key={s.scope}>
                      <button
                        onClick={() => {
                          setScope(s.scope);
                          setCustomMode(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors",
                          s.scope === scope ? "bg-secondary" : "hover:bg-secondary/60",
                        )}
                      >
                        <OutlookDot outlook={s.outlook} />
                        <span className="font-medium truncate flex-1">{s.scope}</span>
                        {s.targetPct != null && (
                          <span className="text-[11px] text-muted-foreground tabular">
                            {s.targetPct}%
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* ── Editor ────────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <StrategyEditor
              key={scope}
              scope={scope}
              stored={getStrategy(scope, store)}
              liveClassPct={stat?.pctOfBook ?? null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── editor ─────────────────────────────────────────────────────────────────

function StrategyEditor({
  scope,
  stored,
  liveClassPct,
}: {
  scope: string;
  stored: Strategy;
  liveClassPct: number | null;
}) {
  const [s, setS] = useState<Strategy>(stored.scope === scope ? stored : emptyStrategy(scope));
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof Strategy>(k: K, v: Strategy[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const drift = s.targetPct != null && liveClassPct != null ? liveClassPct - s.targetPct : null;

  function commit() {
    saveStrategy(s);
    setDirty(false);
    toast.success(
      hasStrategy(s) ? `Strategy for “${scope}” saved.` : `Strategy for “${scope}” cleared.`,
    );
  }

  return (
    <Card
      title={scope || "Strategy"}
      subtitle={stored.updatedAt ? `Last updated ${formatDate(stored.updatedAt)}` : "New strategy"}
      right={
        <div className="flex items-center gap-2">
          {hasStrategy(stored) && (
            <button
              onClick={() => {
                deleteStrategy(scope);
                setS(emptyStrategy(scope));
                setDirty(false);
                toast.message("Strategy deleted.");
              }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-[11.5px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
          <button
            onClick={commit}
            disabled={!dirty}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40 transition-opacity"
          >
            {dirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      }
    >
      {/* Outlook + conviction + target + horizon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Outlook">
          <div className="flex gap-1.5">
            {OUTLOOKS.map((o) => (
              <button
                key={o.value}
                onClick={() => set("outlook", s.outlook === o.value ? "" : (o.value as Outlook))}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-lg border text-[12px] font-medium transition-colors",
                  s.outlook === o.value
                    ? o.value === "bullish"
                      ? "border-success/50 bg-success/10 text-success"
                      : o.value === "bearish"
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-border bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {o.value === "bullish" ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : o.value === "bearish" ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Conviction">
          <div className="flex gap-1.5">
            {CONVICTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() =>
                  set("conviction", s.conviction === c.value ? "" : (c.value as Conviction))
                }
                className={cn(
                  "flex-1 h-9 rounded-lg border text-[12px] font-medium transition-colors",
                  s.conviction === c.value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Target allocation (% of book)"
          hint={
            drift != null
              ? `Now ${liveClassPct!.toFixed(1)}% · ${drift >= 0 ? "over" : "under"} by ${Math.abs(drift).toFixed(1)} pts`
              : undefined
          }
        >
          <div className="relative">
            <input
              type="number"
              value={s.targetPct ?? ""}
              onChange={(e) =>
                set("targetPct", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 25"
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 pr-7 text-[13px] outline-none focus:border-primary/60"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">
              %
            </span>
          </div>
          {drift != null && (
            <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  Math.abs(drift) <= 2 ? "bg-success" : "bg-warning",
                )}
                style={{
                  width: `${Math.min(100, (liveClassPct! / Math.max(s.targetPct || 1, liveClassPct!)) * 100)}%`,
                }}
              />
            </div>
          )}
        </Field>

        <Field label="Time horizon">
          <input
            value={s.horizon}
            onChange={(e) => set("horizon", e.target.value)}
            placeholder="e.g. 12–18 months"
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/60"
          />
        </Field>
      </div>

      {/* Thesis */}
      <Field label="Thesis / view" className="mt-4">
        <textarea
          value={s.thesis}
          onChange={(e) => set("thesis", e.target.value)}
          rows={7}
          placeholder={`Why this positioning for ${scope}? What would change your mind?`}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-primary/60 resize-y"
        />
      </Field>

      {/* Action points */}
      <Field label="Action points" className="mt-4">
        <div className="space-y-2">
          {s.actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <input
                value={a}
                onChange={(e) => {
                  const next = [...s.actions];
                  next[i] = e.target.value;
                  set("actions", next);
                }}
                placeholder="e.g. Trim large caps by ₹2 Cr on strength"
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-primary/60"
              />
              <button
                onClick={() =>
                  set(
                    "actions",
                    s.actions.filter((_, j) => j !== i),
                  )
                }
                className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => set("actions", [...s.actions, ""])}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-border text-[12px] text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add action
          </button>
        </div>
      </Field>
    </Card>
  );
}

// ─── bits ─────────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  big?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tabular mt-0.5",
          big ? "text-[22px]" : "text-[15px]",
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </label>
        {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function OutlookDot({ outlook }: { outlook: Outlook }) {
  const color =
    outlook === "bullish"
      ? "var(--success)"
      : outlook === "bearish"
        ? "var(--destructive)"
        : "var(--muted-foreground)";
  return <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}
