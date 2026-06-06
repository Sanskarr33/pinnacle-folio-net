import { Card } from "./Card";
import { riskAlerts } from "@/lib/dummy-data";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

const conf = {
  high: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30", label: "HIGH" },
  medium: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", ring: "ring-warning/30", label: "MED" },
  low: { icon: Info, color: "text-[var(--chart-1)]", bg: "bg-[var(--chart-1)]/10", ring: "ring-[var(--chart-1)]/30", label: "LOW" },
} as const;

export function RiskAlerts() {
  return (
    <Card title="Risk & compliance alerts" subtitle="Auto-detected from latest portfolio scan">
      <ul className="space-y-2.5">
        {riskAlerts.map((a, i) => {
          const c = conf[a.severity as keyof typeof conf];
          const Icon = c.icon;
          return (
            <li key={i} className={`flex gap-3 p-3 rounded-lg border border-border bg-surface-elevated hover:ring-1 hover:${c.ring} transition-all`}>
              <div className={`h-9 w-9 shrink-0 rounded-md ${c.bg} ${c.color} flex items-center justify-center`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[9.5px] font-bold tracking-wider ${c.color}`}>{c.label}</span>
                  <span className="text-[13px] font-semibold text-foreground">{a.title}</span>
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{a.detail}</p>
              </div>
              <button className="text-[11px] text-muted-foreground hover:text-foreground font-medium self-start">Review</button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
