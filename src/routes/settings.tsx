import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SG Family Wealth" },
      { name: "description", content: "Preferences, user access, notifications and integrations." },
    ],
  }),
  component: () => <PagePlaceholder title="Settings" description="Preferences, user access, notifications and integrations." />,
});
