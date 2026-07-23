import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/bullion")({
  head: () => ({
    meta: [
      { title: "Bullion — SG Family Wealth" },
      {
        name: "description",
        content: "Gold and silver exposure across ETFs, SGBs and physical holdings.",
      },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="bullion"
      eyebrow="Portfolio · Commodities"
      title="Gold & Silver"
      description="Bullion exposure across gold ETFs, sovereign gold bonds, silver ETFs and physical holdings."
      splitBy="product_type"
    />
  ),
});
