import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/exit-load")({
  head: () => ({
    meta: [
      { title: "Exit Load Tracker — SG Family Wealth" },
      { name: "description", content: "Lots approaching exit-load expiry across MFs, PMS and AIFs." },
    ],
  }),
  component: () => <PagePlaceholder title="Exit Load Tracker" description="Lots approaching exit-load expiry across MFs, PMS and AIFs." />,
});
