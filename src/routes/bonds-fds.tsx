import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/holdings/ProductPage";
import { COLS_BONDS_GRID } from "@/components/grid/columns";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({
    meta: [
      { title: "Bonds & Fixed Income — SG Family Wealth" },
      { name: "description", content: "Bonds, REITs, debt funds and fixed deposits." },
    ],
  }),
  component: () => (
    <ProductPage
      productKey="bonds-fds"
      eyebrow="Portfolio · Fixed Income"
      title="Bonds & Fixed Income"
      description="Debt instruments, REITs and debt mutual funds across the family book."
      columns={COLS_BONDS_GRID}
      splitBy="product_type"
    />
  ),
});
