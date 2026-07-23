import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useBook } from "@/hooks/use-book";
import { displayName, normaliseEntity, sliceBy } from "@/lib/portfolio-analytics";
import { inr, formatDate, num, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, EmptyState, Skeleton } from "@/components/common/States";
import { Info, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";
import { CR } from "@/lib/format";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Acquisitions — SG Family Wealth" },
      {
        name: "description",
        content: "When each position was acquired, at what price, and what it is worth now.",
      },
    ],
  }),
  component: TransactionsPage,
});

/**
 * There is no transactions table in Supabase — no trade ledger, no sells, no
 * cashflows. What the book DOES record per lot is purchase_date, purchase_price /
 * purchase_nav and units, which is an acquisition record. This page presents that
 * honestly rather than inventing a trade blotter.
 */
function TransactionsPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("All");

  const acquisitions = useMemo(
    () =>
      book
        .filter((r) => r.purchase_date)
        .sort((a, b) => (b.purchase_date ?? "").localeCompare(a.purchase_date ?? "")),
    [book],
  );

  const years = useMemo(
    () => [
      "All",
      ...Array.from(new Set(acquisitions.map((r) => r.purchase_date!.slice(0, 4))))
        .sort()
        .reverse(),
    ],
    [acquisitions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return acquisitions.filter((r) => {
      if (year !== "All" && !r.purchase_date!.startsWith(year)) return false;
      if (!q) return true;
      return (
        displayName(r).toLowerCase().includes(q) ||
        normaliseEntity(r.entity_name).toLowerCase().includes(q) ||
        (r.folio_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [acquisitions, query, year]);

  // Capital deployed per calendar year — a real "when did we invest" view.
  const byYear = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of acquisitions) {
      const y = r.purchase_date!.slice(0, 4);
      m.set(y, (m.get(y) ?? 0) + (r.invested_value ?? 0));
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([y, v]) => ({ year: y, invested: +(v / CR).toFixed(2) }));
  }, [acquisitions]);

  const missing = book.length - acquisitions.length;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Ledger"
        title="Acquisition History"
        description="When each open position was acquired, at what price, and how it has performed since."
      />

      <div className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-[12px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">This is not a trade ledger.</span> The
          Supabase project has no transactions table — no sells, switches, dividends or cashflows
          are recorded. What follows is reconstructed from the{" "}
          <code className="bg-secondary px-1 rounded">purchase_date</code>,{" "}
          <code className="bg-secondary px-1 rounded">purchase_price</code> and{" "}
          <code className="bg-secondary px-1 rounded">units</code> columns of currently-open
          positions, so closed positions are invisible here.
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[500px] rounded-xl" />
      ) : acquisitions.length === 0 ? (
        <Card title="Acquisitions">
          <EmptyState
            message="No purchase dates recorded in the book."
            hint="Populate purchase_date in portfolio_detailed_holdings to build this view."
          />
        </Card>
      ) : (
        <>
          <Card
            title="Capital deployed by year"
            subtitle={`₹ Cr invested, by purchase year · ${acquisitions.length} dated lots`}
          >
            <div className="h-[240px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byYear} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `₹${v}`}
                    width={50}
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
                    formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Invested"]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="invested"
                    fill="var(--chart-1)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title="Acquisitions"
            subtitle={`${filtered.length} of ${acquisitions.length} lots${missing > 0 ? ` · ${missing} positions have no purchase date` : ""}`}
            right={
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="pl-8 h-8 w-[150px] text-[12px]"
                    aria-label="Search acquisitions"
                  />
                </div>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  aria-label="Filter by purchase year"
                  className="h-8 rounded-md border border-input bg-surface px-2 text-[12px]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y === "All" ? "All years" : y}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState message="No acquisitions match this filter." />
            ) : (
              <div className="overflow-x-auto -mx-5 max-h-[600px]">
                <table className="w-full text-[12.5px] min-w-[880px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/60 backdrop-blur">
                      <th className="text-left font-semibold px-5 py-2.5">Date</th>
                      <th className="text-left font-semibold py-2.5">Security</th>
                      <th className="text-left font-semibold py-2.5">Entity</th>
                      <th className="text-right font-semibold py-2.5">Units</th>
                      <th className="text-right font-semibold py-2.5">Buy price</th>
                      <th className="text-right font-semibold py-2.5">Invested</th>
                      <th className="text-right font-semibold py-2.5">Now worth</th>
                      <th className="text-right font-semibold px-5 py-2.5">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-5 py-2.5 tabular text-muted-foreground whitespace-nowrap">
                          {formatDate(r.purchase_date)}
                        </td>
                        <td className="py-2.5 font-medium max-w-[240px]">
                          <span className="block truncate" title={displayName(r)}>
                            {displayName(r)}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {normaliseEntity(r.entity_name)}
                        </td>
                        <td className="py-2.5 text-right tabular text-muted-foreground">
                          {num(r.units ?? r.quantity, 3)}
                        </td>
                        <td className="py-2.5 text-right tabular text-muted-foreground">
                          {r.purchase_price != null || r.purchase_nav != null
                            ? `₹${num(r.purchase_price ?? r.purchase_nav, 2)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular">{inr(r.invested_value)}</td>
                        <td className="py-2.5 text-right tabular font-semibold">
                          {inr(r.current_value)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-2.5 text-right tabular font-semibold",
                            (r.gain_percent ?? 0) >= 0 ? "text-success" : "text-destructive",
                          )}
                        >
                          {pctSigned(r.gain_percent, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 200 && (
                  <p className="px-5 py-2.5 text-[11.5px] text-muted-foreground border-t border-border bg-secondary/20">
                    Showing the 200 most recent of {filtered.length} — narrow with the search or
                    year filter.
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
