import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  useBook,
  useTotals,
  useAssetAllocation,
  useEntityAllocation,
  useVehicleAllocation,
  useBrokerAllocation,
  useExitLoads,
  useTax,
  useConcentration,
  useHarvest,
} from "@/hooks/use-book";
import {
  displayName,
  normaliseEntity,
  normaliseBroker,
  consolidateSecurities,
} from "@/lib/portfolio-analytics";
import { inr, pct, pctSigned, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import type { Slice } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SG Family Wealth" },
      { name: "description", content: "Printable portfolio summary and CSV exports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const { totals } = useTotals();
  const { slices: assets } = useAssetAllocation();
  const { slices: entities } = useEntityAllocation();
  const { slices: vehicles } = useVehicleAllocation();
  const { slices: custodians } = useBrokerAllocation();
  const { summary: exitLoads } = useExitLoads();
  const { summary: tax } = useTax(90);
  const { risk } = useConcentration();
  const { candidates } = useHarvest();

  const download = useCallback(
    (name: string, rows: string[][]) => {
      const csv = rows
        .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-${totals.asOnDate ?? "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [totals.asOnDate],
  );

  const exports = [
    {
      label: "Full holdings book",
      detail: `${book.length} rows, every column`,
      run: () =>
        download("holdings-full", [
          [
            "Security",
            "Entity",
            "Custodian",
            "Asset class",
            "Category",
            "Product",
            "Invested",
            "Current",
            "Gain",
            "Gain %",
            "XIRR",
            "Term",
            "Held days",
            "Purchase date",
            "Exit load",
          ],
          ...book.map((r) => [
            displayName(r),
            normaliseEntity(r.entity_name),
            normaliseBroker(r.broker_name),
            r.asset_class ?? "",
            r.category ?? "",
            r.product_type ?? "",
            String(r.invested_value ?? ""),
            String(r.current_value ?? ""),
            String(r.unrealised_gain ?? ""),
            String(r.gain_percent ?? ""),
            String(r.xirr ?? ""),
            r.holding_term ?? "",
            String(r.holding_period_days ?? ""),
            r.purchase_date ?? "",
            r.exit_load ?? "",
          ]),
        ]),
    },
    {
      label: "Consolidated securities",
      detail: "Same security across entities merged into one line",
      run: () =>
        download("securities-consolidated", [
          ["Security", "Lots", "Invested", "Current", "Gain", "Gain %", "% Book", "XIRR"],
          ...consolidateSecurities(book).map((s) => [
            s.key,
            String(s.count),
            String(s.invested),
            String(s.current),
            String(s.gain),
            s.gainPct.toFixed(2),
            s.pctOfBook.toFixed(2),
            s.xirr?.toFixed(2) ?? "",
          ]),
        ]),
    },
    {
      label: "Exit-load exposure",
      detail: `${exitLoads.locked.length} locked positions with lapse dates`,
      run: () =>
        download("exit-load-locked", [
          [
            "Security",
            "Entity",
            "Value",
            "Load %",
            "Cost today",
            "Days held",
            "Days remaining",
            "Free on",
          ],
          ...exitLoads.locked.map((p) => [
            displayName(p.row),
            normaliseEntity(p.row.entity_name),
            String(p.row.current_value ?? ""),
            String(p.term.ratePct),
            p.costIfSoldToday.toFixed(2),
            String(p.daysHeld),
            String(p.daysRemaining),
            p.freeOn ?? "",
          ]),
        ]),
    },
    {
      label: "Capital-gains lots",
      detail: `${tax.shortTerm.count} short term, ${tax.longTerm.count} long term`,
      run: () =>
        download("capital-gains-lots", [
          [
            "Security",
            "Entity",
            "Term",
            "Days held",
            "Purchase date",
            "Invested",
            "Current",
            "Unrealised gain",
            "Gain %",
          ],
          ...book
            .filter((r) => r.holding_period_days != null)
            .map((r) => [
              displayName(r),
              normaliseEntity(r.entity_name),
              r.holding_term ?? "",
              String(r.holding_period_days ?? ""),
              r.purchase_date ?? "",
              String(r.invested_value ?? ""),
              String(r.current_value ?? ""),
              String(r.unrealised_gain ?? ""),
              String(r.gain_percent ?? ""),
            ]),
        ]),
    },
    {
      label: "Loss-harvesting candidates",
      detail: `${candidates.length} positions at a loss`,
      run: () =>
        download("loss-harvest", [
          ["Security", "Entity", "Term", "Current value", "Loss", "Loss %", "Exit-load friction"],
          ...candidates.map((c) => [
            displayName(c.row),
            normaliseEntity(c.row.entity_name),
            c.term ?? "",
            String(c.row.current_value ?? ""),
            c.loss.toFixed(2),
            c.lossPct.toFixed(2),
            c.exitLoadCost.toFixed(2),
          ]),
        ]),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations · Reporting"
        title="Reports & Exports"
        description="A printable position summary and CSV extracts of every derived view."
        right={
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md bg-navy text-navy-foreground hover:bg-navy/90 transition-colors print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[500px] rounded-xl" />
      ) : (
        <>
          <Card
            title="CSV exports"
            subtitle="Each reflects the current book exactly"
            className="print:hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {exports.map((e) => (
                <button
                  key={e.label}
                  onClick={e.run}
                  className="group text-left rounded-lg border border-border bg-surface p-4 hover:border-foreground/20 hover:shadow-elevated transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{e.detail}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Printable summary */}
          <Card
            title="Position summary"
            subtitle={`SG Family consolidated · valuations as on ${formatDate(totals.asOnDate)}`}
          >
            <div className="space-y-6">
              <section>
                <H>Headline</H>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px]">
                  <KV k="Total AUM" v={inr(totals.currentValue)} />
                  <KV k="Invested" v={inr(totals.investedValue)} />
                  <KV
                    k="Unrealised gain"
                    v={`${inr(totals.unrealisedGain)} (${pctSigned(totals.unrealisedGainPct)})`}
                  />
                  <KV
                    k="Portfolio XIRR"
                    v={
                      totals.weightedXirr != null
                        ? `${pct(totals.weightedXirr)} · ${totals.xirrCoveragePct.toFixed(0)}% coverage`
                        : "N/A"
                    }
                  />
                  <KV k="Positions" v={totals.holdingCount.toLocaleString("en-IN")} />
                  <KV k="Entities" v={String(totals.entityCount)} />
                  <KV k="Effective holdings" v={risk.effectiveHoldings.toFixed(0)} />
                  <KV k="HHI" v={risk.hhi.toFixed(0)} />
                </dl>
              </section>

              <SliceSection title="By asset class" slices={assets} />
              <SliceSection title="By vehicle" slices={vehicles} />
              <SliceSection title="By entity" slices={entities} />
              <SliceSection title="By custodian" slices={custodians} />

              <section>
                <H>Tax & liquidity</H>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px]">
                  <KV
                    k="Short-term value"
                    v={`${inr(tax.shortTerm.value)} · ${tax.shortTerm.count} lots`}
                  />
                  <KV
                    k="Long-term value"
                    v={`${inr(tax.longTerm.value)} · ${tax.longTerm.count} lots`}
                  />
                  <KV
                    k="Maturing ≤90d"
                    v={`${inr(tax.maturingSoonGain)} · ${tax.maturingSoon.length} lots`}
                  />
                  <KV
                    k="Harvestable losses"
                    v={`${inr(candidates.reduce((s, c) => s + c.loss, 0))} · ${candidates.length} positions`}
                  />
                  <KV
                    k="Locked by exit load"
                    v={`${inr(exitLoads.lockedValue)} · ${exitLoads.locked.length} positions`}
                  />
                  <KV k="Exit-load cost today" v={inr(exitLoads.totalCost)} />
                  <KV
                    k="Largest position"
                    v={`${risk.topSecurityName} · ${pct(risk.topSecurityPct, 2)}`}
                  />
                  <KV k="Top 10 share" v={pct(risk.top10Pct, 1)} />
                </dl>
              </section>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SliceSection({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <section>
      <H>{title}</H>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="text-left font-semibold py-1.5">Group</th>
            <th className="text-right font-semibold py-1.5">Positions</th>
            <th className="text-right font-semibold py-1.5">Invested</th>
            <th className="text-right font-semibold py-1.5">Current</th>
            <th className="text-right font-semibold py-1.5">Gain %</th>
            <th className="text-right font-semibold py-1.5">% Book</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.key} className="border-b border-border/40">
              <td className="py-1.5 font-medium">{s.key}</td>
              <td className="py-1.5 text-right tabular text-muted-foreground">{s.count}</td>
              <td className="py-1.5 text-right tabular">{inr(s.invested)}</td>
              <td className="py-1.5 text-right tabular font-semibold">{inr(s.current)}</td>
              <td
                className={`py-1.5 text-right tabular ${s.gainPct >= 0 ? "text-success" : "text-destructive"}`}
              >
                {pctSigned(s.gainPct, 1)}
              </td>
              <td className="py-1.5 text-right tabular">{pct(s.pctOfBook, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2.5 pb-1 border-b border-border">
      {children}
    </h3>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 font-semibold tabular">{v}</dd>
    </div>
  );
}
