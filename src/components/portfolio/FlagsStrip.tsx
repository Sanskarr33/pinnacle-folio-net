import { inr, pct } from "@/lib/format-portfolio";
import type { FlagRow, FlagSeverity } from "@/lib/portfolio-file";

/**
 * Open risk and data-quality items from flags[], colour-coded by severity.
 *
 * Renders nothing at all when the array is empty — no heading, no container, no
 * "all clear" card. An empty strip would occupy the same space as a real
 * warning and train the eye to skip it.
 */
export function FlagsStrip({ flags }: { flags: FlagRow[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <section aria-labelledby="flags-heading">
      <h2
        id="flags-heading"
        className="text-[10px] uppercase tracking-[0.18em] font-medium text-muted-foreground mb-2.5"
      >
        Flags ({flags.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {flags.map((f) => (
          <FlagCard key={f.id} flag={f} />
        ))}
      </div>
    </section>
  );
}

function FlagCard({ flag }: { flag: FlagRow }) {
  const tone = SEVERITY[flag.severity] ?? SEVERITY.info;

  return (
    <article className={`rounded-lg border p-3.5 ${tone.box}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`}
          aria-hidden
        />
        <span className={`text-[10px] uppercase tracking-[0.16em] font-semibold ${tone.label}`}>
          {flag.severity}
        </span>
        <span className="text-[10px] tabular text-muted-foreground ml-auto">{flag.id}</span>
      </div>

      <h3 className="mt-2 text-[13px] font-semibold text-foreground leading-snug">{flag.title}</h3>
      <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">{flag.detail}</p>

      {/* value is genuinely null on some flags — omit the row rather than
          printing a zero that would read as "nothing at stake". */}
      {flag.value != null && (
        <p className="mt-2.5 pt-2.5 border-t border-border/60 text-[12px] tabular text-foreground">
          {inr(flag.value)}
          {flag.pct != null && <span className="text-muted-foreground"> · {pct(flag.pct)}</span>}
        </p>
      )}

      {flag.owner && (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">Owner: {flag.owner}</p>
      )}
    </article>
  );
}

const SEVERITY: Record<FlagSeverity, { box: string; dot: string; label: string }> = {
  breach: {
    box: "border-destructive/40 bg-destructive/5",
    dot: "bg-destructive",
    label: "text-destructive",
  },
  open: {
    box: "border-warning/50 bg-warning/10",
    dot: "bg-warning",
    label: "text-warning",
  },
  watch: {
    box: "border-sky-500/40 bg-sky-500/5",
    dot: "bg-sky-500",
    label: "text-sky-600 dark:text-sky-400",
  },
  info: {
    box: "border-border bg-muted/40",
    dot: "bg-muted-foreground",
    label: "text-muted-foreground",
  },
};
