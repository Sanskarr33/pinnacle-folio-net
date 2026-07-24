// Manual data-entry layer — add and remove holdings from inside the dashboard.
//
// This is the companion to overrides.ts. That file EDITS fields on rows that came
// from the workbook; this file ADDS whole new holdings and REMOVES existing ones.
// Together they let the dashboard be worked in directly rather than only viewed.
//
// Where the data lives, stated plainly because it matters:
//   The daily sync rebuilds the book from the Excel workbook and overwrites the
//   Supabase copy. So a holding written straight to Supabase would be gone by the
//   next morning. Instead, manual entries are held in this browser (localStorage),
//   merged into every view through useBook, individually revertible, fully logged,
//   and EXPORTABLE — so they can be folded back into the workbook, which is the
//   source the daily pipeline actually reads. Nothing added here is ever silently
//   destroyed by the sync; equally, nothing here reaches another device until it is
//   exported into the master. The management page says this in plain words.
//
// Every change appends to an audit log: what changed, to what, and when.

import type { PortfolioHolding } from "./types";
import { naturalKey } from "./overrides";

const HOLDINGS_KEY = "sg-manual-holdings";
const TOMBSTONES_KEY = "sg-manual-tombstones";
const AUDIT_KEY = "sg-manual-audit";

/** A holding the user typed in. Carries the full row plus provenance. */
export interface ManualHolding extends PortfolioHolding {
  /** Marks a row as user-entered so the UI can badge it and the export can flag it. */
  _manual: true;
  _createdAt: string;
  _updatedAt: string;
}

/** A removal of a workbook row, keyed on its natural key so it survives re-import. */
export interface Tombstone {
  key: string;
  label: string; // human-readable, for the audit list
  removedAt: string;
  reason?: string;
}

export interface AuditEntry {
  at: string;
  action: "add" | "edit" | "delete" | "restore" | "clear";
  target: string; // security name / label
  detail?: string;
}

// ─── low-level storage ──────────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

const listeners = new Set<() => void>();
export function subscribeManual(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// useSyncExternalStore needs a referentially-stable snapshot between changes.
interface ManualSnapshot {
  holdings: ManualHolding[];
  tombstones: Record<string, Tombstone>;
  audit: AuditEntry[];
}
let cached: ManualSnapshot | null = null;

export function getManualSnapshot(): ManualSnapshot {
  if (cached === null) {
    cached = {
      holdings: readJSON<ManualHolding[]>(HOLDINGS_KEY, []),
      tombstones: readJSON<Record<string, Tombstone>>(TOMBSTONES_KEY, {}),
      audit: readJSON<AuditEntry[]>(AUDIT_KEY, []),
    };
  }
  return cached;
}
export function getServerManualSnapshot(): ManualSnapshot {
  return EMPTY;
}
const EMPTY: ManualSnapshot = { holdings: [], tombstones: {}, audit: [] };

function emit() {
  cached = null;
  listeners.forEach((f) => f());
}

function logAudit(entry: Omit<AuditEntry, "at">) {
  const audit = readJSON<AuditEntry[]>(AUDIT_KEY, []);
  audit.unshift({ ...entry, at: new Date().toISOString() });
  // Keep the log bounded; the most recent 500 changes is more than anyone needs.
  writeJSON(AUDIT_KEY, audit.slice(0, 500));
}

// ─── input & validation ─────────────────────────────────────────────────────

export interface HoldingInput {
  security_name: string;
  entity_name: string;
  broker_name?: string;
  folio_number?: string;
  asset_class: string;
  category?: string;
  product_type?: string;
  taxation?: string;
  units?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  invested_value: number;
  current_value: number;
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Reject the entries that would make a row inconsistent or meaningless. */
export function validateHolding(input: Partial<HoldingInput>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.security_name?.trim()) errors.security_name = "A security name is required.";
  if (!input.entity_name?.trim()) errors.entity_name = "Choose which entity owns this.";
  if (!input.asset_class?.trim()) errors.asset_class = "An asset class is required.";

  const inv = input.invested_value;
  const cur = input.current_value;
  if (inv == null || Number.isNaN(inv)) errors.invested_value = "Enter the amount invested.";
  else if (inv < 0) errors.invested_value = "Invested amount cannot be negative.";
  if (cur == null || Number.isNaN(cur)) errors.current_value = "Enter the current value.";
  else if (cur < 0) errors.current_value = "Current value cannot be negative.";

  if (input.units != null && input.units < 0) errors.units = "Units cannot be negative.";
  if (input.purchase_date && input.purchase_date > TODAY())
    errors.purchase_date = "Purchase date is in the future.";
  if (input.purchase_date && input.purchase_date < "1990-01-01")
    errors.purchase_date = "That date looks wrong (before 1990).";

  return { ok: Object.keys(errors).length === 0, errors };
}

const LONG_TERM_DAYS: Record<string, number> = { Equity: 365, Debt: 1095, Other: 1095 };

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Turn validated input into a complete, internally-consistent holding row. */
export function buildHolding(input: HoldingInput, asOn: string): ManualHolding {
  const invested = input.invested_value;
  const current = input.current_value;
  const units = input.units ?? null;
  const held = input.purchase_date ? daysBetween(input.purchase_date, asOn) : null;
  const regime =
    input.taxation === "Debt" ? "Debt" : input.taxation === "Equity" ? "Equity" : "Other";
  const term = held == null ? null : held >= LONG_TERM_DAYS[regime] ? "Long Term" : "Short Term";
  const now = new Date().toISOString();

  return {
    id: `manual-${Date.now()}-${Math.floor(performance.now())}`,
    as_on_date: asOn,
    report_section: "Manual entry",
    source_sheet: "Manual entry",
    source_page: null,
    source_row: null,
    notes: input.notes?.trim() || null,
    created_at: now,
    entity_name: input.entity_name.trim(),
    account_name: null,
    broker_name: input.broker_name?.trim() || null,
    advisor_name: null,
    folio_number: input.folio_number?.trim() || null,
    asset_class: input.asset_class.trim(),
    category: input.category?.trim() || null,
    product_type: input.product_type?.trim() || null,
    taxation: input.taxation?.trim() || null,
    scheme_type: null,
    fund_type: null,
    isin: null,
    ticker: null,
    security_name: input.security_name.trim(),
    scheme_name: null,
    quantity: units,
    units,
    purchase_date: input.purchase_date || null,
    purchase_price: input.purchase_price ?? null,
    purchase_nav: input.purchase_price ?? null,
    current_price: units && units > 0 ? current / units : null,
    current_nav: units && units > 0 ? current / units : null,
    invested_value: invested,
    current_value: current,
    unrealised_gain: current - invested,
    gain_percent: invested !== 0 ? ((current - invested) / invested) * 100 : null,
    allocation_percent: null, // recomputed in the merge layer against the whole book
    xirr: null,
    exit_load: null,
    holding_period_days: held,
    holding_term: term,
    expense_ratio: null,
    pe_ratio: null,
    aum: null,
    _manual: true,
    _createdAt: now,
    _updatedAt: now,
  };
}

// ─── mutations ──────────────────────────────────────────────────────────────

export function addHolding(input: HoldingInput, asOn: string): ManualHolding {
  const row = buildHolding(input, asOn);
  const holdings = readJSON<ManualHolding[]>(HOLDINGS_KEY, []);
  holdings.push(row);
  writeJSON(HOLDINGS_KEY, holdings);
  logAudit({
    action: "add",
    target: row.security_name ?? "—",
    detail: `${input.asset_class}, ${input.entity_name}`,
  });
  emit();
  return row;
}

export function updateManualHolding(id: string, input: HoldingInput, asOn: string): void {
  const holdings = readJSON<ManualHolding[]>(HOLDINGS_KEY, []);
  const i = holdings.findIndex((h) => h.id === id);
  if (i < 0) return;
  const rebuilt = buildHolding(input, asOn);
  rebuilt.id = id; // keep identity stable
  rebuilt._createdAt = holdings[i]._createdAt;
  rebuilt._updatedAt = new Date().toISOString();
  holdings[i] = rebuilt;
  writeJSON(HOLDINGS_KEY, holdings);
  logAudit({ action: "edit", target: rebuilt.security_name ?? "—" });
  emit();
}

/** Remove a manual holding outright (it was never in the workbook). */
export function removeManualHolding(id: string): void {
  const holdings = readJSON<ManualHolding[]>(HOLDINGS_KEY, []);
  const row = holdings.find((h) => h.id === id);
  const next = holdings.filter((h) => h.id !== id);
  writeJSON(HOLDINGS_KEY, next);
  if (row)
    logAudit({
      action: "delete",
      target: row.security_name ?? "—",
      detail: "manual entry removed",
    });
  emit();
}

/** Hide a workbook row. Recorded as a tombstone so re-import does not resurrect it. */
export function tombstoneRow(row: PortfolioHolding, reason?: string): void {
  const key = naturalKey(row);
  const tombstones = readJSON<Record<string, Tombstone>>(TOMBSTONES_KEY, {});
  tombstones[key] = {
    key,
    label: row.security_name || row.scheme_name || key,
    removedAt: new Date().toISOString(),
    reason,
  };
  writeJSON(TOMBSTONES_KEY, tombstones);
  logAudit({
    action: "delete",
    target: row.security_name ?? "—",
    detail: reason || "removed from book",
  });
  emit();
}

export function restoreRow(key: string): void {
  const tombstones = readJSON<Record<string, Tombstone>>(TOMBSTONES_KEY, {});
  const t = tombstones[key];
  delete tombstones[key];
  writeJSON(TOMBSTONES_KEY, tombstones);
  if (t) logAudit({ action: "restore", target: t.label });
  emit();
}

export function clearAllManual(): void {
  writeJSON(HOLDINGS_KEY, []);
  writeJSON(TOMBSTONES_KEY, {});
  logAudit({ action: "clear", target: "all manual entries" });
  emit();
}

// ─── merge into the book ────────────────────────────────────────────────────

export interface ManualStats {
  added: number;
  removed: number;
  addedValue: number;
}

/**
 * Apply the manual layer to a set of rows: drop tombstoned workbook rows, append
 * user-added holdings, and recompute allocation % across the resulting book so the
 * shares stay internally consistent. Returns the original array by reference when
 * there is nothing to change, so React can skip the re-render.
 */
export function applyManualLayer(
  rows: PortfolioHolding[],
  snap: ManualSnapshot = getManualSnapshot(),
): { rows: PortfolioHolding[]; stats: ManualStats } {
  const hasTombstones = Object.keys(snap.tombstones).length > 0;
  const hasAdds = snap.holdings.length > 0;
  if (!hasTombstones && !hasAdds) {
    return { rows, stats: { added: 0, removed: 0, addedValue: 0 } };
  }

  const kept = hasTombstones ? rows.filter((r) => !snap.tombstones[naturalKey(r)]) : rows.slice();
  const removed = rows.length - kept.length;

  const merged = hasAdds ? [...kept, ...snap.holdings] : kept;
  const addedValue = snap.holdings.reduce((s, h) => s + (h.current_value ?? 0), 0);

  const total = merged.reduce((s, r) => s + (r.current_value ?? 0), 0) || 1;
  const out = merged.map((r) => ({
    ...r,
    allocation_percent: ((r.current_value ?? 0) / total) * 100,
  }));

  return {
    rows: out,
    stats: { added: snap.holdings.length, removed, addedValue },
  };
}

export function isManual(row: PortfolioHolding): row is ManualHolding {
  return (row as ManualHolding)._manual === true;
}
