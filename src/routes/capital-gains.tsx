import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/capital-gains")({
  head: () => ({
    meta: [
      { title: "Capital Gains — SG Family Wealth" },
      { name: "description", content: "Realised STCG/LTCG by entity for tax filing, with grandfathering applied." },
    ],
  }),
  component: () => (
    <DrillDownPage
      title="Capital Gains"
      description="Realised STCG/LTCG by entity, sourced from portfolio_detailed_holdings."
      filter={{ kind: "all" }}
    />
  ),
});
