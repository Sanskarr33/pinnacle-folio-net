import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/advisor-review")({
  head: () => ({
    meta: [
      { title: "Advisor Review — SG Family Wealth" },
      { name: "description", content: "Mandate-wise performance, fees, and adherence to investment policy." },
    ],
  }),
  component: () => <PagePlaceholder title="Advisor Review" description="Mandate-wise performance, fees, and adherence to investment policy." />,
});
