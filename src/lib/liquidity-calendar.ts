// Forward liquidity calendar — when capital becomes free or cheaper to move.
//
// A note on what this is NOT: the workbook carries no FD or bond maturity column.
// Two NCD rows and one target-maturity fund state a date inside their NAME, and those
// are parsed and flagged as such; everything else here is derived from dates the book
// records properly. A ladder of invented maturity dates would look far more complete
// and be worth nothing, so it is not built.
//
// What IS reliable, and what this schedules:
//   - exit-load lapse   purchase_date + window   (299 lots, from `exit_load`)
//   - LTCG eligibility  purchase_date + 365/1095 (248 short-term lots, from `taxation`)
//
// No tax rate is applied anywhere. Indian CG rates changed in July 2024 and depend on
// regime and exemptions the book does not model, so this reports the DATE a lot's
// status changes and the value/gain affected — never a fabricated "tax saved" figure.

import type { PortfolioHolding } from "./types";
import { parseExitLoad, taxRegime, displayName } from "./portfolio-analytics";
import { addDays } from "./format";

export type EventKind = "exit-load" | "ltcg" | "maturity";

export interface CalendarEvent {
  kind: EventKind;
  /** ISO date the status changes. */
  date: string;
  row: PortfolioHolding;
  security: string;
  entity: string;
  /** Current value of the lot affected. */
  value: number;
  /** Unrealised gain riding on it (relevant for the LTCG switch). */
  gain: number;
  /**
   * For exit-load events, the penalty that stops applying (₹). For LTCG, 0 —
   * quantifying the tax saved would require rates this book does not model.
   */
  costAvoided: number;
  detail: string;
  /** True when the date came from parsing free text rather than a real column. */
  inferred?: boolean;
}

const LONG_TERM_DAYS = { Equity: 365, Debt: 1095, Other: 1095 } as const;

const val = (r: PortfolioHolding) => r.current_value ?? 0;
const gainOf = (r: PortfolioHolding) => r.unrealised_gain ?? 0;

/**
 * Pull a maturity date out of a security name. Deliberately conservative: only the
 * two shapes that actually occur in this book, and every hit is marked `inferred`
 * so the UI can show it as read-from-the-name rather than recorded.
 *   "CIPL Zero Coupon NCDs 2028- 17.03.28"  -> 2028-03-17
 *   "2027 Maturity 60:40 Index Fund"        -> 2027-03-31 (FY end, approximate)
 */
export function inferMaturity(name: string): { date: string; note: string } | null {
  const n = name || "";
  // dd.mm.yy(yy) — the explicit form, trusted most.
  const dotted = n.match(/(\d{2})\.(\d{2})\.(\d{2,4})\b/);
  if (dotted) {
    const [, dd, mm, yyRaw] = dotted;
    const yy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
    const m = Number(mm);
    const d = Number(dd);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        date: `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        note: "date read from the security name",
      };
    }
  }
  // "<year> Maturity" — only a year is stated, so land it on the Indian FY end.
  const yearOnly = n.match(/\b(20\d{2})\s+Maturity\b/i);
  if (yearOnly) {
    return { date: `${yearOnly[1]}-03-31`, note: "only a year is stated; assumed FY end" };
  }
  return null;
}

/** Every forward-dated event in the book, sorted soonest first. */
export function buildEvents(rows: PortfolioHolding[], today = new Date()): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  for (const r of rows) {
    const security = displayName(r);
    const entity = r.entity_name ?? "—";

    // ── Exit-load lapse ───────────────────────────────────────────────────────
    const term = parseExitLoad(r.exit_load);
    if (term && r.purchase_date && r.holding_period_days != null) {
      if (r.holding_period_days < term.days) {
        const date = addDays(r.purchase_date, term.days).toISOString().slice(0, 10);
        if (date >= todayIso) {
          out.push({
            kind: "exit-load",
            date,
            row: r,
            security,
            entity,
            value: val(r),
            gain: gainOf(r),
            costAvoided: val(r) * (term.ratePct / 100),
            detail: `${term.ratePct}% exit load lapses (${term.days}-day window)`,
          });
        }
      }
    }

    // ── Long-term capital gains eligibility ───────────────────────────────────
    if (r.holding_period_days != null && r.purchase_date && r.holding_term !== "Long Term") {
      const regime = taxRegime(r.taxation);
      const threshold = LONG_TERM_DAYS[regime];
      if (r.holding_period_days < threshold) {
        const date = addDays(r.purchase_date, threshold).toISOString().slice(0, 10);
        if (date >= todayIso) {
          out.push({
            kind: "ltcg",
            date,
            row: r,
            security,
            entity,
            value: val(r),
            gain: gainOf(r),
            costAvoided: 0,
            detail: `Becomes long term (${regime}, ${threshold} days)`,
          });
        }
      }
    }

    // ── Stated maturity, parsed from the name ─────────────────────────────────
    const mat = inferMaturity(security);
    if (mat && mat.date >= todayIso) {
      out.push({
        kind: "maturity",
        date: mat.date,
        row: r,
        security,
        entity,
        value: val(r),
        gain: gainOf(r),
        costAvoided: 0,
        detail: `Stated maturity — ${mat.note}`,
        inferred: true,
      });
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export interface MonthBucket {
  /** "2026-08" */
  key: string;
  label: string;
  events: CalendarEvent[];
  exitLoadValue: number;
  ltcgValue: number;
  maturityValue: number;
  costAvoided: number;
  totalValue: number;
  /** Running total of value freed up to and including this month. */
  cumulative: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Group events into consecutive month buckets, including empty months. */
export function bucketByMonth(
  events: CalendarEvent[],
  horizonMonths: number,
  today = new Date(),
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  for (let i = 0; i < horizonMonths; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      events: [],
      exitLoadValue: 0,
      ltcgValue: 0,
      maturityValue: 0,
      costAvoided: 0,
      totalValue: 0,
      cumulative: 0,
    });
  }

  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const e of events) {
    const b = index.get(e.date.slice(0, 7));
    if (!b) continue; // beyond the horizon
    b.events.push(e);
    if (e.kind === "exit-load") b.exitLoadValue += e.value;
    else if (e.kind === "ltcg") b.ltcgValue += e.value;
    else b.maturityValue += e.value;
    b.costAvoided += e.costAvoided;
    b.totalValue += e.value;
  }

  let running = 0;
  for (const b of buckets) {
    running += b.totalValue;
    b.cumulative = running;
  }
  return buckets;
}

export interface CalendarSummary {
  lockedValue: number; // still inside an exit-load window
  lockedCost: number; // penalty if all of it were sold today
  shortTermValue: number; // not yet long term
  shortTermGain: number;
  freeingIn3m: number;
  freeingIn6m: number;
  freeingIn12m: number;
  beyondHorizon: number; // events dated past the chosen horizon
}

export function summarise(
  events: CalendarEvent[],
  horizonMonths: number,
  today = new Date(),
): CalendarSummary {
  const at = (months: number) => {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, today.getUTCDate()),
    );
    return d.toISOString().slice(0, 10);
  };
  const m3 = at(3);
  const m6 = at(6);
  const m12 = at(12);
  const horizonEnd = at(horizonMonths);

  const exitLoad = events.filter((e) => e.kind === "exit-load");
  const ltcg = events.filter((e) => e.kind === "ltcg");

  return {
    lockedValue: exitLoad.reduce((s, e) => s + e.value, 0),
    lockedCost: exitLoad.reduce((s, e) => s + e.costAvoided, 0),
    shortTermValue: ltcg.reduce((s, e) => s + e.value, 0),
    shortTermGain: ltcg.reduce((s, e) => s + e.gain, 0),
    freeingIn3m: events.filter((e) => e.date <= m3).reduce((s, e) => s + e.value, 0),
    freeingIn6m: events.filter((e) => e.date <= m6).reduce((s, e) => s + e.value, 0),
    freeingIn12m: events.filter((e) => e.date <= m12).reduce((s, e) => s + e.value, 0),
    beyondHorizon: events.filter((e) => e.date > horizonEnd).reduce((s, e) => s + e.value, 0),
  };
}

// --series-N rather than --chart-N: these three are stacked against each other and
// must separate under colour-vision deficiency on both the light and dark surface.
// See the note beside their definition in styles.css.
export const EVENT_META: Record<EventKind, { label: string; colour: string; short: string }> = {
  "exit-load": { label: "Exit load lapses", colour: "var(--series-1)", short: "Exit load" },
  ltcg: { label: "Becomes long term", colour: "var(--series-2)", short: "LTCG" },
  maturity: { label: "Stated maturity", colour: "var(--series-3)", short: "Maturity" },
};
