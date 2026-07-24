import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, FileSpreadsheet, Info, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useBook } from "@/hooks/use-book";
import { useUnits, formatMoney } from "@/lib/units";
import { formatDate } from "@/lib/format";
import { normaliseEntity } from "@/lib/portfolio-analytics";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import {
  buildEvents,
  bucketByMonth,
  summarise,
  EVENT_META,
  type CalendarEvent,
  type EventKind,
  type MonthBucket,
} from "@/lib/liquidity-calendar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Liquidity Calendar — SG Family Wealth" },
      {
        name: "description",
        content: "When exit loads lapse and holdings turn long term.",
      },
    ],
  }),
  component: CalendarPage,
});

const HORIZONS = [12, 24, 36] as const;

function CalendarPage() {
  const { data, isLoading, error } = useBook();
  const { unit, digits } = useUnits();
  const [horizon, setHorizon] = useState<number>(12);
  const [entity, setEntity] = useState("all");
  const [kinds, setKinds] = useState<Record<EventKind, boolean>>({
    "exit-load": true,
    ltcg: true,
    maturity: true,
  });
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Charts stack segments against each other, so every bar must share one unit.
  const cellUnit = unit === "auto" ? "crore" : unit;
  const money = (n: number | null | undefined) => formatMoney(n, cellUnit, digits);

  const rows = useMemo(() => data ?? [], [data]);

  const entities = useMemo(
    () => [...new Set(rows.map((r) => normaliseEntity(r.entity_name)))].sort(),
    [rows],
  );

  const allEvents = useMemo(() => buildEvents(rows), [rows]);

  const events = useMemo(
    () =>
      allEvents.filter(
        (e) => kinds[e.kind] && (entity === "all" || normaliseEntity(e.row.entity_name) === entity),
      ),
    [allEvents, kinds, entity],
  );

  const buckets = useMemo(() => bucketByMonth(events, horizon), [events, horizon]);
  const summary = useMemo(() => summarise(events, horizon), [events, horizon]);

  const chartData = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        key: b.key,
        "Exit load": b.exitLoadValue / (cellUnit === "raw" ? 1 : divisorFor(cellUnit)),
        LTCG: b.ltcgValue / (cellUnit === "raw" ? 1 : divisorFor(cellUnit)),
        Maturity: b.maturityValue / (cellUnit === "raw" ? 1 : divisorFor(cellUnit)),
      })),
    [buckets, cellUnit],
  );

  const openBucket = buckets.find((b) => b.key === openMonth) ?? null;

  async function exportExcel() {
    setExporting(true);
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      await exportXlsx({
        fileName: "liquidity-calendar",
        unit,
        subtitle: `Liquidity calendar · next ${horizon} months · ${events.length} events · SG Family Office`,
        sheets: [
          {
            name: "By month",
            freezeCols: 1,
            columns: [
              { header: "Month", key: "month", type: "text", width: 14 },
              { header: "Exit load lapsing", key: "exitLoad", type: "money" },
              { header: "Turning long term", key: "ltcg", type: "money" },
              { header: "Maturing", key: "maturity", type: "money" },
              { header: "Total", key: "total", type: "money" },
              { header: "Penalty avoided", key: "cost", type: "money" },
              { header: "Cumulative", key: "cum", type: "money" },
              { header: "Events", key: "n", type: "number", width: 10 },
            ],
            rows: buckets.map((b) => ({
              month: b.label,
              exitLoad: b.exitLoadValue,
              ltcg: b.ltcgValue,
              maturity: b.maturityValue,
              total: b.totalValue,
              cost: b.costAvoided,
              cum: b.cumulative,
              n: b.events.length,
            })),
          },
          {
            name: "Events",
            freezeCols: 1,
            columns: [
              { header: "Date", key: "date", type: "date", width: 14 },
              { header: "Type", key: "type", type: "text", width: 20 },
              { header: "Security", key: "security", type: "text", width: 46 },
              { header: "Entity", key: "entity", type: "text", width: 16 },
              { header: "Value", key: "value", type: "money" },
              { header: "Unrealised gain", key: "gain", type: "money" },
              { header: "Penalty avoided", key: "cost", type: "money" },
              { header: "Detail", key: "detail", type: "text", width: 44 },
            ],
            rows: events.map((e) => ({
              date: new Date(e.date),
              type: EVENT_META[e.kind].label,
              security: e.security,
              entity: e.entity,
              value: e.value,
              gain: e.gain,
              cost: e.costAvoided,
              detail: e.detail,
            })),
          },
        ],
      });
    } catch (err) {
      console.error("Calendar export failed", err);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <ErrorState error={error as Error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Liquidity Calendar"
        description="When capital becomes free to move — exit loads lapsing and holdings turning long term."
        right={
          <button
            onClick={exportExcel}
            disabled={exporting || events.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? "Building…" : "Excel"}
          </button>
        }
      />

      {/* ── Headline state ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile
          label="Inside an exit-load window"
          value={money(summary.lockedValue)}
          foot={`${money(summary.lockedCost)} penalty if sold today`}
        />
        <Tile
          label="Not yet long term"
          value={money(summary.shortTermValue)}
          foot={`${money(summary.shortTermGain)} unrealised gain riding on it`}
        />
        <Tile label="Frees up within 6 months" value={money(summary.freeingIn6m)} />
        <Tile
          label="Frees up within 12 months"
          value={money(summary.freeingIn12m)}
          foot={
            summary.beyondHorizon > 0
              ? `${money(summary.beyondHorizon)} falls beyond ${horizon}m`
              : undefined
          }
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Horizon
            </span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={cn(
                    "h-8 px-3 text-[11.5px] font-medium transition-colors",
                    horizon === h
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {h}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Entity
            </span>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium outline-none focus:border-primary/60"
            >
              <option value="all">All entities</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(EVENT_META) as EventKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKinds({ ...kinds, [k]: !kinds[k] })}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11.5px] font-medium transition-colors",
                  kinds[k]
                    ? "border-border bg-secondary/60 text-foreground"
                    : "border-border/60 text-muted-foreground/60 hover:bg-secondary/40",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-[3px] shrink-0"
                  style={{
                    backgroundColor: kinds[k] ? EVENT_META[k].colour : "var(--muted-foreground)",
                    opacity: kinds[k] ? 1 : 0.4,
                  }}
                />
                {EVENT_META[k].label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11.5px] text-muted-foreground tabular">
            {events.length} events · {money(events.reduce((s, e) => s + e.value, 0))}
          </span>
        </div>
      </Card>

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      <Card
        title={`Next ${horizon} months`}
        subtitle="Value whose status changes in each month. Click a bar to list the holdings."
      >
        {isLoading ? (
          <Skeleton className="h-72" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No events in this window for the selected filters.
          </p>
        ) : (
          <div className="h-[340px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
                onClick={(s) => {
                  const p = s?.activePayload?.[0]?.payload as { key?: string } | undefined;
                  if (p?.key) setOpenMonth((m) => (m === p.key ? null : (p.key as string)));
                }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10.5, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  label={{
                    value: unitLabel(cellUnit),
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "var(--muted-foreground)" },
                  }}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.45 }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 6px 24px oklch(0 0 0 / 0.10)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4, color: "var(--foreground)" }}
                  formatter={(v: number, name: string) => [
                    `${v.toFixed(2)}${unitSuffixShort(cellUnit)}`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }}
                  iconType="square"
                  iconSize={9}
                />
                {/* 2px surface gap between stacked segments keeps them readable. */}
                <Bar
                  dataKey="Exit load"
                  stackId="a"
                  fill={EVENT_META["exit-load"].colour}
                  isAnimationActive={false}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <Bar
                  dataKey="LTCG"
                  stackId="a"
                  fill={EVENT_META.ltcg.colour}
                  isAnimationActive={false}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <Bar
                  dataKey="Maturity"
                  stackId="a"
                  fill={EVENT_META.maturity.colour}
                  isAnimationActive={false}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((d) => (
                    <Cell key={d.key} cursor="pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ── Month table (the accessible view of the same numbers) ───────────── */}
      <Card title="Month by month" subtitle="The same figures as the chart, with a running total.">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[12px] border-collapse min-w-[720px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-semibold px-3 py-2 border-b border-border">
                    Month
                  </th>
                  {(Object.keys(EVENT_META) as EventKind[]).map((k) => (
                    <th
                      key={k}
                      className="text-right font-semibold px-3 py-2 border-b border-border whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span
                          className="h-2 w-2 rounded-[2px]"
                          style={{ backgroundColor: EVENT_META[k].colour }}
                        />
                        {EVENT_META[k].short}
                      </span>
                    </th>
                  ))}
                  <th className="text-right font-semibold px-3 py-2 border-b border-border">
                    Total
                  </th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-border">
                    Cumulative
                  </th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-border">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr
                    key={b.key}
                    onClick={() =>
                      b.events.length && setOpenMonth((m) => (m === b.key ? null : b.key))
                    }
                    className={cn(
                      "transition-colors",
                      b.events.length && "cursor-pointer hover:bg-secondary/40",
                      openMonth === b.key && "bg-secondary/60",
                      !b.events.length && "text-muted-foreground/60",
                    )}
                  >
                    <td className="px-3 py-1.5 border-b border-border/40 font-medium whitespace-nowrap">
                      {b.label}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40">
                      {b.exitLoadValue ? money(b.exitLoadValue) : "—"}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40">
                      {b.ltcgValue ? money(b.ltcgValue) : "—"}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40">
                      {b.maturityValue ? money(b.maturityValue) : "—"}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40 font-semibold">
                      {b.totalValue ? money(b.totalValue) : "—"}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40 text-muted-foreground">
                      {money(b.cumulative)}
                    </td>
                    <td className="text-right tabular px-3 py-1.5 border-b border-border/40 text-muted-foreground">
                      {b.events.length || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Drill-down ──────────────────────────────────────────────────────── */}
      {openBucket && openBucket.events.length > 0 && (
        <Card
          title={`${openBucket.label} — ${openBucket.events.length} events`}
          subtitle={`${money(openBucket.totalValue)} changes status this month`}
          right={
            <button
              onClick={() => setOpenMonth(null)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          }
        >
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[12px] border-collapse min-w-[760px]">
              <thead>
                <tr className="text-muted-foreground">
                  <Th>Date</Th>
                  <Th>Security</Th>
                  <Th>Entity</Th>
                  <Th right>Value</Th>
                  <Th right>Gain</Th>
                  <Th>What changes</Th>
                </tr>
              </thead>
              <tbody>
                {openBucket.events.map((e, i) => (
                  <EventRow key={`${e.date}-${i}`} e={e} money={money} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-[11.5px] text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-px shrink-0" />
        <span>
          No tax rate is applied here. Indian capital-gains rates changed in July 2024 and depend on
          exemptions this book does not model, so the calendar shows the date a holding's status
          changes and the value affected — not an estimated tax saving. The workbook records no FD
          or bond maturity column; the few maturity rows come from dates written inside a security
          name and are marked as such.
        </span>
      </p>
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────────────────────────

function divisorFor(u: string) {
  return u === "lakh" ? 100_000 : u === "million" ? 1_000_000 : u === "crore" ? 10_000_000 : 1;
}
function unitLabel(u: string) {
  return u === "lakh" ? "₹ Lakh" : u === "million" ? "₹ Million" : u === "raw" ? "₹" : "₹ Crore";
}
function unitSuffixShort(u: string) {
  return u === "lakh" ? " L" : u === "million" ? " Mn" : u === "raw" ? "" : " Cr";
}

function Tile({ label, value, foot }: { label: string; value: string; foot?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="text-[22px] font-semibold tabular mt-1.5 text-foreground">{value}</p>
      {foot && <p className="text-[11px] text-muted-foreground mt-1">{foot}</p>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "font-semibold px-3 py-2 border-b border-border whitespace-nowrap",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function EventRow({
  e,
  money,
}: {
  e: CalendarEvent;
  money: (n: number | null | undefined) => string;
}) {
  return (
    <tr className="hover:bg-secondary/30 transition-colors">
      <td className="px-3 py-1.5 border-b border-border/40 tabular whitespace-nowrap">
        {formatDate(e.date)}
      </td>
      <td className="px-3 py-1.5 border-b border-border/40">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-[2px] shrink-0"
            style={{ backgroundColor: EVENT_META[e.kind].colour }}
          />
          {e.security}
          {e.inferred && (
            <span
              title="This date was read out of the security name, not a recorded maturity column."
              className="text-[9.5px] uppercase tracking-wider border border-border rounded px-1 py-px text-muted-foreground"
            >
              inferred
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-1.5 border-b border-border/40 text-muted-foreground">{e.entity}</td>
      <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">{money(e.value)}</td>
      <td
        className={cn(
          "px-3 py-1.5 border-b border-border/40 text-right tabular",
          e.gain < 0 && "text-destructive",
        )}
      >
        {money(e.gain)}
      </td>
      <td className="px-3 py-1.5 border-b border-border/40 text-muted-foreground">
        {e.detail}
        {e.costAvoided > 0 && (
          <span className="text-foreground"> · {money(e.costAvoided)} penalty avoided</span>
        )}
      </td>
    </tr>
  );
}
