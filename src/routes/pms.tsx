import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
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
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  // "PMS/AIF Equity Summary" report_section contains BOTH "pms" and "aif".
  // Use product_type as the discriminator so PMS rows don't leak into the AIF page.
  const rows = all.filter(
    (r) =>
      m(r.product_type, "pms") ||
      (m(r.report_section, "pms") && !m(r.product_type, "aif")),
  );

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
