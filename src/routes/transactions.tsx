import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/lib/data-service";
import type { SGTransaction } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowLeftRight, Hash } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — SG Family Wealth" },
      { name: "description", content: "Complete transaction history across all entities and asset classes." },
    ],
  }),
  component: TransactionsPage,
});

const CR = 10_000_000;
function fmtCr(v: number) { return `₹${(v / CR).toFixed(2)} Cr`; }
function fmtAmt(v: number) {
  const abs = Math.abs(v);
  if (abs >= CR) return `₹${(v / CR).toFixed(2)} Cr`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const ENTITIES = ["All", "SG", "SMC", "SSI", "Veer", "SSG", "SMO", "Suhel"];
const ASSET_CLASSES = ["All", "Direct Equity", "Equity MF", "Debt MF", "ETF", "PMS", "AIF"];
const TX_TYPES = ["All", "BUY", "SELL", "SWITCH_IN", "SWITCH_OUT", "DIVIDEND", "SIP"];

function getFYs(rows: SGTransaction[]): string[] {
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

function TransactionsPage() {
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
    staleTime: 5 * 60 * 1000,
  });

  const [txType, setTxType] = useState("All");
  const [assetClass, setAssetClass] = useState("All");
  const [entity, setEntity] = useState("All");
  const [fy, setFy] = useState("All");
  const [search, setSearch] = useState("");

  const fys = useMemo(() => getFYs(allRows), [allRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (txType !== "All") rows = rows.filter((r) => r.transaction_type === txType);
    if (assetClass !== "All") rows = rows.filter((r) => r.asset_class === assetClass);
    if (entity !== "All") rows = rows.filter((r) => r.entity_name?.trim() === entity);
    if (fy !== "All") rows = rows.filter((r) => r.financial_year === fy);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.security_name?.toLowerCase().includes(q) ||
          r.entity_name?.toLowerCase().includes(q) ||
          r.broker?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, txType, assetClass, entity, fy, search]);

  const buyTotal = filtered
    .filter((r) => r.transaction_type === "BUY" || r.transaction_type === "SIP" || r.transaction_type === "SWITCH_IN")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const sellTotal = filtered
    .filter((r) => r.transaction_type === "SELL" || r.transaction_type === "SWITCH_OUT")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const netFlow = buyTotal - sellTotal;

  const selectCls =
    "text-[12px] border border-border bg-background rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Operations</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Complete transaction history across all entities and asset classes.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Total buy / in" value={fmtCr(buyTotal)} />
        <KpiCard icon={TrendingDown} label="Total sell / out" value={fmtCr(sellTotal)} />
        <KpiCard
          icon={ArrowLeftRight}
          label="Net flow"
          value={fmtCr(Math.abs(netFlow))}
          positive={netFlow >= 0}
        />
        <KpiCard icon={Hash} label="Transactions" value={filtered.length.toLocaleString("en-IN")} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={txType} onChange={(e) => setTxType(e.target.value)} className={selectCls}>
          {TX_TYPES.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
        </select>
        <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)} className={selectCls}>
          {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a === "All" ? "All Asset Classes" : a}</option>)}
        </select>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className={selectCls}>
          {ENTITIES.map((e) => <option key={e} value={e}>{e === "All" ? "All Entities" : e}</option>)}
        </select>
        <select value={fy} onChange={(e) => setFy(e.target.value)} className={selectCls}>
          {fys.map((f) => <option key={f} value={f}>{f === "All" ? "All FYs" : `FY ${f}`}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search security, entity, broker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-[12px] border border-border bg-background rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[220px]"
        />
        {(txType !== "All" || assetClass !== "All" || entity !== "All" || fy !== "All" || search) && (
          <button
            onClick={() => { setTxType("All"); setAssetClass("All"); setEntity("All"); setFy("All"); setSearch(""); }}
            className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["#", "Date", "Type", "Security", "Asset Class", "Entity", "Broker / Folio", "Qty", "Price", "Amount", "Realised Gain"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium whitespace-nowrap",
                      ["Qty", "Price", "Amount", "Realised Gain"].includes(h) ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 11 }).map((__, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (i * 11 + ci) % 45}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No transactions match the current filters.
                  </td>
                </tr>
              )}

              {!isLoading &&
                filtered.map((r, i) => {
                  const isSell = r.transaction_type === "SELL" || r.transaction_type === "SWITCH_OUT";
                  const isBuy = r.transaction_type === "BUY" || r.transaction_type === "SIP" || r.transaction_type === "SWITCH_IN";
                  const gain = r.realised_gain;
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.transaction_date
                          ? new Date(r.transaction_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            isBuy
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : isSell
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {r.transaction_type ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{r.security_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.asset_class ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.entity_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-[11.5px]">
                        {[r.broker, r.folio_number].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {r.quantity != null ? r.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {r.price != null ? `₹${r.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {r.amount != null ? fmtAmt(r.amount) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          gain == null ? "text-muted-foreground" : gain >= 0 ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        {gain != null ? `${gain >= 0 ? "+" : ""}${fmtAmt(gain)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
              {filtered.length < allRows.length && ` (filtered from ${allRows.length})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
