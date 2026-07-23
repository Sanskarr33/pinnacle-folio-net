import { Card } from "./Card";
import { useConcentration, useTopSecurities } from "@/hooks/use-book";
import { pct } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";

/**
 * Replaces the old sector risk heatmap, whose sector scores were hand-authored
 * constants. The source table has no sector column, so real sector exposure can't
 * be computed — but real *concentration* can, and that is the risk the heatmap
 * was gesturing at.
 */
export function ConcentrationPanel() {
  const { risk, isLoading, error, refetch } = useConcentration();
  const { slices } = useTopSecurities(6);

  // A book of N equal positions has HHI = 10000/N. Effective holdings inverts that:
  // it says how many equal-weight positions this book actually behaves like.
  const bands: Array<{ label: string; value: number; caption: string; warn: number }> = [
    {
      label: "Largest single position",
      value: risk.topSecurityPct,
      caption: risk.topSecurityName,
      warn: 10,
    },
    { label: "Top 5 positions", value: risk.top5Pct, caption: "combined share of book", warn: 35 },
    {
      label: "Top 10 positions",
      value: risk.top10Pct,
      caption: "combined share of book",
      warn: 50,
    },
    { label: "Largest entity", value: risk.topEntityPct, caption: risk.topEntityName, warn: 50 },
    {
      label: "Largest asset class",
      value: risk.topCategoryPct,
      caption: risk.topCategoryName,
      warn: 65,
    },
  ];

  return (
    <Card title="Concentration risk" subtitle="Measured across the consolidated book">
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={risk.effectiveHoldings === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[300px] w-full" />}
      >
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Metric
            label="Effective holdings"
            value={risk.effectiveHoldings.toFixed(0)}
            hint={`Behaves like ${risk.effectiveHoldings.toFixed(0)} equal-weight positions`}
          />
          <Metric
            label="HHI"
            value={risk.hhi.toFixed(0)}
            hint={
              risk.hhi < 1500
                ? "Diversified (< 1500)"
                : risk.hhi < 2500
                  ? "Moderately concentrated"
                  : "Highly concentrated (> 2500)"
            }
            tone={risk.hhi < 1500 ? "good" : risk.hhi < 2500 ? "warn" : "bad"}
          />
        </div>

        <div className="space-y-3">
          {bands.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between gap-2 text-[11.5px] mb-1">
                <span className="font-medium text-foreground truncate">{b.label}</span>
                <span
                  className={`tabular font-semibold shrink-0 ${
                    b.value >= b.warn ? "text-warning" : "text-foreground"
                  }`}
                >
                  {pct(b.value, 1)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, b.value)}%`,
                    background: b.value >= b.warn ? "var(--warning)" : "var(--chart-1)",
                  }}
                />
              </div>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground truncate" title={b.caption}>
                {b.caption}
              </p>
            </div>
          ))}
        </div>

        {slices.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Largest exposures
            </p>
            <div className="flex flex-wrap gap-1.5">
              {slices.map((s) => (
                <span
                  key={s.key}
                  title={`${s.key} — ${pct(s.pctOfBook, 2)}`}
                  className="inline-flex items-center gap-1.5 text-[10.5px] rounded-md border border-border bg-secondary/50 px-2 py-1 max-w-full"
                >
                  <span className="truncate max-w-[150px]">{s.key}</span>
                  <span className="tabular font-semibold shrink-0">{s.pctOfBook.toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-[22px] font-semibold tabular tracking-tight ${
          tone === "good"
            ? "text-success"
            : tone === "bad"
              ? "text-destructive"
              : tone === "warn"
                ? "text-warning"
                : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{hint}</p>
    </div>
  );
}
