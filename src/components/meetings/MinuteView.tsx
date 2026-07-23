import { useState, useSyncExternalStore } from "react";
import {
  FileText,
  Users,
  Clock,
  MapPin,
  CalendarClock,
  ChevronRight,
  CircleDot,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ExternalLink,
} from "lucide-react";
import type { ImportedMeeting } from "@/lib/minutes";
import {
  subscribeTracking,
  getTracking,
  getServerTracking,
  trackingFor,
  setTracking,
} from "@/lib/minutes";
import { STATUS_LABEL, type ActionStatus } from "@/lib/meetings";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ActionStatus, { cls: string; icon: typeof CircleDot }> = {
  open: { cls: "bg-secondary text-muted-foreground border-border", icon: CircleDot },
  in_progress: {
    cls: "bg-[var(--chart-1)]/12 text-[var(--chart-1)] border-[var(--chart-1)]/30",
    icon: Loader2,
  },
  blocked: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  done: { cls: "bg-success/12 text-success border-success/30", icon: CheckCircle2 },
  dropped: { cls: "bg-muted text-muted-foreground border-border", icon: Ban },
};

/**
 * One set of imported minutes, rendered in full.
 *
 * The parsed action list sits above the original section text, and the raw action
 * block stays available — parsing a flattened PDF table is best-effort, so the
 * source is always one click away rather than being replaced by the parse.
 */
export function MinuteView({ meeting }: { meeting: ImportedMeeting }) {
  const track = useSyncExternalStore(subscribeTracking, getTracking, getServerTracking);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const meta: Array<[typeof Clock, string, string]> = [
    [CalendarClock, "Date", meeting.date ? formatDate(meeting.date) : "not stated"],
    [Clock, "Duration", meeting.duration || "—"],
    [MapPin, "Format", meeting.platform || "—"],
    [Users, "Client", meeting.client || "—"],
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              {meeting.advisor}
            </p>
            <h3 className="text-[17px] font-semibold tracking-tight mt-1">{meeting.title}</h3>
            {meeting.meetingType && (
              <p className="text-[12px] text-muted-foreground mt-0.5">{meeting.meetingType}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meeting.status && (
              <span className="text-[10px] uppercase tracking-wider rounded px-2 py-1 border border-warning/40 bg-warning/10 text-warning font-semibold">
                {meeting.status.replace(/^DRAFT\s*—\s*/i, "Draft · ")}
              </span>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {meta.map(([Icon, label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" />
                {label}
              </dt>
              <dd className="text-[12px] mt-0.5 truncate" title={value}>
                {value}
                {label === "Date" && meeting.dateIsApproximate && (
                  <span className="text-warning"> (month only)</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {meeting.attendees.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Attendees
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meeting.attendees.map((a, i) => (
                <span
                  key={i}
                  className="text-[10.5px] rounded border border-border bg-secondary/50 px-1.5 py-0.5"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 pt-3 border-t border-border text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3 shrink-0" />
          Imported from <code className="bg-secondary px-1 rounded">
            {meeting.sourceFile}
          </code> · {meeting.wordCount.toLocaleString("en-IN")} words
          {meeting.followUp && <> · Follow-up: {meeting.followUp}</>}
        </p>
      </div>

      {/* Purpose */}
      {meeting.purpose && (
        <Block title="Meeting purpose">
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{meeting.purpose}</p>
        </Block>
      )}

      {/* Key takeaways */}
      {meeting.keyTakeaways.length > 0 && (
        <Block title={`Key takeaways (${meeting.keyTakeaways.length})`}>
          <ul className="space-y-2">
            {meeting.keyTakeaways.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--chart-1)] shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* Action items — trackable */}
      {(meeting.actions.length > 0 || meeting.actionsRaw) && (
        <Block
          title={`Action items (${meeting.actions.length})`}
          right={
            meeting.actionsRaw && (
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                {showRaw ? "Hide" : "Show"} original text
              </button>
            )
          }
        >
          {meeting.actions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic">
              An action section exists but could not be split into individual items — the original
              text is below.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[12.5px] min-w-[720px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                    <th className="text-left font-semibold px-5 py-2 w-8">#</th>
                    <th className="text-left font-semibold py-2">Action</th>
                    <th className="text-left font-semibold py-2 w-[170px]">Owner</th>
                    <th className="text-left font-semibold px-5 py-2 w-[190px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {meeting.actions.map((a, i) => {
                    const t = trackingFor(a.id, track);
                    return (
                      <tr key={a.id} className="border-b border-border/40 hover:bg-secondary/25">
                        <td className="px-5 py-2 text-muted-foreground tabular align-top">
                          {i + 1}
                        </td>
                        <td className="py-2 align-top leading-relaxed">{a.title}</td>
                        <td className="py-2 align-top text-muted-foreground">{a.owner || "—"}</td>
                        <td className="px-5 py-2 align-top">
                          <div className="flex items-center gap-1.5">
                            <StatusPill status={t.status} />
                            <select
                              value={t.status}
                              onChange={(e) =>
                                setTracking(a.id, { status: e.target.value as ActionStatus })
                              }
                              aria-label={`Set status for action ${i + 1}`}
                              className="h-6 rounded border border-input bg-surface px-1 text-[10.5px]"
                            >
                              {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                          {t.closedAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              closed {formatDate(t.closedAt)}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showRaw && meeting.actionsRaw && (
            <pre className="mt-3 text-[11px] leading-relaxed whitespace-pre-wrap bg-secondary/40 border border-border rounded-lg p-3 max-h-[320px] overflow-y-auto">
              {meeting.actionsRaw}
            </pre>
          )}
        </Block>
      )}

      {/* Full minutes, section by section */}
      {meeting.sections.length > 0 && (
        <Block title={`Full minutes (${meeting.sections.length} sections)`}>
          <ul className="divide-y divide-border -mx-5">
            {meeting.sections.map((s) => {
              const key = `${meeting.id}-${s.number}`;
              const open = openSection === key;
              return (
                <li key={key}>
                  <button
                    onClick={() => setOpenSection(open ? null : key)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-2 px-5 py-2 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                        open && "rotate-90",
                      )}
                    />
                    <span className="text-[10.5px] tabular text-muted-foreground w-6 shrink-0">
                      {s.number}.
                    </span>
                    <span className="text-[12.5px] font-medium truncate">{s.heading}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {s.text.split(/\s+/).length} words
                    </span>
                  </button>
                  {open && (
                    <div className="px-5 pb-3 pl-[52px]">
                      <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                        {s.text}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          {title}
        </h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: ActionStatus }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
        s.cls,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

export { ExternalLink };
