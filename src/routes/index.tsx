import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveSummary } from "@/components/dashboard/ExecutiveSummary";
import { GainBridge } from "@/components/dashboard/GainBridge";
import { AssetAllocationDonut } from "@/components/dashboard/AssetAllocationDonut";
import { CustodianBreakdown } from "@/components/dashboard/CustodianBreakdown";
import { EntityAllocationBar } from "@/components/dashboard/EntityAllocationBar";
import { ProductCards } from "@/components/dashboard/ProductCards";
import { ConcentrationPanel } from "@/components/dashboard/ConcentrationPanel";
import { TopHoldingsTable } from "@/components/dashboard/TopHoldingsTable";
import { PerformanceLeaders } from "@/components/dashboard/PerformanceLeaders";
import { TaxOpportunities } from "@/components/dashboard/TaxOpportunities";
import { RealisedGains } from "@/components/dashboard/RealisedGains";
import { RiskAlerts } from "@/components/dashboard/RiskAlerts";
import { ActionRequired } from "@/components/dashboard/ActionRequired";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SG Family Wealth" },
      {
        name: "description",
        content: "Consolidated position across all SG family entities and asset classes.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <PageHeader
        eyebrow="Family Office · Principal View"
        title="Consolidated position"
        description="Every figure on this page is derived from the reconciled holdings book — nothing is estimated or placeholder."
      />

      <ExecutiveSummary />

      {/* Decisions first: what needs attention before what things are worth. */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-7">
          <RiskAlerts />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <ActionRequired />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8">
          <GainBridge />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <AssetAllocationDonut />
        </div>
      </div>

      <ProductCards />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <TopHoldingsTable />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <ConcentrationPanel />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <EntityAllocationBar />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <CustodianBreakdown />
        </div>
      </div>

      <RealisedGains />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <TaxOpportunities />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <PerformanceLeaders />
        </div>
      </div>
    </div>
  );
}
