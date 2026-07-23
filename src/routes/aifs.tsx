import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/aifs")({
  head: () => ({
    meta: [
      { title: "AIFs — SG Family Wealth" },
      { name: "description", content: "Alternative investment fund commitments and valuations." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="aifs"
      eyebrow="Portfolio · Alternatives"
      title="Alternative Investment Funds"
      description="Category I, II and III AIF commitments held across family entities."
      splitBy="category"
    />
  ),
});
