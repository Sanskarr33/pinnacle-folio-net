import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — SG Family Wealth" },
      { name: "description", content: "Complete trade & cashflow ledger across entities, broker accounts and demats." },
    ],
  }),
  component: () => <PagePlaceholder title="Transactions" description="Complete trade & cashflow ledger across entities, broker accounts and demats." />,
});
