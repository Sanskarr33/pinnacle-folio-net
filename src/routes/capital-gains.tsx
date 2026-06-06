import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/capital-gains")({
  head: () => ({
    meta: [
      { title: "Capital Gains — SG Family Wealth" },
      { name: "description", content: "Realised STCG/LTCG by entity for tax filing, with grandfathering applied." },
    ],
  }),
  component: () => <PagePlaceholder title="Capital Gains" description="Realised STCG/LTCG by entity for tax filing, with grandfathering applied." />,
});
