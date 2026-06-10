import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({ meta: [
    { title: "Bonds & FDs — SG Family Wealth" },
    { name: "description", content: "Fixed income holdings: bonds, NCDs, and fixed deposits." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Bonds & FDs"
      description="Fixed income exposure across bonds, NCDs and term deposits."
      filter={{ field: "product_type", values: ["Bond", "Bonds", "FD", "Fixed Deposit", "NCD", "Bonds & FD", "Bonds & FDs"] }}
    />
  ),
});
