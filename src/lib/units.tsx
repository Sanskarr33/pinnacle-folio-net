// Global display-unit control.
//
// Every monetary figure in the app renders through this so the whole dashboard
// switches together — a page showing Crore in one panel and Lakh in another is
// worse than either. The choice is persisted per device.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Unit = "auto" | "raw" | "lakh" | "crore" | "million";

export const UNIT_OPTIONS: Array<{ value: Unit; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "Cr / L / ₹ by magnitude" },
  { value: "raw", label: "Rupees", hint: "full number, 2 decimals" },
  { value: "lakh", label: "Lakh", hint: "÷ 100,000" },
  { value: "crore", label: "Crore", hint: "÷ 10,000,000" },
  { value: "million", label: "Million", hint: "÷ 1,000,000" },
];

export const CR = 10_000_000;
export const LAKH = 100_000;
export const MILLION = 1_000_000;

const STORAGE_KEY = "sg-unit";

interface UnitContextValue {
  unit: Unit;
  setUnit: (u: Unit) => void;
  /** Decimal places used for the divided forms. */
  digits: number;
  setDigits: (d: number) => void;
}

const UnitContext = createContext<UnitContextValue>({
  unit: "auto",
  setUnit: () => {},
  digits: 2,
  setDigits: () => {},
});

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<Unit>("auto");
  const [digits, setDigitsState] = useState(2);

  // Read after mount only — localStorage does not exist during SSR, and reading
  // it during render would desync hydration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { unit?: Unit; digits?: number };
        if (parsed.unit && UNIT_OPTIONS.some((o) => o.value === parsed.unit)) {
          setUnitState(parsed.unit);
        }
        if (typeof parsed.digits === "number" && parsed.digits >= 0 && parsed.digits <= 4) {
          setDigitsState(parsed.digits);
        }
      }
    } catch {
      /* private browsing — fall back to defaults */
    }
  }, []);

  const persist = useCallback((u: Unit, d: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit: u, digits: d }));
    } catch {
      /* ignore */
    }
  }, []);

  const setUnit = useCallback(
    (u: Unit) => {
      setUnitState(u);
      persist(u, digits);
    },
    [digits, persist],
  );

  const setDigits = useCallback(
    (d: number) => {
      setDigitsState(d);
      persist(unit, d);
    },
    [unit, persist],
  );

  const value = useMemo(
    () => ({ unit, setUnit, digits, setDigits }),
    [unit, setUnit, digits, setDigits],
  );

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

// ─── Pure formatters (usable outside React, e.g. CSV export) ──────────────────

export function unitDivisor(unit: Unit): number {
  switch (unit) {
    case "lakh":
      return LAKH;
    case "crore":
      return CR;
    case "million":
      return MILLION;
    default:
      return 1;
  }
}

export function unitSuffix(unit: Unit): string {
  switch (unit) {
    case "lakh":
      return " L";
    case "crore":
      return " Cr";
    case "million":
      return " M";
    default:
      return "";
  }
}

/** Indian digit grouping (12,34,56,789.00). */
function group(n: number, digits: number): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMoney(
  amount: number | null | undefined,
  unit: Unit,
  digits = 2,
  opts?: { signed?: boolean; noSymbol?: boolean },
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const sym = opts?.noSymbol ? "" : "₹";
  const sign = amount < 0 ? "−" : opts?.signed ? "+" : "";

  if (unit === "auto") {
    if (abs >= CR) return `${sign}${sym}${group(abs / CR, digits)} Cr`;
    if (abs >= LAKH) return `${sign}${sym}${group(abs / LAKH, digits)} L`;
    return `${sign}${sym}${group(abs, digits)}`;
  }
  if (unit === "raw") return `${sign}${sym}${group(abs, digits)}`;
  return `${sign}${sym}${group(abs / unitDivisor(unit), digits)}${unitSuffix(unit)}`;
}

/** Header label for a money column, e.g. "Value (₹ Cr)". */
export function unitColumnLabel(base: string, unit: Unit): string {
  switch (unit) {
    case "lakh":
      return `${base} (₹ L)`;
    case "crore":
      return `${base} (₹ Cr)`;
    case "million":
      return `${base} (₹ M)`;
    case "raw":
      return `${base} (₹)`;
    default:
      return base;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUnits() {
  const ctx = useContext(UnitContext);
  const { unit, digits } = ctx;

  return useMemo(
    () => ({
      ...ctx,
      /** Money in the currently selected unit. */
      money: (n: number | null | undefined) => formatMoney(n, unit, digits),
      /** Money with an explicit + on positives. */
      moneySigned: (n: number | null | undefined) => formatMoney(n, unit, digits, { signed: true }),
      /** Bare number in the selected unit — for chart axes and tooltips. */
      scaled: (n: number | null | undefined) =>
        n == null || !Number.isFinite(n) ? 0 : n / unitDivisor(unit === "auto" ? "crore" : unit),
      /** Suffix for the active unit, e.g. " Cr". Auto reports Crore. */
      suffix: unitSuffix(unit === "auto" ? "crore" : unit),
      /** Divisor for the active unit; Auto reports Crore so charts stay stable. */
      divisor: unitDivisor(unit === "auto" ? "crore" : unit),
      label: (base: string) => unitColumnLabel(base, unit),
    }),
    [ctx, unit, digits],
  );
}
