import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";
import { AssetAllocationDonut } from "@/components/dashboard/AssetAllocationDonut";

export const Route = createFileRoute("/allocation")({
  head: () => ({ meta: [
    { title: "Asset Allocation — SG Family Wealth" },
    { name: "description", content: "Strategic allocation across asset classes." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Asset Allocation"
      description="Full book grouped by asset_class, sourced from sg_family_holdings_import."
      filter={{ kind: "all" }}
      extra={<div className="max-w-md"><AssetAllocationDonut /></div>}
    />
  ),
});
