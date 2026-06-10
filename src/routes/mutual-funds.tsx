import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({ meta: [
    { title: "Mutual Funds — SG Family Wealth" },
    { name: "description", content: "Mutual fund holdings across the family." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Mutual Funds"
      description="All mutual fund holdings filtered from sg_family_holdings_import."
      filter={{ field: "product_type", values: ["Mutual Fund", "Mutual Funds", "MF"] }}
    />
  ),
});
