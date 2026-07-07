import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import type { PortfolioHolding } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";

function fmtPct(v: number, signed = false) {
  return `${signed && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function HoldingsKpiBar({
  rows,
  isLoading,
}: {
  rows: PortfolioHolding[];
  isLoading: boolean;
}) {
  const { formatAmount } = useCurrency();

  const totalValue    = rows.reduce((s, r) => s + (r.current_value   ?? 0), 0);
  const totalInvested = rows.reduce((s, r) => s + (r.invested_value  ?? 0), 0);
  const totalGain     = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);
  const overallGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const xirrRows = rows.filter(
    (r) => r.xirr != null && r.current_value != null && r.current_value > 0,
  );
  const xirrBase = xirrRows.reduce((s, r) => s + r.current_value!, 0);
  const weightedXirr =
    xirrBase > 0
      ? xirrRows.reduce((s, r) => s + r.xirr! * r.current_value!, 0) / xirrBase
      : null;

  const kpis = [
    {
      label:    "Current Value",
      value:    formatAmount(totalValue),
      sub:      `${rows.length} holding${rows.length !== 1 ? "s" : ""}`,
      positive: null as boolean | null,
      accent:   true,
    },
    {
      label:    "Invested",
      value:    formatAmount(totalInvested),
      sub:      null as string | null,
      positive: null as boolean | null,
      accent:   false,
    },
    {
      label:    "Unrealised Gain",
      value:    formatAmount(totalGain),
      sub:      fmtPct(overallGainPct, true),
      positive: totalGain >= 0,
      accent:   false,
    },
    {
      label:    "Avg XIRR",
      value:    weightedXirr != null ? fmtPct(weightedXirr) : "N/A",
      sub:      "Weighted by value",
      positive: weightedXirr != null ? weightedXirr > 0 : null,
      accent:   false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card key={k.label} accent={k.accent}>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
              {k.label}
            </span>
            {isLoading ? (
              <div className="h-8 w-32 animate-pulse rounded bg-muted mt-1" />
            ) : (
              <span
                className={cn(
                  "text-[26px] font-semibold tracking-tight tabular-nums leading-none mt-1",
                  k.positive === true && "text-emerald-600",
                  k.positive === false && "text-destructive",
                )}
              >
                {k.value}
              </span>
            )}
            {!isLoading && k.sub && (
              <span
                className={cn(
                  "text-[12px] mt-0.5",
                  k.positive === true
                    ? "text-emerald-600"
                    : k.positive === false
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {k.sub}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
