import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETFs — SG Family Wealth" },
      { name: "description", content: "Index, gold, and thematic ETFs across Indian and international exchanges." },
    ],
  }),
  component: EtfsPage,
});

function EtfsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) => m(r.product_type, "etf") || m(r.report_section, "etf"),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · ETFs
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">ETFs</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Index, gold, and thematic ETFs across Indian and international exchanges.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No ETF holdings found in your portfolio."
      />
    </div>
  );
}
