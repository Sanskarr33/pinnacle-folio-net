import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({
    meta: [
      { title: "Mutual Funds — SG Family Wealth" },
      { name: "description", content: "Active SIPs, schemes, fund houses, and category exposure across the family." },
    ],
  }),
  component: () => <PagePlaceholder title="Mutual Funds" description="Active SIPs, schemes, fund houses, and category exposure across the family." />,
});
