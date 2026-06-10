import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({ meta: [
    { title: "Bonds & FDs — SG Family Wealth" },
    { name: "description", content: "Debt and other fixed-income style investments." },
  ]}),
  component: () => (
    <DrillDownPage
      title="Bonds & FDs"
      description="Debt and other investments: bonds, FDs, REITs, PPF and NPS."
      filter={{
        kind: "contains",
        fields: ["product_type", "security_name"],
        keywords: ["Bond", "FD", "Fixed Deposit", "Debt Bonds", "REIT", "PPF", "NPS"],
      }}
    />
  ),
});
