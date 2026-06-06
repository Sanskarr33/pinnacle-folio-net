import { Card } from "./Card";
import { riskHeatmap } from "@/lib/dummy-data";

function color(v: number) {
  // 0 → muted; 1 → strong navy
  const alpha = Math.min(0.92, 0.08 + v * 0.85);
  return `oklch(0.34 0.12 260 / ${alpha})`;
}

const cols = [
  { key: "equity" as const, label: "Equity" },
  { key: "debt" as const, label: "Debt" },
  { key: "intl" as const, label: "Intl" },
];

export function RiskHeatmap() {
  return (
    <Card title="Sector risk heatmap" subtitle="Concentration intensity by exposure">
      <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-1 text-[11px]">
        <div />
        {cols.map((c) => (
          <div key={c.key} className="text-center text-muted-foreground font-medium uppercase tracking-wider text-[10px] pb-1">{c.label}</div>
        ))}
        {riskHeatmap.map((row) => (
          <>
            <div key={row.sector + "l"} className="text-foreground font-medium py-2 pr-2 truncate">{row.sector}</div>
            {cols.map((c) => (
              <div
                key={row.sector + c.key}
                className="rounded-md h-9 flex items-center justify-center text-[11px] font-semibold tabular text-white relative group transition-transform hover:scale-[1.04]"
                style={{ background: color(row[c.key]) }}
                title={`${row.sector} ${c.label} ${(row[c.key] * 100).toFixed(0)}%`}
              >
                {(row[c.key] * 100).toFixed(0)}
              </div>
            ))}
          </>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>Low concentration</span>
        <div className="flex h-2 w-32 rounded-full overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1" style={{ background: color((i + 1) / 10) }} />
          ))}
        </div>
        <span>High</span>
      </div>
    </Card>
  );
}
