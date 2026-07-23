import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Plus,
  Download,
  Upload,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ChevronRight,
  Ban,
  CircleDot,
  Loader2,
  Sparkles,
  FileText,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { EmptyState } from "@/components/common/States";
import { MeetingEditor, ActionEditor } from "@/components/meetings/Editors";
import { MinuteView } from "@/components/meetings/MinuteView";
import { useBook, useActions as useDerivedActions } from "@/hooks/use-book";
import { normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";
import { useUnits } from "@/lib/units";
import { formatDate, humanDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  blankMeeting,
  blankAction,
  saveAction,
  actionStats,
  isOverdue,
  daysUntil,
  ageDays,
  exportJson,
  importJson,
  STATUS_LABEL,
  KIND_LABEL,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  type Meeting,
  type ActionItem,
  type ActionStatus,
} from "@/lib/meetings";
import {
  ADVISORS,
  IMPORTED_MEETINGS,
  MINUTES_SOURCE,
  allTrackedActions,
  setTracking,
  subscribeTracking,
  getTracking,
  getServerTracking,
  type TrackedAction,
} from "@/lib/minutes";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Advisor Meetings — SG Family Wealth" },
      {
        name: "description",
        content:
          "Minutes by advisor, the actions arising, and a record of what has been acted upon.",
      },
    ],
  }),
  component: MeetingsPage,
});

/** Advisor keys double as tab ids, so each firm gets its own tab. */
type Tab = string;

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

function MeetingsPage() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tracking = useSyncExternalStore(subscribeTracking, getTracking, getServerTracking);
  const { data: book = [] } = useBook();
  const { actions: derived } = useDerivedActions(8);
  const { money } = useUnits();

  const [tab, setTab] = useState<Tab>("overview");
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [editAction, setEditAction] = useState<ActionItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [openMinute, setOpenMinute] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectTabRef = useRef<((t: Tab) => void) | null>(null);

  // Deep-link the tab so an advisor view can be bookmarked. Read after mount —
  // window does not exist during SSR.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t) setTab(t);
  }, []);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url);
  }, []);
  selectTabRef.current = selectTab;

  const entityOptions = useMemo(
    () => Array.from(new Set(book.map((r) => normaliseEntity(r.entity_name)))).sort(),
    [book],
  );
  // Advisors from the minutes lead; custodians from the book fill in the rest.
  const advisorOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...ADVISORS.map((a) => a.name),
          ...book.map((r) => normaliseBroker(r.broker_name)).filter((b) => b !== "Unattributed"),
        ]),
      ).sort(),
    [book],
  );

  const trackedActions = useMemo(() => allTrackedActions(tracking), [tracking]);

  /**
   * Imported and authored actions are counted together — "what have we acted upon"
   * is one question, and splitting the answer by where an action came from would
   * make it useless.
   */
  const combinedStats = useMemo(() => {
    const asItems: ActionItem[] = trackedActions.map((t) => ({
      id: t.id,
      meetingId: t.meetingId,
      title: t.title,
      detail: "",
      owner: t.tracking.owner || t.owner,
      advisor: t.advisor,
      entity: "",
      dueDate: t.tracking.dueDate,
      priority: "medium",
      status: t.tracking.status,
      amount: null,
      linkedSecurity: "",
      closedAt: t.tracking.closedAt,
      closureNote: t.tracking.closureNote,
      createdAt: t.meetingDate ? `${t.meetingDate}T00:00:00.000Z` : new Date().toISOString(),
      updatedAt: t.tracking.updatedAt || new Date().toISOString(),
    }));
    return actionStats([...asItems, ...store.actions]);
  }, [trackedActions, store.actions]);

  const authoredMeetings = useMemo(
    () => [...store.meetings].sort((a, b) => b.date.localeCompare(a.date)),
    [store.meetings],
  );

  const doExport = useCallback(() => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advisor-meetings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const doImport = useCallback((file: File) => {
    file.text().then((txt) => {
      try {
        const r = importJson(txt);
        alert(`Imported ${r.meetings} meetings and ${r.actions} actions.`);
      } catch {
        alert("That file could not be read as a meetings export.");
      }
    });
  }, []);

  const promote = useCallback(
    (title: string, detail: string, dueDate: string | null, amount: number | null) => {
      saveAction({ ...blankAction(null), title, detail, dueDate, amount });
      selectTabRef.current?.("actions");
    },
    [],
  );

  const alreadyTracked = useMemo(
    () => new Set(store.actions.map((a) => a.title.trim().toLowerCase())),
    [store.actions],
  );

  const advisor = ADVISORS.find((a) => a.key === tab);
  const advisorMinutes = useMemo(
    () => (advisor ? IMPORTED_MEETINGS.filter((m) => m.advisorKey === advisor.key) : []),
    [advisor],
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-5">
      <PageHeader
        eyebrow="Operations · Governance"
        title="Advisor Meetings"
        description={`${IMPORTED_MEETINGS.length} sets of minutes imported from “${MINUTES_SOURCE}”, plus anything you record here. Each advisor has its own tab.`}
        right={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
            <button
              onClick={doExport}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Backup
            </button>
            <button
              onClick={() => setEditMeeting(blankMeeting())}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3.5 h-9 rounded-md bg-navy text-navy-foreground hover:bg-navy/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New meeting
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat
          label="Meetings"
          value={String(IMPORTED_MEETINGS.length + store.meetings.length)}
          sub={`${IMPORTED_MEETINGS.length} imported`}
          icon={CalendarDays}
        />
        <Stat
          label="Advisors"
          value={String(ADVISORS.length)}
          sub="with minutes on file"
          icon={Building2}
        />
        <Stat
          label="Open actions"
          value={String(combinedStats.open + combinedStats.inProgress + combinedStats.blocked)}
          sub={`${combinedStats.blocked} blocked`}
          icon={ClipboardList}
          tone={combinedStats.blocked > 0 ? "warn" : null}
        />
        <Stat
          label="Overdue"
          value={String(combinedStats.overdue)}
          sub="past due date"
          icon={AlertTriangle}
          tone={combinedStats.overdue > 0 ? "bad" : "good"}
        />
        <Stat
          label="Completed"
          value={String(combinedStats.done)}
          sub={`${combinedStats.completionRate.toFixed(0)}% of all`}
          icon={CheckCircle2}
          tone="good"
        />
        <Stat
          label="Total actions"
          value={String(combinedStats.total)}
          sub={`${trackedActions.length} from minutes`}
          icon={ClipboardList}
        />
      </div>

      {/* Tabs: all meetings, one per advisor, then the cross-cutting views */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-secondary border border-border">
        <TabBtn active={tab === "overview"} onClick={() => selectTab("overview")}>
          All meetings
        </TabBtn>
        <span className="w-px h-5 bg-border mx-0.5" />
        {ADVISORS.map((a) => (
          <TabBtn key={a.key} active={tab === a.key} onClick={() => selectTab(a.key)}>
            {a.name}
            <span className="ml-1.5 text-[10px] tabular opacity-60">{a.meetingCount}</span>
          </TabBtn>
        ))}
        <span className="w-px h-5 bg-border mx-0.5" />
        <TabBtn active={tab === "actions"} onClick={() => selectTab("actions")}>
          Actionables ({combinedStats.total})
        </TabBtn>
        <TabBtn active={tab === "status"} onClick={() => selectTab("status")}>
          Acted upon vs outstanding
        </TabBtn>
      </div>

      {/* ── All meetings ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <>
          <Card
            title="Imported minutes"
            subtitle={`${IMPORTED_MEETINGS.length} documents · newest first · click to read in full`}
          >
            <ul className="divide-y divide-border -mx-5">
              {IMPORTED_MEETINGS.map((m) => {
                const open = openMinute === m.id;
                const done = m.actions.filter((a) =>
                  CLOSED_STATUSES.includes((tracking[a.id]?.status ?? "open") as ActionStatus),
                ).length;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setOpenMinute(open ? null : m.id)}
                      aria-expanded={open}
                      className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 mt-0.5 text-muted-foreground shrink-0 transition-transform",
                          open && "rotate-90",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold truncate">{m.title}</span>
                          <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--chart-1)]/12 text-[var(--chart-1)] border border-[var(--chart-1)]/25">
                            {m.advisor}
                          </span>
                          {m.actions.length > 0 && (
                            <span className="text-[10px] rounded px-1.5 py-0.5 bg-secondary text-muted-foreground tabular border border-border">
                              {done}/{m.actions.length} actions done
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                          {m.date ? formatDate(m.date) : "date not stated"}
                          {m.duration && <> · {m.duration}</>}
                          {m.platform && <> · {m.platform}</>} · {m.sections.length} sections
                        </p>
                      </div>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </button>
                    {open && (
                      <div className="px-5 pb-5 bg-secondary/15">
                        <MinuteView meeting={m} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title="Meetings you have recorded"
            subtitle={`${authoredMeetings.length} authored here · separate from the imported documents`}
          >
            {authoredMeetings.length === 0 ? (
              <EmptyState
                message="No meetings recorded here yet."
                hint="The imported minutes above are read-only. Use “New meeting” for anything not covered by a document."
              />
            ) : (
              <ul className="divide-y divide-border -mx-5">
                {authoredMeetings.map((m) => {
                  const linked = store.actions.filter((a) => a.meetingId === m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold">
                            {m.title || "Untitled meeting"}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-secondary text-muted-foreground border border-border">
                            {KIND_LABEL[m.kind]}
                          </span>
                          {linked.length > 0 && (
                            <span className="text-[10px] rounded px-1.5 py-0.5 bg-[var(--chart-1)]/12 text-[var(--chart-1)]">
                              {linked.length} action{linked.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                          {formatDate(m.date)}
                          {m.advisor && <> · {m.advisor}</>}
                          {m.entities.length > 0 && <> · {m.entities.join(", ")}</>}
                        </p>
                      </div>
                      <button
                        onClick={() => setEditMeeting(m)}
                        className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Edit
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* ── One advisor ──────────────────────────────────────────────────── */}
      {advisor && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Meetings"
              value={String(advisor.meetingCount)}
              sub="on file"
              icon={CalendarDays}
            />
            <Stat
              label="Actions raised"
              value={String(advisor.actionCount)}
              sub="across all minutes"
              icon={ClipboardList}
            />
            <Stat
              label="Closed"
              value={String(
                trackedActions.filter(
                  (t) =>
                    t.advisorKey === advisor.key && CLOSED_STATUSES.includes(t.tracking.status),
                ).length,
              )}
              sub="done or dropped"
              icon={CheckCircle2}
              tone="good"
            />
            <Stat
              label="Latest meeting"
              value={advisorMinutes[0]?.date ? formatDate(advisorMinutes[0].date) : "—"}
              sub={advisorMinutes[0]?.meetingType?.slice(0, 32) || ""}
              icon={Clock}
            />
          </div>

          {advisorMinutes.map((m) => (
            <Card
              key={m.id}
              title={m.title}
              subtitle={`${m.date ? formatDate(m.date) : "date not stated"} · ${m.sourceFile}`}
            >
              <MinuteView meeting={m} />
            </Card>
          ))}
        </>
      )}

      {/* ── Actionables ──────────────────────────────────────────────────── */}
      {tab === "actions" && (
        <>
          {derived.length > 0 && (
            <Card
              title="Suggested from the portfolio"
              subtitle="Dated deadlines the book already knows about — promote one to track it here"
            >
              <ul className="space-y-1.5">
                {derived.slice(0, 4).map((d) => {
                  const tracked = alreadyTracked.has(d.title.trim().toLowerCase());
                  return (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[var(--chart-3)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium truncate">{d.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{d.detail}</p>
                      </div>
                      <span className="text-[11px] tabular text-muted-foreground shrink-0">
                        {d.dueDate ? formatDate(d.dueDate) : "—"}
                      </span>
                      <button
                        disabled={tracked}
                        onClick={() => promote(d.title, d.detail, d.dueDate, d.amount)}
                        className="text-[11.5px] font-medium px-2.5 h-7 rounded-md border border-border hover:bg-secondary disabled:opacity-40 transition-colors shrink-0"
                      >
                        {tracked ? "Tracked" : "Track"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <MinutesActionTable
            actions={trackedActions}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />

          <Card
            title={`Actions you have recorded (${store.actions.length})`}
            subtitle="Authored here rather than extracted from a document"
            right={
              <button
                onClick={() => setEditAction(blankAction())}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 h-8 rounded-md border border-border hover:bg-secondary transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                New action
              </button>
            }
          >
            {store.actions.length === 0 ? (
              <EmptyState message="Nothing recorded here yet." />
            ) : (
              <AuthoredActionTable actions={store.actions} onEdit={setEditAction} money={money} />
            )}
          </Card>
        </>
      )}

      {/* ── Status ───────────────────────────────────────────────────────── */}
      {tab === "status" && (
        <StatusView
          tracked={trackedActions}
          authored={store.actions}
          stats={combinedStats}
          money={money}
          onEdit={setEditAction}
        />
      )}

      {editMeeting && (
        <MeetingEditor
          meeting={editMeeting}
          entityOptions={entityOptions}
          advisorOptions={advisorOptions}
          onClose={() => setEditMeeting(null)}
        />
      )}
      {editAction && (
        <ActionEditor
          action={editAction}
          meetings={authoredMeetings}
          entityOptions={entityOptions}
          advisorOptions={advisorOptions}
          onClose={() => setEditAction(null)}
        />
      )}

      <p className="text-[10.5px] text-muted-foreground">
        Minutes are imported read-only by{" "}
        <code className="bg-secondary px-1 rounded">python scripts/import_minutes.py</code> — drop a
        new PDF or DOCX into <code className="bg-secondary px-1 rounded">{MINUTES_SOURCE}/</code>{" "}
        and re-run it. Action status and anything you author is kept in this browser; use{" "}
        <strong>Backup</strong> regularly.
      </p>
    </div>
  );
}

// ─── Imported action table ────────────────────────────────────────────────────

function MinutesActionTable({
  actions,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
}: {
  actions: TrackedAction[];
  query: string;
  setQuery: (v: string) => void;
  statusFilter: "all" | "open" | "closed";
  setStatusFilter: (v: "all" | "open" | "closed") => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => {
      if (statusFilter === "open" && !OPEN_STATUSES.includes(a.tracking.status)) return false;
      if (statusFilter === "closed" && !CLOSED_STATUSES.includes(a.tracking.status)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q) ||
        a.advisor.toLowerCase().includes(q)
      );
    });
  }, [actions, query, statusFilter]);

  return (
    <Card
      title={`Actions from minutes (${filtered.length})`}
      subtitle="Extracted from the documents — set status here as they get done"
      right={
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search actions"
              className="h-8 w-[160px] pl-8 rounded-md border border-input bg-surface text-[12px] outline-none"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-secondary border border-border">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "text-[11px] font-medium px-2 py-1 rounded transition-colors capitalize",
                  statusFilter === f
                    ? "bg-surface text-foreground shadow-elegant"
                    : "text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState message="No actions match this filter." />
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[12.5px] min-w-[880px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
                <th className="text-left font-semibold px-5 py-2.5">Action</th>
                <th className="text-left font-semibold py-2.5 w-[160px]">Owner</th>
                <th className="text-left font-semibold py-2.5 w-[150px]">Advisor</th>
                <th className="text-right font-semibold py-2.5 w-[110px]">Meeting</th>
                <th className="text-left font-semibold px-5 py-2.5 w-[170px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-secondary/25">
                  <td className="px-5 py-2.5 align-top leading-relaxed max-w-[440px]">{a.title}</td>
                  <td className="py-2.5 align-top text-muted-foreground">
                    {a.tracking.owner || a.owner || "—"}
                  </td>
                  <td className="py-2.5 align-top text-muted-foreground">{a.advisor}</td>
                  <td className="py-2.5 align-top text-right tabular text-muted-foreground whitespace-nowrap">
                    {a.meetingDate ? formatDate(a.meetingDate) : "—"}
                  </td>
                  <td className="px-5 py-2.5 align-top">
                    <select
                      value={a.tracking.status}
                      onChange={(e) =>
                        setTracking(a.id, { status: e.target.value as ActionStatus })
                      }
                      aria-label="Set action status"
                      className={cn(
                        "h-7 rounded border px-1.5 text-[11px] font-medium",
                        STATUS_STYLE[a.tracking.status].cls,
                      )}
                    >
                      {(Object.keys(STATUS_LABEL) as ActionStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    {a.tracking.closedAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        closed {formatDate(a.tracking.closedAt)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AuthoredActionTable({
  actions,
  onEdit,
  money,
}: {
  actions: ActionItem[];
  onEdit: (a: ActionItem) => void;
  money: (n: number | null | undefined) => string;
}) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[12.5px] min-w-[820px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border bg-secondary/40">
            <th className="text-left font-semibold px-5 py-2.5">Action</th>
            <th className="text-left font-semibold py-2.5">Owner</th>
            <th className="text-right font-semibold py-2.5">Amount</th>
            <th className="text-right font-semibold py-2.5">Due</th>
            <th className="text-right font-semibold py-2.5">Age</th>
            <th className="text-left font-semibold px-5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => {
            const overdue = isOverdue(a);
            const dd = daysUntil(a.dueDate);
            return (
              <tr
                key={a.id}
                onClick={() => onEdit(a)}
                className="border-b border-border/40 hover:bg-secondary/30 cursor-pointer"
              >
                <td className="px-5 py-2.5 font-medium max-w-[300px] truncate">{a.title}</td>
                <td className="py-2.5 text-muted-foreground">{a.owner || "—"}</td>
                <td className="py-2.5 text-right tabular">
                  {a.amount != null ? money(a.amount) : "—"}
                </td>
                <td
                  className={cn(
                    "py-2.5 text-right tabular whitespace-nowrap",
                    overdue ? "text-destructive font-semibold" : "text-muted-foreground",
                  )}
                >
                  {a.dueDate ? formatDate(a.dueDate) : "—"}
                  {dd != null && OPEN_STATUSES.includes(a.status) && (
                    <span className="block text-[10px]">
                      {dd < 0 ? `${Math.abs(dd)}d overdue` : dd === 0 ? "today" : `in ${dd}d`}
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right tabular text-muted-foreground">
                  {humanDays(ageDays(a))}
                </td>
                <td className="px-5 py-2.5">
                  <StatusPill status={a.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status view ──────────────────────────────────────────────────────────────

function StatusView({
  tracked,
  authored,
  stats,
  money,
  onEdit,
}: {
  tracked: TrackedAction[];
  authored: ActionItem[];
  stats: ReturnType<typeof actionStats>;
  money: (n: number | null | undefined) => string;
  onEdit: (a: ActionItem) => void;
}) {
  const outstandingTracked = tracked.filter((t) => OPEN_STATUSES.includes(t.tracking.status));
  const closedTracked = tracked.filter((t) => CLOSED_STATUSES.includes(t.tracking.status));
  const outstandingAuthored = authored.filter((a) => OPEN_STATUSES.includes(a.status));
  const closedAuthored = authored.filter((a) => CLOSED_STATUSES.includes(a.status));

  const total = stats.total || 1;
  const pct = (n: number) => (n / total) * 100;

  const byAdvisor = useMemo(() => {
    const m = new Map<string, { total: number; closed: number }>();
    for (const t of tracked) {
      const e = m.get(t.advisor) ?? { total: 0, closed: 0 };
      e.total++;
      if (CLOSED_STATUSES.includes(t.tracking.status)) e.closed++;
      m.set(t.advisor, e);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [tracked]);

  return (
    <>
      <Card title="Progress" subtitle="Every action, imported and authored, by outcome">
        <div className="flex h-3.5 rounded-full overflow-hidden bg-secondary">
          <Seg w={pct(stats.done)} cls="bg-success" title={`Done ${stats.done}`} />
          <Seg
            w={pct(stats.inProgress)}
            cls="bg-[var(--chart-1)]"
            title={`In progress ${stats.inProgress}`}
          />
          <Seg w={pct(stats.blocked)} cls="bg-destructive" title={`Blocked ${stats.blocked}`} />
          <Seg w={pct(stats.open)} cls="bg-warning" title={`Open ${stats.open}`} />
          <Seg
            w={pct(stats.dropped)}
            cls="bg-muted-foreground/40"
            title={`Dropped ${stats.dropped}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px]">
          <Legend cls="bg-success" label="Done" n={stats.done} />
          <Legend cls="bg-[var(--chart-1)]" label="In progress" n={stats.inProgress} />
          <Legend cls="bg-destructive" label="Blocked" n={stats.blocked} />
          <Legend cls="bg-warning" label="Open" n={stats.open} />
          <Legend cls="bg-muted-foreground/40" label="Dropped" n={stats.dropped} />
        </div>
        <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Mini label="Completion rate" value={`${stats.completionRate.toFixed(0)}%`} tone="good" />
          <Mini label="Total actions" value={String(stats.total)} />
          <Mini
            label="Still outstanding"
            value={String(outstandingTracked.length + outstandingAuthored.length)}
            tone="warn"
          />
          <Mini label="Value outstanding" value={money(stats.openValue)} />
        </div>
      </Card>

      <Card title="By advisor" subtitle="Actions raised versus closed, per firm">
        <div className="space-y-3">
          {byAdvisor.map(([name, v]) => (
            <div key={name}>
              <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                <span className="font-medium">{name}</span>
                <span className="tabular text-muted-foreground">
                  {v.closed}/{v.total} closed
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${(v.closed / v.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-6">
          <Card
            title={`Still outstanding (${outstandingTracked.length + outstandingAuthored.length})`}
            subtitle="Nothing here has been closed off yet"
          >
            {outstandingTracked.length + outstandingAuthored.length === 0 ? (
              <EmptyState message="Nothing outstanding." />
            ) : (
              <ul className="divide-y divide-border -mx-5 max-h-[520px] overflow-y-auto">
                {outstandingTracked.map((t) => (
                  <li key={t.id} className="px-5 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[12.5px] flex-1 leading-relaxed">{t.title}</span>
                      <StatusPill status={t.tracking.status} />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">
                      {t.advisor}
                      {(t.tracking.owner || t.owner) && <> · {t.tracking.owner || t.owner}</>}
                      {t.meetingDate && <> · from {formatDate(t.meetingDate)}</>}
                    </p>
                  </li>
                ))}
                {outstandingAuthored.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => onEdit(a)}
                      className="w-full text-left px-5 py-2.5 hover:bg-secondary/30"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[12.5px] flex-1">{a.title}</span>
                        <StatusPill status={a.status} />
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">
                        {a.owner || "unassigned"} · recorded here
                        {a.dueDate && (
                          <span className={isOverdue(a) ? "text-destructive font-medium" : ""}>
                            {" · due "}
                            {formatDate(a.dueDate)}
                          </span>
                        )}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <Card
            title={`Acted upon (${closedTracked.length + closedAuthored.length})`}
            subtitle="Closed, with the date it was closed"
          >
            {closedTracked.length + closedAuthored.length === 0 ? (
              <EmptyState
                message="Nothing closed yet."
                hint="Set an action to Done or Dropped and it appears here with the date."
              />
            ) : (
              <ul className="divide-y divide-border -mx-5 max-h-[520px] overflow-y-auto">
                {closedTracked.map((t) => (
                  <li key={t.id} className="px-5 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[12.5px] flex-1 leading-relaxed">{t.title}</span>
                      <StatusPill status={t.tracking.status} />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">
                      {t.advisor}
                      {t.tracking.closedAt && <> · closed {formatDate(t.tracking.closedAt)}</>}
                    </p>
                    {t.tracking.closureNote && (
                      <p className="text-[10.5px] italic text-foreground/80 mt-0.5">
                        {t.tracking.closureNote}
                      </p>
                    )}
                  </li>
                ))}
                {closedAuthored.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => onEdit(a)}
                      className="w-full text-left px-5 py-2.5 hover:bg-secondary/30"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[12.5px] flex-1">{a.title}</span>
                        <StatusPill status={a.status} />
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">
                        {a.closedAt ? `closed ${formatDate(a.closedAt)}` : "closed"} · took{" "}
                        {humanDays(ageDays(a))}
                      </p>
                      {a.closureNote && (
                        <p className="text-[10.5px] italic text-foreground/80 mt-0.5">
                          {a.closureNote}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[12px] font-medium px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap",
        active
          ? "bg-surface text-foreground shadow-elegant"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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
      {STATUS_LABEL[status]}
    </span>
  );
}

function Seg({ w, cls, title }: { w: number; cls: string; title: string }) {
  if (w <= 0) return null;
  return <div className={cls} style={{ width: `${w}%` }} title={title} />;
}

function Legend({ cls, label, n }: { cls: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", cls)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{n}</span>
    </span>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-[15px] font-semibold tabular",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "good" | "warn" | "bad" | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-elegant">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[20px] font-semibold tabular tracking-tight",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground truncate">{sub}</p>
    </div>
  );
}
