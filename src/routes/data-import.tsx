import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllHoldings } from "@/lib/data-service";
import { inr } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import { Database, Wallet, Calendar, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/data-import")({
  head: () => ({
    meta: [
      { title: "Data Import — SG Family Wealth" },
      { name: "description", content: "Health and freshness of the consolidated holdings dataset." },
    ],
  }),
  component: DataImportPage,
});

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
      </div>
      <p className="mt-2.5 text-[18px] font-semibold tabular tracking-tight">{value}</p>
    </div>
  );
}

function DataImportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
  });
  const rows = data ?? [];
  const aum = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);
  const asOn = rows.map((r) => r.as_on_date).filter(Boolean).sort().pop() ?? "—";
  const fetched = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const byClass = new Map<string, number>();
  for (const r of rows) {
    const k = r.asset_class?.trim() || "Other";
    byClass.set(k, (byClass.get(k) ?? 0) + 1);
  }
  const groups = Array.from(byClass.entries()).sort((a, b) => b[1] - a[1]);

  const healthy = !isLoading && rows.length > 0;

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Data Import</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Source-of-truth dataset: <code className="text-foreground">sg_family_holdings_import</code>.</p>
      </div>

      {healthy ? (
        <div className="rounded-xl border border-success/30 bg-success/10 text-success px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[13px] font-medium">
            Live data loaded — {rows.length} rows · {inr(aum, { compact: true })} AUM
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/10 text-warning px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-[13px] font-medium">{isLoading ? "Loading holdings…" : "No rows returned from sg_family_holdings_import."}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Database} label="Total rows" value={rows.length.toString()} />
        <Stat icon={Wallet} label="AUM" value={inr(aum, { compact: true })} />
        <Stat icon={Calendar} label="As on date" value={asOn} />
        <Stat icon={RefreshCw} label="Last fetched" value={fetched} />
      </div>

      <Card title="Row count by asset class" subtitle="Coverage of consolidated holdings dataset">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data."}</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                  <th className="text-left font-semibold px-5 py-2.5">Asset class</th>
                  <th className="text-right font-semibold py-2.5">Rows</th>
                  <th className="text-left font-semibold px-5 py-2.5 w-1/2">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([name, count]) => {
                  const pctVal = rows.length > 0 ? (count / rows.length) * 100 : 0;
                  return (
                    <tr key={name} className="border-b border-border/60">
                      <td className="px-5 py-3 font-medium text-foreground">{name}</td>
                      <td className="py-3 text-right tabular">{count}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pctVal}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular w-12 text-right">{pctVal.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Refresh data" subtitle="To push a new dataset, run this in the Supabase SQL editor">
        <pre className="text-[12px] bg-secondary/40 border border-border rounded-lg p-4 overflow-x-auto leading-relaxed">
{`-- 1. Clear existing holdings
TRUNCATE TABLE sg_family_holdings_import;

-- 2. Insert fresh rows from your latest export
INSERT INTO sg_family_holdings_import
  (entity_name, account_name, asset_class, product_type, security_name,
   isin, ticker, quantity, average_cost, invested_value, current_price,
   current_value, advisor_name, category, unrealised_gain,
   gain_percent, allocation_percent, as_on_date)
VALUES
  (...);  -- one row per position

-- The dashboard refreshes within 5 minutes (cache TTL).`}
        </pre>
      </Card>
    </div>
  );
}
