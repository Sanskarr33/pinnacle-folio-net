import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/aifs")({
  head: () => ({
    meta: [
      { title: "AIFs — SG Family Wealth" },
      { name: "description", content: "Cat I/II/III alternative investments with capital calls and IRR tracking." },
    ],
  }),
  component: () => <PagePlaceholder title="AIFs" description="Cat I/II/III alternative investments with capital calls and IRR tracking." />,
});
