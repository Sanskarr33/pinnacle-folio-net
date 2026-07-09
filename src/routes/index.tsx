import { useState, useEffect, useCallback } from "react";
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
import { getLastAsOnDate } from "@/lib/data-service";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const AUTO_REFRESH_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

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

  const handleRefresh = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      console.log("[Refresh] Calling edge function via supabase client...");

      const { data, error } = await supabase.functions.invoke("update-prices", {
        body: {},
      });

      console.log("[Refresh] data:", data, "error:", error);

      if (error) throw error;

      await queryClient.invalidateQueries();

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
      localStorage.setItem("prices_last_refreshed", timeStr);
      localStorage.setItem("prices_last_refreshed_ts", String(now.getTime()));
      setLastRefreshed(timeStr);

      if (!silent) {
        toast.success(`Prices updated — ${data?.updated ?? 0} holdings refreshed`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Refresh] Error:", msg);
      if (!silent) toast.error(`Failed to refresh: ${msg}`);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [queryClient]);

  // On mount: restore last-refresh label + auto-refresh if > 8 hours stale
  useEffect(() => {
    const stored = localStorage.getItem("prices_last_refreshed");
    setLastRefreshed(stored);

    const lastTs = parseInt(localStorage.getItem("prices_last_refreshed_ts") ?? "0", 10);
    if (Date.now() - lastTs > AUTO_REFRESH_INTERVAL_MS) {
      console.log("[refresh] auto-refreshing stale prices (>8 h since last update)");
      handleRefresh(true); // silent=true: no toast for auto-refresh
    }
  }, [handleRefresh]);

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Family Office · Principal View</p>
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mt-1">{`Good afternoon, ${firstName}`}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {`Here's the consolidated position across all SG family entities as on ${asOnFormatted}.`}
          {isRefreshing
            ? <span className="ml-1 opacity-70"> Updating prices…</span>
            : lastRefreshed && <span className="ml-1 opacity-70">{`Prices refreshed at ${lastRefreshed}.`}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleRefresh(false)}
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
