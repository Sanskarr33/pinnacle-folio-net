import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/international")({
  head: () => ({
    meta: [
      { title: "International Portfolio — SG Family Wealth" },
      { name: "description", content: "Offshore holdings via LRS, GIFT-IFSC and overseas brokerage accounts." },
    ],
  }),
  component: () => <PagePlaceholder title="International Portfolio" description="Offshore holdings via LRS, GIFT-IFSC and overseas brokerage accounts." />,
});
