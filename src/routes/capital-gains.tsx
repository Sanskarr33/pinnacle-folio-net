import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCapitalGains, getSellTransactions } from "@/lib/data-service";
import type { SGCapitalGain, SGTransaction } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { ChevronRight, TrendingUp, TrendingDown, Receipt, DollarSign } from "lucide-react";

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
  const sign = v >= 0 ? "+" : "−";
  if (abs >= CR) return `${sign}₹${(abs / CR).toFixed(2)} Cr`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const ENTITY_ORDER = ["SG", "SMC", "SSI", "Veer", "SMO", "SSG", "Suhel"];
const ENTITY_TABS = ["All", ...ENTITY_ORDER];
const ENTITY_NAMES: Record<string, string> = {
  SG: "Sunil Goel",
  SMC: "Sandmartin Consultants Pvt Ltd",
  SSI: "Staffing Solution (India) Pvt Ltd",
  Veer: "Veer Properties Pvt Ltd",
  SMO: "Sandmartin Outsourcing Pvt Ltd",
  SSG: "Sangeeta Goel",
  Suhel: "Suhel Goel",
};

function getFYs(rows: SGCapitalGain[]): string[] {
  const set = new Set(rows.map((r) => r.financial_year).filter(Boolean) as string[]);
  return ["All", ...Array.from(set).sort().reverse()];
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

function MiniKpi({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight",
          positive === undefined
            ? "text-foreground"
            : positive
              ? "text-emerald-600"
              : "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

const SELL_HEADERS = [
  "Security", "Sale Date", "Units", "Sale Price", "Sale Value",
  "Pur Date", "Pur Price", "Cost Basis", "Gain",
];
const RIGHT_COLS = new Set(["Units", "Sale Price", "Sale Value", "Pur Price", "Cost Basis", "Gain"]);

function AssetClassSection({ ac, rows }: { ac: string; rows: SGTransaction[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-border/40 first:border-t-0">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            open && "rotate-90",
          )}
        />
        <span className="text-[12px] font-semibold">{ac}</span>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {rows.length} sale{rows.length !== 1 ? "s" : ""}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto bg-background/30">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-y border-border/30 bg-secondary/20">
                {SELL_HEADERS.map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium whitespace-nowrap",
                      RIGHT_COLS.has(h) ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gain = r.realised_gain;
                return (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{r.security_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(r.transaction_date)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.quantity != null
                        ? r.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.price != null
                        ? `₹${r.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {r.amount != null ? fmtCr(r.amount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(r.purchase_date)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.purchase_price != null
                        ? `₹${r.purchase_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.cost_of_acquisition != null ? fmtCr(r.cost_of_acquisition) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums font-medium",
                        gain == null
                          ? "text-muted-foreground"
                          : gain >= 0
                            ? "text-emerald-600"
                            : "text-destructive",
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
      )}
    </div>
  );
}

function EntityCard({
  entityCode,
  cgRows,
  sellRows,
}: {
  entityCode: string;
  cgRows: SGCapitalGain[];
  sellRows: SGTransaction[];
}) {
  const entityCg = useMemo(
    () => cgRows.filter((r) => r.entity_name === entityCode),
    [cgRows, entityCode],
  );
  const entitySell = useMemo(
    () => sellRows.filter((r) => r.entity_name === entityCode),
    [sellRows, entityCode],
  );

  const totalSale = entityCg.reduce((s, r) => s + (r.sale_amount ?? 0), 0);
  const stcg = entityCg.reduce((s, r) => s + (r.st_gain_loss ?? 0), 0);
  const ltcg = entityCg.reduce((s, r) => s + (r.lt_gain_loss ?? 0), 0);
  const netTax = entityCg.reduce((s, r) => s + (r.st_tax ?? 0) + (r.lt_tax ?? 0), 0);

  const byAssetClass = useMemo(() => {
    const map = new Map<string, SGTransaction[]>();
    for (const row of entitySell) {
      const ac = row.asset_class ?? "Other";
      if (!map.has(ac)) map.set(ac, []);
      map.get(ac)!.push(row);
    }
    return map;
  }, [entitySell]);

  if (entityCg.length === 0 && entitySell.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-bold tracking-wide">{entityCode}</span>
          <span className="text-muted-foreground">—</span>
          <span className="text-[13px] text-muted-foreground">{ENTITY_NAMES[entityCode] ?? entityCode}</span>
        </div>
        {totalSale > 0 && (
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {fmtCr(totalSale)} sold
          </span>
        )}
      </div>

      {/* KPI mini row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border">
        <MiniKpi label="Sale Proceeds" value={fmtCr(totalSale)} />
        <MiniKpi label="STCG" value={fmtAmt(stcg)} positive={stcg >= 0} />
        <MiniKpi label="LTCG" value={fmtAmt(ltcg)} positive={ltcg >= 0} />
        <MiniKpi
          label="Net Tax"
          value={netTax > 0 ? fmtCr(netTax) : "—"}
          positive={netTax > 0 ? false : undefined}
        />
      </div>

      {/* Asset class collapsible sections */}
      <div>
        {byAssetClass.size > 0 ? (
          Array.from(byAssetClass.entries()).map(([ac, rows]) => (
            <AssetClassSection key={ac} ac={ac} rows={rows} />
          ))
        ) : (
          <p className="px-5 py-4 text-[12px] text-muted-foreground">
            No SELL transactions for this period.
          </p>
        )}
      </div>
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
  const [activeEntity, setActiveEntity] = useState("All");

  const filteredCg = useMemo(
    () => (fy === "All" ? cgRows : cgRows.filter((r) => r.financial_year === fy)),
    [cgRows, fy],
  );
  const filteredSell = useMemo(
    () => (fy === "All" ? sellRows : sellRows.filter((r) => r.financial_year === fy)),
    [sellRows, fy],
  );

  const kpiCg = useMemo(
    () =>
      activeEntity === "All"
        ? filteredCg
        : filteredCg.filter((r) => r.entity_name === activeEntity),
    [filteredCg, activeEntity],
  );

  const totalSale = kpiCg.reduce((s, r) => s + (r.sale_amount ?? 0), 0);
  const totalST = kpiCg.reduce((s, r) => s + (r.st_gain_loss ?? 0), 0);
  const totalLT = kpiCg.reduce((s, r) => s + (r.lt_gain_loss ?? 0), 0);
  const totalTax = kpiCg.reduce((s, r) => s + (r.st_tax ?? 0) + (r.lt_tax ?? 0), 0);

  const selectCls =
    "text-[12px] border border-border bg-background rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";

  const entitiesToShow = activeEntity === "All" ? ENTITY_ORDER : [activeEntity];

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Portfolio · Tax
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight mt-1">Capital Gains</h1>
          <p className="text-sm text-muted-foreground mt-1">
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

      {/* Entity tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mb-1">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveEntity(tab)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap",
              activeEntity === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
            )}
          >
            {tab === "All" ? "All Entities" : tab}
          </button>
        ))}
      </div>

      {/* Aggregate KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Total Sale Proceeds" value={fmtCr(totalSale)} />
        <KpiCard icon={TrendingUp} label="STCG" value={fmtAmt(totalST)} positive={totalST >= 0} />
        <KpiCard icon={TrendingDown} label="LTCG" value={fmtAmt(totalLT)} positive={totalLT >= 0} />
        <KpiCard
          icon={Receipt}
          label="Net Tax Liability"
          value={totalTax > 0 ? fmtCr(totalTax) : "—"}
          positive={totalTax > 0 ? false : undefined}
        />
      </div>

      {/* Entity cards */}
      {isLoading ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {entitiesToShow.map((entityCode) => (
            <EntityCard
              key={`${entityCode}-${fy}`}
              entityCode={entityCode}
              cgRows={filteredCg}
              sellRows={filteredSell}
            />
          ))}
        </div>
      )}
    </div>
  );
}
