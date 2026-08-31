import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useTotals } from "@/hooks/use-book";

/**
 * Consistent page masthead. Stamps the book's as-on date on every page so a
 * figure can never be mistaken for live intraday data.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  right,
  hideAsOn,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
  /**
   * Suppress the workbook as-on chip. For pages that source their figures from
   * somewhere other than holdings-snapshot.json and stamp their own date — two
   * different as-at dates stacked on one page is worse than none.
   */
  hideAsOn?: boolean;
}) {
  const { totals, isLoading } = useTotals();

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          {eyebrow}
        </p>
        <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-foreground mt-1">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
        {!hideAsOn && !isLoading && totals.asOnDate && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 border border-border rounded-md px-2 py-1">
            <CalendarClock className="h-3 w-3" />
            Valuations as on {formatDate(totals.asOnDate)}
            <Link to="/data-import" className="underline underline-offset-2 hover:text-foreground">
              source
            </Link>
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
