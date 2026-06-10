import { useQuery } from "@tanstack/react-query";
import { getAllHoldings, getDetailedHoldings } from "@/lib/data-service";
import { inr, pct } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import type { SGHoldingRow } from "@/lib/types";
import { TrendingUp, TrendingDown, Wallet, PieChart, Layers, Database } from "lucide-react";

type FieldName = "asset_class" | "product_type" | "security_name";

export type DrillFilter =
  | { kind: "all" }
  | { kind: "contains"; fields: FieldName[]; keywords: string[] };

export function matchesFilter(r: SGHoldingRow, filter: DrillFilter): boolean {
  if (filter.kind === "all") return true;
  const kws = filter.keywords.map((k) => k.toLowerCase());
  return filter.fields.some((f) => {
    const v = (r[f] ?? "").toString().toLowerCase();
    return kws.some((k) => v.includes(k));
  });
}

export function DrillDownPage({
  title,
  description,
  filter,
  extra,
  source = "detailed",
}: {
  title: string;
  description: string;
  filter: DrillFilter;
  extra?: React.ReactNode;
  /** "detailed" → portfolio_detailed_holdings (default for product pages).
   *  "summary"  → sg_family_holdings_import (executive summary). */
  source?: "detailed" | "summary";
}) {
  const { data: detailed, isLoading: detailedLoading } = useQuery({
    queryKey: ["detailedHoldings"],
    queryFn: getDetailedHoldings,
    staleTime: 5 * 60 * 1000,
    enabled: source === "detailed",
  });
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["allHoldings"],
    queryFn: getAllHoldings,
    staleTime: 5 * 60 * 1000,
    enabled: source === "summary" || (source === "detailed" && detailed === null),
  });

  const isLoading = source === "detailed" ? detailedLoading : summaryLoading;

  // Decide which dataset feeds the page.
  //  - source="summary": always use summary table.
  //  - source="detailed": use detailed rows when available; if Supabase fetch
  //    returned null (connection failure / not configured), fall back to summary.
  //    If detailed returned [] (live but empty), DO NOT fall back — show empty state.
  const detailedEmptyLive = source === "detailed" && Array.isArray(detailed) && detailed.length === 0;
  const all: SGHoldingRow[] =
    source === "summary"
      ? (summary ?? [])
      : Array.isArray(detailed) && detailed.length > 0
        ? detailed
        : detailed === null
          ? (summary ?? [])
          : []; // detailed === [] → empty live table

  const rows = all.filter((r) => matchesFilter(r, filter));


  const totalAll = (all ?? []).reduce((s, r) => s + (r.current_value ?? 0), 0);
  const current = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);
  const invested = rows.reduce((s, r) => s + (r.invested_value ?? 0), 0);
  const gain = rows.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0);
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  const allocPct = totalAll > 0 ? (current / totalAll) * 100 : 0;

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
      </div>

      {detailedEmptyLive ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 flex flex-col items-center justify-center text-center shadow-elegant">
          <div className="h-12 w-12 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
            <Database className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold">Detailed holdings data not imported yet</h3>
          <p className="mt-1.5 text-[13px] text-muted-foreground max-w-md">
            Once rows are loaded into <code className="text-foreground">portfolio_detailed_holdings</code>,
            instrument-level KPIs and the holdings table for this module will populate automatically.
          </p>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi icon={Wallet}     label="Current value"   value={inr(current, { compact: true })} />
        <Kpi icon={Layers}     label="Invested value"  value={inr(invested, { compact: true })} />
        <Kpi icon={gain >= 0 ? TrendingUp : TrendingDown} label="Unrealised P/L" value={inr(gain, { compact: true })} positive={gain >= 0} />
        <Kpi icon={TrendingUp} label="Gain %"          value={pct(gainPct)} positive={gainPct >= 0} />
        <Kpi icon={PieChart}   label="Allocation %"    value={`${allocPct.toFixed(2)}%`} />
      </div>

      {extra}


      <Card title="Holdings" subtitle={`${rows.length} instrument${rows.length === 1 ? "" : "s"} matching this filter`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading holdings…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No matching holdings in sg_family_holdings_import.</div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                  <th className="text-left font-semibold px-5 py-2.5">#</th>
                  <th className="text-left font-semibold py-2.5">Instrument</th>
                  <th className="text-left font-semibold py-2.5">Asset class</th>
                  <th className="text-left font-semibold py-2.5">Product</th>
                  <th className="text-left font-semibold py-2.5">Entity</th>
                  <th className="text-right font-semibold py-2.5">Invested</th>
                  <th className="text-right font-semibold py-2.5">Current</th>
                  <th className="text-right font-semibold px-5 py-2.5">Gain</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
                  .map((r, i) => {
                    const inv = r.invested_value ?? 0;
                    const un = r.unrealised_gain ?? 0;
                    const gp = r.gain_pct != null ? r.gain_pct : inv > 0 ? (un / inv) * 100 : 0;
                    return (
                      <tr key={`${r.security_name}-${i}`} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                        <td className="px-5 py-3 text-muted-foreground tabular">{String(i + 1).padStart(2, "0")}</td>
                        <td className="py-3 font-medium text-foreground">{r.security_name}</td>
                        <td className="py-3 text-muted-foreground">{r.asset_class}</td>
                        <td className="py-3 text-muted-foreground">{r.product_type}</td>
                        <td className="py-3 text-muted-foreground">{r.entity_name ?? "SG Family Consolidated"}</td>
                        <td className="py-3 text-right tabular">{inr(inv, { compact: true })}</td>
                        <td className="py-3 text-right font-semibold tabular">{inr(r.current_value ?? 0, { compact: true })}</td>
                        <td className={`px-5 py-3 text-right font-semibold tabular ${gp >= 0 ? "text-success" : "text-destructive"}`}>
                          {gp >= 0 ? "+" : ""}{gp.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}
    </div>

  );
}

function Kpi({
  icon: Icon, label, value, positive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
      </div>
      <p className={`mt-2.5 text-[20px] font-semibold tabular tracking-tight ${
        positive === undefined ? "text-foreground" : positive ? "text-success" : "text-destructive"
      }`}>{value}</p>
    </div>
  );
}
