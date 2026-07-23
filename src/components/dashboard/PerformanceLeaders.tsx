import { Card } from "./Card";
import { usePerformanceLeaders } from "@/hooks/use-book";
import { pctSigned } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Slice } from "@/lib/types";
import { useUnits } from "@/lib/units";

/**
 * Replaces the old "Top movers" panel.
 *
 * Intraday movers need a previous close, and the source table holds a single
 * dated snapshot with no prior price — so day-change cannot be computed. This
 * ranks by return on cost since purchase instead, which the data does support.
 */
export function PerformanceLeaders() {
  const { best, worst, isLoading, error, refetch } = usePerformanceLeaders(5);

  return (
    <Card title="Performance leaders" subtitle="Best and weakest positions by return on cost">
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={best.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[300px] w-full" />}
      >
        <div className="space-y-4">
          <Section title="Strongest" items={best} up />
          {worst.length > 0 && (
            <>
              <div className="border-t border-border" />
              <Section title="Weakest" items={worst} up={false} />
            </>
          )}
        </div>
        <p className="mt-4 pt-3 border-t border-border text-[10.5px] text-muted-foreground leading-relaxed">
          Return since purchase, not intraday movement — the source book is a single dated snapshot
          with no previous close.
        </p>
      </Panel>
    </Card>
  );
}

function Section({ title, items, up }: { title: string; items: Slice[]; up: boolean }) {
  const { money } = useUnits();
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((m) => (
          <li
            key={m.key}
            className="flex items-center justify-between gap-2 text-[12px] py-1.5 px-2 -mx-2 rounded hover:bg-secondary/60 transition-colors"
          >
            <span className="font-medium truncate min-w-0" title={m.key}>
              {m.key}
            </span>
            <div className="flex items-center gap-3 tabular shrink-0">
              <span className="text-muted-foreground text-[11px]">{money(m.current)}</span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold min-w-[68px] justify-end ${
                  m.gainPct >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {pctSigned(m.gainPct, 1)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
