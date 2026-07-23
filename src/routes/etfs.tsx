import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETFs — SG Family Wealth" },
      { name: "description", content: "Exchange-traded fund positions across the family book." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="etfs"
      eyebrow="Portfolio · ETFs"
      title="Exchange-Traded Funds"
      description="Index and sector ETF positions. Gold and silver ETFs are grouped under Bullion."
      splitBy="category"
    />
  ),
});
