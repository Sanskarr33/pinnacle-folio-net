import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getConsolidatedHoldings } from "@/lib/data-service";
import { HoldingsKpiBar } from "@/components/holdings/HoldingsKpiBar";
import { ExpandableHoldingsTable } from "@/components/holdings/ExpandableHoldingsTable";

const ASSET_CLASSES = "ETF";
const ENTITIES = ["All", "SG", "SMC", "SSI", "Veer", "SSG", "SMO", "Suhel"];

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETFs — SG Family Wealth" },
      { name: "description", content: "Index, gold, and thematic ETFs across Indian and international exchanges." },
    ],
  }),
  component: EtfsPage,
});

function EtfsPage() {
  const [entity, setEntity] = useState("All");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["consolidatedHoldings", ASSET_CLASSES, entity],
    queryFn: () => getConsolidatedHoldings(ASSET_CLASSES, entity === "All" ? undefined : entity),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Portfolio · ETFs
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight mt-1">ETFs</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Index, gold, and thematic ETFs across Indian and international exchanges.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Entity</span>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="text-[12px] border border-border bg-background rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {ENTITIES.map((e) => (
              <option key={e} value={e}>{e === "All" ? "All Entities" : e}</option>
            ))}
          </select>
        </div>
      </div>
      <HoldingsKpiBar rows={rows} isLoading={isLoading} />
      <ExpandableHoldingsTable
        rows={rows}
        isLoading={isLoading}
        assetClasses={ASSET_CLASSES}
        emptyMessage="No ETF holdings found for this filter."
      />
    </div>
  );
}
