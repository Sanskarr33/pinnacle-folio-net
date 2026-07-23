import { Card } from "./Card";
import { useBrokerAllocation, useDataHealth } from "@/hooks/use-book";
import { pct, pctSigned } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { Info } from "lucide-react";
import { useUnits } from "@/lib/units";

/**
 * Replaces the old "Advisor-wise AUM" panel.
 *
 * `advisor_name` is null for every row in the source table, so an advisor
 * comparison cannot be built from this data. `broker_name` IS populated, so this
 * shows the custodian split instead — the same "who is holding what" question,
 * answered with figures that exist.
 */
export function CustodianBreakdown() {
  const { money } = useUnits();
  const { slices, isLoading, error, refetch } = useBrokerAllocation();
  const { health } = useDataHealth();

  const max = Math.max(...slices.map((s) => s.current), 1);

  return (
    <Card
      title="Custodian concentration"
      subtitle="AUM by broker / custodian"
      right={
        health.brokerAliasesMerged > 0 && (
          <span
            title={`${health.brokerAliasesMerged} inconsistent broker spellings in the source were merged (e.g. "Kotak Secu", "KotakSec", "ksecu" → Kotak Securities).`}
            className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground cursor-help shrink-0 border border-border rounded px-1.5 py-0.5"
          >
            <Info className="h-3 w-3" />
            {health.brokerAliasesMerged} merged
          </span>
        )
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={slices.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[260px] w-full" />}
      >
        <div className="space-y-3.5">
          {slices.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between gap-2 text-[12px] mb-1.5">
                <span className="font-medium text-foreground truncate">{s.key}</span>
                <div className="flex items-center gap-2.5 tabular shrink-0">
                  <span className="text-muted-foreground text-[11px]">{s.count} pos</span>
                  <span className="text-muted-foreground">{money(s.current)}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold min-w-[52px] justify-center ${
                      s.gainPct >= 0
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {pctSigned(s.gainPct, 1)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    s.key === "Unattributed"
                      ? "bg-muted-foreground/40"
                      : "bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-5)]"
                  }`}
                  style={{ width: `${(s.current / max) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10.5px] text-muted-foreground tabular">
                <span>{s.pctOfBook.toFixed(1)}% of book</span>
                <span>{s.xirr != null ? `XIRR ${pct(s.xirr, 1)}` : "XIRR n/a"}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
          Advisor-level comparison isn't shown because{" "}
          <code className="text-[10.5px] bg-secondary px-1 py-0.5 rounded">advisor_name</code> is
          empty for all {health.totalRows} rows in the source table.
        </p>
      </Panel>
    </Card>
  );
}
