import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/data-import")({
  head: () => ({
    meta: [
      { title: "Data Import — SG Family Wealth" },
      { name: "description", content: "Upload CAS, broker contract notes, PMS statements and bank exports." },
    ],
  }),
  component: () => <PagePlaceholder title="Data Import" description="Upload CAS, broker contract notes, PMS statements and bank exports." />,
});
