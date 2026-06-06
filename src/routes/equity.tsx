import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/equity")({
  head: () => ({
    meta: [
      { title: "Direct Equity — SG Family Wealth" },
      { name: "description", content: "Stock-level positions, sector exposure, and intraday P&L across the family book." },
    ],
  }),
  component: () => <PagePlaceholder title="Direct Equity" description="Stock-level positions, sector exposure, and intraday P&L across the family book." />,
});
