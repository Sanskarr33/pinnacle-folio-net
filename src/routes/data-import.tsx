import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useBook, useDataHealth, useTotals } from "@/hooks/use-book";
import { getSnapshotComparison } from "@/lib/data-service";
import { sliceBy, unreachableRows } from "@/lib/portfolio-analytics";
import { inr, formatDate, pct } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { Database, AlertTriangle, CheckCircle2, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export const Route = createFileRoute("/data-import")({
  head: () => ({
    meta: [
      { title: "Data Source — SG Family Wealth" },
      {
        name: "description",
        content: "Where the dashboard's numbers come from and how complete they are.",
      },
    ],
  }),
  component: DataImportPage,
});

function DataImportPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const { health } = useDataHealth();
  const { totals } = useTotals();

  const { data: comparison } = useQuery({
    queryKey: ["snapshotComparison"],
    queryFn: getSnapshotComparison,
    staleTime: 5 * 60 * 1000,
  });

  const sections = useMemo(
    () => sliceBy(book, (r) => r.report_section?.trim() || "Unattributed"),
    [book],
  );
  const orphans = useMemo(() => unreachableRows(book), [book]);

  const completeness = (missing: number) =>
    health.totalRows > 0 ? ((health.totalRows - missing) / health.totalRows) * 100 : 0;

  const fields = [
    {
      label: "Purchase date",
      missing: health.missingPurchaseDate,
      why: "drives exit-load and long-term dates",
    },
    {
      label: "XIRR",
      missing: health.missingXirr,
      why: "excluded rows drop out of portfolio return",
    },
    {
      label: "Category",
      missing: health.missingCategory,
      why: "these fall into “Uncategorised” on product pages",
    },
    {
      label: "Custodian",
      missing: health.missingBroker,
      why: "shown as “Unattributed” in custodian views",
    },
    {
      label: "Exit load term",
      missing: health.missingExitLoad,
      why: "treated as no load — may understate lock-in",
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Data"
        title="Data Source & Health"
        description="Exactly where every figure on this dashboard comes from, and how complete the underlying import is."
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[400px] rounded-xl" />
      ) : (
        <>
          {/* Where the numbers come from, and how stale the database has become. */}
          {comparison && (
            <div className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-4">
              <GitCompareArrows className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[12px] min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  The dashboard reads the Excel workbook, not Supabase
                </p>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  Figures are imported from the family's own reporting pack by{" "}
                  <code className="bg-secondary px-1 rounded">scripts/import_excel.py</code>. The
                  Supabase table holds an older snapshot and the app's key is read-only (row-level
                  security rejects writes), so it cannot be refreshed from here. Run the importer
                  after each workbook update; use{" "}
                  <code className="bg-secondary px-1 rounded">scripts/out/holdings.sql</code> with a
                  service key to bring the database back in line.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SnapshotCard
                    name={comparison.workbook.label}
                    inUse
                    rows={comparison.workbook.rows}
                    value={comparison.workbook.value}
                    asOn={comparison.workbook.asOn}
                  />
                  {comparison.supabase && (
                    <SnapshotCard
                      name={comparison.supabase.label}
                      inUse={false}
                      rows={comparison.supabase.rows}
                      value={comparison.supabase.value}
                      asOn={comparison.supabase.asOn}
                    />
                  )}
                </div>
                {comparison.supabase && (
                  <p className="text-muted-foreground mt-2.5 tabular">
                    Database is behind by{" "}
                    {inr(Math.abs(comparison.workbook.value - comparison.supabase.value))} across{" "}
                    {Math.abs(comparison.workbook.rows - comparison.supabase.rows)} rows.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              icon={Database}
              label="Rows in book"
              value={health.totalRows.toLocaleString("en-IN")}
              sub="positions imported"
            />
            <Stat
              icon={Database}
              label="Book value"
              value={inr(totals.currentValue)}
              sub={`as on ${formatDate(totals.asOnDate)}`}
            />
            <Stat
              icon={CheckCircle2}
              label="Reachable rows"
              value={`${health.totalRows - orphans.length}/${health.totalRows}`}
              sub={
                orphans.length === 0 ? "every row has a page" : `${orphans.length} not on any page`
              }
              tone={orphans.length === 0 ? "good" : "warn"}
            />
            <Stat
              icon={AlertTriangle}
              label="Broker spellings merged"
              value={String(health.brokerAliasesMerged)}
              sub="normalised into canonical names"
              tone={health.brokerAliasesMerged > 0 ? "warn" : null}
            />
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <Card
                title="Field completeness"
                subtitle="Empty columns silently weaken the analysis that depends on them"
              >
                <div className="space-y-3.5">
                  {fields.map((f) => {
                    const filled = completeness(f.missing);
                    return (
                      <div key={f.label}>
                        <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                          <span className="font-medium">{f.label}</span>
                          <span className="tabular text-muted-foreground shrink-0">
                            {f.missing > 0 ? `${f.missing} missing · ` : ""}
                            {pct(filled, 0)} complete
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${filled}%`,
                              background:
                                filled >= 95
                                  ? "var(--success)"
                                  : filled >= 70
                                    ? "var(--chart-1)"
                                    : "var(--warning)",
                            }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{f.why}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <Card title="Known data issues" subtitle="Things worth fixing at source">
                <ul className="space-y-3 text-[12px]">
                  {health.duplicateHoldings > 0 && (
                    <Issue
                      tone="warn"
                      title={`${health.duplicateHoldings} duplicated lots`}
                      detail="Same security, folio, unit count and purchase date recorded more than once — likely a copy-paste in the source sheet."
                    />
                  )}
                  {health.brokerAliasesMerged > 0 && (
                    <Issue
                      tone="warn"
                      title={`${health.brokerAliasesMerged} inconsistent broker spellings`}
                      detail="Normalised for display (e.g. Kotak Secu / KotakSec / ksecu → Kotak Securities), but the source rows are still inconsistent."
                    />
                  )}
                  {health.missingXirr > 0 && (
                    <Issue
                      tone="warn"
                      title={`${health.missingXirr} rows without XIRR`}
                      detail={`Portfolio return is a value-weighted mean over ${totals.xirrCoveragePct.toFixed(0)}% of book value, not the whole book.`}
                    />
                  )}
                  {health.unparseableExitLoad > 0 && (
                    <Issue
                      tone="warn"
                      title={`${health.unparseableExitLoad} unreadable exit-load terms`}
                      detail="Expected format is rate/days, e.g. 1/365. These rows are excluded from the exit-load tracker."
                    />
                  )}
                  {orphans.length > 0 && (
                    <Issue
                      tone="warn"
                      title={`${orphans.length} rows not on any product page`}
                      detail={`product_type values: ${[...new Set(orphans.map((r) => r.product_type ?? "null"))].join(", ")}`}
                    />
                  )}
                  <Issue
                    tone="info"
                    title="No transactions table"
                    detail="No trade ledger, sells or cashflows exist in the project, so realised gains and true time-weighted returns cannot be computed."
                  />
                  <Issue
                    tone="info"
                    title="Single valuation snapshot"
                    detail="Only one as-on date is present, so no time series, day change or trend can be shown."
                  />
                  <Issue
                    tone="info"
                    title="No sector column"
                    detail="Sector-level equity risk cannot be broken down until a sector field is added to the import."
                  />
                </ul>
              </Card>
            </div>
          </div>

          <Card
            title="Import provenance"
            subtitle="Rows grouped by the source sheet section they came from"
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[12.5px] min-w-[520px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                    <th className="text-left font-semibold px-5 py-2.5">Report section</th>
                    <th className="text-right font-semibold py-2.5">Rows</th>
                    <th className="text-right font-semibold py-2.5">Value</th>
                    <th className="text-right font-semibold px-5 py-2.5">% Book</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s) => (
                    <tr key={s.key} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="px-5 py-2.5 font-medium">{s.key}</td>
                      <td className="py-2.5 text-right tabular text-muted-foreground">{s.count}</td>
                      <td className="py-2.5 text-right tabular font-semibold">{inr(s.current)}</td>
                      <td className="px-5 py-2.5 text-right tabular">{pct(s.pctOfBook, 1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
                    <td className="px-5 py-2.5">Total</td>
                    <td className="py-2.5 text-right tabular">{health.totalRows}</td>
                    <td className="py-2.5 text-right tabular">{inr(totals.currentValue)}</td>
                    <td className="px-5 py-2.5 text-right tabular">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SnapshotCard({
  name,
  inUse,
  rows,
  value,
  asOn,
}: {
  name: string;
  inUse: boolean;
  rows: number;
  value: number;
  asOn: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 bg-surface",
        inUse ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <code className="text-[10.5px] font-semibold truncate">{name}</code>
        <span
          className={cn(
            "text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0",
            inUse ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {inUse ? "IN USE" : "NOT USED"}
        </span>
      </div>
      <p className="mt-2 text-[15px] font-semibold tabular">{inr(value)}</p>
      <p className="text-[10.5px] text-muted-foreground tabular">
        {rows.toLocaleString("en-IN")} rows · as on {formatDate(asOn)}
      </p>
    </div>
  );
}

function Issue({ title, detail, tone }: { title: string; detail: string; tone: "warn" | "info" }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={cn(
          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
          tone === "warn" ? "bg-warning" : "bg-muted-foreground/40",
        )}
      />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground mt-0.5 leading-relaxed text-[11.5px]">{detail}</p>
      </div>
    </li>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn" | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-elegant">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 text-[20px] font-semibold tabular tracking-tight",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
