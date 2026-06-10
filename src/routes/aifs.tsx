import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/aifs")({
  head: () => ({ meta: [
    { title: "AIFs — SG Family Wealth" },
    { name: "description", content: "Alternative Investment Funds." },
  ]}),
  component: () => (
    <DrillDownPage
      title="AIFs"
      description="Alternative Investment Funds — Category I/II/III commitments."
      filter={{ kind: "contains", fields: ["product_type", "security_name"], keywords: ["AIF"] }}
    />
  ),
});
