import { Card } from "./Card";
import { Link } from "@tanstack/react-router";
import { useActions } from "@/hooks/use-book";
import { formatDate } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { CalendarCheck2, IndianRupee } from "lucide-react";
import { useUnits } from "@/lib/units";

/**
 * Real dated deadlines pulled from the book: exit-load windows lapsing and
 * short-term lots crossing into long-term. Both carry a rupee figure, so the
 * list is ordered by when money is actually at stake.
 */
export function ActionRequired() {
  const { money } = useUnits();
  const { actions, isLoading, error, refetch } = useActions(6);

  return (
    <Card
      title="Upcoming dates"
      subtitle="Exit-load expiries and long-term tax thresholds from the current book"
      right={
        <Link
          to="/exit-load"
          className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium shrink-0"
        >
          All dates →
        </Link>
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        skeleton={
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px]" />
            ))}
          </div>
        }
      >
        {actions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarCheck2 className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-[13px] text-muted-foreground">
              No exit-load or tax deadlines in the current book.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {actions.map((a) => {
              const d = a.dueDate ? new Date(a.dueDate) : null;
              return (
                <li key={a.id}>
                  <Link
                    to={a.href ?? "/"}
                    className="group flex items-center gap-3 p-2.5 -mx-1 rounded-lg hover:bg-secondary/60 transition-colors"
                  >
                    <div className="h-10 w-12 shrink-0 rounded-md bg-navy text-navy-foreground flex flex-col items-center justify-center">
                      {d ? (
                        <>
                          <span className="text-[9px] uppercase tracking-wider opacity-75 leading-none">
                            {d.toLocaleDateString("en-IN", { month: "short" })}
                          </span>
                          <span className="text-[14px] font-semibold tabular leading-none mt-0.5">
                            {d.getDate()}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] opacity-75">TBD</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12.5px] font-medium text-foreground truncate"
                        title={a.title}
                      >
                        {a.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {a.detail}
                      </p>
                    </div>
                    {a.amount != null && (
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold tabular flex items-center gap-0.5">
                          <IndianRupee className="h-3 w-3 text-muted-foreground" />
                          {money(a.amount).replace("₹", "")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.dueDate ? formatDate(a.dueDate) : "—"}
                        </p>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Card>
  );
}
