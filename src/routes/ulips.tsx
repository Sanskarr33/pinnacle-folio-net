import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/ulips")({
  head: () => ({ meta: [
    { title: "ULIPs — SG Family Wealth" },
    { name: "description", content: "Unit Linked Insurance Plans across family members." },
  ]}),
  component: () => (
    <DrillDownPage
      title="ULIPs"
      description="Unit Linked Insurance Plans and current fund values."
      filter={{ kind: "contains", fields: ["product_type", "security_name"], keywords: ["ULIP"] }}
    />
  ),
});
