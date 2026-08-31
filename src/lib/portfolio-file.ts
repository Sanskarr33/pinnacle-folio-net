// Loader for public/portfolio.json — the single file the dashboard reads.
//
// Refresh procedure: replace public/portfolio.json, redeploy. Nothing else moves.
//
// This module fetches, validates the envelope, and hands back plain data. It
// derives no financial figure: every number the dashboard prints is a field that
// already exists in the file. See format-portfolio.ts for the display rules.

export const PORTFOLIO_URL = "/portfolio.json";
export const SUPPORTED_SCHEMA = "1.0";

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface PortfolioMeta {
  generatedAt: string;
  asOfHoldings: string;
  asOfPerformance: string;
  priorMark: string;
  scope: string;
  scopeNote: string;
  source: string;
  currency: string;
  units: string;
  preparedBy: string;
  disclaimer: string;
  variant?: string;
}

export interface PortfolioTotals {
  currentValue: number;
  costBasis: number;
  unrealisedGain: number;
  unrealisedGainPct: number;
  netInvestment: number;
  totalGain: number;
  totalGainPct: number;
  realisedGain: number;
  income: number;
  blendedXirrPct: number | null;
  counts: {
    categories: number;
    sleeves: number;
    entities: number;
    instruments: number;
  };
}

export interface PortfolioMovement {
  fromMark: string;
  toMark: string;
  priorValue: number;
  currentValue: number;
  purchases: number;
  markToMarket: number;
  markToMarketPct: number;
  note: string;
}

export interface CategoryRow {
  name: string;
  value: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  weightPct: number;
  priorValue: number;
  markToMarket: number;
  xirrPct: number | null;
}

export interface SleeveRow {
  name: string;
  category: string;
  value: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  weightPct: number;
  priorValue: number;
  markToMarket: number;
  returnPct: number | null;
  returnType: string | null;
}

export interface EntityRow {
  name: string;
  family: string;
  value: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  weightPct: number;
}

export interface HoldingRow {
  name: string;
  sleeve: string;
  assetClass: string;
  quantity: number | null;
  avgPrice: number | null;
  currentPrice: number | null;
  value: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  sector: string;
  marketCap: string;
  amc: string;
  nilCost: boolean;
}

/** Breakdown rows share a shape; the dimension key varies by table. */
export interface BreakdownRow {
  count: number;
  value: number;
  cost: number;
  sharePct: number | null;
  assetClass?: string;
  amc?: string;
  sector?: string;
  marketCap?: string;
}

export interface PortfolioBreakdowns {
  byAssetClass: BreakdownRow[];
  byAmcMutualFundsOnly: BreakdownRow[];
  bySectorDirectEquity: BreakdownRow[];
  byMarketCapDirectEquity: BreakdownRow[];
}

export type FlagSeverity = "breach" | "open" | "watch" | "info";

export interface FlagRow {
  id: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  value: number | null;
  pct: number | null;
  owner: string;
}

export interface PortfolioFile {
  schemaVersion: string;
  meta: PortfolioMeta;
  totals: PortfolioTotals;
  movement: PortfolioMovement;
  categories: CategoryRow[];
  sleeves: SleeveRow[];
  entities: EntityRow[];
  holdings: HoldingRow[];
  breakdowns: PortfolioBreakdowns;
  flags: FlagRow[];
}

/**
 * A schema mismatch is a warning, not a failure: the file still parsed and its
 * marks are still readable, so hiding it would be worse than showing it with a
 * banner. A structural failure, by contrast, throws.
 *
 * `compact` marks a portfolio.summary.json — same structure minus holdings. The
 * page renders every other section and says the instrument list is absent,
 * rather than showing an empty table that reads as "no holdings".
 */
export interface LoadedPortfolio {
  data: PortfolioFile;
  schemaWarning: string | null;
  compact: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export class PortfolioLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioLoadError";
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Check the envelope before any component reads it.
 *
 * The point is to fail loudly on a file that is present but wrong, rather than
 * let `undefined` reach the render path and surface as blanks or NaN that look
 * like real, zero-valued positions.
 */
function assertShape(raw: unknown, label: string): { data: PortfolioFile; compact: boolean } {
  if (!isObject(raw)) {
    throw new PortfolioLoadError(`${label} is not a JSON object.`);
  }
  for (const key of ["meta", "totals", "movement", "breakdowns"] as const) {
    if (!isObject(raw[key])) {
      throw new PortfolioLoadError(`${label} is missing the "${key}" object.`);
    }
  }
  for (const key of ["categories", "sleeves", "entities", "flags"] as const) {
    if (!Array.isArray(raw[key])) {
      throw new PortfolioLoadError(`${label} is missing the "${key}" array.`);
    }
  }

  // holdings is the one optional block: portfolio.summary.json omits it by
  // design. Absent is a different thing from empty, so record which it was.
  const hasHoldings = Array.isArray(raw.holdings);
  if (raw.holdings !== undefined && !hasHoldings) {
    throw new PortfolioLoadError(`${label} has a "holdings" key that is not an array.`);
  }

  const totals = raw.totals as Record<string, unknown>;
  if (typeof totals.currentValue !== "number" || !Number.isFinite(totals.currentValue)) {
    throw new PortfolioLoadError(`${label} has no usable totals.currentValue.`);
  }
  if (!isObject(totals.counts)) {
    throw new PortfolioLoadError(`${label} is missing totals.counts.`);
  }

  const data = { ...raw, holdings: hasHoldings ? raw.holdings : [] } as unknown as PortfolioFile;
  return { data, compact: !hasHoldings };
}

/**
 * Parse and validate portfolio JSON from any source — the deployed file or a
 * paste. Throws PortfolioLoadError with a message meant to be read by whoever
 * pasted it, not just logged.
 */
export function parsePortfolio(text: string, label = "portfolio.json"): LoadedPortfolio {
  if (!text.trim()) {
    throw new PortfolioLoadError("Nothing to read — the text is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    // A dev server rewrites unknown paths to index.html, so a renamed data file
    // arrives as HTML with a 200. Name that case rather than reporting a
    // confusing "Unexpected token <".
    const looksLikeHtml = text.trimStart().startsWith("<");
    throw new PortfolioLoadError(
      looksLikeHtml
        ? `${label} is a web page, not JSON — the data file is not deployed.`
        : `${label} is not valid JSON. ${cause instanceof Error ? cause.message : ""}`.trim(),
    );
  }

  const { data, compact } = assertShape(parsed, label);

  const version = typeof data.schemaVersion === "string" ? data.schemaVersion : "(absent)";
  const schemaWarning =
    version === SUPPORTED_SCHEMA
      ? null
      : `This page understands schemaVersion ${SUPPORTED_SCHEMA}, but the file declares ${version}. Figures may be mislabelled or missing.`;

  return { data, schemaWarning, compact };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Read the file. The only network call this dashboard makes.
 *
 * Throws on transport failure, malformed JSON, or a structurally wrong file, so
 * the caller can show an error state instead of partial numbers. A schema
 * version we do not recognise comes back as a warning alongside the data.
 */
export async function fetchPortfolio(signal?: AbortSignal): Promise<LoadedPortfolio> {
  let res: Response;
  try {
    res = await fetch(PORTFOLIO_URL, { signal, cache: "no-cache" });
  } catch (cause) {
    throw new PortfolioLoadError(
      `Could not reach ${PORTFOLIO_URL}. ${cause instanceof Error ? cause.message : ""}`.trim(),
    );
  }

  if (!res.ok) {
    throw new PortfolioLoadError(
      `${PORTFOLIO_URL} returned ${res.status} ${res.statusText}. The data file may be missing from the deploy.`,
    );
  }

  return parsePortfolio(await res.text(), PORTFOLIO_URL);
}
