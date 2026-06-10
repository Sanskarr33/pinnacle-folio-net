import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/aifs")({
  head: () => ({
    meta: [
      { title: "AIFs — SG Family Wealth" },
      { name: "description", content: "Cat I/II/III alternative investments with capital calls and IRR tracking." },
    ],
  }),
  component: AifsPage,
});

function AifsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  // "PMS/AIF Equity Summary" report_section contains BOTH "aif" and "pms".
  // Use product_type as the discriminator so AIF rows don't pull in PMS entries.
  const rows = all.filter(
    (r) =>
      m(r.product_type, "aif") ||
      (m(r.report_section, "aif") && !m(r.product_type, "pms")),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Alternatives
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">AIFs</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cat I/II/III alternative investments with capital calls and IRR tracking.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        isLoading={isLoading}
        emptyMessage="No AIF holdings found in your portfolio."
      />
    </div>
  );
}
