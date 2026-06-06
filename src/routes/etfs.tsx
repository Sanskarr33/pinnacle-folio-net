import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/etfs")({
  head: () => ({
    meta: [
      { title: "ETFs — SG Family Wealth" },
      { name: "description", content: "Index, gold, and thematic ETFs across Indian and international exchanges." },
    ],
  }),
  component: () => <PagePlaceholder title="ETFs" description="Index, gold, and thematic ETFs across Indian and international exchanges." />,
});
