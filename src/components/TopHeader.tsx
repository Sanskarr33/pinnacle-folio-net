import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Moon, Sun, RefreshCw, CalendarClock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBook, useTotals, useAlerts } from "@/hooks/use-book";
import { useTheme } from "@/hooks/use-theme";
import { pctSigned, formatDate } from "@/lib/format";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { UnitSelector } from "@/components/common/UnitSelector";
import { cn } from "@/lib/utils";
import { useUnits } from "@/lib/units";

/**
 * The header used to show hard-coded NIFTY / SENSEX / USD-INR / GOLD quotes. There
 * is no market-data source in this project, so those are gone; what's shown now is
 * the book's own live-derived state.
 */
export function TopHeader() {
  const { money } = useUnits();
  const { totals } = useTotals();
  const { alerts } = useAlerts();
  const { isFetching } = useBook();
  const { toggle } = useTheme();
  const qc = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  const highs = alerts.filter((a) => a.severity === "high").length;

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-surface/85 backdrop-blur-md border-b border-border flex items-center px-3 sm:px-6 gap-3">
        <SidebarTrigger className="text-muted-foreground shrink-0" />

        <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-muted-foreground border-r border-border pr-4">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="tabular font-medium text-foreground">
              {formatDate(totals.asOnDate)}
            </span>
            <span className="text-[10px] text-muted-foreground/70 mt-0.5">Book valuation date</span>
          </div>
        </div>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Real book stats, not market quotes. */}
          <div className="hidden xl:flex items-center gap-4 text-[11px] tabular pr-3 border-r border-border">
            <Stat label="AUM" value={money(totals.currentValue)} />
            <Stat
              label="Unrealised"
              value={pctSigned(totals.unrealisedGainPct, 1)}
              tone={totals.unrealisedGainPct >= 0 ? "up" : "down"}
            />
            <Stat
              label="XIRR"
              value={totals.weightedXirr != null ? `${totals.weightedXirr.toFixed(1)}%` : "—"}
            />
          </div>

          <UnitSelector compact />

          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["book"] })}
            disabled={isFetching}
            title="Refresh portfolio data"
            aria-label="Refresh portfolio data"
            className="h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-muted-foreground", isFetching && "animate-spin")}
            />
          </button>

          <button
            onClick={toggle}
            title="Toggle dark mode"
            aria-label="Toggle dark mode"
            className="h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
          >
            <Sun className="h-4 w-4 text-muted-foreground dark:hidden" />
            <Moon className="h-4 w-4 text-muted-foreground hidden dark:block" />
          </button>

          <Link
            to="/"
            title={`${alerts.length} active alerts`}
            className="relative h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
            aria-label={`${alerts.length} active alerts`}
          >
            <span className="text-[11px] font-semibold tabular text-muted-foreground">
              {alerts.length}
            </span>
            {highs > 0 && (
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            )}
          </Link>

          <div className="flex items-center gap-2.5 pl-2 border-l border-border">
            <div className="h-9 w-9 rounded-full bg-navy text-navy-foreground flex items-center justify-center text-[11px] font-semibold tracking-wide shrink-0">
              SG
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-[12px] font-semibold">SG Family Office</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {totals.entityCount} entities
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground font-medium tracking-wider uppercase text-[10px]">
        {label}
      </span>
      <span
        className={cn(
          "font-semibold",
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
