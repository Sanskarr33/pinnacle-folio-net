import { useEffect, useState } from "react";
import { X, Save, Trash2, Plus } from "lucide-react";
import {
  type Meeting,
  type ActionItem,
  type MeetingKind,
  type ActionPriority,
  type ActionStatus,
  KIND_LABEL,
  STATUS_LABEL,
  saveMeeting,
  deleteMeeting,
  saveAction,
  deleteAction,
  blankAction,
} from "@/lib/meetings";
import { cn } from "@/lib/utils";

// ─── Shared form primitives ───────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-9 rounded-md border border-input bg-surface px-2.5 text-[12.5px] outline-none focus-visible:ring-1 focus-visible:ring-ring";
const areaCls =
  "rounded-md border border-input bg-surface px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y";

/** Modal shell. Escape closes; the backdrop is click-through-proof for accidental loss. */
function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-3xl rounded-xl border border-border bg-surface shadow-elevated my-auto"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[68vh] overflow-y-auto">{children}</div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-secondary/25">
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Meeting editor ───────────────────────────────────────────────────────────

export function MeetingEditor({
  meeting,
  entityOptions,
  advisorOptions,
  onClose,
}: {
  meeting: Meeting;
  entityOptions: string[];
  advisorOptions: string[];
  onClose: () => void;
}) {
  const [m, setM] = useState<Meeting>(meeting);
  const set = <K extends keyof Meeting>(k: K, v: Meeting[K]) => setM((p) => ({ ...p, [k]: v }));
  const isNew = !meeting.title && !meeting.notes && !meeting.advisor;

  return (
    <Modal
      title={isNew ? "New meeting" : "Edit meeting"}
      onClose={onClose}
      footer={
        <>
          {!isNew ? (
            <button
              onClick={() => {
                if (confirm("Delete this meeting? Its actions are kept but detached.")) {
                  deleteMeeting(m.id);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                saveMeeting(m);
                onClose();
              }}
              disabled={!m.advisor.trim() && !m.title.trim()}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3.5 h-9 rounded-md bg-navy text-navy-foreground hover:bg-navy/90 disabled:opacity-40 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save meeting
            </button>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="Date">
          <input
            type="date"
            value={m.date}
            onChange={(e) => set("date", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Advisor / firm">
          <input
            list="advisor-options"
            value={m.advisor}
            onChange={(e) => set("advisor", e.target.value)}
            placeholder="e.g. Kotak Securities"
            className={inputCls}
          />
          <datalist id="advisor-options">
            {advisorOptions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>

        <Field label="Meeting type">
          <select
            value={m.kind}
            onChange={(e) => set("kind", e.target.value as MeetingKind)}
            className={inputCls}
          >
            {(Object.keys(KIND_LABEL) as MeetingKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location / mode">
          <input
            value={m.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Office, video call…"
            className={inputCls}
          />
        </Field>

        <Field label="Title" wide>
          <input
            value={m.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Quarterly portfolio review"
            className={inputCls}
          />
        </Field>

        <Field label="Attendees" hint="Comma separated" wide>
          <input
            value={m.attendees.join(", ")}
            onChange={(e) =>
              set(
                "attendees",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="Suresh Goel, Relationship Manager…"
            className={inputCls}
          />
        </Field>

        <Field label="Entities discussed" hint="Comma separated" wide>
          <input
            list="entity-options"
            value={m.entities.join(", ")}
            onChange={(e) =>
              set(
                "entities",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="SG, SMC…"
            className={inputCls}
          />
          <datalist id="entity-options">
            {entityOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        <Field label="Agenda" wide>
          <textarea
            rows={3}
            value={m.agenda}
            onChange={(e) => set("agenda", e.target.value)}
            placeholder="What was this meeting called to cover?"
            className={areaCls}
          />
        </Field>

        <Field label="Notes / minutes" wide>
          <textarea
            rows={8}
            value={m.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="What was said, what was recommended, what the advisor's view was…"
            className={areaCls}
          />
        </Field>

        <Field
          label="Decisions taken"
          wide
          hint="What was actually agreed, as distinct from what was discussed"
        >
          <textarea
            rows={4}
            value={m.decisions}
            onChange={(e) => set("decisions", e.target.value)}
            className={areaCls}
          />
        </Field>

        <Field label="Next meeting">
          <input
            type="date"
            value={m.nextMeeting ?? ""}
            onChange={(e) => set("nextMeeting", e.target.value || null)}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Action editor ────────────────────────────────────────────────────────────

export function ActionEditor({
  action,
  meetings,
  entityOptions,
  advisorOptions,
  onClose,
}: {
  action: ActionItem;
  meetings: Meeting[];
  entityOptions: string[];
  advisorOptions: string[];
  onClose: () => void;
}) {
  const [a, setA] = useState<ActionItem>(action);
  const set = <K extends keyof ActionItem>(k: K, v: ActionItem[K]) =>
    setA((p) => ({ ...p, [k]: v }));
  const isNew = !action.title;
  const closing = a.status === "done" || a.status === "dropped";

  return (
    <Modal
      title={isNew ? "New action" : "Edit action"}
      onClose={onClose}
      footer={
        <>
          {!isNew ? (
            <button
              onClick={() => {
                if (confirm("Delete this action permanently?")) {
                  deleteAction(a.id);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                saveAction(a);
                onClose();
              }}
              disabled={!a.title.trim()}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3.5 h-9 rounded-md bg-navy text-navy-foreground hover:bg-navy/90 disabled:opacity-40 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save action
            </button>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="Action" wide>
          <input
            value={a.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Rebalance out of small cap into flexi cap"
            className={inputCls}
          />
        </Field>

        <Field label="Detail" wide>
          <textarea
            rows={4}
            value={a.detail}
            onChange={(e) => set("detail", e.target.value)}
            className={areaCls}
          />
        </Field>

        <Field label="From meeting">
          <select
            value={a.meetingId ?? ""}
            onChange={(e) => set("meetingId", e.target.value || null)}
            className={inputCls}
          >
            <option value="">Standalone (no meeting)</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.date} · {m.advisor || "—"} · {m.title || "Untitled"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Owner">
          <input
            value={a.owner}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="Who is accountable?"
            className={inputCls}
          />
        </Field>

        <Field label="Advisor / firm">
          <input
            list="advisor-options-a"
            value={a.advisor}
            onChange={(e) => set("advisor", e.target.value)}
            className={inputCls}
          />
          <datalist id="advisor-options-a">
            {advisorOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        <Field label="Entity">
          <input
            list="entity-options-a"
            value={a.entity}
            onChange={(e) => set("entity", e.target.value)}
            className={inputCls}
          />
          <datalist id="entity-options-a">
            {entityOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>

        <Field label="Due date">
          <input
            type="date"
            value={a.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value || null)}
            className={inputCls}
          />
        </Field>

        <Field label="Priority">
          <select
            value={a.priority}
            onChange={(e) => set("priority", e.target.value as ActionPriority)}
            className={inputCls}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>

        <Field label="Status">
          <select
            value={a.status}
            onChange={(e) => set("status", e.target.value as ActionStatus)}
            className={inputCls}
          >
            {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount at stake (₹)" hint="Optional — enter in rupees">
          <input
            type="number"
            value={a.amount ?? ""}
            onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="e.g. 2500000"
            className={inputCls}
          />
        </Field>

        <Field label="Linked security" wide hint="Free text — the fund or stock this concerns">
          <input
            value={a.linkedSecurity}
            onChange={(e) => set("linkedSecurity", e.target.value)}
            className={inputCls}
          />
        </Field>

        {closing && (
          <Field
            label="Closure note"
            wide
            hint="What was actually done — this is the record of the action being acted upon"
          >
            <textarea
              rows={3}
              value={a.closureNote}
              onChange={(e) => set("closureNote", e.target.value)}
              className={areaCls}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export { Plus };
