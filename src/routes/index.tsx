import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveSummary } from "@/components/dashboard/ExecutiveSummary";
import { WealthMovementChart } from "@/components/dashboard/WealthMovementChart";
import { AssetAllocationDonut } from "@/components/dashboard/AssetAllocationDonut";
import { AdvisorComparison } from "@/components/dashboard/AdvisorComparison";
import { EntityAllocationBar } from "@/components/dashboard/EntityAllocationBar";
import { ProductCards } from "@/components/dashboard/ProductCards";
import { RiskHeatmap } from "@/components/dashboard/RiskHeatmap";
import { TopHoldingsTable } from "@/components/dashboard/TopHoldingsTable";
import { TopMovers } from "@/components/dashboard/TopMovers";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { RiskAlerts } from "@/components/dashboard/RiskAlerts";
import { ActionRequired } from "@/components/dashboard/ActionRequired";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SG Family Wealth" },
      { name: "description", content: "Executive overview of SG Family portfolio across all entities and asset classes." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <PageTitle />
      <ExecutiveSummary />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8">
          <WealthMovementChart />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <AssetAllocationDonut />
        </div>
      </div>

      <ProductCards />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7">
          <EntityAllocationBar />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <AdvisorComparison />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <TopHoldingsTable />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <RiskHeatmap />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <RecentTransactions />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TopMovers />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-6">
          <RiskAlerts />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <ActionRequired />
        </div>
      </div>
    </div>
  );
}

function PageTitle() {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Family Office · Principal View</p>
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mt-1">Good afternoon, Suresh</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's the consolidated position across all SG family entities as of close, 06 June 2026.</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="text-[12px] font-medium px-3.5 h-9 rounded-md border border-border bg-surface hover:bg-secondary text-foreground transition-colors">
          Export PDF
        </button>
        <button className="text-[12px] font-medium px-3.5 h-9 rounded-md bg-navy text-navy-foreground hover:bg-navy/90 transition-colors">
          Schedule review
        </button>
      </div>
    </div>
  );
}
