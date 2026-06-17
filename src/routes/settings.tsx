import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/dashboard/Card";
import { User, Database, Bell, Info } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SG Family Wealth" },
      { name: "description", content: "Preferences, data source and notification configuration." },
    ],
  }),
  component: SettingsPage,
});

type Row = { k: string; v: string };

function SettingsCard({ icon: Icon, title, rows }: { icon: React.ComponentType<{ className?: string }>; title: string; rows: Row[] }) {
  return (
    <Card title={title} right={<Icon className="h-4 w-4 text-muted-foreground" />}>
      <dl className="divide-y divide-border/60">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between py-2.5 gap-4">
            <dt className="text-[12px] text-muted-foreground">{r.k}</dt>
            <dd className="text-[12.5px] font-medium text-foreground text-right tabular">{r.v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SettingsPage() {
  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Principal profile, data source, notification rules and platform metadata.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SettingsCard
          icon={User}
          title="Principal"
          rows={[
            { k: "Name", v: "Suresh Gupta" },
            { k: "Role", v: "Principal" },
            { k: "Access", v: "Full Owner" },
          ]}
        />
        <SettingsCard
          icon={Database}
          title="Portfolio"
          rows={[
            { k: "Data source", v: "sg_family_holdings_import" },
            { k: "Supabase project", v: "bdjwhgwoztdocwdvzrem" },
            { k: "Currency", v: "₹ INR" },
            { k: "Display unit", v: "Crore" },
          ]}
        />
        <SettingsCard
          icon={Bell}
          title="Notifications"
          rows={[
            { k: "AUM threshold", v: "±5% in a week" },
            { k: "Exit load reminder", v: "30 days" },
            { k: "Quarterly review", v: "Enabled · Jul 2026" },
          ]}
        />
        <SettingsCard
          icon={Info}
          title="About"
          rows={[
            { k: "Platform", v: "SG Family Wealth Command Centre" },
            { k: "Data as on", v: "15 June 2026" },
            { k: "Cache TTL", v: "5 minutes" },
            { k: "Holdings", v: "156 positions · ₹320.09 Cr" },
          ]}
        />
      </div>
    </div>
  );
}
