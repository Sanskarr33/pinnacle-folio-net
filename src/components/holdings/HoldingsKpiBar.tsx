import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/Card";
import type { PortfolioHolding } from "@/lib/types";
import { totals as computeTotals } from "@/lib/portfolio-analytics";
import { pct, pctSigned } from "@/lib/format";
import { Skeleton } from "@/components/common/States";
import { useMemo } from "react";
import { useUnits } from "@/lib/units";

/**
 * KPI strip for a product page. Percent-of-book is computed against the full
 * book so a page's share is meaningful, not just its own subtotal.
 */
export function HoldingsKpiBar({
  rows,
  isLoading,
  bookValue,
}: {
  rows: PortfolioHolding[];
  isLoading: boolean;
  bookValue?: number;
}) {
  const { money } = useUnits();
  const t = useMemo(() => computeTotals(rows), [rows]);
  const shareOfBook = bookValue && bookValue > 0 ? (t.currentValue / bookValue) * 100 : null;

  const kpis = [
    {
      label: "Current value",
      value: money(t.currentValue),
      sub: shareOfBook != null ? `${pct(shareOfBook, 1)} of book` : `${t.holdingCount} positions`,
      tone: null as "up" | "down" | null,
      accent: true,
    },
    {
      label: "Invested",
      value: money(t.investedValue),
      sub: `${t.holdingCount} position${t.holdingCount !== 1 ? "s" : ""}`,
      tone: null as "up" | "down" | null,
      accent: false,
    },
    {
      label: "Unrealised gain",
      value: money(t.unrealisedGain),
      sub: pctSigned(t.unrealisedGainPct),
      tone: (t.unrealisedGain >= 0 ? "up" : "down") as "up" | "down",
      accent: false,
    },
    {
      label: "XIRR",
      value: t.weightedXirr != null ? pct(t.weightedXirr) : "N/A",
      sub:
        t.weightedXirr != null
          ? `weighted, ${t.xirrCoveragePct.toFixed(0)}% coverage`
          : "not recorded in source",
      tone: (t.weightedXirr != null && t.weightedXirr > 0 ? "up" : null) as "up" | "down" | null,
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <Card key={k.label} accent={k.accent}>
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
              {k.label}
            </span>
            {isLoading ? (
              <Skeleton className="h-7 w-28 mt-1.5" />
            ) : (
              <span
                className={cn(
                  "text-[22px] sm:text-[25px] font-semibold tracking-tight tabular-nums leading-none mt-1.5",
                  k.tone === "up" && "text-success",
                  k.tone === "down" && "text-destructive",
                )}
              >
                {k.value}
              </span>
            )}
            {!isLoading && (
              <span
                className={cn(
                  "text-[11.5px] mt-1",
                  k.tone === "up"
                    ? "text-success"
                    : k.tone === "down"
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
