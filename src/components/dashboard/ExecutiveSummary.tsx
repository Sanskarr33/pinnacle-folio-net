import { TrendingUp, TrendingDown, Wallet, Activity, Target, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getFamilyKpis } from "@/lib/data-service";
import { pct } from "@/lib/dummy-data";
import { useCurrency } from "@/contexts/CurrencyContext";

export function ExecutiveSummary() {
  const { data: k, isError, error, isLoading } = useQuery({
    queryKey: ["familyKpis"],
    queryFn: getFamilyKpis,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive p-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Supabase connection error</p>
          <p className="text-xs mt-1 opacity-80">
            Could not load <code>sg_family_holdings_import</code>. {error instanceof Error ? error.message : ""}
          </p>
        </div>
      </div>
    );
  }

  const { formatAmount } = useCurrency();

  if (isLoading || !k) {
    return <div className="h-[220px] rounded-xl border border-border bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-navy via-navy to-[oklch(0.22_0.06_265)] text-navy-foreground shadow-elevated">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <div className="relative grid grid-cols-12 gap-0">
        <div className="col-span-12 lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">Total Family AUM</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[44px] leading-none font-semibold tracking-tight tabular">{formatAmount(k.totalAUM)}</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px]">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${k.dayChange >= 0 ? "bg-success/20 text-emerald-300" : "bg-destructive/20 text-rose-300"}`}>
              {k.dayChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {pct(k.dayChangePct)} today
            </span>
            <span className="text-white/55 tabular">{k.dayChange >= 0 ? "+" : ""}{formatAmount(k.dayChange)}</span>
          </div>
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="text-white/50 uppercase tracking-wider">Invested</p>
              <p className="mt-1 text-[14px] font-medium tabular">{formatAmount(k.invested)}</p>
            </div>
            <div>
              <p className="text-white/50 uppercase tracking-wider">Entities</p>
              <p className="mt-1 text-[14px] font-medium tabular">7 active</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4">
          <Stat icon={TrendingUp}  label="Unrealised P/L"  value={formatAmount(k.unrealisedGain)} sub={pct(k.unrealisedGainPct)} positive={k.unrealisedGain >= 0} />
          <Stat icon={Wallet}      label="Realised P/L (FY)" value={formatAmount(k.realisedGain)} sub={pct(k.realisedGainPct)} positive={k.realisedGain >= 0} />
          <Stat icon={Target}      label="Portfolio XIRR"  value={`${k.xirr}%`} sub="vs benchmark 12.4%" positive={k.xirr >= 12.4} />
          <Stat icon={Activity}    label="Day Movement"    value={pct(k.dayChangePct)} sub={formatAmount(k.dayChange)} positive={k.dayChange >= 0} last />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, positive, last }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; positive: boolean; last?: boolean;
}) {
  return (
    <div className={`p-6 border-t border-white/10 lg:border-t-0 ${!last ? "border-r border-white/10" : ""}`}>
      <div className="flex items-center gap-2 text-white/55">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
      </div>
      <p className="mt-3 text-[24px] font-semibold tabular tracking-tight">{value}</p>
      <p className={`mt-1 text-[12px] tabular ${positive ? "text-emerald-300" : "text-rose-300"}`}>
        {positive ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
        {sub}
      </p>
    </div>
  );
}
