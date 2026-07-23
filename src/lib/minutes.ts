// Imported advisor minutes.
//
// Generated from the source PDFs/DOCX by `python scripts/import_minutes.py`.
// The documents are READ-ONLY in the app — re-running the importer replaces this
// snapshot wholesale. What a user records ABOUT an imported action (status, owner,
// due date, closure note) lives in localStorage keyed on the action's stable id, so
// it survives re-import.

import snapshot from "@/data/meetings-snapshot.json";
import type { ActionStatus } from "./meetings";

export interface MinuteSection {
  number: string;
  heading: string;
  text: string;
}

export interface MinuteAction {
  id: string;
  title: string;
  owner: string;
  target: string;
}

export interface ImportedMeeting {
  id: string;
  advisor: string;
  advisorKey: string;
  date: string | null;
  dateIsApproximate: boolean;
  title: string;
  kind: string;
  meetingType: string;
  duration: string;
  platform: string;
  client: string;
  attendees: string[];
  circulatedTo: string;
  preparedBy: string;
  status: string;
  followUp: string;
  sourceFile: string;
  purpose: string;
  keyTakeaways: string[];
  sections: MinuteSection[];
  actionsRaw: string;
  actions: MinuteAction[];
  wordCount: number;
}

export interface AdvisorSummary {
  key: string;
  name: string;
  meetingCount: number;
  actionCount: number;
}

const SNAP = snapshot as unknown as {
  source: string;
  generatedAt: string;
  advisors: AdvisorSummary[];
  meetings: ImportedMeeting[];
};

export const MINUTES_SOURCE = SNAP.source;
export const MINUTES_GENERATED_AT = SNAP.generatedAt;
export const IMPORTED_MEETINGS: ImportedMeeting[] = SNAP.meetings;
export const ADVISORS: AdvisorSummary[] = SNAP.advisors;

export function meetingsForAdvisor(key: string | null): ImportedMeeting[] {
  return key ? IMPORTED_MEETINGS.filter((m) => m.advisorKey === key) : IMPORTED_MEETINGS;
}

export function findMeeting(id: string): ImportedMeeting | undefined {
  return IMPORTED_MEETINGS.find((m) => m.id === id);
}

// ─── Tracking overlay for imported actions ────────────────────────────────────
// Imported actions carry no status of their own — the documents record what was
// agreed, not what has since been done. This overlay is where that is tracked.

export interface ActionTracking {
  status: ActionStatus;
  owner: string;
  dueDate: string | null;
  closedAt: string | null;
  closureNote: string;
  updatedAt: string;
}

const TRACK_KEY = "sg-minutes-tracking";

type TrackStore = Record<string, ActionTracking>;

function read(): TrackStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(TRACK_KEY);
    return raw ? (JSON.parse(raw) as TrackStore) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();
let cached: TrackStore | null = null;

export function subscribeTracking(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getTracking(): TrackStore {
  if (cached === null) cached = read();
  return cached;
}
export function getServerTracking(): TrackStore {
  return {};
}

function commit(next: TrackStore) {
  cached = next;
  try {
    localStorage.setItem(TRACK_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode */
  }
  listeners.forEach((fn) => fn());
}

/** Default state for an action the user has not touched yet. */
export const UNTRACKED: ActionTracking = {
  status: "open",
  owner: "",
  dueDate: null,
  closedAt: null,
  closureNote: "",
  updatedAt: "",
};

export function trackingFor(actionId: string, store: TrackStore = getTracking()): ActionTracking {
  return store[actionId] ?? UNTRACKED;
}

export function setTracking(actionId: string, patch: Partial<ActionTracking>) {
  const store = { ...getTracking() };
  const prev = store[actionId] ?? UNTRACKED;
  const next: ActionTracking = { ...prev, ...patch, updatedAt: new Date().toISOString() };

  // Stamp/clear the closure date on transition so the "acted upon" record cannot
  // disagree with the status.
  const closing = next.status === "done" || next.status === "dropped";
  const wasClosed = prev.status === "done" || prev.status === "dropped";
  next.closedAt = closing
    ? wasClosed
      ? (prev.closedAt ?? new Date().toISOString())
      : new Date().toISOString()
    : null;

  store[actionId] = next;
  commit(store);
}

export function clearTracking(actionId: string) {
  const store = { ...getTracking() };
  delete store[actionId];
  commit(store);
}

/** Every imported action, flattened, with its tracking state and meeting context. */
export interface TrackedAction extends MinuteAction {
  meetingId: string;
  advisor: string;
  advisorKey: string;
  meetingDate: string | null;
  meetingTitle: string;
  tracking: ActionTracking;
}

export function allTrackedActions(store: TrackStore = getTracking()): TrackedAction[] {
  const out: TrackedAction[] = [];
  for (const m of IMPORTED_MEETINGS) {
    for (const a of m.actions) {
      out.push({
        ...a,
        meetingId: m.id,
        advisor: m.advisor,
        advisorKey: m.advisorKey,
        meetingDate: m.date,
        meetingTitle: m.title,
        tracking: store[a.id] ?? UNTRACKED,
      });
    }
  }
  return out;
}
