import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/entities")({
  head: () => ({
    meta: [
      { title: "Entities — SG Family Wealth" },
      { name: "description", content: "Individual, HUF, trust, and corporate entities under the SG family umbrella." },
    ],
  }),
  component: () => <PagePlaceholder title="Entities" description="Individual, HUF, trust, and corporate entities under the SG family umbrella." />,
});
