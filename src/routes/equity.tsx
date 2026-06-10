import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/equity")({
  head: () => ({ meta: [
    { title: "Direct Equity — SG Family Wealth" },
    { name: "description", content: "Direct equity stock holdings across the family." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Direct Equity"
      description="Listed stocks held directly across all entities."
      filter={{ kind: "contains", fields: ["product_type", "asset_class"], keywords: ["Direct Equity", "Equity Shares"] }}
    />
  ),
});
