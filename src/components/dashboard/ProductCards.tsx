import { productExposure, inr } from "@/lib/dummy-data";
import { TrendingUp } from "lucide-react";

export function ProductCards() {
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight">Product allocation</h2>
          <p className="text-[11.5px] text-muted-foreground">Exposure by investment vehicle</p>
        </div>
        <button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">View all →</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {productExposure.slice(0, 9).map((p) => (
          <div key={p.product} className="group rounded-lg border border-border bg-surface p-4 hover:border-foreground/20 hover:shadow-elevated transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{p.product}</span>
              <TrendingUp className="h-3 w-3 text-success opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2.5 text-[18px] font-semibold tabular tracking-tight">{inr(p.value, { compact: true })}</p>
            <div className="mt-2.5 flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground tabular">{p.pct}% of book</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-navy" style={{ width: `${Math.min(p.pct * 2.5, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
