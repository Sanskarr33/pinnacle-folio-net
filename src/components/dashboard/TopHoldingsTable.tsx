import { Card } from "./Card";
import { Link } from "@tanstack/react-router";
import { useTopSecurities } from "@/hooks/use-book";
import { pct, pctSigned } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { useUnits } from "@/lib/units";

/**
 * Positions are consolidated by security name first — the same fund held in five
 * entities is one exposure, and showing it as five separate lines understates
 * concentration, which is the whole point of this table.
 */
export function TopHoldingsTable() {
  const { money } = useUnits();
  const { slices, isLoading, error, refetch } = useTopSecurities(10);

  return (
    <Card
      title="Top 10 holdings"
      subtitle="Consolidated across all entities, ranked by market value"
      right={
        <Link
          to="/allocation"
          className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium shrink-0"
        >
          Full book →
        </Link>
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={slices.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[340px] w-full" />}
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[12px] min-w-[620px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                <th className="text-left font-semibold px-5 py-2.5 w-8">#</th>
                <th className="text-left font-semibold py-2.5">Security</th>
                <th className="text-right font-semibold py-2.5">Held in</th>
                <th className="text-right font-semibold py-2.5">Value</th>
                <th className="text-right font-semibold py-2.5">% Book</th>
                <th className="text-right font-semibold py-2.5">Gain</th>
                <th className="text-right font-semibold px-5 py-2.5">XIRR</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((h, i) => (
                <tr
                  key={h.key}
                  className="border-b border-border/60 hover:bg-secondary/40 transition-colors"
                >
                  <td className="px-5 py-2.5 text-muted-foreground tabular">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-2.5 font-medium text-foreground max-w-[280px]">
                    <span className="block truncate" title={h.key}>
                      {h.key}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground tabular">
                    {h.count} {h.count === 1 ? "lot" : "lots"}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular">{money(h.current)}</td>
                  <td className="py-2.5 text-right tabular text-muted-foreground">
                    {h.pctOfBook.toFixed(2)}%
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold tabular ${
                      h.gainPct >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {pctSigned(h.gainPct, 1)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular text-muted-foreground">
                    {h.xirr != null ? pct(h.xirr, 1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Card>
  );
}
