import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/equity")({
  head: () => ({
    meta: [
      { title: "Direct Equity — SG Family Wealth" },
      { name: "description", content: "Stock-level positions across the family book." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="equity"
      eyebrow="Portfolio · Equity"
      title="Direct Equity"
      description="Listed and unlisted stock positions held directly across all family entities."
      splitBy="category"
    />
  ),
});
