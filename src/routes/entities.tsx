import { createFileRoute } from "@tanstack/react-router";
import { EntityGroupPage } from "@/components/EntityGroupPage";

export const Route = createFileRoute("/entities")({
  head: () => ({ meta: [
    { title: "Entities — SG Family Wealth" },
    { name: "description", content: "Individual, HUF, trust, and corporate entities under the SG family umbrella." },
  ]}),
  component: () => (
    <EntityGroupPage
      title="Entities"
      description="Individual, HUF, trust, and corporate entities — current value, invested, gain and allocation."
    />
  ),
});
