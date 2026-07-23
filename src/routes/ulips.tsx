import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";

export const Route = createFileRoute("/ulips")({
  head: () => ({
    meta: [
      { title: "ULIPs — SG Family Wealth" },
      { name: "description", content: "Unit-linked insurance plan fund values." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="ulips"
      eyebrow="Portfolio · Insurance"
      title="Unit-Linked Insurance Plans"
      description="ULIP fund values and their return on premiums paid."
      splitBy="category"
    />
  ),
});
