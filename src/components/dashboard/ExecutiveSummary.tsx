import { TrendingUp, TrendingDown, Wallet, Target, Users, Layers, Info } from "lucide-react";
import { useTotals } from "@/hooks/use-book";
import { pct, pctSigned } from "@/lib/format";
import { ErrorState, Skeleton } from "@/components/common/States";
import { useUnits } from "@/lib/units";

export function ExecutiveSummary() {
  const { money } = useUnits();
  const { totals: k, isLoading, error, refetch } = useTotals();

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  if (isLoading) {
    return <Skeleton className="h-[210px] w-full rounded-xl" />;
  }

  const up = k.unrealisedGain >= 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-navy via-navy to-[oklch(0.22_0.06_265)] text-navy-foreground shadow-elevated">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative grid grid-cols-12">
        {/* Headline */}
        <div className="col-span-12 lg:col-span-4 p-6 border-b lg:border-b-0 lg:border-r border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">
            Total Family AUM
          </p>
          <div className="mt-3">
            <span className="text-[38px] sm:text-[44px] leading-none font-semibold tracking-tight tabular">
              {money(k.currentValue)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                up ? "bg-success/20 text-emerald-300" : "bg-destructive/20 text-rose-300"
              }`}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {pctSigned(k.unrealisedGainPct)} since purchase
            </span>
          </div>
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="text-white/50 uppercase tracking-wider">Invested</p>
              <p className="mt-1 text-[14px] font-medium tabular">{money(k.investedValue)}</p>
            </div>
            <div>
              <p className="text-white/50 uppercase tracking-wider">Positions</p>
              <p className="mt-1 text-[14px] font-medium tabular">
                {k.holdingCount.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4">
          <Stat
            icon={TrendingUp}
            label="Unrealised P/L"
            value={money(k.unrealisedGain)}
            sub={pctSigned(k.unrealisedGainPct)}
            positive={up}
          />
          <Stat
            icon={Target}
            label="Portfolio XIRR"
            value={k.weightedXirr != null ? pct(k.weightedXirr) : "N/A"}
            sub={
              k.weightedXirr != null
                ? `on ${k.xirrCoveragePct.toFixed(0)}% of book`
                : "not recorded"
            }
            positive={k.weightedXirr != null ? k.weightedXirr > 0 : null}
            // A weighted mean over 69% of the book is not the same as the book's return.
            note={
              k.xirrCoveragePct < 95
                ? `${(100 - k.xirrCoveragePct).toFixed(0)}% of book value has no XIRR recorded and is excluded from this average.`
                : undefined
            }
          />
          <Stat
            icon={Wallet}
            label="Cost Basis"
            value={money(k.investedValue)}
            sub={`${((k.investedValue / (k.currentValue || 1)) * 100).toFixed(0)}% of value`}
            positive={null}
          />
          <Stat
            icon={Users}
            label="Entities"
            value={String(k.entityCount)}
            sub="holding assets"
            positive={null}
            last
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  positive,
  last,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  positive: boolean | null;
  last?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`p-5 border-t border-white/10 lg:border-t-0 ${!last ? "md:border-r border-white/10" : ""}`}
    >
      <div className="flex items-center gap-2 text-white/55">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium truncate">
          {label}
        </span>
        {note && (
          <span title={note} className="ml-auto cursor-help">
            <Info className="h-3 w-3 text-white/40 hover:text-white/70 transition-colors" />
          </span>
        )}
      </div>
      <p className="mt-3 text-[21px] sm:text-[24px] font-semibold tabular tracking-tight">
        {value}
      </p>
      <p
        className={`mt-1 text-[11.5px] tabular ${
          positive === true
            ? "text-emerald-300"
            : positive === false
              ? "text-rose-300"
              : "text-white/45"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

export { Stat as ExecutiveStat };
