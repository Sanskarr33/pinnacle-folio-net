import { Card } from "./Card";
import { advisorAUM } from "@/lib/dummy-data";

export function AdvisorComparison() {
  const max = Math.max(...advisorAUM.map((a) => a.aum));
  return (
    <Card title="Advisor-wise AUM" subtitle="Mandate split · XIRR shown alongside">
      <div className="space-y-3.5">
        {advisorAUM.map((a) => (
          <div key={a.advisor}>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="font-medium text-foreground">{a.advisor}</span>
              <div className="flex items-center gap-3 tabular">
                <span className="text-muted-foreground">₹{a.aum.toLocaleString("en-IN")} Cr</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-success/10 text-success min-w-[48px] justify-center">
                  {a.returns}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--chart-1)] to-[var(--chart-5)] transition-all duration-700"
                style={{ width: `${(a.aum / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
