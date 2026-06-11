import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/ulips")({
  head: () => ({
    meta: [
      { title: "ULIPs — SG Family Wealth" },
      { name: "description", content: "Insurance-linked plans, fund switches and surrender value monitoring." },
    ],
  }),
  component: UlipsPage,
});

function UlipsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) => m(r.product_type, "ulip") || m(r.report_section, "ulip"),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Insurance
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">ULIPs</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Insurance-linked plans, fund switches and surrender value monitoring.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No ULIP holdings found in your portfolio."
      />
    </div>
  );
}
