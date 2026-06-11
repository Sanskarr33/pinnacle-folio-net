import { createFileRoute } from "@tanstack/react-router";
import { EntityGroupPage } from "@/components/EntityGroupPage";

export const Route = createFileRoute("/family")({
  head: () => ({ meta: [
    { title: "Family Overview — SG Family Wealth" },
    { name: "description", content: "Entity-wise portfolio summary across the SG family." },
  ]}),
  component: () => (
    <EntityGroupPage
      title="Family Overview"
      description="Consolidated position across every family entity, sourced live from sg_family_holdings_import."
    />
  ),
});
