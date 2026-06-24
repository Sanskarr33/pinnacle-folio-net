import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
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
import { getLastAsOnDate, invalidateCache } from "@/lib/data-service";

const EDGE_FN_URL = "https://bdjwhgwoztdocwdvzrem.supabase.co/functions/v1/update-prices";

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
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    setRefreshedAt(localStorage.getItem("prices_last_refreshed"));
  }, []);

  const { data: lastAsOnDate } = useQuery({
    queryKey: ["lastAsOnDate"],
    queryFn: getLastAsOnDate,
    staleTime: Infinity,
  });

  const asOnFormatted = lastAsOnDate
    ? (() => {
        try {
          return new Date(lastAsOnDate).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          });
        } catch {
          return lastAsOnDate;
        }
      })()
    : "10 Jun 2026";

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch(EDGE_FN_URL, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { updated?: number };
      const now = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit",
      });
      setRefreshedAt(now);
      localStorage.setItem("prices_last_refreshed", now);
      invalidateCache();
      await queryClient.invalidateQueries();
      toast.success(`Prices updated — ${json.updated ?? 0} holdings refreshed`);
    } catch {
      toast.error("Failed to refresh prices. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Family Office · Principal View</p>
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mt-1">Good afternoon, Suresh</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {`Here's the consolidated position across all SG family entities as on ${asOnFormatted}.`}
          {refreshedAt && (
            <span className="ml-1 opacity-70">{`Prices refreshed at ${refreshedAt}.`}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-[12px] font-medium px-3.5 h-9 rounded-md border border-border bg-surface hover:bg-secondary text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRefreshing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          {isRefreshing ? "Refreshing…" : "Refresh Prices"}
        </button>
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
