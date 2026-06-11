import { useQuery } from "@tanstack/react-query";
import { getAllHoldings } from "@/lib/data-service";
import { inr, pct } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import { Users, Wallet, Layers, TrendingUp, TrendingDown } from "lucide-react";

export function EntityGroupPage({ title, description }: { title: string; description: string }) {
  const { data: all, isLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const rows = all ?? [];
  const totalCurrent = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);
  const totalInvested = rows.reduce((s, r) => s + (r.invested_value ?? 0), 0);
  const totalGain = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const byEntity = new Map<string, { current: number; invested: number; gain: number }>();
  for (const r of rows) {
    const key = r.entity_name?.trim() || "SG Family Consolidated";
    const e = byEntity.get(key) ?? { current: 0, invested: 0, gain: 0 };
    e.current  += r.current_value   ?? 0;
    e.invested += r.invested_value  ?? 0;
    e.gain     += r.unrealised_gain ?? 0;
    byEntity.set(key, e);
  }
  const entities = Array.from(byEntity.entries())
    .map(([entity, v]) => ({
      entity,
      ...v,
      gainPct: v.invested > 0 ? (v.gain / v.invested) * 100 : 0,
      allocPct: totalCurrent > 0 ? (v.current / totalCurrent) * 100 : 0,
    }))
    .sort((a, b) => b.current - a.current);

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi icon={Wallet} label="Current value"  value={inr(totalCurrent, { compact: true })} />
        <Kpi icon={Layers} label="Invested value" value={inr(totalInvested, { compact: true })} />
        <Kpi icon={totalGain >= 0 ? TrendingUp : TrendingDown} label="Unrealised P/L" value={inr(totalGain, { compact: true })} positive={totalGain >= 0} />
        <Kpi icon={TrendingUp} label="Gain %"     value={pct(totalGainPct)} positive={totalGainPct >= 0} />
        <Kpi icon={Users} label="Entities"        value={`${entities.length}`} />
      </div>

      <Card title="Entity-wise summary" subtitle="Grouped by entity_name from sg_family_holdings_import">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : entities.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No entities found.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                  <th className="text-left font-semibold px-5 py-2.5">#</th>
                  <th className="text-left font-semibold py-2.5">Entity</th>
                  <th className="text-right font-semibold py-2.5">Invested</th>
                  <th className="text-right font-semibold py-2.5">Current</th>
                  <th className="text-right font-semibold py-2.5">Unrealised P/L</th>
                  <th className="text-right font-semibold py-2.5">Gain %</th>
                  <th className="text-right font-semibold px-5 py-2.5">Allocation %</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e, i) => (
                  <tr key={e.entity} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</td>
                    <td className="py-3 font-medium text-foreground">{e.entity}</td>
                    <td className="py-3 text-right tabular">{inr(e.invested, { compact: true })}</td>
                    <td className="py-3 text-right font-semibold tabular">{inr(e.current, { compact: true })}</td>
                    <td className={`py-3 text-right font-semibold tabular ${e.gain >= 0 ? "text-success" : "text-destructive"}`}>
                      {inr(e.gain, { compact: true })}
                    </td>
                    <td className={`py-3 text-right font-semibold tabular ${e.gainPct >= 0 ? "text-success" : "text-destructive"}`}>
                      {e.gainPct >= 0 ? "+" : ""}{e.gainPct.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular">{e.allocPct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, positive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; positive?: boolean;
}) {
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
