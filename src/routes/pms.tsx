import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/pms")({
  head: () => ({
    meta: [
      { title: "PMS — SG Family Wealth" },
      {
        name: "description",
        content: "Portfolio management service mandates and their performance.",
      },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="pms"
      eyebrow="Portfolio · Managed"
      title="Portfolio Management Services"
      description="Discretionary PMS mandates, their committed capital and current valuation."
      splitBy="category"
    />
  ),
});
