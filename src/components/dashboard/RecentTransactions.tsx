import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getRecentTransactions } from "@/lib/data-service";
import { recentTransactions as fallback, inr, formatDate } from "@/lib/dummy-data";

const typeStyle: Record<string, string> = {
  BUY:      "bg-success/12 text-success",
  SELL:     "bg-destructive/12 text-destructive",
  SIP:      "bg-[var(--chart-1)]/12 text-[var(--chart-1)]",
  "TOP-UP": "bg-[var(--chart-5)]/12 text-[var(--chart-5)]",
};

export function RecentTransactions() {
  const { data: transactions = fallback } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: getRecentTransactions,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <Card
      title="Recent transactions"
      subtitle="Last confirmed trades across family entities"
      right={<button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">All transactions →</button>}
    >
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
              <th className="text-left font-semibold px-5 py-2.5">Date</th>
              <th className="text-left font-semibold py-2.5">Entity</th>
              <th className="text-left font-semibold py-2.5">Instrument</th>
              <th className="text-left font-semibold py-2.5">Type</th>
              <th className="text-right font-semibold py-2.5">Qty</th>
              <th className="text-right font-semibold px-5 py-2.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                <td className="px-5 py-3 text-muted-foreground tabular">{formatDate(t.date)}</td>
                <td className="py-3 font-medium">{t.entity}</td>
                <td className="py-3 text-foreground">{t.instrument}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${typeStyle[t.type] ?? "bg-muted text-muted-foreground"}`}>
                    {t.type}
                  </span>
                </td>
                <td className="py-3 text-right tabular text-muted-foreground">{t.qty > 0 ? t.qty.toLocaleString("en-IN") : "—"}</td>
                <td className="px-5 py-3 text-right font-semibold tabular">{inr(t.amount, { compact: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
