import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, FileWarning, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/States";
import { DataPaste } from "@/components/portfolio/DataPaste";
import { FlagsStrip } from "@/components/portfolio/FlagsStrip";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { SchemaWarning, StalenessBanner } from "@/components/portfolio/StalenessBanner";
import {
  Breakdowns,
  Categories,
  Entities,
  HeadlineTotals,
  Movement,
  Sleeves,
} from "@/components/portfolio/Sections";
import { formatStamp } from "@/lib/format-portfolio";
import { fetchPortfolio, type LoadedPortfolio } from "@/lib/portfolio-file";
import { reportReconciliation } from "@/lib/portfolio-reconcile";
import {
  getPasteSnapshot,
  getServerPasteSnapshot,
  loadPaste,
  subscribePaste,
  type PortfolioSource,
} from "@/lib/portfolio-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SG Family Wealth" },
      {
        name: "description",
        content: "Consolidated position across all SG family entities and asset classes.",
      },
    ],
  }),
  component: DashboardPage,
});

type Fetched =
  | { status: "loading" }
  | { status: "ready"; loaded: LoadedPortfolio }
  | { status: "error"; error: Error };

/**
 * Reads the portfolio from one of two places, in this order:
 *
 *   1. a file pasted into this browser (portfolio-store.ts), if there is one
 *   2. public/portfolio.json, fetched at load
 *
 * A paste wins outright — including when the deployed fetch fails — so the page
 * stays usable on a build whose data file is missing. Which source is in play is
 * always stated on screen; it is never inferred from the figures.
 *
 * The fetch runs in an effect rather than a route loader so it is client-side:
 * the file is a same-origin static asset, and a server loader would bake it into
 * the SSR response, which is the opposite of what a page about freshness wants.
 */
function DashboardPage() {
  const [fetched, setFetched] = useState<Fetched>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const record = useSyncExternalStore(subscribePaste, getPasteSnapshot, getServerPasteSnapshot);
  const pasted = useMemo(() => loadPaste(record), [record]);

  useEffect(() => {
    const ac = new AbortController();
    let live = true;

    setFetched({ status: "loading" });

    fetchPortfolio(ac.signal)
      .then((loaded) => live && setFetched({ status: "ready", loaded }))
      .catch((err: unknown) => {
        if (!live || ac.signal.aborted) return;
        setFetched({
          status: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      live = false;
      ac.abort();
    };
  }, [attempt]);

  const active: LoadedPortfolio | null =
    pasted ?? (fetched.status === "ready" ? fetched.loaded : null);

  const source: PortfolioSource = pasted
    ? { kind: "pasted", pastedAt: record?.pastedAt ?? "", label: record?.label ?? "" }
    : { kind: "deployed" };

  useEffect(() => {
    if (active && import.meta.env.DEV) reportReconciliation(active.data, active.compact);
  }, [active]);

  const onApplied = useCallback(() => setAttempt((n) => n + 1), []);

  // Only a genuine dead end: no paste to fall back on and the fetch failed.
  if (!active && fetched.status === "error") {
    return (
      <Shell>
        <LoadFailure error={fetched.error} onRetry={() => setAttempt((n) => n + 1)} />
        <DataPaste source={source} onApplied={onApplied} />
      </Shell>
    );
  }

  if (!active) {
    return (
      <Shell>
        <Skeleton className="h-[68px] w-full rounded-lg" />
        <Skeleton className="h-[230px] w-full rounded-xl" />
        <Skeleton className="h-[160px] w-full rounded-xl" />
      </Shell>
    );
  }

  const { data, schemaWarning, compact } = active;

  return (
    <Shell>
      <StalenessBanner
        asOfHoldings={data.meta.asOfHoldings}
        asOfPerformance={data.meta.asOfPerformance}
      />
      <SchemaWarning message={schemaWarning} />
      {compact && <CompactNotice />}

      <DataPaste source={source} onApplied={onApplied} />

      <FlagsStrip flags={data.flags} />

      <HeadlineTotals file={data} />
      <Movement file={data} />
      <Categories rows={data.categories} />
      <Sleeves rows={data.sleeves} />
      <Entities rows={data.entities} />
      <Breakdowns file={data} />
      {/* An absent holdings list is not an empty one — say so instead of
          rendering a table with no rows. */}
      {!compact && <HoldingsTable rows={data.holdings} />}

      <Footer meta={data.meta} source={source} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <PageHeader
        eyebrow="Family Office · Principal View"
        title="Consolidated position"
        description="Every figure on this page is read directly from portfolio.json — nothing is recomputed in the browser."
        // This page states its own as-at date in the staleness banner below, and
        // reads a different file from the rest of the app.
        hideAsOn
      />
      {children}
    </div>
  );
}

function CompactNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <FileWarning className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-[12px] text-muted-foreground">
        This is the compact file (<code className="text-foreground">portfolio.summary.json</code>),
        which omits the instrument list. Every other section is complete. Paste the full{" "}
        <code className="text-foreground">portfolio.json</code> to see holdings.
      </p>
    </div>
  );
}

/**
 * Shown when the file cannot be loaded and nothing has been pasted.
 *
 * Deliberately renders no figures. There is no last-known-good copy to fall back
 * to, and showing the previous render's numbers without a date beside them would
 * be indistinguishable from current data.
 */
function LoadFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-destructive">
            Portfolio data could not be loaded
          </h2>
          <p className="mt-1.5 text-[12.5px] text-foreground/80 break-words">{error.message}</p>
          <p className="mt-3 text-[12px] text-muted-foreground">
            No figures are shown, because none could be read. Nothing on this screen is a stale or
            partial copy of the book. You can paste a file below instead.
          </p>
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer({
  meta,
  source,
}: {
  meta: LoadedPortfolio["data"]["meta"];
  source: PortfolioSource;
}) {
  return (
    <footer className="pt-2 pb-6 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <p>{meta.scopeNote}</p>
      <p>{meta.disclaimer}</p>
      <p className="text-muted-foreground/70">
        {meta.scope} · Source: {meta.source} · Prepared by {meta.preparedBy} · Generated{" "}
        {formatStamp(meta.generatedAt)} · All figures in {meta.currency}.
      </p>
      <p className="text-muted-foreground/70">
        {source.kind === "pasted"
          ? `Showing data pasted into this browser on ${formatStamp(source.pastedAt)}${
              source.label ? ` (${source.label})` : ""
            }, not the deployed file.`
          : "Showing the deployed portfolio.json."}
      </p>
    </footer>
  );
}
