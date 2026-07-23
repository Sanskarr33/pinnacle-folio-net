import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useBook, useTotals, useDataHealth } from "@/hooks/use-book";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { Skeleton } from "@/components/common/States";
import { useTheme } from "@/hooks/use-theme";
import { RefreshCw, Sun, Moon, Monitor, Database, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SG Family Wealth" },
      { name: "description", content: "Appearance, data source and alert thresholds." },
    ],
  }),
  component: SettingsPage,
});

/** Thresholds used by deriveAlerts — surfaced here so the rules aren't hidden in code. */
const THRESHOLDS = [
  { rule: "Single-security concentration", medium: "≥ 5% of book", high: "≥ 10% of book" },
  { rule: "Top-10 concentration", medium: "≥ 35% of book", high: "≥ 50% of book" },
  { rule: "Entity concentration", medium: "≥ 55% of book", high: "—" },
  { rule: "Exit-load exposure", medium: "any locked position", high: "cost ≥ ₹0.50 Cr" },
  { rule: "Gains approaching long term", medium: "within 90 days", high: "—" },
  { rule: "Loss harvesting", medium: "—", high: "total loss > ₹0.10 Cr" },
  { rule: "Cash drag", medium: "—", high: "cash > 2% of book" },
  { rule: "XIRR coverage", medium: "—", high: "> 20% of rows missing" },
];

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isLoading, isFetching } = useBook();
  const { totals } = useTotals();
  const { health } = useDataHealth();
  const qc = useQueryClient();

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1100px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Configuration"
        title="Settings"
        description="Appearance, the data source behind every figure, and the thresholds that trigger alerts."
      />

      <Card title="Appearance" subtitle="Applies immediately and is remembered on this device">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTheme(k)}
              className={cn(
                "inline-flex items-center gap-2 text-[12.5px] font-medium px-3.5 h-9 rounded-md border transition-colors",
                theme === k
                  ? "border-foreground/30 bg-secondary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Data source" subtitle="Every figure in this app derives from one table">
        {isLoading ? (
          <Skeleton className="h-[160px]" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3.5">
              <Database className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <code className="text-[12px] font-semibold">portfolio_detailed_holdings</code>
                <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11.5px]">
                  <div>
                    <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      Rows
                    </dt>
                    <dd className="tabular font-semibold mt-0.5">
                      {health.totalRows.toLocaleString("en-IN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      Valuation date
                    </dt>
                    <dd className="tabular font-semibold mt-0.5">{formatDate(totals.asOnDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      Cache
                    </dt>
                    <dd className="tabular font-semibold mt-0.5">5 min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">
                      Status
                    </dt>
                    <dd className="font-semibold mt-0.5">
                      {isFetching ? (
                        <span className="text-warning">Refreshing…</span>
                      ) : (
                        <span className="text-success">Loaded</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["book"] })}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 h-9 rounded-md border border-border hover:bg-secondary disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                Refresh data now
              </button>
              <a
                href="/data-import"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Data health report
              </a>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              The Supabase project URL and publishable key are currently hard-coded in{" "}
              <code className="bg-secondary px-1 rounded">src/lib/supabase.ts</code>, which
              overrides the <code className="bg-secondary px-1 rounded">.env</code> values. Moving
              them into environment variables would let you point this dashboard at a different
              project without a code change.
            </p>
          </div>
        )}
      </Card>

      <Card title="Alert thresholds" subtitle="The rules that generate the dashboard's risk alerts">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[12.5px] min-w-[480px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                <th className="text-left font-semibold px-5 py-2.5">Rule</th>
                <th className="text-left font-semibold py-2.5">Medium</th>
                <th className="text-left font-semibold px-5 py-2.5">High</th>
              </tr>
            </thead>
            <tbody>
              {THRESHOLDS.map((t) => (
                <tr key={t.rule} className="border-b border-border/40">
                  <td className="px-5 py-2.5 font-medium">{t.rule}</td>
                  <td className="py-2.5 text-muted-foreground tabular">{t.medium}</td>
                  <td className="px-5 py-2.5 text-muted-foreground tabular">{t.high}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          These are currently constants in{" "}
          <code className="bg-secondary px-1 rounded">src/lib/portfolio-analytics.ts</code>. Making
          them editable would need a settings table in Supabase to persist per-family policy.
        </p>
      </Card>
    </div>
  );
}
