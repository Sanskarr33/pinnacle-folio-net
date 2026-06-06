import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/bonds-fds")({
  head: () => ({
    meta: [
      { title: "Bonds & FDs — SG Family Wealth" },
      { name: "description", content: "Fixed income ladder including corporate bonds, G-secs and bank deposits." },
    ],
  }),
  component: () => <PagePlaceholder title="Bonds & FDs" description="Fixed income ladder including corporate bonds, G-secs and bank deposits." />,
});
