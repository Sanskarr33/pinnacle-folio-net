import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ClipboardPaste, RotateCcw, X } from "lucide-react";
import { PortfolioLoadError } from "@/lib/portfolio-file";
import { clearPaste, savePaste, type PortfolioSource } from "@/lib/portfolio-store";
import { reconcile, type CheckResult } from "@/lib/portfolio-reconcile";
import { formatStamp } from "@/lib/format-portfolio";

/**
 * Paste a new portfolio.json straight into the page.
 *
 * Two gates before anything is applied:
 *   1. it must parse and carry the expected blocks (portfolio-file.ts), and
 *   2. it must reconcile against its own totals (portfolio-reconcile.ts).
 *
 * A file that fails (2) is still applicable, but only on a second, explicit
 * click — a book that disagrees with itself is sometimes what you actually have,
 * and refusing outright would just push the user back to editing files by hand.
 * What it must never do is apply silently.
 *
 * The reconciliation here sums the file's own rows. That is validation of the
 * data, not derivation of a displayed figure: no total computed here is ever
 * rendered as a portfolio number.
 */
export function DataPaste({
  source,
  onApplied,
}: {
  source: PortfolioSource;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [armed, setArmed] = useState(false);

  function reset() {
    setText("");
    setLabel("");
    setError(null);
    setChecks(null);
    setArmed(false);
  }

  function apply(force: boolean) {
    setError(null);
    try {
      // Parse first so a malformed paste never displaces a good one.
      const loaded = savePaste(text, label);
      const results = reconcile(loaded.data, loaded.compact);
      const failed = results.filter((r) => !r.pass);

      if (failed.length && !force) {
        // Undo the write: savePaste already stored it, and leaving inconsistent
        // data applied while asking for confirmation would defeat the prompt.
        clearPaste();
        setChecks(results);
        setArmed(true);
        return;
      }

      setChecks(results);
      setArmed(false);
      setText("");
      setLabel("");
      setOpen(false);
      onApplied();
    } catch (e) {
      setChecks(null);
      setArmed(false);
      setError(
        e instanceof PortfolioLoadError || e instanceof Error
          ? e.message
          : "The pasted text could not be read.",
      );
    }
  }

  function revert() {
    clearPaste();
    reset();
    onApplied();
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 text-left hover:bg-muted/40 transition-colors rounded-xl"
      >
        <ClipboardPaste className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-[13px] font-semibold text-foreground">Update data</span>
        <span className="text-[11.5px] text-muted-foreground truncate">
          {source.kind === "pasted"
            ? `showing pasted data · ${formatStamp(source.pastedAt)}`
            : "showing the deployed portfolio.json"}
        </span>
        <ChevronDown
          className={`h-4 w-4 ml-auto shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-border space-y-3">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Paste the contents of <code className="text-foreground">portfolio.json</code> (or{" "}
            <code className="text-foreground">portfolio.summary.json</code>, which omits the
            holdings list). It is checked and reconciled before anything on the page changes.{" "}
            <strong className="text-foreground">Stored in this browser only</strong> — it will not
            reach your phone or another family member's session.
          </p>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setChecks(null);
              setArmed(false);
            }}
            spellCheck={false}
            rows={7}
            placeholder='{ "schemaVersion": "1.0", "meta": { … } }'
            aria-label="Portfolio JSON"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[11.5px] leading-relaxed outline-none focus:ring-2 focus:ring-ring/40 resize-y"
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional), e.g. 29 Aug MProfit pull"
              aria-label="Label for this paste"
              className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-ring/40"
            />

            <button
              type="button"
              onClick={() => apply(armed)}
              disabled={!text.trim()}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                armed
                  ? "bg-destructive text-destructive-foreground hover:opacity-90"
                  : "bg-navy text-navy-foreground hover:opacity-90"
              }`}
            >
              {armed ? "Apply anyway" : "Validate & apply"}
            </button>

            {source.kind === "pasted" && (
              <button
                type="button"
                onClick={revert}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revert to deployed file
              </button>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
            >
              <X className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
              <span className="break-words">{error}</span>
            </p>
          )}

          {checks && <ReconciliationReport results={checks} armed={armed} />}
        </div>
      )}
    </section>
  );
}

function ReconciliationReport({ results, armed }: { results: CheckResult[]; armed: boolean }) {
  const failed = results.filter((r) => !r.pass);

  if (!failed.length) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] text-foreground">
        <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        All {results.length} reconciliation checks passed.
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2.5 space-y-2"
    >
      <p className="flex items-start gap-2 text-[12px] text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" aria-hidden />
        <span>
          <strong>
            {failed.length} of {results.length} checks failed.
          </strong>{" "}
          This file disagrees with its own totals.
          {armed && " Nothing has been applied. Press again to apply it regardless."}
        </span>
      </p>
      <ul className="space-y-0.5 pl-5.5">
        {failed.map((r) => (
          <li key={r.name} className="text-[11px] tabular text-muted-foreground">
            {r.name} — off by {r.delta.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </li>
        ))}
      </ul>
    </div>
  );
}
