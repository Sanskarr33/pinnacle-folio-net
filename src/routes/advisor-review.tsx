import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllHoldings } from "@/lib/data-service";
import { inr, pct } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import { Wallet, Layers, TrendingUp, TrendingDown, Users } from "lucide-react";

export const Route = createFileRoute("/advisor-review")({
  head: () => ({
    meta: [
      { title: "Advisor Review — SG Family Wealth" },
      { name: "description", content: "Advisor-wise AUM, performance, and allocation across the SG family portfolio." },
    ],
  }),
  component: AdvisorReviewPage,
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

function AdvisorReviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
  });
  const rows = data ?? [];
  const totalAll = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);

  type Bucket = { advisor: string; count: number; invested: number; current: number; gain: number };
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const a = (r.advisor_name?.toString().trim()) || "Self-managed";
    const b = map.get(a) ?? { advisor: a, count: 0, invested: 0, current: 0, gain: 0 };
    b.count += 1;
    b.invested += r.invested_value ?? 0;
    b.current += r.current_value ?? 0;
    b.gain += r.unrealised_gain ?? 0;
    map.set(a, b);
  }
  const advisors = Array.from(map.values()).sort((a, b) => b.current - a.current);
  const totalInvested = advisors.reduce((s, r) => s + r.invested, 0);
  const totalGain = advisors.reduce((s, r) => s + r.gain, 0);

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Advisor Review</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">AUM and performance attribution by mandate manager, derived from live holdings.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={Wallet} label="Total AUM" value={inr(totalAll, { compact: true })} />
        <Kpi icon={Layers} label="Total invested" value={inr(totalInvested, { compact: true })} />
        <Kpi icon={totalGain >= 0 ? TrendingUp : TrendingDown} label="Unrealised P/L" value={inr(totalGain, { compact: true })} positive={totalGain >= 0} />
        <Kpi icon={Users} label="Advisors" value={advisors.length.toString()} />
      </div>

      <Card title="Advisor allocation" subtitle={`${advisors.length} mandate manager${advisors.length === 1 ? "" : "s"}`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading advisors…</div>
        ) : advisors.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No advisor data.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                  <th className="text-left font-semibold px-5 py-2.5">#</th>
                  <th className="text-left font-semibold py-2.5">Advisor / Manager</th>
                  <th className="text-right font-semibold py-2.5">Holdings</th>
                  <th className="text-right font-semibold py-2.5">Invested</th>
                  <th className="text-right font-semibold py-2.5">Current AUM</th>
                  <th className="text-right font-semibold py-2.5">Unrealised P/L</th>
                  <th className="text-right font-semibold py-2.5">Gain%</th>
                  <th className="text-right font-semibold px-5 py-2.5">Allocation%</th>
                </tr>
              </thead>
              <tbody>
                {advisors.map((a, i) => {
                  const gp = a.invested > 0 ? (a.gain / a.invested) * 100 : 0;
                  const alloc = totalAll > 0 ? (a.current / totalAll) * 100 : 0;
                  return (
                    <tr key={a.advisor} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-3 font-medium text-foreground">{a.advisor}</td>
                      <td className="py-3 text-right tabular text-muted-foreground">{a.count}</td>
                      <td className="py-3 text-right tabular">{inr(a.invested, { compact: true })}</td>
                      <td className="py-3 text-right font-semibold tabular">{inr(a.current, { compact: true })}</td>
                      <td className={`py-3 text-right font-semibold tabular ${a.gain >= 0 ? "text-success" : "text-destructive"}`}>{inr(a.gain, { compact: true })}</td>
                      <td className={`py-3 text-right font-semibold tabular ${gp >= 0 ? "text-success" : "text-destructive"}`}>{pct(gp)}</td>
                      <td className="px-5 py-3 text-right tabular text-muted-foreground">{alloc.toFixed(2)}%</td>
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
