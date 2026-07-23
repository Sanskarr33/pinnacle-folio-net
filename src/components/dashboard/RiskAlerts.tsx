import { Card } from "./Card";
import { Link } from "@tanstack/react-router";
import { useAlerts } from "@/hooks/use-book";
import { Panel, Skeleton } from "@/components/common/States";
import { AlertTriangle, AlertCircle, Info, ShieldCheck } from "lucide-react";
import type { AlertSeverity } from "@/lib/types";

const CONF: Record<
  AlertSeverity,
  { icon: typeof AlertTriangle; color: string; bg: string; label: string }
> = {
  high: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "HIGH" },
  medium: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", label: "MED" },
  low: { icon: Info, color: "text-[var(--chart-1)]", bg: "bg-[var(--chart-1)]/10", label: "LOW" },
};

/**
 * Every alert here is computed from the book by `deriveAlerts`. Nothing is
 * hand-written, so the list changes when the portfolio does.
 */
export function RiskAlerts() {
  const { alerts, isLoading, error, refetch } = useAlerts();

  return (
    <Card
      title="Risk & compliance alerts"
      subtitle="Derived from the current book — thresholds applied automatically"
      right={
        !isLoading &&
        alerts.length > 0 && (
          <span className="text-[10.5px] tabular text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
            {alerts.length}
          </span>
        )
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        skeleton={
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px]" />
            ))}
          </div>
        }
      >
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ShieldCheck className="h-7 w-7 text-success/50" />
            <p className="text-[13px] text-muted-foreground">
              No threshold breaches detected in the current book.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {alerts.map((a) => {
              const c = CONF[a.severity];
              const Icon = c.icon;
              return (
                <li
                  key={a.id}
                  className="flex gap-3 p-3 rounded-lg border border-border bg-surface-elevated hover:border-foreground/15 transition-colors"
                >
                  <div
                    className={`h-9 w-9 shrink-0 rounded-md ${c.bg} ${c.color} flex items-center justify-center`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9.5px] font-bold tracking-wider ${c.color}`}>
                        {c.label}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground">{a.title}</span>
                      {a.metric && (
                        <span className="text-[11px] tabular font-semibold text-muted-foreground">
                          {a.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                      {a.detail}
                    </p>
                  </div>
                  {a.href && (
                    <Link
                      to={a.href}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-medium self-start shrink-0"
                    >
                      Review
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Card>
  );
}
