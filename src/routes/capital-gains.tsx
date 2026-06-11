import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable, COLS_CAPITAL_GAINS } from "@/components/holdings/HoldingsTable";
=======
import { DrillDownPage } from "@/components/DrillDownPage";
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4

export const Route = createFileRoute("/capital-gains")({
  head: () => ({
    meta: [
      { title: "Capital Gains — SG Family Wealth" },
      { name: "description", content: "Realised STCG/LTCG by entity for tax filing, with grandfathering applied." },
    ],
  }),
<<<<<<< HEAD
  component: CapitalGainsPage,
=======
  component: () => (
    <DrillDownPage
      title="Capital Gains"
      description="Realised STCG/LTCG by entity, sourced from portfolio_detailed_holdings."
      filter={{ kind: "all" }}
    />
  ),
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4
});

function CapitalGainsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  // Sorted by unrealised gain descending — largest gainers first, nulls last
  const rows = [...all].sort((a, b) => {
    const ga = a.unrealised_gain;
    const gb = b.unrealised_gain;
    if (ga == null && gb == null) return 0;
    if (ga == null) return 1;
    if (gb == null) return -1;
    return gb - ga;
  });

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Tax
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Capital Gains</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Unrealised gains across all holdings, sorted by magnitude. Use holding term to identify STCG vs LTCG exposure.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        columns={COLS_CAPITAL_GAINS}
        isLoading={isLoading}
        emptyMessage="No holdings data available for capital gains analysis."
      />
    </div>
  );
}
