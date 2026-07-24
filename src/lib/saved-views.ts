// Named, reusable view configurations.
//
// A "view" is whatever config a page needs to reconstruct what you were looking at —
// a pivot layout, a grid's filters and column set. Stored per-scope so a pivot view
// can never be offered on a holdings grid.
//
// Kept in localStorage, like the other user-state stores here: this is personal
// working state, not book data, and it must survive a re-import untouched.

const STORAGE_KEY = "sg-saved-views";

export interface SavedView<T = unknown> {
  id: string;
  scope: string; // "pivot" | "grid:mutual-funds" | …
  name: string;
  config: T;
  createdAt: string;
}

type Store = Record<string, SavedView[]>; // scope -> views

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

export function subscribeViews(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getViewsSnapshot(): Store {
  if (cached === null) cached = read();
  return cached;
}
export function getServerViewsSnapshot(): Store {
  return {};
}
function emit() {
  cached = null;
  listeners.forEach((f) => f());
}

export function viewsFor<T>(scope: string, store: Store = getViewsSnapshot()): SavedView<T>[] {
  return (store[scope] ?? []) as SavedView<T>[];
}

export function saveView<T>(scope: string, name: string, config: T): SavedView<T> {
  const store = { ...read() };
  const list = [...(store[scope] ?? [])];
  const trimmed = name.trim() || "Untitled view";
  // Re-saving under an existing name updates it rather than creating a duplicate.
  const existing = list.findIndex((v) => v.name.toLowerCase() === trimmed.toLowerCase());
  const view: SavedView<T> = {
    id: existing >= 0 ? list[existing].id : `${scope}-${Date.now()}-${list.length}`,
    scope,
    name: trimmed,
    config,
    createdAt: existing >= 0 ? list[existing].createdAt : new Date().toISOString(),
  };
  if (existing >= 0) list[existing] = view as SavedView;
  else list.push(view as SavedView);
  store[scope] = list;
  write(store);
  emit();
  return view;
}

export function deleteView(scope: string, id: string) {
  const store = { ...read() };
  store[scope] = (store[scope] ?? []).filter((v) => v.id !== id);
  if (store[scope].length === 0) delete store[scope];
  write(store);
  emit();
}
