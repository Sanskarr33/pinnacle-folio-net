// Local edit layer over the imported book.
//
// The Excel workbook stays the source of truth: the daily import regenerates the
// snapshot wholesale, and row ids are reassigned every run. So corrections can NOT
// be keyed on row id — they are keyed on a NATURAL key (security + folio + entity +
// purchase date + units) that survives re-import and row reordering.
//
// Edits are held in localStorage, marked in the UI, individually revertible, and
// exportable — so the dashboard never silently diverges from the workbook.

import type { PortfolioHolding } from "./types";

const STORAGE_KEY = "sg-holding-overrides";

/** Fields a user is allowed to correct. Derived values are recomputed, not stored. */
export const EDITABLE_FIELDS = [
  "security_name",
  "entity_name",
  "broker_name",
  "folio_number",
  "asset_class",
  "category",
  "product_type",
  "taxation",
  "quantity",
  "units",
  "purchase_date",
  "purchase_price",
  "purchase_nav",
  "current_price",
  "current_nav",
  "invested_value",
  "current_value",
  "xirr",
  "exit_load",
  "holding_period_days",
  "holding_term",
  "notes",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export interface Override {
  key: string;
  field: EditableField;
  value: string | number | null;
  original: string | number | null;
  editedAt: string;
}

/** Stable identity for a lot, independent of import order or generated ids. */
export function naturalKey(r: PortfolioHolding): string {
  return [
    (r.security_name || r.scheme_name || "").trim().toLowerCase(),
    (r.folio_number ?? "").trim(),
    (r.entity_name ?? "").trim().toLowerCase(),
    r.purchase_date ?? "",
    r.units ?? r.quantity ?? "",
    r.source_sheet ?? "",
  ].join("|");
}

type Store = Record<string, Record<string, Override>>;

function read(): Store {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — edits simply won't persist */
  }
}

const listeners = new Set<() => void>();

/** Subscribe to override changes (used by useSyncExternalStore). */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  cachedSnapshot = null;
  listeners.forEach((fn) => fn());
}

// useSyncExternalStore requires a referentially-stable snapshot between changes.
let cachedSnapshot: Store | null = null;
export function getSnapshot(): Store {
  if (cachedSnapshot === null) cachedSnapshot = read();
  return cachedSnapshot;
}
export function getServerSnapshot(): Store {
  return {};
}

export function setOverride(
  row: PortfolioHolding,
  field: EditableField,
  value: string | number | null,
) {
  const key = naturalKey(row);
  const store = { ...read() };
  const original = (row as unknown as Record<string, unknown>)[field] as string | number | null;

  // Setting a value back to its original clears the override instead of storing a no-op.
  if (String(value ?? "") === String(original ?? "")) {
    if (store[key]) {
      const { [field]: _removed, ...rest } = store[key];
      if (Object.keys(rest).length === 0) delete store[key];
      else store[key] = rest;
    }
  } else {
    store[key] = {
      ...(store[key] ?? {}),
      [field]: { key, field, value, original, editedAt: new Date().toISOString() },
    };
  }
  write(store);
  emit();
}

export function clearOverride(row: PortfolioHolding, field: EditableField) {
  const key = naturalKey(row);
  const store = { ...read() };
  if (!store[key]) return;
  const { [field]: _removed, ...rest } = store[key];
  if (Object.keys(rest).length === 0) delete store[key];
  else store[key] = rest;
  write(store);
  emit();
}

export function clearAllOverrides() {
  write({});
  emit();
}

export function overrideCount(store: Store = getSnapshot()): number {
  return Object.values(store).reduce((n, fields) => n + Object.keys(fields).length, 0);
}

export function allOverrides(store: Store = getSnapshot()): Override[] {
  return Object.values(store).flatMap((fields) => Object.values(fields));
}

/**
 * Apply stored corrections to a row. Monetary edits recompute unrealised gain and
 * gain % so the row stays internally consistent — editing "current value" without
 * that would leave a gain figure that contradicts it.
 */
export function applyOverrides(
  row: PortfolioHolding,
  store: Store = getSnapshot(),
): PortfolioHolding {
  const edits = store[naturalKey(row)];
  if (!edits) return row;

  const out = { ...row } as unknown as Record<string, unknown>;
  for (const o of Object.values(edits)) out[o.field] = o.value;

  const invested = out.invested_value as number | null;
  const current = out.current_value as number | null;
  const touchedMoney = Object.keys(edits).some(
    (f) => f === "invested_value" || f === "current_value",
  );
  if (touchedMoney && typeof invested === "number" && typeof current === "number") {
    out.unrealised_gain = current - invested;
    out.gain_percent = invested !== 0 ? ((current - invested) / invested) * 100 : null;
  }
  return out as unknown as PortfolioHolding;
}

/** True if this specific cell has been corrected. */
export function isEdited(
  row: PortfolioHolding,
  field: string,
  store: Store = getSnapshot(),
): boolean {
  return Boolean(store[naturalKey(row)]?.[field]);
}

export function editedFields(
  row: PortfolioHolding,
  store: Store = getSnapshot(),
): Record<string, Override> {
  return store[naturalKey(row)] ?? {};
}
