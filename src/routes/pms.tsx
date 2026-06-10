import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/pms")({
  head: () => ({ meta: [
    { title: "PMS — SG Family Wealth" },
    { name: "description", content: "Portfolio Management Service mandates." },
  ]}),
  component: () => (
    <DrillDownPage
      title="PMS"
      description="Portfolio Management Service mandates and current values."
      filter={{ kind: "contains", fields: ["product_type", "security_name"], keywords: ["PMS"] }}
    />
  ),
});
