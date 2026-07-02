import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getConsolidatedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({
    meta: [
      { title: "Mutual Funds — SG Family Wealth" },
      { name: "description", content: "Active SIPs, schemes, fund houses, and category exposure across the family." },
    ],
  }),
  component: MutualFundsPage,
});

function MutualFundsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["consolidatedHoldings", "MF"],
    queryFn: () => getConsolidatedHoldings(["Equity MF", "Debt MF"]),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Mutual Funds
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Mutual Funds</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Active SIPs, schemes, fund houses, and category exposure across the family.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No mutual fund holdings found in your portfolio."
      />
    </div>
  );
}
