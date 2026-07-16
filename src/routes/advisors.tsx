import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, Calendar, MessageSquare, CheckCircle,
  TrendingUp, Edit2, Users, Phone, Mail, X, Loader2, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Advisor {
  id: string;
  name: string;
  firm?: string;
  phone?: string;
  email?: string;
  mandate?: string;
  asset_classes?: string[];
  entities?: string[];
  fee_type?: string;
  fee_amount?: number;
  relationship_since?: string;
  active: boolean;
  notes?: string;
  created_at: string;
}

interface Meeting {
  id: string;
  advisor_id: string;
  meeting_date: string;
  meeting_type: string;
  attendees?: string;
  raw_notes?: string;
  ai_summary?: string;
  next_meeting_date?: string;
  created_by?: string;
  created_at: string;
}

interface Action {
  id: string;
  meeting_id?: string;
  advisor_id: string;
  action_type: string;
  description: string;
  security_name?: string;
  asset_class?: string;
  entity_name?: string;
  target_amount?: number;
  timeline?: string;
  priority: string;
  status: string;
  acted_date?: string;
  pnl_impact?: number;
  auto_detected: boolean;
  notes?: string;
  created_at: string;
}

interface ExtractedItem {
  action_type: string;
  description: string;
  security_name: string | null;
  asset_class: string | null;
  entity_name: string | null;
  target_amount: number | null;
  timeline: string | null;
  priority: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASSES = ["Equity MF", "Debt MF", "Direct Equity", "PMS", "AIF", "Bonds", "REIT", "ETF", "International"];
const ENTITIES = ["SG", "SMC", "SSI", "Veer", "SMO", "SSG", "Suhel"];
const FEE_TYPES = ["None", "AUM-based", "Fixed", "Performance"];
const MEETING_TYPES = ["In-Person", "Call", "Email", "Report", "WhatsApp"];
const ACTION_TYPES = ["BUY", "SELL", "HOLD", "REVIEW", "REBALANCE", "OTHER"];
const TIMELINES = ["Immediate", "This Week", "This Month", "This Quarter"];
const PRIORITIES = ["High", "Medium", "Low"];

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/advisors")({
  head: () => ({
    meta: [
      { title: "Advisors — SG Family Wealth" },
      { name: "description", content: "Manage advisor relationships, meetings, and action items." },
    ],
  }),
  component: AdvisorsPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ["bg-blue-700", "bg-emerald-700", "bg-violet-700", "bg-amber-700", "bg-rose-700", "bg-cyan-700"];
  return colors[name.charCodeAt(0) % colors.length];
}

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function actionAgingClass(action: Action) {
  if (action.status !== "Pending") return "";
  const d = Math.floor((Date.now() - new Date(action.created_at).getTime()) / 86400000);
  if (d > 60) return "text-red-500";
  if (d > 30) return "text-amber-500";
  return "";
}

function priorityBorderColor(p: string) {
  if (p === "High") return "border-l-red-500";
  if (p === "Medium") return "border-l-amber-500";
  return "border-l-emerald-500";
}

function statusStyle(s: string) {
  if (s === "Acted") return "bg-emerald-500/15 text-emerald-600";
  if (s === "Ignored") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-600";
}

function toggleArr(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdvisorsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <AdvisorProfile advisorId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <AdvisorDirectory onSelect={setSelectedId} />;
}

// ─── Advisor Directory ────────────────────────────────────────────────────────

function AdvisorDirectory({ onSelect }: { onSelect: (id: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: advisors = [], isLoading } = useQuery({
    queryKey: ["advisors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sg_advisors").select("*").order("name");
      if (error) throw error;
      return data as Advisor[];
    },
  });

  const { data: meetingCounts = {} as Record<string, number> } = useQuery({
    queryKey: ["advisor-meeting-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("sg_advisor_meetings").select("advisor_id");
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.advisor_id] = (counts[r.advisor_id] ?? 0) + 1;
      return counts;
    },
  });

  const { data: actionStats = {} as Record<string, { total: number; pending: number }> } = useQuery({
    queryKey: ["advisor-action-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("sg_advisor_actions").select("advisor_id, status");
      const stats: Record<string, { total: number; pending: number }> = {};
      for (const r of data ?? []) {
        if (!stats[r.advisor_id]) stats[r.advisor_id] = { total: 0, pending: 0 };
        stats[r.advisor_id].total++;
        if (r.status === "Pending") stats[r.advisor_id].pending++;
      }
      return stats;
    },
  });

  // Conflict detection — same security advised BUY by one advisor and SELL by another
  const { data: pendingActions = [] } = useQuery({
    queryKey: ["advisor-pending-actions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sg_advisor_actions")
        .select("advisor_id, action_type, security_name")
        .eq("status", "Pending")
        .in("action_type", ["BUY", "SELL"])
        .not("security_name", "is", null);
      return data ?? [];
    },
  });

  const conflicts: { security: string; buyers: string[]; sellers: string[] }[] = [];
  const secMap = new Map<string, { buys: Set<string>; sells: Set<string> }>();
  for (const a of pendingActions as { advisor_id: string; action_type: string; security_name: string }[]) {
    const key = a.security_name.toLowerCase();
    if (!secMap.has(key)) secMap.set(key, { buys: new Set(), sells: new Set() });
    const entry = secMap.get(key)!;
    if (a.action_type === "BUY") entry.buys.add(a.advisor_id);
    else entry.sells.add(a.advisor_id);
  }
  for (const [sec, { buys, sells }] of secMap) {
    const buyers = [...buys].filter(id => !sells.has(id));
    const sellers = [...sells].filter(id => !buys.has(id));
    if (buyers.length > 0 && sellers.length > 0) {
      const buyerNames = advisors.filter(a => buyers.includes(a.id)).map(a => a.name);
      const sellerNames = advisors.filter(a => sellers.includes(a.id)).map(a => a.name);
      if (buyerNames.length && sellerNames.length) conflicts.push({ security: sec, buyers: buyerNames, sellers: sellerNames });
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Advisor Management</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground mt-1">Advisors</h1>
          <p className="text-sm text-muted-foreground mt-1">Track relationships, meetings, and action accountability.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Advisor
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-600 font-medium text-[13px]">
            <AlertTriangle className="h-4 w-4" />
            {conflicts.length} Conflict{conflicts.length > 1 ? "s" : ""} Detected
          </div>
          {conflicts.slice(0, 4).map((c, i) => (
            <p key={i} className="text-[12px] text-amber-600/80">
              <strong>{c.buyers.join(", ")}</strong> advised BUY · <strong>{c.sellers.join(", ")}</strong> advised SELL on{" "}
              <strong className="capitalize">{c.security}</strong>
            </p>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading advisors…
        </div>
      ) : advisors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
          <Users className="h-10 w-10 opacity-20" />
          <p className="text-sm">No advisors yet. Add your first to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {advisors.map(a => {
            const stats = actionStats[a.id] ?? { total: 0, pending: 0 };
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className="text-left bg-surface border border-border rounded-xl p-5 shadow-elegant hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold shrink-0", avatarColor(a.name))}>
                    {initials(a.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{a.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{a.firm ?? "Independent"}</p>
                  </div>
                </div>
                {a.mandate && (
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">{a.mandate}</p>
                )}
                {a.entities && a.entities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.entities.slice(0, 5).map(e => (
                      <span key={e} className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">{e}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t border-border pt-3 mt-2">
                  <span><span className="font-medium text-foreground">{meetingCounts[a.id] ?? 0}</span> meetings</span>
                  <span><span className="font-medium text-foreground">{stats.total}</span> actions</span>
                  {stats.pending > 0 && (
                    <span className="text-amber-600 font-medium ml-auto">{stats.pending} pending</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <AdvisorForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["advisors"] });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Advisor Profile ──────────────────────────────────────────────────────────

function AdvisorProfile({ advisorId, onBack }: { advisorId: string; onBack: () => void }) {
  const [actionFilter, setActionFilter] = useState<"All" | "Pending" | "Acted" | "Ignored">("All");
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const qc = useQueryClient();
  const { formatAmount } = useCurrency();

  const { data: advisor, isLoading } = useQuery({
    queryKey: ["advisor", advisorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sg_advisors").select("*").eq("id", advisorId).single();
      if (error) throw error;
      return data as Advisor;
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["advisor-meetings", advisorId],
    queryFn: async () => {
      const { data } = await supabase.from("sg_advisor_meetings").select("*").eq("advisor_id", advisorId).order("meeting_date", { ascending: false });
      return (data ?? []) as Meeting[];
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["advisor-actions", advisorId],
    queryFn: async () => {
      const { data } = await supabase.from("sg_advisor_actions").select("*").eq("advisor_id", advisorId).order("created_at", { ascending: false });
      return (data ?? []) as Action[];
    },
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("sg_advisor_actions")
        .update({ status, acted_date: status === "Acted" ? new Date().toISOString().split("T")[0] : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor-actions", advisorId] });
      qc.invalidateQueries({ queryKey: ["advisor-action-stats"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update"),
  });

  if (isLoading || !advisor) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const totalActions = actions.length;
  const actedCount = actions.filter(a => a.status === "Acted").length;
  const actedPct = totalActions > 0 ? Math.round((actedCount / totalActions) * 100) : 0;
  const pnlSum = actions.filter(a => a.status === "Acted" && a.pnl_impact).reduce((s, a) => s + (a.pnl_impact ?? 0), 0);
  const filteredActions = actionFilter === "All" ? actions : actions.filter(a => a.status === actionFilter);

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Advisors
      </button>

      {/* Header card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-elegant flex flex-col sm:flex-row gap-5">
        <div className={cn("h-14 w-14 rounded-full flex items-center justify-center text-white text-[18px] font-bold shrink-0", avatarColor(advisor.name))}>
          {initials(advisor.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-[22px] font-semibold text-foreground">{advisor.name}</h2>
              <p className="text-sm text-muted-foreground">{advisor.firm ?? "Independent"}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowEditForm(true)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Edit2 className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => setShowMeetingForm(true)}
                className="flex items-center gap-1.5 px-4 h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Meeting
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-[12px] text-muted-foreground">
            {advisor.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{advisor.phone}</span>}
            {advisor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{advisor.email}</span>}
            {advisor.fee_type && advisor.fee_type !== "None" && (
              <span>{advisor.fee_type}{advisor.fee_amount ? ` · ${advisor.fee_amount}%` : ""}</span>
            )}
          </div>
          {advisor.mandate && <p className="text-[13px] text-foreground/80 mt-2 max-w-2xl">{advisor.mandate}</p>}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {advisor.entities?.map(e => (
              <span key={e} className="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary font-medium">{e}</span>
            ))}
            {advisor.asset_classes?.map(c => (
              <span key={c} className="px-2 py-0.5 rounded-full text-[11px] bg-secondary text-muted-foreground">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Meetings", value: meetings.length, icon: Calendar },
          { label: "Actions Given", value: totalActions, icon: MessageSquare },
          { label: "Acted Upon", value: `${actedCount} (${actedPct}%)`, icon: CheckCircle },
          { label: "Est. P&L Impact", value: pnlSum ? formatAmount(pnlSum) : "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4 shadow-elegant">
            <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider mb-2">
              <Icon className="h-3.5 w-3.5" />{label}
            </div>
            <p className="text-[22px] font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Action items */}
      <div className="bg-surface border border-border rounded-xl shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-[15px] font-semibold text-foreground">Action Items</h3>
          <div className="flex gap-1">
            {(["All", "Pending", "Acted", "Ignored"] as const).map(f => (
              <button
                key={f}
                onClick={() => setActionFilter(f)}
                className={cn(
                  "px-3 h-7 rounded-md text-[12px] font-medium transition-colors",
                  actionFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filteredActions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No action items{actionFilter !== "All" ? ` with status "${actionFilter}"` : ""}.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredActions.map(action => (
              <div key={action.id} className={cn("px-5 py-4 border-l-[3px]", priorityBorderColor(action.priority))}>
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-secondary text-foreground shrink-0 mt-0.5">
                    {action.action_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground font-medium">{action.description}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      {action.security_name && <span>📌 {action.security_name}</span>}
                      {action.entity_name && <span>🏢 {action.entity_name}</span>}
                      {action.timeline && <span>⏱ {action.timeline}</span>}
                      {action.target_amount && <span>₹ {formatAmount(action.target_amount)}</span>}
                      <span className={cn("ml-auto", actionAgingClass(action))}>{daysAgo(action.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", statusStyle(action.status))}>
                      {action.status}
                    </span>
                    {action.status === "Pending" && (
                      <>
                        <button
                          onClick={() => updateAction.mutate({ id: action.id, status: "Acted" })}
                          className="px-2 h-6 rounded text-[11px] bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors"
                        >
                          Mark Acted
                        </button>
                        <button
                          onClick={() => updateAction.mutate({ id: action.id, status: "Ignored" })}
                          className="px-2 h-6 rounded text-[11px] bg-muted text-muted-foreground hover:bg-secondary transition-colors"
                        >
                          Ignore
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meeting timeline */}
      <div className="bg-surface border border-border rounded-xl shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">Meeting History</h3>
        </div>
        {meetings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No meetings recorded yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {meetings.map(m => {
              const mActions = actions.filter(a => a.meeting_id === m.id);
              const expanded = expandedMeeting === m.id;
              return (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-medium text-foreground">
                          {new Date(m.meeting_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] bg-secondary text-muted-foreground">{m.meeting_type}</span>
                        {mActions.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">{mActions.length} action{mActions.length > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      {m.ai_summary && (
                        <p className={cn("text-[12px] text-muted-foreground", !expanded && "line-clamp-2")}>{m.ai_summary}</p>
                      )}
                      {m.attendees && <p className="text-[11px] text-muted-foreground mt-1">👥 {m.attendees}</p>}
                    </div>
                    {(m.ai_summary || m.raw_notes || mActions.length > 0) && (
                      <button
                        onClick={() => setExpandedMeeting(expanded ? null : m.id)}
                        className="text-[12px] text-primary hover:underline shrink-0"
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="mt-3 space-y-3">
                      {m.raw_notes && (
                        <div className="bg-secondary/40 rounded-lg px-3 py-2.5 text-[12px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {m.raw_notes}
                        </div>
                      )}
                      {mActions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[12px] font-medium text-foreground">Actions from this meeting:</p>
                          {mActions.map(a => (
                            <div key={a.id} className={cn("pl-3 border-l-2 text-[12px] text-muted-foreground", priorityBorderColor(a.priority).replace("border-l-[3px]", ""))}>
                              <span className="font-semibold text-foreground">[{a.action_type}]</span>{" "}
                              {a.description}
                              {a.security_name && ` — ${a.security_name}`}
                              <span className={cn("ml-2 text-[11px] font-medium", statusStyle(a.status).split(" ")[1])}>
                                ({a.status})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.next_meeting_date && (
                        <p className="text-[12px] text-muted-foreground">
                          📅 Next:{" "}
                          {new Date(m.next_meeting_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEditForm && (
        <AdvisorForm
          advisor={advisor}
          onClose={() => setShowEditForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["advisor", advisorId] });
            qc.invalidateQueries({ queryKey: ["advisors"] });
            setShowEditForm(false);
          }}
        />
      )}

      {showMeetingForm && (
        <MeetingForm
          advisorId={advisorId}
          onClose={() => setShowMeetingForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["advisor-meetings", advisorId] });
            qc.invalidateQueries({ queryKey: ["advisor-actions", advisorId] });
            qc.invalidateQueries({ queryKey: ["advisor-action-stats"] });
            setShowMeetingForm(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Advisor Form ─────────────────────────────────────────────────────────────

function AdvisorForm({ advisor, onClose, onSaved }: {
  advisor?: Advisor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: advisor?.name ?? "",
    firm: advisor?.firm ?? "",
    phone: advisor?.phone ?? "",
    email: advisor?.email ?? "",
    mandate: advisor?.mandate ?? "",
    asset_classes: advisor?.asset_classes ?? [] as string[],
    entities: advisor?.entities ?? [] as string[],
    fee_type: advisor?.fee_type ?? "None",
    fee_amount: advisor?.fee_amount?.toString() ?? "",
    relationship_since: advisor?.relationship_since ?? "",
    notes: advisor?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        firm: form.firm || null,
        phone: form.phone || null,
        email: form.email || null,
        mandate: form.mandate || null,
        asset_classes: form.asset_classes,
        entities: form.entities,
        fee_type: form.fee_type || null,
        fee_amount: form.fee_amount ? parseFloat(form.fee_amount) : null,
        relationship_since: form.relationship_since || null,
        notes: form.notes || null,
      };
      if (advisor?.id) {
        const { error } = await supabase.from("sg_advisors").update(payload).eq("id", advisor.id);
        if (error) throw error;
        toast.success("Advisor updated");
      } else {
        const { error } = await supabase.from("sg_advisors").insert(payload);
        if (error) throw error;
        toast.success("Advisor added");
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const textareaClass = "mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none";
  const labelClass = "text-[11px] uppercase tracking-wider text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[520px] bg-background border-l border-border h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-semibold text-foreground">{advisor ? "Edit Advisor" : "Add Advisor"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <label className="block">
            <span className={labelClass}>Name *</span>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Firm / Company</span>
            <input value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Mandate / Scope</span>
            <textarea value={form.mandate} onChange={e => setForm(f => ({ ...f, mandate: e.target.value }))} rows={3} className={textareaClass} />
          </label>
          <div>
            <span className={labelClass}>Asset Classes</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ASSET_CLASSES.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, asset_classes: toggleArr(f.asset_classes, c) }))}
                  className={cn("px-2.5 py-1 rounded-full text-[12px] border transition-colors",
                    form.asset_classes.includes(c) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelClass}>Entities</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ENTITIES.map(e => (
                <button key={e} type="button" onClick={() => setForm(f => ({ ...f, entities: toggleArr(f.entities, e) }))}
                  className={cn("px-2.5 py-1 rounded-full text-[12px] border transition-colors",
                    form.entities.includes(e) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Fee Type</span>
              <select value={form.fee_type} onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))}
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Fee Amount (%)</span>
              <input type="number" step="0.01" value={form.fee_amount}
                onChange={e => setForm(f => ({ ...f, fee_amount: e.target.value }))} className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Relationship Since</span>
            <input type="date" value={form.relationship_since}
              onChange={e => setForm(f => ({ ...f, relationship_since: e.target.value }))} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Internal Notes</span>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={textareaClass} />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-md border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {advisor ? "Save Changes" : "Add Advisor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting Form ─────────────────────────────────────────────────────────────

function MeetingForm({ advisorId, onClose, onSaved }: {
  advisorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [details, setDetails] = useState({
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_type: "In-Person",
    attendees: "",
    next_meeting_date: "",
  });
  const [rawNotes, setRawNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedItems, setEditedItems] = useState<ExtractedItem[]>([]);
  const [autoDetect, setAutoDetect] = useState(true);
  const [saving, setSaving] = useState(false);

  const extractWithAI = async () => {
    if (!rawNotes.trim()) { toast.error("Please enter meeting notes first"); return; }
    setExtracting(true);
    try {
      const res = await fetch("/.netlify/functions/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: rawNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEditedSummary(data.summary ?? "");
      setEditedItems(data.action_items ?? []);
      setStep(3);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const updateItem = (i: number, patch: Partial<ExtractedItem>) => {
    setEditedItems(items => items.map((it, j) => j === i ? { ...it, ...patch } : it));
  };
  const removeItem = (i: number) => setEditedItems(items => items.filter((_, j) => j !== i));
  const addItem = () => setEditedItems(items => [...items, {
    action_type: "REVIEW", description: "", security_name: null,
    asset_class: null, entity_name: null, target_amount: null, timeline: null, priority: "Medium",
  }]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: mData, error: mErr } = await supabase
        .from("sg_advisor_meetings")
        .insert({
          advisor_id: advisorId,
          meeting_date: details.meeting_date,
          meeting_type: details.meeting_type,
          attendees: details.attendees || null,
          raw_notes: rawNotes || null,
          ai_summary: editedSummary || null,
          next_meeting_date: details.next_meeting_date || null,
          created_by: (user as { name?: string } | null)?.name ?? null,
        })
        .select()
        .single();
      if (mErr) throw mErr;
      const meetingId = mData.id;

      if (editedItems.length > 0) {
        const itemsWithStatus = await Promise.all(editedItems.map(async item => {
          let status = "Pending";
          let auto_detected = false;
          if (autoDetect && item.security_name && item.action_type === "BUY") {
            const { data: h } = await supabase
              .from("sg_family_holdings_import")
              .select("id")
              .ilike("security_name", `%${item.security_name}%`)
              .limit(1);
            if ((h?.length ?? 0) > 0) { status = "Acted"; auto_detected = true; }
          }
          return { ...item, status, auto_detected };
        }));

        const { error: aErr } = await supabase.from("sg_advisor_actions").insert(
          itemsWithStatus.map(item => ({
            meeting_id: meetingId,
            advisor_id: advisorId,
            action_type: item.action_type,
            description: item.description || "(no description)",
            security_name: item.security_name ?? null,
            asset_class: item.asset_class ?? null,
            entity_name: item.entity_name ?? null,
            target_amount: item.target_amount ?? null,
            timeline: item.timeline ?? null,
            priority: item.priority ?? "Medium",
            status: item.status,
            auto_detected: item.auto_detected,
            acted_date: item.status === "Acted" ? new Date().toISOString().split("T")[0] : null,
          }))
        );
        if (aErr) throw aErr;

        const autoActed = itemsWithStatus.filter(i => i.auto_detected).length;
        toast.success(
          `Meeting saved · ${itemsWithStatus.length} action${itemsWithStatus.length > 1 ? "s" : ""} added` +
          (autoActed > 0 ? ` · ${autoActed} auto-detected as acted` : "")
        );
      } else {
        toast.success("Meeting saved");
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const selectClass = "h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none";
  const labelClass = "text-[11px] uppercase tracking-wider text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[600px] bg-background border-l border-border h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Add Meeting</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Step {step} of 3 — {step === 1 ? "Details" : step === 2 ? "Notes" : "Review & Save"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex shrink-0">
          {([1, 2, 3] as const).map(s => (
            <div key={s} className={cn("flex-1 h-1", s <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Date *</span>
                  <input type="date" value={details.meeting_date}
                    onChange={e => setDetails(d => ({ ...d, meeting_date: e.target.value }))}
                    className={"mt-1 " + inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Type</span>
                  <select value={details.meeting_type}
                    onChange={e => setDetails(d => ({ ...d, meeting_type: e.target.value }))}
                    className={"mt-1 w-full " + selectClass}>
                    {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Attendees</span>
                <input value={details.attendees} placeholder="e.g. Suresh Goel, Rahul (ICICI Direct)"
                  onChange={e => setDetails(d => ({ ...d, attendees: e.target.value }))}
                  className={"mt-1 " + inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Next Meeting Date (optional)</span>
                <input type="date" value={details.next_meeting_date}
                  onChange={e => setDetails(d => ({ ...d, next_meeting_date: e.target.value }))}
                  className={"mt-1 " + inputClass} />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-[12px] text-muted-foreground">
                Paste raw notes, emails, WhatsApp messages, or any text. Click "Extract with AI" to automatically find action items.
              </p>
              <textarea
                value={rawNotes}
                onChange={e => setRawNotes(e.target.value)}
                placeholder="Paste meeting notes here…"
                rows={14}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <button
                onClick={extractWithAI}
                disabled={extracting || !rawNotes.trim()}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {extracting ? <><Loader2 className="h-4 w-4 animate-spin" />Extracting…</> : "✨ Extract with AI"}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <span className={labelClass}>Summary (editable)</span>
                <textarea
                  value={editedSummary}
                  onChange={e => setEditedSummary(e.target.value)}
                  placeholder="Add a summary of this meeting…"
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={labelClass}>Action Items ({editedItems.length})</span>
                  <button onClick={addItem} className="text-[12px] text-primary hover:underline">+ Add item</button>
                </div>
                <div className="space-y-3">
                  {editedItems.map((item, i) => (
                    <div key={i} className="bg-secondary/40 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={item.action_type} onChange={e => updateItem(i, { action_type: e.target.value })}
                          className="h-7 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={item.priority} onChange={e => updateItem(i, { priority: e.target.value })}
                          className="h-7 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button onClick={() => removeItem(i)} className="ml-auto text-muted-foreground hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input value={item.description} placeholder="Description of action"
                        onChange={e => updateItem(i, { description: e.target.value })}
                        className="w-full h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={item.security_name ?? ""} placeholder="Security (optional)"
                          onChange={e => updateItem(i, { security_name: e.target.value || null })}
                          className="h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                        <select value={item.entity_name ?? ""} onChange={e => updateItem(i, { entity_name: e.target.value || null })}
                          className="h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          <option value="">Entity (optional)</option>
                          {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={item.timeline ?? ""} onChange={e => updateItem(i, { timeline: e.target.value || null })}
                          className="h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          <option value="">Timeline (optional)</option>
                          {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" value={item.target_amount ?? ""} placeholder="Amount ₹ (optional)"
                          onChange={e => updateItem(i, { target_amount: e.target.value ? parseFloat(e.target.value) : null })}
                          className="h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                      </div>
                    </div>
                  ))}
                  {editedItems.length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-4">No action items yet. Add some above or save without them.</p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={autoDetect} onChange={e => setAutoDetect(e.target.checked)} className="rounded" />
                <span className="text-[12px] text-muted-foreground">Auto-detect BUY actions already in portfolio holdings</span>
              </label>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <button
            onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as 1 | 2 | 3)}
            className="px-4 h-9 rounded-md border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <div className="flex gap-2">
            {step === 2 && (
              <button onClick={() => setStep(3)}
                className="px-4 h-9 rounded-md border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                Skip AI
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !details.meeting_date}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Meeting
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
