import { createFileRoute } from "@tanstack/react-router";
import { DrillDownPage } from "@/components/DrillDownPage";

export const Route = createFileRoute("/international")({
  head: () => ({ meta: [
    { title: "International — SG Family Wealth" },
    { name: "description", content: "Offshore and international investment holdings." },
  ]}),
  component: () => (
    <DrillDownPage
      title="International"
      description="Offshore equity, funds, and other international exposure."
      filter={{ field: "asset_class", values: ["International", "Offshore", "Global", "Foreign"] }}
    />
  ),
});
