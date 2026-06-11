import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/equity")({
  head: () => ({
    meta: [
      { title: "Direct Equity — SG Family Wealth" },
      { name: "description", content: "Stock-level positions, sector exposure, and intraday P&L across the family book." },
    ],
  }),
  component: DirectEquityPage,
=======
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/equity")({
  head: () => ({ meta: [
    { title: "Direct Equity — SG Family Wealth" },
    { name: "description", content: "Direct equity stock holdings across the family." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Direct Equity"
      description="Listed stocks held directly across all entities."
      filter={{ kind: "contains", fields: ["product_type", "asset_class"], keywords: ["Direct Equity", "Equity Shares"] }}
    />
  ),
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4
});

function DirectEquityPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) =>
      m(r.product_type, "direct equity") ||
      m(r.report_section, "direct equity") ||
      (m(r.product_type, "equity") &&
        !m(r.product_type, "mutual") &&
        !m(r.product_type, "etf") &&
        !m(r.product_type, "pms")),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Equity
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Direct Equity</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Stock-level positions, sector exposure, and intraday P&amp;L across the family book.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No direct equity holdings found in your portfolio."
      />
    </div>
  );
}
