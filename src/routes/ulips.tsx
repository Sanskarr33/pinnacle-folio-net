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
      description="Unit Linked Insurance Plans and their current fund values."
      filter={{ field: "product_type", values: ["ULIP", "ULIPs", "Unit Linked"] }}
    />
  ),
});
