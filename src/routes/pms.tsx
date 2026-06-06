import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/pms")({
  head: () => ({
    meta: [
      { title: "PMS — SG Family Wealth" },
      { name: "description", content: "Portfolio Management Services mandates, strategy-wise performance and fee tracking." },
    ],
  }),
  component: () => <PagePlaceholder title="PMS" description="Portfolio Management Services mandates, strategy-wise performance and fee tracking." />,
});
