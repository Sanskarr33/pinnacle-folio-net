import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  useTotals,
  useAssetAllocation,
  useVehicleAllocation,
  useEntityAllocation,
  useBrokerAllocation,
  useTopSecurities,
  useConcentration,
  useExitLoads,
  useTax,
  useHarvest,
  useRealisedGains,
  useBook,
} from "@/hooks/use-book";
import { effectiveBands, computeDrift } from "@/lib/policy";
import { IMPORTED_MEETINGS, ADVISORS, allTrackedActions } from "@/lib/minutes";
import { CLOSED_STATUSES, OPEN_STATUSES } from "@/lib/meetings";
import { inr, pct, pctSigned, formatDate, CR } from "@/lib/format";
import type { Slice } from "@/lib/types";

/**
 * A print-first portfolio report.
 *
 * This is deliberately NOT the on-screen dashboard reskinned. It is its own
 * document — A4 pages, fixed light palette (identical in light, dark and on paper),
 * fixed-size charts that render at print time, and a static per-page footer with
 * deterministic page numbers. The browser's "Save as PDF" turns it into a vector PDF.
 *
 * All figures come from the same hooks the dashboard uses, so the report can never
 * disagree with the screen.
 */

// Fixed palette — never reads a CSS variable, so the report looks the same whatever
// theme the app is in and whatever the printer does with colour.
const C = {
  navy: "#161d34",
  navy2: "#232c4d",
  gold: "#c6a253",
  ink: "#1b2333",
  body: "#374151",
  muted: "#6b7280",
  faint: "#9aa2b1",
  line: "#e5e8ee",
  soft: "#f6f7f9",
  good: "#2f8f5b",
  bad: "#c0392b",
  warn: "#b7791f",
  white: "#ffffff",
};

const CHART = [
  "#3350a0",
  "#2f8f5b",
  "#c6a253",
  "#7b5ea8",
  "#c0563a",
  "#3d8ca0",
  "#6a8f3d",
  "#a03d6e",
];

const money = (n: number | null | undefined) => inr(n);
const crVal = (n: number) => +(n / CR).toFixed(2);

export function ReportDocument({ preparedFor = "SG Family Office" }: { preparedFor?: string }) {
  const { totals } = useTotals();
  const { data: book = [] } = useBook();
  const { slices: assets } = useAssetAllocation();
  const { slices: vehicles } = useVehicleAllocation();
  const { slices: entities } = useEntityAllocation();
  const { slices: custodians } = useBrokerAllocation();
  const { slices: topSecs } = useTopSecurities(18);
  const { risk } = useConcentration();
  const { summary: exit } = useExitLoads();
  const { summary: tax } = useTax(90);
  const { candidates } = useHarvest();
  const { capitalGains } = useRealisedGains();

  const drift = useMemo(() => computeDrift(book, effectiveBands()), [book]);
  const breaches = drift.drifts.filter((d) => d.status !== "within");
  const harvestLoss = candidates.reduce((s, c) => s + c.loss, 0);

  const tracked = useMemo(() => allTrackedActions(), []);
  const openActions = tracked.filter((t) => OPEN_STATUSES.includes(t.tracking.status)).length;
  const closedActions = tracked.filter((t) => CLOSED_STATUSES.includes(t.tracking.status)).length;

  const asOn = totals.asOnDate ? formatDate(totals.asOnDate) : "—";
  const generated = formatDate(new Date().toISOString());

  // Build the page list, then render with deterministic "Page N of M" footers.
  const pages: React.ReactNode[] = [];

  // ── 1 · Cover ───────────────────────────────────────────────────────────────
  pages.push(
    <div className="rpt-page rpt-cover" key="cover">
      <div className="rpt-cover-texture" />
      <div className="rpt-cover-top">
        <div className="rpt-mark">SG</div>
        <div>
          <div className="rpt-mark-name">SG FAMILY WEALTH</div>
          <div className="rpt-mark-sub">COMMAND CENTRE</div>
        </div>
      </div>

      <div className="rpt-cover-mid">
        <div className="rpt-cover-kicker">Consolidated Portfolio Report</div>
        <div className="rpt-cover-aum">{money(totals.currentValue)}</div>
        <div className="rpt-cover-aumlabel">Total family assets under management</div>
        <div className="rpt-cover-chips">
          <span className="rpt-chip">{pctSigned(totals.unrealisedGainPct)} on cost</span>
          <span className="rpt-chip">
            {totals.weightedXirr != null ? `${pct(totals.weightedXirr)} XIRR` : "XIRR n/a"}
          </span>
          <span className="rpt-chip">{totals.entityCount} entities</span>
          <span className="rpt-chip">{totals.holdingCount.toLocaleString("en-IN")} positions</span>
        </div>
      </div>

      <div className="rpt-cover-bottom">
        <div>
          <div className="rpt-cover-metaLabel">Prepared for</div>
          <div className="rpt-cover-metaValue">{preparedFor}</div>
        </div>
        <div>
          <div className="rpt-cover-metaLabel">Valuations as on</div>
          <div className="rpt-cover-metaValue">{asOn}</div>
        </div>
        <div>
          <div className="rpt-cover-metaLabel">Report generated</div>
          <div className="rpt-cover-metaValue">{generated}</div>
        </div>
      </div>
      <div className="rpt-cover-confidential">
        Private &amp; Confidential — prepared for the named family office only. Not for circulation.
      </div>
    </div>,
  );

  // ── 2 · Executive summary ───────────────────────────────────────────────────
  const donutData = assets.map((a) => ({ name: a.key, value: a.current }));
  pages.push(
    <Page key="exec" title="Executive Summary" subtitle={`Consolidated position as on ${asOn}`}>
      <div className="rpt-kpigrid">
        <Kpi label="Total AUM" value={money(totals.currentValue)} accent />
        <Kpi label="Invested (cost)" value={money(totals.investedValue)} />
        <Kpi
          label="Unrealised gain"
          value={money(totals.unrealisedGain)}
          sub={pctSigned(totals.unrealisedGainPct)}
          tone={totals.unrealisedGain >= 0 ? "good" : "bad"}
        />
        <Kpi
          label="Portfolio XIRR"
          value={totals.weightedXirr != null ? pct(totals.weightedXirr) : "n/a"}
          sub={totals.weightedXirr != null ? `${totals.xirrCoveragePct.toFixed(0)}% coverage` : ""}
        />
        <Kpi
          label="Realised gain (FY)"
          value={capitalGains?.total ? money(capitalGains.total.netGain) : "—"}
          sub={capitalGains?.total ? `tax ${money(capitalGains.total.netTax)}` : ""}
        />
        <Kpi
          label="Effective holdings"
          value={risk.effectiveHoldings.toFixed(0)}
          sub={`HHI ${risk.hhi.toFixed(0)}`}
        />
      </div>

      <p className="rpt-narrative">
        The family book stands at <b>{money(totals.currentValue)}</b> across{" "}
        <b>{totals.holdingCount.toLocaleString("en-IN")}</b> positions in{" "}
        <b>{totals.entityCount}</b> entities, an unrealised{" "}
        {totals.unrealisedGain >= 0 ? "gain" : "loss"} of{" "}
        <b>{money(Math.abs(totals.unrealisedGain))}</b> ({pctSigned(totals.unrealisedGainPct)}) on
        cost. Value is concentrated — the ten largest positions carry <b>{pct(risk.top10Pct, 1)}</b>{" "}
        of the book, which behaves like <b>{risk.effectiveHoldings.toFixed(0)}</b> equal-weight
        holdings.
        {breaches.length > 0 && (
          <>
            {" "}
            <b>{breaches.length}</b> allocation band{breaches.length !== 1 ? "s" : ""} sit outside
            policy (see Risk &amp; Policy).
          </>
        )}
      </p>

      <div className="rpt-two">
        <Panel title="Asset allocation">
          <div className="rpt-donutwrap">
            <PieChart width={210} height={210}>
              <Pie
                data={donutData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke={C.white}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={CHART[i % CHART.length]} />
                ))}
              </Pie>
            </PieChart>
            <ul className="rpt-legend">
              {assets.slice(0, 8).map((a, i) => (
                <li key={a.key}>
                  <span className="rpt-dot" style={{ background: CHART[i % CHART.length] }} />
                  <span className="rpt-legend-name">{a.key}</span>
                  <span className="rpt-legend-val">{pct(a.pctOfBook, 1)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Cost to value by asset class · ₹ Cr">
          <BarChart
            width={300}
            height={220}
            data={assets.slice(0, 7).map((a) => ({
              name: a.key.replace(/ Mutual Funds$/, " MF").slice(0, 12),
              invested: crVal(a.invested),
              gain: crVal(a.gain),
            }))}
            margin={{ top: 6, right: 6, left: -8, bottom: 28 }}
          >
            <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8, fill: C.muted }}
              angle={-32}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 8, fill: C.muted }} axisLine={false} tickLine={false} />
            <Bar dataKey="invested" stackId="v" fill={C.navy} isAnimationActive={false} />
            <Bar
              dataKey="gain"
              stackId="v"
              fill={C.good}
              isAnimationActive={false}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
          <div className="rpt-barlegend">
            <span>
              <span className="rpt-dot" style={{ background: C.navy }} /> Invested
            </span>
            <span>
              <span className="rpt-dot" style={{ background: C.good }} /> Unrealised gain
            </span>
          </div>
        </Panel>
      </div>
    </Page>,
  );

  // ── 3 · Allocation detail ───────────────────────────────────────────────────
  pages.push(
    <Page key="alloc" title="Allocation Detail" subtitle="Four independent views of the same book">
      <div className="rpt-two">
        <SliceTable title="By asset class" slices={assets} />
        <SliceTable title="By investment vehicle" slices={vehicles} />
      </div>
      <div className="rpt-two" style={{ marginTop: "6mm" }}>
        <SliceTable title="By entity" slices={entities} />
        <SliceTable title="By custodian" slices={custodians} />
      </div>
    </Page>,
  );

  // ── 4 · Top holdings ────────────────────────────────────────────────────────
  pages.push(
    <Page
      key="top"
      title="Largest Holdings"
      subtitle="Consolidated across all entities, by market value"
    >
      <table className="rpt-table">
        <thead>
          <tr>
            <th className="rpt-num">#</th>
            <th>Security / Scheme</th>
            <th className="rpt-r">Lots</th>
            <th className="rpt-r">Value</th>
            <th className="rpt-r">% Book</th>
            <th className="rpt-r">Gain %</th>
            <th className="rpt-r">XIRR</th>
          </tr>
        </thead>
        <tbody>
          {topSecs.map((h, i) => (
            <tr key={h.key}>
              <td className="rpt-num">{i + 1}</td>
              <td className="rpt-name">{h.key}</td>
              <td className="rpt-r rpt-muted">{h.count}</td>
              <td className="rpt-r rpt-strong">{money(h.current)}</td>
              <td className="rpt-r">{pct(h.pctOfBook, 2)}</td>
              <td className="rpt-r" style={{ color: h.gainPct >= 0 ? C.good : C.bad }}>
                {pctSigned(h.gainPct, 1)}
              </td>
              <td className="rpt-r rpt-muted">{h.xirr != null ? pct(h.xirr, 1) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>
              Top {topSecs.length} of {totals.holdingCount.toLocaleString("en-IN")} positions
            </td>
            <td className="rpt-r" />
            <td className="rpt-r rpt-strong">
              {money(topSecs.reduce((s, h) => s + h.current, 0))}
            </td>
            <td className="rpt-r">
              {pct(
                topSecs.reduce((s, h) => s + h.pctOfBook, 0),
                1,
              )}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </Page>,
  );

  // ── 5 · Risk & policy ───────────────────────────────────────────────────────
  pages.push(
    <Page
      key="risk"
      title="Risk & Policy"
      subtitle="Concentration, and allocation against the advisor policy bands"
    >
      <div className="rpt-kpigrid rpt-kpi4">
        <Kpi
          label="Top-10 share"
          value={pct(risk.top10Pct, 1)}
          tone={risk.top10Pct >= 40 ? "warn" : undefined}
        />
        <Kpi
          label="Largest position"
          value={pct(risk.topSecurityPct, 1)}
          sub={risk.topSecurityName.slice(0, 24)}
        />
        <Kpi label="Largest entity" value={pct(risk.topEntityPct, 1)} sub={risk.topEntityName} />
        <Kpi
          label="HHI"
          value={risk.hhi.toFixed(0)}
          sub={risk.hhi < 1500 ? "diversified" : risk.hhi < 2500 ? "moderate" : "concentrated"}
        />
      </div>

      <SectionLabel>Allocation vs policy bands</SectionLabel>
      <table className="rpt-table rpt-compact">
        <thead>
          <tr>
            <th>Band</th>
            <th className="rpt-r">Actual</th>
            <th className="rpt-r">Policy</th>
            <th className="rpt-r">Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {drift.drifts.map((d) => (
            <tr key={d.band.key}>
              <td className="rpt-name">{d.band.label}</td>
              <td
                className="rpt-r rpt-strong"
                style={{ color: d.status !== "within" ? C.bad : C.ink }}
              >
                {pct(d.actualPct, 1)}
              </td>
              <td className="rpt-r rpt-muted">
                {d.band.min}–{d.band.max}%
              </td>
              <td className="rpt-r">
                {d.status === "within" ? (
                  <span style={{ color: C.good, fontWeight: 600 }}>within</span>
                ) : (
                  <span style={{ color: C.bad, fontWeight: 600 }}>
                    {d.status} · {pct(d.driftPct, 1)}
                  </span>
                )}
              </td>
              <td className="rpt-src">{d.band.source}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {breaches.length > 0 && (
        <div className="rpt-callout rpt-callout-bad">
          <b>
            {breaches.length} band{breaches.length !== 1 ? "s" : ""} outside policy.
          </b>{" "}
          {breaches
            .map(
              (d) =>
                `${d.band.label} is ${pct(d.actualPct, 1)} vs a ${d.band.min}–${d.band.max}% band`,
            )
            .join("; ")}
          . Equity here counts listed, unlisted, MFs, ETFs, PMS and equity AIFs — a wider basket
          than some advisors quoted, so read the gap as directional until the IPS definition is
          agreed.
        </div>
      )}
    </Page>,
  );

  // ── 6 · Tax & liquidity ─────────────────────────────────────────────────────
  pages.push(
    <Page
      key="tax"
      title="Tax & Liquidity"
      subtitle="Holding-term split, exit-load exposure and harvesting"
    >
      <div className="rpt-two">
        <Panel title="Holding term (unrealised)">
          <Row
            label="Short term"
            value={money(tax.shortTerm.value)}
            sub={`${tax.shortTerm.count} lots · gain ${money(tax.shortTerm.gain)}`}
          />
          <Row
            label="Long term"
            value={money(tax.longTerm.value)}
            sub={`${tax.longTerm.count} lots · gain ${money(tax.longTerm.gain)}`}
          />
          <Row
            label="Maturing ≤ 90d"
            value={money(tax.maturingSoonGain)}
            sub={`${tax.maturingSoon.length} lots cross to long term`}
            tone="warn"
          />
        </Panel>
        <Panel title="Realised gains (this FY)">
          {capitalGains?.total ? (
            <>
              <Row label="Sale proceeds" value={money(capitalGains.total.saleAmount)} />
              <Row
                label="Net realised gain"
                value={money(capitalGains.total.netGain)}
                tone="good"
              />
              <Row label="Tax liability" value={money(capitalGains.total.netTax)} tone="warn" />
            </>
          ) : (
            <p className="rpt-empty">No realised gains recorded this financial year.</p>
          )}
        </Panel>
      </div>

      <div className="rpt-two" style={{ marginTop: "6mm" }}>
        <Panel title="Exit-load exposure">
          <Row
            label="Positions locked"
            value={String(exit.locked.length)}
            sub={`of ${exit.locked.length + exit.free} with a term`}
            tone="warn"
          />
          <Row label="Value locked" value={money(exit.lockedValue)} />
          <Row
            label="Cost if sold today"
            value={money(exit.totalCost)}
            tone="bad"
            sub="total exit load payable"
          />
        </Panel>
        <Panel title="Loss harvesting">
          <Row label="Positions at a loss" value={String(candidates.length)} />
          <Row
            label="Harvestable loss"
            value={money(harvestLoss)}
            tone="good"
            sub="offsets realised gains"
          />
          <Row
            label="Exit-load friction"
            value={money(candidates.reduce((s, c) => s + c.exitLoadCost, 0))}
            sub="to realise those losses"
          />
        </Panel>
      </div>

      {exit.locked.length > 0 && (
        <>
          <SectionLabel>Soonest exit-load expiries</SectionLabel>
          <table className="rpt-table rpt-compact">
            <thead>
              <tr>
                <th>Security</th>
                <th>Entity</th>
                <th className="rpt-r">Value</th>
                <th className="rpt-r">Load</th>
                <th className="rpt-r">Cost today</th>
                <th className="rpt-r">Free on</th>
              </tr>
            </thead>
            <tbody>
              {exit.locked.slice(0, 8).map((p) => (
                <tr key={p.row.id}>
                  <td className="rpt-name">
                    {(p.row.security_name ?? p.row.scheme_name ?? "—").slice(0, 40)}
                  </td>
                  <td className="rpt-muted">{p.row.entity_name ?? "—"}</td>
                  <td className="rpt-r">{money(p.row.current_value)}</td>
                  <td className="rpt-r rpt-muted">{pct(p.term.ratePct, 2)}</td>
                  <td className="rpt-r" style={{ color: C.bad }}>
                    {money(p.costIfSoldToday)}
                  </td>
                  <td className="rpt-r rpt-muted">{p.freeOn ? formatDate(p.freeOn) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>,
  );

  // ── 7 · Advisor governance ──────────────────────────────────────────────────
  pages.push(
    <Page key="gov" title="Advisor Governance" subtitle="Meetings on file and the actions arising">
      <div className="rpt-kpigrid rpt-kpi4">
        <Kpi label="Advisors" value={String(ADVISORS.length)} sub="with minutes on file" />
        <Kpi label="Meetings" value={String(IMPORTED_MEETINGS.length)} />
        <Kpi
          label="Open actions"
          value={String(openActions)}
          tone={openActions > 0 ? "warn" : undefined}
        />
        <Kpi label="Closed" value={String(closedActions)} tone="good" />
      </div>

      <SectionLabel>By advisor</SectionLabel>
      <table className="rpt-table rpt-compact">
        <thead>
          <tr>
            <th>Advisor</th>
            <th className="rpt-r">Meetings</th>
            <th className="rpt-r">Actions raised</th>
            <th className="rpt-r">Closed</th>
            <th className="rpt-r">Latest</th>
          </tr>
        </thead>
        <tbody>
          {ADVISORS.map((a) => {
            const mine = IMPORTED_MEETINGS.filter((m) => m.advisorKey === a.key);
            const latest = mine
              .map((m) => m.date)
              .filter(Boolean)
              .sort()
              .pop();
            const closed = tracked.filter(
              (t) => t.advisorKey === a.key && CLOSED_STATUSES.includes(t.tracking.status),
            ).length;
            return (
              <tr key={a.key}>
                <td className="rpt-name">{a.name}</td>
                <td className="rpt-r">{a.meetingCount}</td>
                <td className="rpt-r">{a.actionCount}</td>
                <td className="rpt-r" style={{ color: closed > 0 ? C.good : C.muted }}>
                  {closed}
                </td>
                <td className="rpt-r rpt-muted">{latest ? formatDate(latest) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="rpt-note">
        This report is generated from the reconciled holdings book and the imported advisor minutes.
        Figures are as on {asOn}; nothing here is an estimate or projection. Bullion and bond
        sub-totals may differ from the source R1 control total, which contains reference errors —
        lot-level detail is authoritative.
      </p>
    </Page>,
  );

  return (
    <div className="rpt">
      <ReportStyles />
      {pages.map((p, i) => (
        <div className="rpt-pagewrap" key={i}>
          {p}
          <div className="rpt-foot">
            <span>Private &amp; Confidential · SG Family Office</span>
            <span>Valuations as on {asOn}</span>
            <span>
              Page {i + 1} of {pages.length}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rpt-page">
      <div className="rpt-head">
        <div>
          <div className="rpt-head-kicker">SG Family Wealth</div>
          <h2 className="rpt-head-title">{title}</h2>
          {subtitle && <div className="rpt-head-sub">{subtitle}</div>}
        </div>
        <div className="rpt-head-mark">SG</div>
      </div>
      <div className="rpt-body">{children}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "warn";
  accent?: boolean;
}) {
  const color =
    tone === "good" ? C.good : tone === "bad" ? C.bad : tone === "warn" ? C.warn : C.ink;
  return (
    <div className={`rpt-kpi${accent ? " rpt-kpi-accent" : ""}`}>
      <div className="rpt-kpi-label">{label}</div>
      <div className="rpt-kpi-value" style={{ color }}>
        {value}
      </div>
      {sub && <div className="rpt-kpi-sub">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rpt-panel">
      <div className="rpt-panel-title">{title}</div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "warn";
}) {
  const color =
    tone === "good" ? C.good : tone === "bad" ? C.bad : tone === "warn" ? C.warn : C.ink;
  return (
    <div className="rpt-row">
      <div>
        <div className="rpt-row-label">{label}</div>
        {sub && <div className="rpt-row-sub">{sub}</div>}
      </div>
      <div className="rpt-row-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="rpt-sectionlabel">{children}</div>;
}

function SliceTable({ title, slices }: { title: string; slices: Slice[] }) {
  const max = Math.max(...slices.map((s) => s.current), 1);
  return (
    <div className="rpt-panel">
      <div className="rpt-panel-title">{title}</div>
      <table className="rpt-slicetable">
        <tbody>
          {slices.slice(0, 10).map((s, i) => (
            <tr key={s.key}>
              <td className="rpt-slice-name">
                <span className="rpt-dot" style={{ background: CHART[i % CHART.length] }} />
                {s.key}
              </td>
              <td className="rpt-slice-bar">
                <span className="rpt-slice-track">
                  <span
                    className="rpt-slice-fill"
                    style={{
                      width: `${(s.current / max) * 100}%`,
                      background: CHART[i % CHART.length],
                    }}
                  />
                </span>
              </td>
              <td className="rpt-r rpt-strong">{money(s.current)}</td>
              <td className="rpt-r rpt-muted">{pct(s.pctOfBook, 1)}</td>
              <td
                className="rpt-r"
                style={{ color: s.gainPct >= 0 ? C.good : C.bad, fontSize: "8pt" }}
              >
                {pctSigned(s.gainPct, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Scoped stylesheet ────────────────────────────────────────────────────────
// Fixed colours, A4 geometry, and print isolation so only the report prints.

function ReportStyles() {
  return (
    <style>{`
.rpt { --gold:${C.gold}; color:${C.ink}; background:${C.soft}; font-family:Inter,"Helvetica Neue",system-ui,sans-serif; -webkit-font-smoothing:antialiased; font-feature-settings:"tnum","cv11"; }
.rpt *{ box-sizing:border-box; }
.rpt-pagewrap{ position:relative; }
.rpt-page{ width:210mm; min-height:297mm; background:${C.white}; margin:0 auto; padding:16mm 15mm 20mm; display:flex; flex-direction:column; }
@media screen { .rpt-pagewrap{ margin:0 auto 8mm; width:210mm; } .rpt-page{ box-shadow:0 4px 24px rgba(20,25,45,.16); } }

/* running footer */
.rpt-foot{ position:absolute; left:15mm; right:15mm; bottom:9mm; display:flex; justify-content:space-between; font-size:7.5pt; letter-spacing:.02em; color:${C.faint}; border-top:.4pt solid ${C.line}; padding-top:2mm; }

/* page header */
.rpt-head{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5pt solid ${C.navy}; padding-bottom:4mm; margin-bottom:6mm; }
.rpt-head-kicker{ font-size:8pt; letter-spacing:.22em; text-transform:uppercase; color:var(--gold); font-weight:600; }
.rpt-head-title{ font-size:20pt; font-weight:700; letter-spacing:-.01em; margin:1mm 0 0; color:${C.navy}; }
.rpt-head-sub{ font-size:9.5pt; color:${C.muted}; margin-top:1mm; }
.rpt-head-mark{ width:11mm; height:11mm; border-radius:2mm; background:${C.navy}; color:${C.gold}; font-weight:700; font-size:11pt; display:flex; align-items:center; justify-content:center; letter-spacing:.02em; }
.rpt-body{ flex:1; }

/* cover */
.rpt-cover{ background:${C.navy}; color:${C.white}; padding:22mm 20mm; position:relative; overflow:hidden; justify-content:space-between; }
.rpt-cover-texture{ position:absolute; inset:0; opacity:.10; background-image:radial-gradient(circle at 18% 15%, #fff 1px, transparent 1px); background-size:22px 22px; }
.rpt-cover-top{ position:relative; display:flex; align-items:center; gap:4mm; }
.rpt-mark{ width:14mm; height:14mm; border-radius:2.5mm; background:${C.gold}; color:${C.navy}; font-weight:800; font-size:13pt; display:flex; align-items:center; justify-content:center; }
.rpt-mark-name{ font-size:12pt; font-weight:700; letter-spacing:.04em; }
.rpt-mark-sub{ font-size:8pt; letter-spacing:.28em; color:rgba(255,255,255,.55); }
.rpt-cover-mid{ position:relative; }
.rpt-cover-kicker{ font-size:11pt; letter-spacing:.16em; text-transform:uppercase; color:${C.gold}; font-weight:600; }
.rpt-cover-aum{ font-size:52pt; font-weight:700; letter-spacing:-.02em; margin:3mm 0 1mm; line-height:1; }
.rpt-cover-aumlabel{ font-size:10.5pt; color:rgba(255,255,255,.6); }
.rpt-cover-chips{ display:flex; gap:2.5mm; margin-top:7mm; flex-wrap:wrap; }
.rpt-chip{ font-size:9pt; padding:1.6mm 3.5mm; border-radius:20px; background:rgba(255,255,255,.10); border:.5pt solid rgba(255,255,255,.18); }
.rpt-cover-bottom{ position:relative; display:flex; gap:12mm; padding-top:8mm; border-top:.6pt solid rgba(255,255,255,.15); }
.rpt-cover-metaLabel{ font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.5); }
.rpt-cover-metaValue{ font-size:11pt; font-weight:600; margin-top:1mm; }
.rpt-cover-confidential{ position:relative; margin-top:6mm; font-size:8pt; color:rgba(255,255,255,.45); }

/* KPI grid */
.rpt-kpigrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; }
.rpt-kpi4{ grid-template-columns:repeat(4,1fr); }
.rpt-kpi{ border:.6pt solid ${C.line}; border-radius:2mm; padding:3.5mm; background:${C.white}; }
.rpt-kpi-accent{ border-top:2pt solid ${C.gold}; }
.rpt-kpi-label{ font-size:7.5pt; letter-spacing:.12em; text-transform:uppercase; color:${C.muted}; }
.rpt-kpi-value{ font-size:16pt; font-weight:700; letter-spacing:-.01em; margin-top:1.5mm; }
.rpt-kpi-sub{ font-size:8pt; color:${C.muted}; margin-top:.5mm; }

.rpt-narrative{ font-size:10pt; line-height:1.65; color:${C.body}; margin:6mm 0; }
.rpt-narrative b{ color:${C.ink}; font-weight:650; }

.rpt-two{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; }
.rpt-panel{ border:.6pt solid ${C.line}; border-radius:2mm; padding:4mm; background:${C.white}; }
.rpt-panel-title{ font-size:8pt; letter-spacing:.12em; text-transform:uppercase; color:${C.muted}; font-weight:600; margin-bottom:3mm; }

.rpt-donutwrap{ display:flex; align-items:center; gap:3mm; }
.rpt-legend{ list-style:none; margin:0; padding:0; flex:1; }
.rpt-legend li{ display:flex; align-items:center; gap:2mm; font-size:8.5pt; padding:.7mm 0; }
.rpt-legend-name{ flex:1; color:${C.body}; }
.rpt-legend-val{ font-weight:600; color:${C.ink}; }
.rpt-dot{ width:2.4mm; height:2.4mm; border-radius:.6mm; display:inline-block; flex:none; }
.rpt-barlegend{ display:flex; gap:5mm; font-size:8pt; color:${C.muted}; margin-top:1mm; }
.rpt-barlegend span{ display:inline-flex; align-items:center; gap:1.5mm; }

/* tables */
.rpt-table{ width:100%; border-collapse:collapse; font-size:9pt; }
.rpt-table.rpt-compact{ font-size:8.5pt; }
.rpt-table thead th{ text-align:left; font-size:7.5pt; letter-spacing:.1em; text-transform:uppercase; color:${C.muted}; font-weight:600; border-bottom:1pt solid ${C.navy}; padding:2mm 2mm; }
.rpt-table tbody td{ padding:1.9mm 2mm; border-bottom:.4pt solid ${C.line}; }
.rpt-table tfoot td{ padding:2.4mm 2mm; border-top:1.2pt solid ${C.navy}; font-weight:700; font-size:8.5pt; }
.rpt-r{ text-align:right; font-variant-numeric:tabular-nums; }
.rpt-num{ width:8mm; color:${C.faint}; font-variant-numeric:tabular-nums; }
.rpt-name{ font-weight:600; color:${C.ink}; }
.rpt-muted{ color:${C.muted}; }
.rpt-strong{ font-weight:700; }
.rpt-src{ font-size:7.5pt; color:${C.faint}; }

.rpt-slicetable{ width:100%; border-collapse:collapse; font-size:8.5pt; table-layout:fixed; }
.rpt-slicetable td{ padding:1.4mm 1mm; border-bottom:.4pt solid ${C.line}; vertical-align:middle; }
.rpt-slicetable td.rpt-r{ white-space:nowrap; }
.rpt-slice-name{ font-weight:500; color:${C.ink}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rpt-slice-bar{ width:16mm; }
.rpt-slice-track{ display:block; height:2mm; background:${C.soft}; border-radius:2px; overflow:hidden; }
.rpt-slice-fill{ display:block; height:100%; border-radius:2px; }

.rpt-row{ display:flex; justify-content:space-between; align-items:baseline; padding:2mm 0; border-bottom:.4pt solid ${C.line}; }
.rpt-row:last-child{ border-bottom:none; }
.rpt-row-label{ font-size:9pt; color:${C.body}; }
.rpt-row-sub{ font-size:7.5pt; color:${C.faint}; margin-top:.4mm; }
.rpt-row-value{ font-size:11pt; font-weight:700; font-variant-numeric:tabular-nums; }

.rpt-sectionlabel{ font-size:8pt; letter-spacing:.14em; text-transform:uppercase; color:${C.muted}; font-weight:600; margin:7mm 0 3mm; }
.rpt-callout{ margin-top:5mm; padding:3.5mm 4mm; border-radius:2mm; font-size:8.5pt; line-height:1.55; }
.rpt-callout-bad{ background:#fbecea; border:.6pt solid #e7c3bd; color:#7a2f24; }
.rpt-empty{ font-size:9pt; color:${C.muted}; font-style:italic; }
.rpt-note{ margin-top:7mm; padding-top:3mm; border-top:.4pt solid ${C.line}; font-size:8pt; line-height:1.6; color:${C.faint}; }

@media print {
  @page { size:A4; margin:0; }
  html, body { background:${C.white} !important; }
  body * { visibility:hidden !important; }
  .rpt, .rpt * { visibility:visible !important; }
  .rpt{ position:absolute; left:0; top:0; width:100%; background:${C.white}; }
  .rpt-pagewrap{ margin:0 !important; page-break-after:always; break-after:page; }
  .rpt-pagewrap:last-child{ page-break-after:auto; break-after:auto; }
  .rpt-page{ box-shadow:none !important; margin:0 !important; }
  .rpt-panel, .rpt-kpi, .rpt-table, .rpt-two { break-inside:avoid; }
}
    `}</style>
  );
}
