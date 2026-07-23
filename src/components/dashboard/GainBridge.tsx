import { Card } from "./Card";
import { useAssetAllocation, useTotals } from "@/hooks/use-book";
import { pctSigned, CR } from "@/lib/format";
import { Panel, Skeleton } from "@/components/common/States";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Slice } from "@/lib/types";
import { useUnits } from "@/lib/units";

/**
 * Replaces the old "wealth movement" time series.
 *
 * The book is a SINGLE dated snapshot — there is no month-by-month history in the
 * source table, so a trend line would have to be invented. What the data does
 * support is the cost-to-value bridge: how much was put in per asset class and what
 * it is worth now. That answers "where did the gain come from" with real numbers.
 */
export function GainBridge() {
  const { money, moneySigned } = useUnits();
  const { slices, isLoading, error, refetch } = useAssetAllocation();
  const { totals } = useTotals();

  const data = slices.map((s) => ({
    name: s.key.replace(/ Mutual Funds$/, " MF"),
    invested: +(s.invested / CR).toFixed(2),
    gain: +(s.gain / CR).toFixed(2),
    current: s.current,
    gainPct: s.gainPct,
    count: s.count,
  }));

  return (
    <Card
      title="Cost to value bridge"
      subtitle="Invested capital and unrealised gain by asset class · ₹ Cr"
      right={
        totals.investedValue > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total gain</p>
            <p className="text-[15px] font-semibold tabular text-success">
              {moneySigned(totals.unrealisedGain)}
            </p>
          </div>
        )
      }
    >
      <Panel
        isLoading={isLoading}
        error={error}
        isEmpty={data.length === 0}
        onRetry={() => refetch()}
        skeleton={<Skeleton className="h-[300px] w-full" />}
      >
        <div className="h-[300px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={58}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₹${v}`}
                width={52}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                formatter={(v: number, n: string) => [
                  `₹${v.toFixed(2)} Cr`,
                  n === "invested" ? "Invested" : "Unrealised gain",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                formatter={(v) => (v === "invested" ? "Invested" : "Unrealised gain")}
              />
              {/* Stacked so each bar's full height is current value. */}
              <Bar
                isAnimationActive={false}
                dataKey="invested"
                stackId="v"
                fill="var(--chart-1)"
                radius={[0, 0, 3, 3]}
                maxBarSize={54}
              />
              <Bar
                isAnimationActive={false}
                dataKey="gain"
                stackId="v"
                fill="var(--chart-2)"
                radius={[3, 3, 0, 0]}
                maxBarSize={54}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px]">
          <Mini label="Invested" value={money(totals.investedValue)} />
          <Mini label="Current value" value={money(totals.currentValue)} />
          <Mini
            label="Unrealised gain"
            value={moneySigned(totals.unrealisedGain)}
            positive={totals.unrealisedGain >= 0}
          />
          <Mini
            label="Return on cost"
            value={pctSigned(totals.unrealisedGainPct)}
            positive={totals.unrealisedGainPct >= 0}
          />
        </div>

        <BestWorst slices={slices} />
      </Panel>
    </Card>
  );
}

function BestWorst({ slices }: { slices: Slice[] }) {
  const { money } = useUnits();
  const ranked = slices.filter((s) => s.invested > 0).sort((a, b) => b.gainPct - a.gainPct);
  if (ranked.length < 2) return null;
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  return (
    <p className="mt-3 text-[11.5px] text-muted-foreground leading-relaxed">
      <span className="font-medium text-foreground">{best.key}</span> is the strongest class at{" "}
      <span className="text-success font-medium tabular">{pctSigned(best.gainPct)}</span> on{" "}
      {money(best.invested)} invested;{" "}
      <span className="font-medium text-foreground">{worst.key}</span> the weakest at{" "}
      <span
        className={
          worst.gainPct >= 0
            ? "text-success font-medium tabular"
            : "text-destructive font-medium tabular"
        }
      >
        {pctSigned(worst.gainPct)}
      </span>
      .
    </p>
  );
}

function Mini({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground uppercase tracking-wider text-[10px] truncate">{label}</p>
      <p
        className={`mt-1 text-[14px] font-semibold tabular truncate ${
          positive === true
            ? "text-success"
            : positive === false
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
