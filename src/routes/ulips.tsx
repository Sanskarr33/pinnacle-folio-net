import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/ulips")({
  head: () => ({
    meta: [
      { title: "ULIPs — SG Family Wealth" },
      { name: "description", content: "Insurance-linked plans, fund switches and surrender value monitoring." },
    ],
  }),
  component: () => <PagePlaceholder title="ULIPs" description="Insurance-linked plans, fund switches and surrender value monitoring." />,
});
