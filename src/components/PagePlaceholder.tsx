import { Construction } from "lucide-react";

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
      </div>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 flex flex-col items-center justify-center text-center shadow-elegant">
        <div className="h-12 w-12 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
          <Construction className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-[15px] font-semibold">Module under construction</h3>
        <p className="mt-1.5 text-[13px] text-muted-foreground max-w-md">
          Detailed reporting, holdings drill-down and exports for this module will appear here once data ingestion is configured.
        </p>
      </div>
    </div>
  );
}
