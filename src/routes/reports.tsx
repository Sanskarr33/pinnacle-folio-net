import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllHoldings, getFamilyKpis } from "@/lib/data-service";
import { pct } from "@/lib/dummy-data";
import { Card } from "@/components/dashboard/Card";
import { FileText, Download, PieChart, Receipt, Briefcase } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSortableTable, SortableHeader } from "@/hooks/useSortableTable";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SG Family Wealth" },
      { name: "description", content: "Custom reports, statements and quarterly principal review packs." },
    ],
  }),
  component: ReportsPage,
});

const REPORTS = [
  { icon: Briefcase, title: "Portfolio Snapshot", desc: "Single-page overview of every position with valuations as on report date." },
  { icon: FileText, title: "Family Office Summary", desc: "Entity-wise AUM, allocation, P/L and advisor mandate review." },
  { icon: PieChart, title: "Asset Allocation Report", desc: "Asset class & product mix vs. target IPS bands with drift analysis." },
  { icon: Receipt, title: "Capital Gains Statement", desc: "Realised & unrealised gains, holding period, indexation working." },
];

const TH = "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-2.5 cursor-pointer select-none group whitespace-nowrap";

function ReportsPage() {
  const { formatAmount } = useCurrency();
  const { data: holdings } = useQuery({ queryKey: ["allHoldings"], queryFn: getAllHoldings, staleTime: 5 * 60 * 1000 });
  const { data: kpis } = useQuery({ queryKey: ["familyKpis"], queryFn: getFamilyKpis, staleTime: 5 * 60 * 1000 });
  const rows = holdings ?? [];
  const totalCurrent = rows.reduce((s, r) => s + (r.current_value ?? 0), 0);

  type Bucket = { name: string; invested: number; current: number; gain: number };
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const k = r.asset_class?.trim() || "Other";
    const b = map.get(k) ?? { name: k, invested: 0, current: 0, gain: 0 };
    b.invested += r.invested_value ?? 0;
    b.current += r.current_value ?? 0;
    b.gain += r.unrealised_gain ?? 0;
    map.set(k, b);
  }
  const rawBuckets = Array.from(map.values());
  const { sorted: buckets, sortConfig, handleSort } = useSortableTable(rawBuckets, "current", "desc");

  const totInv = rawBuckets.reduce((s, r) => s + r.invested, 0);
  const totCur = rawBuckets.reduce((s, r) => s + r.current, 0);
  const totGain = rawBuckets.reduce((s, r) => s + r.gain, 0);
  const totGp = totInv > 0 ? (totGain / totInv) * 100 : 0;

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Module</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Live AUM {kpis ? formatAmount(kpis.totalAUM) : "—"} across {rows.length} positions. Generate principal-ready review packs on demand.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORTS.map((r) => (
          <div key={r.title} className="rounded-xl border border-border bg-surface p-5 shadow-elegant flex flex-col">
            <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center">
              <r.icon className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold tracking-tight">{r.title}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground flex-1">{r.desc}</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-[12px] font-medium px-3 py-2 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export PDF
            </button>
          </div>
        ))}
      </div>

      <Card title="Portfolio snapshot — by asset class" subtitle="Live aggregation from sg_family_holdings_import · click column headers to sort">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-y border-border bg-secondary/40">
                <SortableHeader label="Asset class"       sortKey="name"     sortConfig={sortConfig} onSort={handleSort} className={`${TH} text-left px-5`} />
                <SortableHeader label="Invested"          sortKey="invested"  sortConfig={sortConfig} onSort={handleSort} className={`${TH} text-right`} />
                <SortableHeader label="Current value"     sortKey="current"   sortConfig={sortConfig} onSort={handleSort} className={`${TH} text-right`} />
                <SortableHeader label="Unrealised gain"   sortKey="gain"      sortConfig={sortConfig} onSort={handleSort} className={`${TH} text-right`} />
                <th className={`${TH} text-right`}>Gain%</th>
                <th className={`${TH} text-right px-5`}>Allocation%</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const gp = b.invested > 0 ? (b.gain / b.invested) * 100 : 0;
                const alloc = totalCurrent > 0 ? (b.current / totalCurrent) * 100 : 0;
                return (
                  <tr key={b.name} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{b.name}</td>
                    <td className="py-3 text-right tabular-nums">{formatAmount(b.invested)}</td>
                    <td className="py-3 text-right font-semibold tabular-nums">{formatAmount(b.current)}</td>
                    <td className={`py-3 text-right font-semibold tabular-nums ${b.gain >= 0 ? "text-success" : "text-destructive"}`}>{formatAmount(b.gain)}</td>
                    <td className={`py-3 text-right font-semibold tabular-nums ${gp >= 0 ? "text-success" : "text-destructive"}`}>{pct(gp)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{alloc.toFixed(2)}%</td>
                  </tr>
                );
              })}
              <tr className="bg-secondary/40 font-semibold">
                <td className="px-5 py-3">Total</td>
                <td className="py-3 text-right tabular-nums">{formatAmount(totInv)}</td>
                <td className="py-3 text-right tabular-nums">{formatAmount(totCur)}</td>
                <td className={`py-3 text-right tabular-nums ${totGain >= 0 ? "text-success" : "text-destructive"}`}>{formatAmount(totGain)}</td>
                <td className={`py-3 text-right tabular-nums ${totGp >= 0 ? "text-success" : "text-destructive"}`}>{pct(totGp)}</td>
                <td className="px-5 py-3 text-right tabular-nums">100.00%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
