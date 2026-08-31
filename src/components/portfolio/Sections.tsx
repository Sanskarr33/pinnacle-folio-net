// The non-holdings sections of the portfolio page, in report order.
//
// Every figure below is a field read straight from portfolio.json. Nothing is
// summed, averaged, or re-derived here — counts come from totals.counts rather
// than array lengths, and shares come from weightPct / sharePct rather than
// value ÷ total.

import { formatStamp, inr, inrSigned, pct, pctSigned, toneOf } from "@/lib/format-portfolio";
import type {
  BreakdownRow,
  CategoryRow,
  EntityRow,
  PortfolioFile,
  SleeveRow,
} from "@/lib/portfolio-file";

// ─── Shared chrome ────────────────────────────────────────────────────────────

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-4 sm:px-5 py-3.5 border-b border-border">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/** Horizontal scroll is contained here so the page body never scrolls sideways. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export const TH = "text-[10px] uppercase tracking-[0.14em] font-medium text-muted-foreground";
export const TD = "text-[12.5px] tabular";
export const ROW = "border-t border-border/70 hover:bg-muted/40 transition-colors";

// ─── Headline totals ──────────────────────────────────────────────────────────

export function HeadlineTotals({ file }: { file: PortfolioFile }) {
  const t = file.totals;
  const up = t.unrealisedGain >= 0;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-navy via-navy to-[oklch(0.22_0.06_265)] text-navy-foreground shadow-elevated overflow-hidden">
      <div className="grid grid-cols-12">
        <div className="col-span-12 lg:col-span-4 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-medium">
            {file.meta.scope} · Current value
          </p>
          <p className="mt-3 text-[38px] sm:text-[44px] leading-none font-semibold tracking-tight tabular">
            {inr(t.currentValue)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium tabular ${
                up ? "bg-success/20 text-emerald-300" : "bg-destructive/20 text-rose-300"
              }`}
            >
              {pct(t.unrealisedGainPct)} unrealised
            </span>
          </div>
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-4">
            <MiniStat label="Cost basis" value={inr(t.costBasis)} />
            <MiniStat label="Net investment" value={inr(t.netInvestment)} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4">
          <Stat
            label="Unrealised gain"
            value={inr(t.unrealisedGain)}
            sub={pct(t.unrealisedGainPct)}
            tone={up}
          />
          <Stat
            label="Total gain"
            value={inr(t.totalGain)}
            sub={pct(t.totalGainPct)}
            tone={t.totalGain >= 0}
          />
          <Stat label="Realised gain" value={inr(t.realisedGain)} sub="booked" tone={null} />
          <Stat label="Income" value={inr(t.income)} sub="received" tone={null} last />
          <Stat
            label="Blended XIRR"
            value={pct(t.blendedXirrPct)}
            sub="across the book"
            tone={null}
          />
          <Stat
            label="Categories"
            value={String(t.counts.categories)}
            sub="asset categories"
            tone={null}
          />
          <Stat
            label="Sleeves"
            value={String(t.counts.sleeves)}
            sub="strategy sleeves"
            tone={null}
          />
          <Stat
            label="Instruments"
            value={t.counts.instruments.toLocaleString("en-IN")}
            sub={`across ${t.counts.entities} entities`}
            tone={null}
            last
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-1 text-[14px] font-medium tabular">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  last,
}: {
  label: string;
  value: string;
  sub: string;
  tone: boolean | null;
  last?: boolean;
}) {
  return (
    <div
      className={`p-4 sm:p-5 border-t border-white/10 ${!last ? "md:border-r border-white/10" : ""}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-white/55 truncate">
        {label}
      </p>
      <p className="mt-2.5 text-[19px] sm:text-[22px] font-semibold tabular tracking-tight">
        {value}
      </p>
      <p
        className={`mt-1 text-[11.5px] tabular ${
          tone === true ? "text-emerald-300" : tone === false ? "text-rose-300" : "text-white/45"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

// ─── Movement since the prior mark ────────────────────────────────────────────

export function Movement({ file }: { file: PortfolioFile }) {
  const m = file.movement;
  return (
    <Section
      title="Movement since prior mark"
      subtitle={`${formatStamp(m.fromMark)} → ${formatStamp(m.toMark)}`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-border/70">
        <Cell label="Prior value" value={inr(m.priorValue)} />
        <Cell label="Current value" value={inr(m.currentValue)} />
        <Cell label="Purchases" value={inrSigned(m.purchases)} tone={m.purchases} />
        <Cell label="Mark to market" value={inrSigned(m.markToMarket)} tone={m.markToMarket} />
        <Cell label="Change" value={pctSigned(m.markToMarketPct)} tone={m.markToMarketPct} />
      </div>
      {m.note && (
        <p className="px-4 sm:px-5 py-3 border-t border-border text-[11.5px] text-muted-foreground">
          {m.note}
        </p>
      )}
    </Section>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-[16px] font-semibold tabular ${
          tone === undefined ? "text-foreground" : toneOf(tone)
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function Categories({ rows }: { rows: CategoryRow[] }) {
  return (
    <Section title="Categories" subtitle="Weight, gain and mark-to-market by asset category">
      <TableScroll>
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="bg-muted/40">
              <th className={`${TH} text-left px-4 sm:px-5 py-2.5`}>Category</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Value</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Cost</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain %</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Weight</th>
              <th className={`${TH} text-right px-3 py-2.5`}>M2M</th>
              <th className={`${TH} text-right px-4 sm:px-5 py-2.5`}>XIRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={ROW}>
                <td className={`${TD} text-left px-4 sm:px-5 py-2.5 font-medium`}>{r.name}</td>
                <td className={`${TD} text-right px-3 py-2.5`}>{inr(r.value)}</td>
                <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                  {inr(r.cost)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gain)}`}>
                  {inrSigned(r.gain)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gainPct)}`}>
                  {pct(r.gainPct)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5`}>{pct(r.weightPct)}</td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.markToMarket)}`}>
                  {inrSigned(r.markToMarket)}
                </td>
                <td className={`${TD} text-right px-4 sm:px-5 py-2.5`}>{pct(r.xirrPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}

// ─── Sleeves ──────────────────────────────────────────────────────────────────

export function Sleeves({ rows }: { rows: SleeveRow[] }) {
  return (
    <Section
      title="Sleeves"
      subtitle="Return type varies by sleeve — XIRR where a cashflow history exists, absolute gain otherwise"
    >
      <TableScroll>
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="bg-muted/40">
              <th className={`${TH} text-left px-4 sm:px-5 py-2.5`}>Sleeve</th>
              <th className={`${TH} text-left px-3 py-2.5`}>Category</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Value</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Cost</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain %</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Weight</th>
              <th className={`${TH} text-right px-3 py-2.5`}>M2M</th>
              <th className={`${TH} text-right px-4 sm:px-5 py-2.5`}>Return</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.category}/${r.name}`} className={ROW}>
                <td className={`${TD} text-left px-4 sm:px-5 py-2.5 font-medium`}>{r.name}</td>
                <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                  {r.category}
                </td>
                <td className={`${TD} text-right px-3 py-2.5`}>{inr(r.value)}</td>
                <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                  {inr(r.cost)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gain)}`}>
                  {inrSigned(r.gain)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gainPct)}`}>
                  {pct(r.gainPct)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5`}>{pct(r.weightPct)}</td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.markToMarket)}`}>
                  {inrSigned(r.markToMarket)}
                </td>
                <td className={`${TD} text-right px-4 sm:px-5 py-2.5`}>
                  {pct(r.returnPct)}
                  {/* returnType is null exactly when returnPct is — label only
                      when there is a figure for it to qualify. */}
                  {r.returnType && (
                    <span className="block text-[10px] text-muted-foreground">{r.returnType}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}

// ─── Entities ─────────────────────────────────────────────────────────────────

export function Entities({ rows }: { rows: EntityRow[] }) {
  return (
    <Section
      title="Entities"
      subtitle="Family shown per entity; the file carries no family subtotal, so none is shown"
    >
      <TableScroll>
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-muted/40">
              <th className={`${TH} text-left px-4 sm:px-5 py-2.5`}>Entity</th>
              <th className={`${TH} text-left px-3 py-2.5`}>Family</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Value</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Cost</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Gain %</th>
              <th className={`${TH} text-right px-4 sm:px-5 py-2.5`}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={ROW}>
                <td className={`${TD} text-left px-4 sm:px-5 py-2.5 font-medium`}>{r.name}</td>
                <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>{r.family}</td>
                <td className={`${TD} text-right px-3 py-2.5`}>{inr(r.value)}</td>
                <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                  {inr(r.cost)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gain)}`}>
                  {inrSigned(r.gain)}
                </td>
                <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gainPct)}`}>
                  {pct(r.gainPct)}
                </td>
                <td className={`${TD} text-right px-4 sm:px-5 py-2.5`}>{pct(r.weightPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}

// ─── Breakdowns ───────────────────────────────────────────────────────────────

export function Breakdowns({ file }: { file: PortfolioFile }) {
  const b = file.breakdowns;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <BreakdownTable
        title="By asset class"
        dimension="assetClass"
        label="Asset class"
        rows={b.byAssetClass}
      />
      <BreakdownTable
        title="By AMC"
        subtitle="Mutual funds only"
        dimension="amc"
        label="AMC"
        rows={b.byAmcMutualFundsOnly}
      />
      <BreakdownTable
        title="By sector"
        subtitle="Direct equity only"
        dimension="sector"
        label="Sector"
        rows={b.bySectorDirectEquity}
      />
      <BreakdownTable
        title="By market cap"
        subtitle="Direct equity only"
        dimension="marketCap"
        label="Market cap"
        rows={b.byMarketCapDirectEquity}
      />
    </div>
  );
}

function BreakdownTable({
  title,
  subtitle,
  dimension,
  label,
  rows,
}: {
  title: string;
  subtitle?: string;
  dimension: keyof BreakdownRow;
  label: string;
  rows: BreakdownRow[];
}) {
  return (
    <Section title={title} subtitle={subtitle}>
      <TableScroll>
        <table className="w-full min-w-[460px]">
          <thead>
            <tr className="bg-muted/40">
              <th className={`${TH} text-left px-4 sm:px-5 py-2.5`}>{label}</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Lines</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Value</th>
              <th className={`${TH} text-right px-3 py-2.5`}>Cost</th>
              <th className={`${TH} text-right px-4 sm:px-5 py-2.5`}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const name = (r[dimension] as string | undefined) ?? "—";
              return (
                <tr key={name} className={ROW}>
                  <td className={`${TD} text-left px-4 sm:px-5 py-2.5 font-medium`}>{name}</td>
                  <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                    {r.count}
                  </td>
                  <td className={`${TD} text-right px-3 py-2.5`}>{inr(r.value)}</td>
                  <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                    {inr(r.cost)}
                  </td>
                  <td className={`${TD} text-right px-4 sm:px-5 py-2.5`}>{pct(r.sharePct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
    </Section>
  );
}
