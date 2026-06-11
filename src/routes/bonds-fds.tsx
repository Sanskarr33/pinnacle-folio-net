import { createFileRoute } from "@tanstack/react-router";
<<<<<<< HEAD
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable, COLS_BONDS } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({
    meta: [
      { title: "Bonds & FDs — SG Family Wealth" },
      { name: "description", content: "Fixed income ladder including corporate bonds, G-secs and bank deposits." },
    ],
  }),
  component: BondsFdsPage,
=======
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({ meta: [
    { title: "Bonds & FDs — SG Family Wealth" },
    { name: "description", content: "Debt and other fixed-income style investments." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Bonds & FDs"
      description="Debt and other investments: bonds, FDs, REITs, PPF and NPS."
      filter={{
        kind: "contains",
        fields: ["product_type", "security_name"],
        keywords: ["Bond", "FD", "Fixed Deposit", "Debt Bonds", "REIT", "PPF", "NPS"],
      }}
    />
  ),
>>>>>>> 9ef70e5e4e15281c8fc57e9e1b6185ff70a8c0f4
});

function BondsFdsPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const m = (s: string | null | undefined, q: string) =>
    (s ?? "").toLowerCase().includes(q.toLowerCase());

  const rows = all.filter(
    (r) =>
      // product_type matches
      m(r.product_type, "bond") ||
      m(r.product_type, "fd") ||
      m(r.product_type, "fixed deposit") ||
      m(r.product_type, "g-sec") ||
      m(r.product_type, "gsec") ||
      m(r.product_type, "debenture") ||
      m(r.product_type, "ncd") ||
      m(r.product_type, "ppf") ||
      m(r.product_type, "nps") ||
      m(r.product_type, "reit") ||
      // report_section matches — covers: Debt Bonds/REIT, Fixed Deposits,
      // Other Investments Summary, PPF, NPS, Bond
      m(r.report_section, "bond") ||
      m(r.report_section, "fd") ||
      m(r.report_section, "fixed") ||
      m(r.report_section, "debt") ||
      m(r.report_section, "g-sec") ||
      m(r.report_section, "reit") ||
      m(r.report_section, "ppf") ||
      m(r.report_section, "nps") ||
      m(r.report_section, "other investments"),
  );

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Debt
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Bonds &amp; FDs</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Fixed income ladder including corporate bonds, G-secs and bank deposits.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        columns={COLS_BONDS}
        isLoading={isLoading}
        emptyMessage="No bond or fixed deposit holdings found in your portfolio."
      />
    </div>
  );
}
