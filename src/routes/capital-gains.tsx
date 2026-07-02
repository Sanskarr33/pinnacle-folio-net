import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCapitalGains, getSellTransactions } from "@/lib/data-service";
import type { SGCapitalGain, SGTransaction } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Receipt, Landmark } from "lucide-react";

export const Route = createFileRoute("/capital-gains")({
  head: () => ({
    meta: [
      { title: "Capital Gains — SG Family Wealth" },
      { name: "description", content: "Realised STCG/LTCG by entity for tax filing." },
    ],
  }),
  component: CapitalGainsPage,
});

const CR = 10_000_000;
function fmtCr(v: number) { return `₹${(v / CR).toFixed(2)} Cr`; }
function fmtAmt(v: number) {
  const abs = Math.abs(v);
  if (abs >= CR) return `${v >= 0 ? "+" : "−"}₹${(Math.abs(v) / CR).toFixed(2)} Cr`;
  return `${v >= 0 ? "+" : "−"}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getFYs(rows: SGCapitalGain[]): string[] {
  const fys = new Set(rows.map((r) => r.financial_year).filter(Boolean) as string[]);
  return ["All", ...Array.from(fys).sort().reverse()];
}

function KpiCard({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "mt-2.5 text-[20px] font-semibold tabular-nums tracking-tight",
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-emerald-600"
              : "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CapitalGainsPage() {
  const { data: cgRows = [], isLoading: cgLoading } = useQuery({
    queryKey: ["capitalGains"],
    queryFn: getCapitalGains,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sellRows = [], isLoading: sellLoading } = useQuery({
    queryKey: ["sellTransactions"],
    queryFn: getSellTransactions,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = cgLoading || sellLoading;

  const fys = useMemo(() => getFYs(cgRows), [cgRows]);
  const [fy, setFy] = useState("All");

  const filteredCg = useMemo(
    () => (fy === "All" ? cgRows : cgRows.filter((r) => r.financial_year === fy)),
    [cgRows, fy],
  );

  const filteredSell = useMemo(
    () => (fy === "All" ? sellRows : sellRows.filter((r) => r.financial_year === fy)),
    [sellRows, fy],
  );

  const totalST = filteredCg.reduce((s, r) => s + (r.st_gain_loss ?? 0), 0);
  const totalLT = filteredCg.reduce((s, r) => s + (r.lt_gain_loss ?? 0), 0);
  const totalSTTax = filteredCg.reduce((s, r) => s + (r.st_tax ?? 0), 0);
  const totalLTTax = filteredCg.reduce((s, r) => s + (r.lt_tax ?? 0), 0);

  const selectCls =
    "text-[12px] border border-border bg-background rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Portfolio · Tax
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight mt-1">Capital Gains</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Realised STCG and LTCG by entity, sourced from sg_capital_gains and SELL transactions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">FY</span>
          <select value={fy} onChange={(e) => setFy(e.target.value)} className={selectCls}>
            {fys.map((f) => (
              <option key={f} value={f}>{f === "All" ? "All Years" : `FY ${f}`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="STCG" value={fmtCr(Math.abs(totalST))} positive={totalST >= 0} />
        <KpiCard icon={TrendingDown} label="LTCG" value={fmtCr(Math.abs(totalLT))} positive={totalLT >= 0} />
        <KpiCard icon={Receipt} label="ST Tax" value={fmtCr(totalSTTax)} positive={totalSTTax <= 0} />
        <KpiCard icon={Landmark} label="LT Tax" value={fmtCr(totalLTTax)} positive={totalLTTax <= 0} />
      </div>

      {/* Summary table by entity/FY */}
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[13px] font-semibold">Gains Summary by Entity</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">From sg_capital_gains table</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["#", "FY", "Entity", "Asset Class", "Sale Amount", "STCG", "LTCG", "ST Tax", "LT Tax"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium whitespace-nowrap",
                      ["Sale Amount", "STCG", "LTCG", "ST Tax", "LT Tax"].includes(h) ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((__, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (i * 9 + ci) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filteredCg.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No capital gains data for this period.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filteredCg.map((r, i) => {
                  const st = r.st_gain_loss ?? 0;
                  const lt = r.lt_gain_loss ?? 0;
                  const stTax = r.st_tax ?? 0;
                  const ltTax = r.lt_tax ?? 0;
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.financial_year ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{r.entity_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.asset_class ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.sale_amount != null ? fmtCr(r.sale_amount) : "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-medium", st >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {fmtAmt(st)}
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-medium", lt >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {fmtAmt(lt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {stTax > 0 ? `₹${stTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {ltTax > 0 ? `₹${ltTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredCg.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
            <span className="text-[11px] text-muted-foreground">{filteredCg.length} row{filteredCg.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* SELL transactions detail */}
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[13px] font-semibold">SELL Transactions Detail</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Individual sale transactions with cost basis and realised gain</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["#", "Date", "Security", "Entity", "FY", "Qty", "Sale Price", "Amount", "Cost Basis", "Realised Gain"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium whitespace-nowrap",
                      ["Qty", "Sale Price", "Amount", "Cost Basis", "Realised Gain"].includes(h) ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 10 }).map((__, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (i * 10 + ci) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && filteredSell.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No SELL transactions for this period.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filteredSell.map((r: SGTransaction, i) => {
                  const gain = r.realised_gain;
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.transaction_date
                          ? new Date(r.transaction_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[180px] truncate">{r.security_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.entity_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.financial_year ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {r.quantity != null ? r.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {r.price != null ? `₹${r.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {r.amount != null ? fmtCr(r.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {r.cost_of_acquisition != null ? fmtCr(r.cost_of_acquisition) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          gain == null ? "text-muted-foreground" : gain >= 0 ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {gain != null ? fmtAmt(gain) : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredSell.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
            <span className="text-[11px] text-muted-foreground">{filteredSell.length} SELL transaction{filteredSell.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}
