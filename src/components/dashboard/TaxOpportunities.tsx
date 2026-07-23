import { Card } from "./Card";
import { Link } from "@tanstack/react-router";
import { useTax, useHarvest, useExitLoads } from "@/hooks/use-book";
import { humanDays } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { Scissors, Hourglass, Lock } from "lucide-react";
import { useUnits } from "@/lib/units";

/**
 * Replaces the old "Recent transactions" feed. There is no transactions table in
 * Supabase — the previous panel rendered six hard-coded trades. This shows the
 * three money-at-stake positions the book CAN answer, each linking to its page.
 */
export function TaxOpportunities() {
  const { money } = useUnits();
  const { summary: tax, isLoading, error, refetch } = useTax(90);
  const { candidates } = useHarvest();
  const { summary: exit } = useExitLoads();

  const totalLoss = candidates.reduce((s, c) => s + c.loss, 0);

  return (
    <Card
      title="Money at stake"
      subtitle="Tax timing and liquidity friction detected in the current book"
    >
      <Panel
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        skeleton={
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          <Item
            icon={Hourglass}
            tone="warn"
            title="Gains approaching long-term status"
            value={money(tax.maturingSoonGain)}
            detail={
              tax.maturingSoon.length > 0
                ? `${tax.maturingSoon.length} short-term ${tax.maturingSoon.length === 1 ? "lot crosses" : "lots cross"} the threshold within 90 days — the soonest in ${humanDays(tax.maturingSoon[0].daysToLongTerm)}.`
                : "No short-term lots with gains cross the long-term threshold in the next 90 days."
            }
            href="/capital-gains"
          />
          <Item
            icon={Lock}
            tone="warn"
            title="Locked behind exit loads"
            value={money(exit.totalCost)}
            detail={
              exit.locked.length > 0
                ? `${exit.locked.length} positions worth ${money(exit.lockedValue)} still inside their exit-load window; the first clears in ${humanDays(exit.locked[0].daysRemaining)}.`
                : "No positions are currently inside an exit-load window."
            }
            href="/exit-load"
          />
          <Item
            icon={Scissors}
            tone="good"
            title="Harvestable unrealised losses"
            value={money(totalLoss)}
            detail={
              candidates.length > 0
                ? `${candidates.length} positions carry losses that could offset realised gains this financial year.`
                : "No positions are currently at a loss."
            }
            href="/capital-gains"
          />
        </div>

        <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Short term</p>
            <p className="mt-1 text-[14px] font-semibold tabular">{money(tax.shortTerm.value)}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {tax.shortTerm.count} lots · gain {money(tax.shortTerm.gain)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Long term</p>
            <p className="mt-1 text-[14px] font-semibold tabular">{money(tax.longTerm.value)}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {tax.longTerm.count} lots · gain {money(tax.longTerm.gain)}
            </p>
          </div>
        </div>
      </Panel>
    </Card>
  );
}

function Item({
  icon: Icon,
  title,
  value,
  detail,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
  href: string;
  tone: "good" | "warn";
}) {
  return (
    <Link
      to={href}
      className="flex gap-3 p-3 rounded-lg border border-border bg-surface-elevated hover:border-foreground/15 transition-colors"
    >
      <div
        className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center ${
          tone === "warn" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span className="text-[13px] font-semibold tabular shrink-0">{value}</span>
        </div>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </Link>
  );
}
