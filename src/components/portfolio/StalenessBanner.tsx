import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { formatStamp, staleness, type Staleness } from "@/lib/format-portfolio";

/**
 * The as-at date, stated near the top of the page and impossible to dismiss.
 *
 * There is deliberately no close button, no collapse, and no auto-hide. A large
 * headline figure with no date next to it is the failure this component exists
 * to prevent, so its visibility is not a user preference.
 */
export function StalenessBanner({
  asOfHoldings,
  asOfPerformance,
  now,
}: {
  asOfHoldings: string | null | undefined;
  asOfPerformance?: string | null;
  now?: Date;
}) {
  const age = staleness(asOfHoldings, now);
  const style = TONE[age.level];
  const Icon = style.icon;

  return (
    <div
      // role=status rather than alert: it is present on every render, and an
      // assertive live region would interrupt a screen reader on every load.
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-4 py-3 ${style.box}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${style.icon_}`} aria-hidden />

      <p className={`text-[13px] font-semibold ${style.title}`}>
        {age.level === "fresh" ? `Holdings ${age.label}` : age.label}
      </p>

      {/* When the headline is a staleness warning, the mark itself still has to
          be readable — the warning says how old, this says as of when. */}
      {age.level !== "fresh" && (
        <p className={`text-[12px] tabular ${style.body}`}>
          Holdings as at {formatStamp(asOfHoldings)}
        </p>
      )}

      {asOfPerformance && (
        <p className={`text-[12px] tabular ${style.body}`}>
          · Performance as at {formatStamp(asOfPerformance)}
        </p>
      )}
    </div>
  );
}

const TONE: Record<
  Staleness["level"],
  { box: string; title: string; body: string; icon_: string; icon: typeof Clock }
> = {
  // Under 24h: present and readable, but visually quiet — nothing is wrong.
  fresh: {
    box: "border-border bg-muted/40",
    title: "text-foreground",
    body: "text-muted-foreground",
    icon_: "text-muted-foreground",
    icon: Clock,
  },
  // 1–3 days.
  aging: {
    box: "border-warning/40 bg-warning/10",
    title: "text-foreground",
    body: "text-muted-foreground",
    icon_: "text-warning",
    icon: AlertTriangle,
  },
  // Over 3 days.
  stale: {
    box: "border-destructive/50 bg-destructive/10",
    title: "text-destructive",
    body: "text-destructive/80",
    icon_: "text-destructive",
    icon: ShieldAlert,
  },
  // An unreadable date is treated as loudly as a stale one, never as fresh.
  unknown: {
    box: "border-destructive/50 bg-destructive/10",
    title: "text-destructive",
    body: "text-destructive/80",
    icon_: "text-destructive",
    icon: ShieldAlert,
  },
};

/** Shown only when the file declares a schemaVersion this page does not know. */
export function SchemaWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">Unrecognised data schema</p>
        <p className="text-[12px] mt-0.5 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
