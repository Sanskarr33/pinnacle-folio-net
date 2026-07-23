// Advisor meetings and the actions that come out of them.
//
// Unlike holdings — which are imported from the Excel book and regenerated daily —
// this is data the family AUTHORS. It has no upstream source, so it is the one part
// of the app that must never be overwritten by an import.
//
// STORAGE: localStorage, with JSON export/import. That is per-device and lost if the
// browser is cleared, which is not good enough for minutes of record long-term —
// `scripts/out/meetings.sql` creates the equivalent Supabase tables when you are
// ready to move it server-side.

export type ActionStatus = "open" | "in_progress" | "blocked" | "done" | "dropped";
export type ActionPriority = "high" | "medium" | "low";
export type MeetingKind = "review" | "pitch" | "annual" | "adhoc" | "call";

export interface Meeting {
  id: string;
  date: string; // ISO
  advisor: string; // firm or individual
  kind: MeetingKind;
  title: string;
  attendees: string[];
  entities: string[]; // family entities discussed
  location: string;
  agenda: string;
  notes: string;
  decisions: string;
  nextMeeting: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  meetingId: string | null; // standalone actions are allowed
  title: string;
  detail: string;
  owner: string;
  advisor: string;
  entity: string;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
  amount: number | null; // ₹ at stake, if quantifiable
  linkedSecurity: string;
  /** Set when status moves to done/dropped — the audit trail of what was acted upon. */
  closedAt: string | null;
  closureNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingStore {
  meetings: Meeting[];
  actions: ActionItem[];
  version: 1;
}

const STORAGE_KEY = "sg-meetings";

export const EMPTY_STORE: MeetingStore = { meetings: [], actions: [], version: 1 };

export const STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  dropped: "Dropped",
};

/** Done and dropped are both "closed" — dropped means consciously not doing it. */
export const OPEN_STATUSES: ActionStatus[] = ["open", "in_progress", "blocked"];
export const CLOSED_STATUSES: ActionStatus[] = ["done", "dropped"];

export const KIND_LABEL: Record<MeetingKind, string> = {
  review: "Portfolio review",
  pitch: "Product pitch",
  annual: "Annual review",
  adhoc: "Ad-hoc",
  call: "Call",
};

// ─── Persistence ──────────────────────────────────────────────────────────────

function read(): MeetingStore {
  if (typeof localStorage === "undefined") return EMPTY_STORE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as MeetingStore;
    return {
      version: 1,
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

function write(store: MeetingStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode */
  }
}

const listeners = new Set<() => void>();
let cached: MeetingStore | null = null;

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// useSyncExternalStore needs a referentially stable snapshot between writes.
export function getSnapshot(): MeetingStore {
  if (cached === null) cached = read();
  return cached;
}
export function getServerSnapshot(): MeetingStore {
  return EMPTY_STORE;
}

function commit(next: MeetingStore) {
  cached = next;
  write(next);
  listeners.forEach((fn) => fn());
}

// Sortable, collision-free enough for a single-user local store.
function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export function blankMeeting(): Meeting {
  const t = now();
  return {
    id: newId("mtg"),
    date: t.slice(0, 10),
    advisor: "",
    kind: "review",
    title: "",
    attendees: [],
    entities: [],
    location: "",
    agenda: "",
    notes: "",
    decisions: "",
    nextMeeting: null,
    createdAt: t,
    updatedAt: t,
  };
}

export function saveMeeting(m: Meeting) {
  const s = getSnapshot();
  const i = s.meetings.findIndex((x) => x.id === m.id);
  const updated = { ...m, updatedAt: now() };
  const meetings =
    i === -1 ? [updated, ...s.meetings] : s.meetings.map((x) => (x.id === m.id ? updated : x));
  commit({ ...s, meetings });
}

/** Deleting a meeting keeps its actions but detaches them, so no history is lost. */
export function deleteMeeting(id: string) {
  const s = getSnapshot();
  commit({
    ...s,
    meetings: s.meetings.filter((m) => m.id !== id),
    actions: s.actions.map((a) => (a.meetingId === id ? { ...a, meetingId: null } : a)),
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function blankAction(meetingId: string | null = null): ActionItem {
  const t = now();
  return {
    id: newId("act"),
    meetingId,
    title: "",
    detail: "",
    owner: "",
    advisor: "",
    entity: "",
    dueDate: null,
    priority: "medium",
    status: "open",
    amount: null,
    linkedSecurity: "",
    closedAt: null,
    closureNote: "",
    createdAt: t,
    updatedAt: t,
  };
}

export function saveAction(a: ActionItem) {
  const s = getSnapshot();
  const prev = s.actions.find((x) => x.id === a.id);
  const closing = CLOSED_STATUSES.includes(a.status);
  const wasClosed = prev ? CLOSED_STATUSES.includes(prev.status) : false;

  const updated: ActionItem = {
    ...a,
    updatedAt: now(),
    // Stamp the closure date on transition, and clear it if reopened, so
    // "what did we act on and when" stays truthful.
    closedAt: closing ? (wasClosed ? (prev?.closedAt ?? now()) : now()) : null,
  };

  const i = s.actions.findIndex((x) => x.id === a.id);
  const actions =
    i === -1 ? [updated, ...s.actions] : s.actions.map((x) => (x.id === a.id ? updated : x));
  commit({ ...s, actions });
}

export function deleteAction(id: string) {
  const s = getSnapshot();
  commit({ ...s, actions: s.actions.filter((a) => a.id !== id) });
}

export function setActionStatus(id: string, status: ActionStatus, note = "") {
  const s = getSnapshot();
  const a = s.actions.find((x) => x.id === id);
  if (!a) return;
  saveAction({ ...a, status, closureNote: note || a.closureNote });
}

// ─── Derived views ────────────────────────────────────────────────────────────

export function isOverdue(a: ActionItem, today = new Date()): boolean {
  if (!a.dueDate || CLOSED_STATUSES.includes(a.status)) return false;
  return new Date(a.dueDate) < new Date(today.toISOString().slice(0, 10));
}

export function daysUntil(dateISO: string | null, today = new Date()): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  const t0 = new Date(today.toISOString().slice(0, 10)).getTime();
  return Math.round((d.getTime() - t0) / 86_400_000);
}

/** How long an action has been open, or how long it took to close. */
export function ageDays(a: ActionItem, today = new Date()): number {
  const start = new Date(a.createdAt).getTime();
  const end = a.closedAt ? new Date(a.closedAt).getTime() : today.getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export interface ActionStats {
  total: number;
  open: number;
  inProgress: number;
  blocked: number;
  done: number;
  dropped: number;
  overdue: number;
  dueThisWeek: number;
  completionRate: number; // done / (done + dropped + open-ish)
  avgDaysToClose: number | null;
  openValue: number; // ₹ at stake still outstanding
  closedValue: number;
}

export function actionStats(actions: ActionItem[], today = new Date()): ActionStats {
  const by = (s: ActionStatus) => actions.filter((a) => a.status === s);
  const done = by("done");
  const dropped = by("dropped");
  const closed = [...done, ...dropped];
  const openish = actions.filter((a) => OPEN_STATUSES.includes(a.status));

  const closeTimes = done.filter((a) => a.closedAt).map((a) => ageDays(a, today));

  return {
    total: actions.length,
    open: by("open").length,
    inProgress: by("in_progress").length,
    blocked: by("blocked").length,
    done: done.length,
    dropped: dropped.length,
    overdue: actions.filter((a) => isOverdue(a, today)).length,
    dueThisWeek: openish.filter((a) => {
      const d = daysUntil(a.dueDate, today);
      return d != null && d >= 0 && d <= 7;
    }).length,
    completionRate: actions.length ? (done.length / actions.length) * 100 : 0,
    avgDaysToClose: closeTimes.length
      ? closeTimes.reduce((s, n) => s + n, 0) / closeTimes.length
      : null,
    openValue: openish.reduce((s, a) => s + (a.amount ?? 0), 0),
    closedValue: closed.reduce((s, a) => s + (a.amount ?? 0), 0),
  };
}

// ─── Import / export ──────────────────────────────────────────────────────────

export function exportJson(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

/**
 * Merge an exported file back in. Existing ids are updated rather than duplicated,
 * so importing the same backup twice is safe.
 */
export function importJson(raw: string): { meetings: number; actions: number } {
  const parsed = JSON.parse(raw) as Partial<MeetingStore>;
  const s = getSnapshot();
  const mById = new Map(s.meetings.map((m) => [m.id, m]));
  const aById = new Map(s.actions.map((a) => [a.id, a]));
  let mCount = 0;
  let aCount = 0;

  for (const m of parsed.meetings ?? []) {
    if (m?.id) {
      mById.set(m.id, m);
      mCount++;
    }
  }
  for (const a of parsed.actions ?? []) {
    if (a?.id) {
      aById.set(a.id, a);
      aCount++;
    }
  }

  commit({
    version: 1,
    meetings: [...mById.values()].sort((a, b) => b.date.localeCompare(a.date)),
    actions: [...aById.values()],
  });
  return { meetings: mCount, actions: aCount };
}

export function clearAll() {
  commit(EMPTY_STORE);
}
