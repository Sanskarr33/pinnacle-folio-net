import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/allocation")({
  head: () => ({ meta: [
    { title: "Asset Allocation — SG Family Wealth" },
    { name: "description", content: "Strategic and tactical allocation across asset classes." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Asset Allocation"
      description="Full book sourced from sg_family_holdings_import, with totals and per-instrument detail."
      filter={{ field: "asset_class", values: ["*"] }}
    />
  ),
});
