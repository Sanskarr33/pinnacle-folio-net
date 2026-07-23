import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/international")({
  head: () => ({
    meta: [
      { title: "International — SG Family Wealth" },
      { name: "description", content: "Offshore and globally-invested exposure." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="international"
      eyebrow="Portfolio · Global"
      title="International Exposure"
      description="Offshore funds and globally-invested schemes, identified by scheme mandate."
      splitBy="category"
      overlapNote="These are a lens over the book, not a separate vehicle — most are feeder or fund-of-fund schemes that also appear under Mutual Funds."
    />
  ),
});
