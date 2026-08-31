// Holds a pasted portfolio file so the dashboard can be refreshed without a
// redeploy.
//
// Kept in localStorage, matching overrides.ts and manual-entries.ts: the
// deployed portfolio.json is a static asset and there is no write path back to
// it (the Supabase client carries a publishable anon key, and no Netlify
// function writes). So a paste updates THIS BROWSER only — it does not reach a
// phone or another family member's session.
//
// Everything below goes through the small interface at the bottom of this file,
// so a server-backed store can be dropped in later without touching the UI.

import { parsePortfolio, type LoadedPortfolio } from "./portfolio-file";

const STORAGE_KEY = "sg-portfolio-paste-v1";

export interface PastedRecord {
  /** The raw text exactly as pasted. Re-parsed on read, never trusted as typed. */
  json: string;
  /** When it was pasted, ISO. Distinct from meta.asOfHoldings, which is the mark. */
  pastedAt: string;
  /** Optional note the user typed, e.g. "29 Aug MProfit pull". */
  label: string;
}

export type PortfolioSource =
  | { kind: "deployed" }
  | { kind: "pasted"; pastedAt: string; label: string };

// ─── Store ────────────────────────────────────────────────────────────────────

let cache: PastedRecord | null | undefined;
const listeners = new Set<() => void>();

function read(): PastedRecord | null {
  if (cache !== undefined) return cache;
  if (typeof localStorage === "undefined") return (cache = null);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as PastedRecord) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function emit() {
  for (const fn of listeners) fn();
}

export function subscribePaste(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPasteSnapshot(): PastedRecord | null {
  return read();
}

/** SSR has no localStorage; always report "nothing pasted" so markup matches. */
export function getServerPasteSnapshot(): PastedRecord | null {
  return null;
}

export class PortfolioStoreError extends Error {}

/**
 * Validate then persist. Parsing first means a bad paste can never displace a
 * good one — the store only ever holds text that has already parsed cleanly.
 */
export function savePaste(json: string, label: string): LoadedPortfolio {
  const loaded = parsePortfolio(json, "Pasted data");

  const record: PastedRecord = {
    json,
    pastedAt: new Date().toISOString(),
    label: label.trim(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (cause) {
    // A full 465-holding file is a few hundred KB; a browser at its ~5MB origin
    // quota will reject it. Say so plainly rather than failing silently and
    // leaving the previous paste on screen as if the new one had applied.
    throw new PortfolioStoreError(
      cause instanceof Error && /quota/i.test(cause.message)
        ? "This browser's storage is full, so the paste was not saved. Clear site data and try again."
        : "The paste could not be saved to this browser's storage.",
    );
  }

  cache = record;
  emit();
  return loaded;
}

/** Drop the paste and fall back to the deployed portfolio.json. */
export function clearPaste(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do — the in-memory clear below still takes effect.
  }
  cache = null;
  emit();
}

/**
 * Re-parse the stored paste.
 *
 * Returns null when nothing is stored, and also when the stored text no longer
 * parses — a schema the current build cannot read must fall back to the
 * deployed file rather than blanking the page.
 */
export function loadPaste(record: PastedRecord | null): LoadedPortfolio | null {
  if (!record) return null;
  try {
    return parsePortfolio(record.json, "Pasted data");
  } catch {
    return null;
  }
}
