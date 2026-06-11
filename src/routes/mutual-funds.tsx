import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
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
=======
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({ meta: [
    { title: "Mutual Funds — SG Family Wealth" },
    { name: "description", content: "Mutual fund holdings across the family." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Mutual Funds"
      description="All mutual fund holdings filtered from sg_family_holdings_import."
      filter={{ kind: "contains", fields: ["product_type", "asset_class", "security_name"], keywords: ["Mutual Fund", "Mutual Funds"] }}
    />
  ),
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4
});

function MutualFundsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) =>
      m(r.product_type, "mutual") ||
      m(r.report_section, "mutual") ||
      // "Equity MF Detail" / "Debt MF Detail" — report_section uses "MF" not "mutual"
      m(r.report_section, " mf ") ||
      m(r.report_section, "mf detail") ||
      r.report_section?.toLowerCase().startsWith("equity mf") ||
      r.report_section?.toLowerCase().startsWith("debt mf"),
  );

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
