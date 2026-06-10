import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDetailedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { HoldingsTable, COLS_EXIT_LOAD } from "@/components/holdings/HoldingsTable";

export const Route = createFileRoute("/exit-load")({
  head: () => ({
    meta: [
      { title: "Exit Load Tracker — SG Family Wealth" },
      { name: "description", content: "Lots approaching exit-load expiry across MFs, PMS and AIFs." },
    ],
  }),
  component: ExitLoadPage,
});

// Exit load values considered "no exit load" — filtered out
const NO_LOAD_VALUES = new Set([
  "", "nil", "none", "0", "0%", "0.0%", "0.00%",
  "na", "n/a", "not applicable", "-", "—",
]);

function ExitLoadPage() {
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
  });

  const rows = all.filter((r) => {
    const el = (r.exit_load ?? "").trim().toLowerCase();
    return !NO_LOAD_VALUES.has(el);
  });

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Portfolio · Exit Load
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Exit Load Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Lots with active exit loads across MFs, PMS and AIFs — review before redeeming.
        </p>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <HoldingsTable
        rows={rows}
        columns={COLS_EXIT_LOAD}
        isLoading={isLoading}
        emptyMessage="No holdings with active exit loads. All positions are freely redeemable."
      />
    </div>
  );
}
