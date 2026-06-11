import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/international")({
  head: () => ({
    meta: [
      { title: "International Portfolio — SG Family Wealth" },
      { name: "description", content: "Offshore holdings via LRS, GIFT-IFSC and overseas brokerage accounts." },
    ],
  }),
  component: InternationalPage,
=======
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/international")({
  head: () => ({ meta: [
    { title: "International — SG Family Wealth" },
    { name: "description", content: "Offshore and international investment holdings." },
  ]}),
  component: () => (
    <DrillDownPage
      title="International"
      description="Offshore equity, funds, and other international exposure."
      filter={{ kind: "contains", fields: ["product_type", "asset_class", "security_name"], keywords: ["International"] }}
    />
  ),
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4
});

function InternationalPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) =>
      // Structured tags
      m(r.category, "international") ||
      m(r.asset_class, "international") ||
      m(r.product_type, "international") ||
      m(r.report_section, "international") ||
      m(r.report_section, "global") ||
      m(r.report_section, "overseas") ||
      // security_name keyword fallback for funds without the International tag
      m(r.security_name, "international") ||
      m(r.security_name, "global") ||
      m(r.security_name, "nasdaq") ||
      m(r.security_name, "china") ||
      m(r.security_name, "japan") ||
      m(r.security_name, "brazil") ||
      // Word-boundary match for "US" — avoids false matches in words like "FOCUS"
      /\bus\b/i.test(r.security_name ?? ""),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · International
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">International Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Offshore holdings via LRS, GIFT-IFSC and overseas brokerage accounts.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No international holdings found in your portfolio."
      />
    </div>
  );
}
