import { useQuery } from "@tanstack/react-query";
import { getProductExposure } from "@/lib/data-service";
import { productExposure as fallback, inr } from "@/lib/dummy-data";
import { Card } from "./Card";
import { TrendingUp } from "lucide-react";

const productColors: Record<string, string> = {
  "Direct Equity": "var(--chart-1)",
  "Mutual Funds":  "var(--chart-2)",
  "PMS":           "var(--chart-5)",
  "AIF":           "var(--chart-4)",
  "Bonds":         "var(--chart-2)",
  "ETF":           "var(--chart-3)",
  "International": "var(--chart-1)",
  "Cash & FD":     "var(--muted-foreground)",
  "ULIP":          "var(--chart-4)",
};

export function ProductCards() {
  const { data: products = fallback } = useQuery({
    queryKey: ["productExposure"],
    queryFn: getProductExposure,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card
      title="Product allocation"
      subtitle="Exposure by investment vehicle"
      right={<button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">View all →</button>}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
        {products.map((p) => {
          const barColor = productColors[p.product] ?? "var(--chart-1)";
          return (
            <div
              key={p.product}
              className="group rounded-lg border border-border bg-surface p-4 hover:border-foreground/20 hover:shadow-elevated transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">{p.product}</span>
                <TrendingUp className="h-3 w-3 text-success opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="mt-2.5 text-[18px] font-semibold tabular tracking-tight">{inr(p.value, { compact: true })}</p>
              <div className="mt-2.5 text-[10.5px] text-muted-foreground tabular">{p.pct}% of book</div>
              <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(p.pct * 2.5, 100)}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
