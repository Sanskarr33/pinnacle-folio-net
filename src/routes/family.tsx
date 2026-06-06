import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family Overview — SG Family Wealth" },
      { name: "description", content: "Family members, entities, and consolidated relationships across the SG household." },
    ],
  }),
  component: () => <PagePlaceholder title="Family Overview" description="Family members, entities, and consolidated relationships across the SG household." />,
});
