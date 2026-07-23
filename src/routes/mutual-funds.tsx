import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/mutual-funds")({
  head: () => ({
    meta: [
      { title: "Mutual Funds — SG Family Wealth" },
      {
        name: "description",
        content: "Scheme-level mutual fund holdings, category split and XIRR.",
      },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="mutual-funds"
      eyebrow="Portfolio · Funds"
      title="Mutual Funds"
      description="Every scheme held across entities, with category concentration and value-weighted XIRR."
      splitBy="category"
      overlapNote="Offshore fund-of-funds also appear under International — they are one holding counted in two lenses, not double-counted in totals."
    />
  ),
});
