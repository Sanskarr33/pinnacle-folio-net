import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/aifs")({
  head: () => ({ meta: [
    { title: "AIFs — SG Family Wealth" },
    { name: "description", content: "Alternative Investment Fund commitments and NAV." },
  ]}),
  component: () => (
    <DrillDownPage
      title="AIFs"
      description="Alternative Investment Funds — Category I/II/III commitments."
      filter={{ field: "product_type", values: ["AIF", "AIFs", "Alternative Investment Fund"] }}
    />
  ),
});
