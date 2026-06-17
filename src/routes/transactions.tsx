import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllHoldings } from "@/lib/data-service";
import { inr, pct } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import { Wallet, Layers, TrendingUp, TrendingDown, ListOrdered } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Holdings Ledger — SG Family Wealth" },
      { name: "description", content: "Complete instrument-level ledger across all entities and accounts." },
    ],
  }),
  component: TransactionsPage,
});

function Kpi({ icon: Icon, label, value, positive }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
      </div>
      <p className={`mt-2.5 text-[20px] font-semibold tabular tracking-tight ${
        positive === undefined ? "text-foreground" : positive ? "text-success" : "text-destructive"
      }`}>{value}</p>
    </div>
  );
}

function TransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
  });
  const rows = (data ?? []).slice().sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0));
  const invested = rows.reduce((s, r) => s + (r.invested_value ?? 0), 0);
  const current = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);
  const gain = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Holdings Ledger</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Instrument-level positions across every entity and account, sourced live from sg_family_holdings_import.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={ListOrdered} label="Total positions" value={rows.length.toString()} />
        <Kpi icon={Layers} label="Total invested" value={inr(invested, { compact: true })} />
        <Kpi icon={Wallet} label="Current value" value={inr(current, { compact: true })} />
        <Kpi icon={gain >= 0 ? TrendingUp : TrendingDown} label="Unrealised P/L" value={inr(gain, { compact: true })} positive={gain >= 0} />
      </div>

      <Card title="All holdings" subtitle={`${rows.length} positions sorted by current value`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading holdings…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No holdings available.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                  <th className="text-left font-semibold px-5 py-2.5">#</th>
                  <th className="text-left font-semibold py-2.5">Security</th>
                  <th className="text-left font-semibold py-2.5">Asset class</th>
                  <th className="text-left font-semibold py-2.5">Category</th>
                  <th className="text-right font-semibold py-2.5">Qty/Units</th>
                  <th className="text-right font-semibold py-2.5">Avg Cost</th>
                  <th className="text-right font-semibold py-2.5">CMP/NAV</th>
                  <th className="text-right font-semibold py-2.5">Invested</th>
                  <th className="text-right font-semibold py-2.5">Current</th>
                  <th className="text-right font-semibold px-5 py-2.5">Gain%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const inv = r.invested_value ?? 0;
                  const un = r.unrealised_gain ?? 0;
                  const gp = r.gain_percent != null ? r.gain_percent : inv > 0 ? (un / inv) * 100 : 0;
                  const cmp = r.current_price ?? r.ltp ?? 0;
                  return (
                    <tr key={`${r.security_name}-${i}`} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground tabular">{String(i + 1).padStart(3, "0")}</td>
                      <td className="py-3 font-medium text-foreground">{r.security_name}</td>
                      <td className="py-3 text-muted-foreground">{r.asset_class}</td>
                      <td className="py-3 text-muted-foreground">{r.category ?? r.product_type ?? "—"}</td>
                      <td className="py-3 text-right tabular text-muted-foreground">{(r.quantity ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                      <td className="py-3 text-right tabular text-muted-foreground">{(r.average_cost ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right tabular text-muted-foreground">{cmp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="py-3 text-right tabular">{inr(inv, { compact: true })}</td>
                      <td className="py-3 text-right font-semibold tabular">{inr(r.current_value ?? 0, { compact: true })}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular ${gp >= 0 ? "text-success" : "text-destructive"}`}>{pct(gp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
