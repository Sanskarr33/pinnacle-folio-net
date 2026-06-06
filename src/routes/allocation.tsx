import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/allocation")({
  head: () => ({
    meta: [
      { title: "Asset Allocation — SG Family Wealth" },
      { name: "description", content: "Strategic and tactical allocation across asset classes with drift monitoring." },
    ],
  }),
  component: () => <PagePlaceholder title="Asset Allocation" description="Strategic and tactical allocation across asset classes with drift monitoring." />,
});
