import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/exit-load")({
  head: () => ({
    meta: [
      { title: "Exit Load Tracker — SG Family Wealth" },
      { name: "description", content: "Lots approaching exit-load expiry across MFs, PMS and AIFs." },
    ],
  }),
  component: () => (
    <DrillDownPage
      title="Exit Load Tracker"
      description="Lots approaching exit-load expiry across MFs, PMS and AIFs, sourced from portfolio_detailed_holdings."
      filter={{
        kind: "contains",
        fields: ["product_type", "asset_class", "security_name"],
        keywords: ["Mutual Fund", "MF", "PMS", "AIF"],
      }}
    />
  ),
});
