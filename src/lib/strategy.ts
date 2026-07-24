// Strategy playbook — the family's written view per asset class / sector / theme.
//
// One strategy document per "scope" (an asset class like "Equity Mutual Funds", a
// sector like "Banking", or any custom theme). Each captures the outlook, a target
// allocation, conviction, horizon, the thesis, and concrete action points. Held in
// localStorage like the other working-state stores here — it is the family's own
// commentary, not book data, and must survive a re-import untouched.

const STORAGE_KEY = "sg-strategies";

export type Outlook = "bullish" | "neutral" | "bearish" | "";
export type Conviction = "high" | "medium" | "low" | "";

export interface Strategy {
  scope: string; // asset class / sector / theme — the dropdown value
  outlook: Outlook;
  targetPct: number | null; // desired allocation, % of book
  conviction: Conviction;
  horizon: string; // e.g. "12–18 months"
  thesis: string; // the main write-up
  actions: string[]; // concrete next steps
  updatedAt: string;
}

type Store = Record<string, Strategy>;

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
    /* quota / private mode */
  }
}

const listeners = new Set<() => void>();
let cached: Store | null = null;

export function subscribeStrategies(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getStrategiesSnapshot(): Store {
  if (cached === null) cached = read();
  return cached;
}
export function getServerStrategiesSnapshot(): Store {
  return EMPTY;
}
const EMPTY: Store = {};
function emit() {
  cached = null;
  listeners.forEach((f) => f());
}

export function emptyStrategy(scope: string): Strategy {
  return {
    scope,
    outlook: "",
    targetPct: null,
    conviction: "",
    horizon: "",
    thesis: "",
    actions: [],
    updatedAt: "",
  };
}

export function getStrategy(scope: string, store: Store = getStrategiesSnapshot()): Strategy {
  return store[scope] ?? emptyStrategy(scope);
}

/** True when the user has actually written something for this scope. */
export function hasStrategy(s: Strategy): boolean {
  return Boolean(
    s.thesis.trim() ||
    s.actions.some((a) => a.trim()) ||
    s.outlook ||
    s.conviction ||
    s.targetPct != null ||
    s.horizon.trim(),
  );
}

export function saveStrategy(strategy: Strategy): void {
  const store = { ...read() };
  const cleaned: Strategy = {
    ...strategy,
    actions: strategy.actions.map((a) => a.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
  if (hasStrategy(cleaned)) {
    store[strategy.scope] = cleaned;
  } else {
    // Saving an empty strategy clears it rather than storing a blank.
    delete store[strategy.scope];
  }
  write(store);
  emit();
}

export function deleteStrategy(scope: string): void {
  const store = { ...read() };
  delete store[scope];
  write(store);
  emit();
}

/** Scopes that have a saved strategy, most recently updated first. */
export function savedScopes(store: Store = getStrategiesSnapshot()): Strategy[] {
  return Object.values(store).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export const OUTLOOKS: { value: Outlook; label: string }[] = [
  { value: "bullish", label: "Bullish" },
  { value: "neutral", label: "Neutral" },
  { value: "bearish", label: "Bearish" },
];

export const CONVICTIONS: { value: Conviction; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// A handful of common equity sectors/themes to offer alongside the book's real asset
// classes, so the dropdown is useful before anything is typed.
export const SECTOR_SUGGESTIONS = [
  "Banking & Financials",
  "IT & Technology",
  "Pharma & Healthcare",
  "FMCG & Consumption",
  "Auto",
  "Energy & Utilities",
  "Infrastructure",
  "Metals & Materials",
  "Real Estate",
  "New-age / Digital",
];
