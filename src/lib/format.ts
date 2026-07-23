// Display formatters. All monetary values enter as ₹ rupees.

export const CR = 10_000_000;
export const LAKH = 100_000;

/** ₹ rupees → "₹12.34 Cr". Falls back to Lakh below ₹1 Cr so small numbers stay readable. */
export function inr(
  amount: number | null | undefined,
  opts?: { compact?: boolean; forceCr?: boolean },
) {
  const n = amount ?? 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (!opts?.forceCr && abs < CR) {
    if (abs < LAKH) return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
    return `${sign}₹${(abs / LAKH).toFixed(2)} L`;
  }
  return `${sign}₹${(abs / CR).toFixed(2)} Cr`;
}

/** Always renders in Crore — use inside columns where the unit is in the header. */
export function cr(amount: number | null | undefined, digits = 2) {
  return ((amount ?? 0) / CR).toFixed(digits);
}

/** Signed ₹, e.g. "+₹4.20 Cr" / "−₹1.10 Cr". */
export function inrSigned(amount: number | null | undefined) {
  const n = amount ?? 0;
  return `${n >= 0 ? "+" : "−"}₹${(Math.abs(n) / CR).toFixed(2)} Cr`;
}

export function pct(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)}%`;
}

export function pctSigned(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** ISO date → "10 Jun 2026". */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** ISO date → "10 Jun". */
export function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** 425 → "1y 2m", 45 → "45d". Used for holding periods and countdowns. */
export function humanDays(days: number | null | undefined) {
  if (days == null || !Number.isFinite(days)) return "—";
  const d = Math.max(0, Math.round(days));
  if (d < 60) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}m`;
  const y = Math.floor(d / 365);
  const m = Math.floor((d % 365) / 30);
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

export function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

/** Compact integer, e.g. 22737.19 → "22,737.19". */
export function num(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits });
}
