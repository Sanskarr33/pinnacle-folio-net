import { Card } from "./Card";
import { useRealisedGains } from "@/hooks/use-book";
import { pct, formatDate } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { cn } from "@/lib/utils";
import { useUnits } from "@/lib/units";

/**
 * Realised capital gains for the current financial year, from the transaction
 * workbook's "CapGains FY25-26" sheet. Before this workbook existed there was no
 * trade ledger anywhere in the project, so realised P/L could not be shown at all.
 */
export function RealisedGains({ compact = false }: { compact?: boolean }) {
  const { money } = useUnits();
  const { capitalGains, isLoading, error, refetch } = useRealisedGains();
  const total = capitalGains?.total;
  const cats = (capitalGains?.byCategory ?? []).filter((c) => c.saleAmount > 0);

  return (
    <Card
      title={`Realised gains · FY ${capitalGains?.financialYear ?? ""}`}
      subtitle={
        capitalGains?.asOn
          ? `Booked to date, as on ${formatDate(capitalGains.asOn)}`
          : "Booked to date"
      }
      right={
        total && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tax due</p>
            <p className="text-[15px] font-semibold tabular text-warning">{money(total.netTax)}</p>
          </div>
        )
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={!total}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[220px] w-full" />}
        emptyMessage="No realised capital gains recorded for this financial year."
      >
        {total && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-border">
              <Fig label="Sale proceeds" value={money(total.saleAmount)} />
              <Fig
                label="Short-term gain"
                value={money(total.shortTermGain)}
                tone={total.shortTermGain >= 0 ? "good" : "bad"}
                sub={`tax ${money(total.shortTermTax)}`}
              />
              <Fig
                label="Long-term gain"
                value={money(total.longTermGain)}
                tone={total.longTermGain >= 0 ? "good" : "bad"}
                sub={`tax ${money(total.longTermTax)}`}
              />
              <Fig
                label="Net realised"
                value={money(total.netGain)}
                tone={total.netGain >= 0 ? "good" : "bad"}
                sub={`tax ${money(total.netTax)}`}
              />
            </div>

            {!compact && (
              <div className="overflow-x-auto -mx-5 mt-4">
                <table className="w-full text-[12.5px] min-w-[640px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                      <th className="text-left font-semibold px-5 py-2.5">Asset category</th>
                      <th className="text-right font-semibold py-2.5">Sale proceeds</th>
                      <th className="text-right font-semibold py-2.5">Short-term</th>
                      <th className="text-right font-semibold py-2.5">Long-term</th>
                      <th className="text-right font-semibold py-2.5">Net gain</th>
                      <th className="text-right font-semibold px-5 py-2.5">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr
                        key={c.category}
                        className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-5 py-2.5 font-medium">{c.category}</td>
                        <td className="py-2.5 text-right tabular">{money(c.saleAmount)}</td>
                        <td
                          className={cn(
                            "py-2.5 text-right tabular",
                            c.shortTermGain > 0 && "text-success",
                            c.shortTermGain < 0 && "text-destructive",
                            c.shortTermGain === 0 && "text-muted-foreground/50",
                          )}
                        >
                          {c.shortTermGain === 0 ? "—" : money(c.shortTermGain)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right tabular",
                            c.longTermGain > 0 && "text-success",
                            c.longTermGain < 0 && "text-destructive",
                            c.longTermGain === 0 && "text-muted-foreground/50",
                          )}
                        >
                          {c.longTermGain === 0 ? "—" : money(c.longTermGain)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right tabular font-semibold",
                            c.netGain >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {money(c.netGain)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular text-warning">
                          {c.netTax === 0 ? "—" : money(c.netTax)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                      <td className="px-5 py-2.5">Total</td>
                      <td className="py-2.5 text-right tabular">{money(total.saleAmount)}</td>
                      <td className="py-2.5 text-right tabular">{money(total.shortTermGain)}</td>
                      <td className="py-2.5 text-right tabular">{money(total.longTermGain)}</td>
                      <td
                        className={cn(
                          "py-2.5 text-right tabular",
                          total.netGain >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {money(total.netGain)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular text-warning">
                        {money(total.netTax)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {total.netGain > 0 && (
              <p className="mt-4 pt-3 border-t border-border text-[11.5px] text-muted-foreground leading-relaxed">
                Effective tax rate on realised gains is{" "}
                <span className="tabular font-medium text-foreground">
                  {pct((total.netTax / total.netGain) * 100, 1)}
                </span>
                . Unrealised losses elsewhere in the book could offset part of this — see the loss
                harvesting tab.
              </p>
            )}
          </>
        )}
      </Panel>
    </Card>
  );
}

function Fig({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "mt-1 text-[17px] font-semibold tabular tracking-tight truncate",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
