import { Card } from "./Card";
import { topMovers } from "@/lib/dummy-data";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function TopMovers() {
  return (
    <Card title="Top movers" subtitle="Largest intraday moves in equity book">
      <div className="space-y-4">
        <Section title="Gainers" items={topMovers.gainers} up />
        <div className="border-t border-border" />
        <Section title="Losers" items={topMovers.losers} up={false} />
      </div>
    </Card>
  );
}

function Section({ title, items, up }: { title: string; items: typeof topMovers.gainers; up: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((m) => (
          <li key={m.name} className="flex items-center justify-between text-[12px] py-1.5 px-2 -mx-2 rounded hover:bg-secondary/60 transition-colors">
            <span className="font-medium">{m.name}</span>
            <div className="flex items-center gap-3 tabular">
              <span className="text-muted-foreground text-[11px]">₹{m.value.toFixed(1)} Cr</span>
              <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-success" : "text-destructive"} min-w-[60px] justify-end`}>
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {m.change > 0 ? "+" : ""}{m.change.toFixed(2)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
