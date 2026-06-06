import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SG Family Wealth" },
      { name: "description", content: "Custom reports, statements and quarterly principal review packs." },
    ],
  }),
  component: () => <PagePlaceholder title="Reports" description="Custom reports, statements and quarterly principal review packs." />,
});
