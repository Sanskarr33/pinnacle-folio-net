import { TrendingUp, TrendingDown, Wallet, Activity, Target, Sparkles } from "lucide-react";
import { familyKpis, inr, pct } from "@/lib/dummy-data";

export function ExecutiveSummary() {
  const k = familyKpis;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-navy via-navy to-[oklch(0.22_0.06_265)] text-navy-foreground shadow-elevated">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="relative grid grid-cols-12 gap-0">
        <div className="col-span-12 lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">Total Family AUM</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[44px] leading-none font-semibold tracking-tight tabular">{inr(k.totalAUM, { compact: true })}</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/20 text-emerald-300 font-medium">
              <TrendingUp className="h-3 w-3" />
              {pct(k.dayChangePct)} today
            </span>
            <span className="text-white/55 tabular">+{inr(k.dayChange, { compact: true })}</span>
          </div>
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="text-white/50 uppercase tracking-wider">Invested</p>
              <p className="mt-1 text-[14px] font-medium tabular">{inr(k.invested, { compact: true })}</p>
            </div>
            <div>
              <p className="text-white/50 uppercase tracking-wider">Entities</p>
              <p className="mt-1 text-[14px] font-medium tabular">7 active</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4">
          <Stat icon={TrendingUp} label="Unrealised P/L" value={inr(k.unrealisedGain, { compact: true })} sub={pct(k.unrealisedGainPct)} positive />
          <Stat icon={Wallet} label="Realised P/L (FY)" value={inr(k.realisedGain, { compact: true })} sub={pct(k.realisedGainPct)} positive />
          <Stat icon={Target} label="Portfolio XIRR" value={`${k.xirr}%`} sub="vs benchmark 12.4%" positive />
          <Stat icon={Activity} label="Day Movement" value={pct(k.dayChangePct)} sub={inr(k.dayChange, { compact: true })} positive last />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, positive, last }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; positive: boolean; last?: boolean;
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
