import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getConsolidatedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/pms")({
  head: () => ({
    meta: [
      { title: "PMS — SG Family Wealth" },
      { name: "description", content: "Portfolio Management Services mandates, strategy-wise performance and fee tracking." },
    ],
  }),
  component: PmsPage,
});

function PmsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["consolidatedHoldings", "PMS"],
    queryFn: () => getConsolidatedHoldings("PMS"),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · PMS
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">PMS</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Portfolio Management Services mandates, strategy-wise performance and fee tracking.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No PMS holdings found in your portfolio."
      />
    </div>
  );
}
