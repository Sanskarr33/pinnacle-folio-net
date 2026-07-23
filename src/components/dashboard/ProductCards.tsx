import { Link } from "@tanstack/react-router";
import { Card } from "./Card";
import { useVehicleAllocation } from "@/hooks/use-book";
import { pctSigned } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import { ArrowUpRight } from "lucide-react";
import { useUnits } from "@/lib/units";

const VEHICLE_COLOR: Record<string, string> = {
  "Mutual Funds": "var(--chart-2)",
  "Direct Equity": "var(--chart-1)",
  Bullion: "var(--chart-3)",
  "Unlisted Equity": "var(--chart-5)",
  AIFs: "var(--chart-4)",
  PMS: "var(--chart-5)",
  ETFs: "var(--chart-3)",
  "Bonds & REITs": "var(--chart-2)",
  ULIPs: "var(--chart-4)",
  Cash: "var(--muted-foreground)",
  "Other Investments": "var(--muted-foreground)",
  Unclassified: "var(--muted-foreground)",
};

// Vehicle bucket → product page, so a card is a way in rather than a dead end.
const VEHICLE_LINK: Record<string, string> = {
  "Mutual Funds": "/mutual-funds",
  "Direct Equity": "/equity",
  "Unlisted Equity": "/equity",
  Bullion: "/bullion",
  ETFs: "/etfs",
  PMS: "/pms",
  AIFs: "/aifs",
  ULIPs: "/ulips",
  "Bonds & REITs": "/bonds-fds",
};

export function ProductCards() {
  const { money } = useUnits();
  const { slices, isLoading, error, refetch } = useVehicleAllocation();

  return (
    <Card
      title="Product allocation"
      subtitle="Exposure by investment vehicle · buckets are mutually exclusive and sum to total AUM"
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={slices.length === 0}
        onRetry={() => refetch()}
        skeleton={
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-[116px]" />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {slices.map((p) => {
            const color = VEHICLE_COLOR[p.key] ?? "var(--chart-1)";
            const href = VEHICLE_LINK[p.key];
            const body = (
              <>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
                    {p.key}
                  </span>
                  {href && (
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </div>
                <p className="mt-2.5 text-[17px] font-semibold tabular tracking-tight">
                  {money(p.current)}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10.5px] tabular">
                  <span className="text-muted-foreground">{p.pctOfBook.toFixed(1)}% of book</span>
                  <span className={p.gainPct >= 0 ? "text-success" : "text-destructive"}>
                    {pctSigned(p.gainPct, 1)}
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(2, p.pctOfBook)}%`, background: color }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/70 tabular">
                  {p.count} position{p.count !== 1 ? "s" : ""}
                </p>
              </>
            );

            const cls =
              "group rounded-lg border border-border bg-surface p-4 hover:border-foreground/20 hover:shadow-elevated transition-all block";

            return href ? (
              <Link key={p.key} to={href} className={cls}>
                {body}
              </Link>
            ) : (
              <div key={p.key} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </Panel>
    </Card>
  );
}
