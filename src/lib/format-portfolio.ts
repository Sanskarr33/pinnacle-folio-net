// Display formatters for the portfolio.json dashboard.
//
// Deliberately separate from format.ts: this file's conventions differ (no space
// before the unit, "n/a" rather than "N/A", U+2212 MINUS rather than a hyphen),
// and format.ts is on the render path of 33 other routes that must not shift.
//
// NOTHING here computes a financial figure. These functions only turn a number
// that already exists in the file into a string. The one arithmetic operation is
// dividing by 1e7 / 1e5 to pick a display unit, which changes the notation, not
// the quantity.

export const CR = 10_000_000;
export const LAKH = 100_000;

/** U+2212 MINUS SIGN. A hyphen is not a minus and reads wrong in tabular figures. */
export const MINUS = "−";

/** The single spelling of "no value". Never 0, never blank, never NaN. */
export const NA = "n/a";

/** True when a value is absent or unusable — the only gate to NA. */
function isBlank(n: number | null | undefined): n is null | undefined {
  return n == null || !Number.isFinite(n);
}

/**
 * Rupees → "₹333.04cr" / "₹7.19L" / "₹12,345".
 *
 * Sub-lakh amounts use en-IN digit grouping (1,23,456 rather than 123,456).
 * Negatives carry a real minus sign; callers that also want a "+" use inrSigned.
 */
export function inr(amount: number | null | undefined): string {
  if (isBlank(amount)) return NA;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? MINUS : "";
  if (abs >= CR) return `${sign}₹${(abs / CR).toFixed(2)}cr`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(2)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/**
 * Rupees with an explicit sign on both directions — "+₹7.19L" / "−₹1.10cr".
 * For movement and gain figures, where the direction is the point.
 */
export function inrSigned(amount: number | null | undefined): string {
  if (isBlank(amount)) return NA;
  // Route through inr() so the unit thresholds stay in one place, then replace
  // its sign (absent or MINUS) with an explicit one.
  const body = inr(Math.abs(amount));
  return `${amount < 0 ? MINUS : "+"}${body}`;
}

/** Two decimals and a % suffix. No forced sign; negatives still show MINUS. */
export function pct(n: number | null | undefined): string {
  if (isBlank(n)) return NA;
  const abs = Math.abs(n);
  return `${n < 0 ? MINUS : ""}${abs.toFixed(2)}%`;
}

/** Two decimals, % suffix, explicit sign both ways — for markToMarketPct etc. */
export function pctSigned(n: number | null | undefined): string {
  if (isBlank(n)) return NA;
  const abs = Math.abs(n);
  return `${n < 0 ? MINUS : "+"}${abs.toFixed(2)}%`;
}

/** Plain number with en-IN grouping, for quantities. */
export function qty(n: number | null | undefined, digits = 2): string {
  if (isBlank(n)) return NA;
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

/** A unit price. Same grouping as qty but always 2dp, since it is money. */
export function price(n: number | null | undefined): string {
  if (isBlank(n)) return NA;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Tailwind text colour for a signed figure. `null` for absent values so a
 * missing number is never painted as a gain or a loss.
 */
export function toneOf(n: number | null | undefined): string {
  if (isBlank(n) || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-success" : "text-destructive";
}

// ─── Dates ────────────────────────────────────────────────────────────────────

const IST_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
};

const IST_TIME: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
};

/**
 * ISO-8601 (+05:30) → "29 Aug 2026, 9:09 AM IST".
 *
 * Pinned to Asia/Kolkata rather than the viewer's zone: these marks are stamped
 * by an Indian back office, and a principal opening the page abroad should see
 * the mark as the book recorded it, not shifted into local time.
 */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  const date = d.toLocaleDateString("en-IN", IST_DATE);
  const time = d.toLocaleTimeString("en-IN", IST_TIME).toUpperCase().replace(/\s+/g, " ");
  return `${date}, ${time} IST`;
}

/** ISO-8601 → "29 Aug 2026". For footers and column headers. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-IN", IST_DATE);
}

export type Staleness = {
  /** Whole days between the mark and now. Negative clamps to 0. */
  days: number;
  level: "fresh" | "aging" | "stale" | "unknown";
  label: string;
};

/**
 * How old is this mark? Drives the banner that must never be hideable.
 *
 * Thresholds are on elapsed hours, not calendar days, so a mark taken late
 * yesterday does not read as "1 day old" at 00:05 today.
 *   < 24h    fresh
 *   24–72h   aging
 *   > 72h    stale
 * An unparseable stamp is "unknown" and is styled as loudly as stale — a date we
 * cannot read is not evidence that the data is current.
 */
export function staleness(iso: string | null | undefined, now: Date = new Date()): Staleness {
  if (!iso) return { days: 0, level: "unknown", label: "No as-at date recorded" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { days: 0, level: "unknown", label: "As-at date could not be read" };
  }
  const hours = (now.getTime() - d.getTime()) / 3_600_000;
  const days = Math.max(0, Math.floor(hours / 24));
  if (hours < 24) return { days, level: "fresh", label: `as at ${formatStamp(iso)}` };
  const plural = days === 1 ? "day" : "days";
  if (hours <= 72) {
    return { days, level: "aging", label: `Data is ${days} ${plural} old` };
  }
  return { days, level: "stale", label: `STALE — data is ${days} ${plural} old` };
}
