import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getTopHoldings } from "@/lib/data-service";
import { topHoldings as fallback } from "@/lib/dummy-data";

const typeColor: Record<string, string> = {
  Equity: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  MF:     "bg-[var(--chart-2)]/12 text-[var(--chart-2)]",
  PMS:    "bg-[var(--chart-5)]/12 text-[var(--chart-5)]",
  ETF:    "bg-[var(--chart-3)]/15 text-[oklch(0.5_0.13_80)]",
  AIF:    "bg-[var(--chart-4)]/12 text-[var(--chart-4)]",
};

export function TopHoldingsTable() {
  const { data: holdings = fallback } = useQuery({
    queryKey: ["topHoldings"],
    queryFn: getTopHoldings,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card
      title="Top 10 holdings"
      subtitle="Ranked by current market value across all entities"
      right={<button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">View full book →</button>}
    >
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
              <th className="text-left font-semibold px-5 py-2.5">#</th>
              <th className="text-left font-semibold py-2.5">Instrument</th>
              <th className="text-left font-semibold py-2.5">Type</th>
              <th className="text-left font-semibold py-2.5">Entity</th>
              <th className="text-right font-semibold py-2.5">LTP (₹)</th>
              <th className="text-right font-semibold py-2.5">Value (₹ Cr)</th>
              <th className="text-right font-semibold px-5 py-2.5">Gain</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => (
              <tr key={h.name} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                <td className="px-5 py-3 text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</td>
                <td className="py-3 font-medium text-foreground">{h.name}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeColor[h.type] ?? "bg-muted text-muted-foreground"}`}>
                    {h.type}
                  </span>
                </td>
                <td className="py-3 text-muted-foreground">{h.entity}</td>
                <td className="py-3 text-right tabular">{h.ltp ? h.ltp.toLocaleString("en-IN") : "—"}</td>
                <td className="py-3 text-right font-semibold tabular">{h.value.toFixed(2)}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular ${h.gainPct >= 0 ? "text-success" : "text-destructive"}`}>
                  {h.gainPct >= 0 ? "+" : ""}{h.gainPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
