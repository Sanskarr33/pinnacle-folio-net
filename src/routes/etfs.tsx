import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/etfs")({
  head: () => ({ meta: [
    { title: "ETFs — SG Family Wealth" },
    { name: "description", content: "Exchange-traded funds across Indian and international exchanges." },
  ]}),
  component: () => (
    <DrillDownPage
      title="ETFs"
      description="Index, gold, and thematic ETFs filtered from sg_family_holdings_import."
      filter={{ kind: "contains", fields: ["product_type", "security_name"], keywords: ["ETF"] }}
    />
  ),
});
