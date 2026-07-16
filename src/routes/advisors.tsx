import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, Calendar, MessageSquare, CheckCircle,
  TrendingUp, Edit2, Users, Phone, Mail, X, Loader2,
  AlertTriangle, Clipboard, Activity,
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

// ─── Design helpers ───────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-blue-700",
  "from-emerald-500 to-emerald-700",
  "from-violet-500 to-violet-700",
  "from-amber-500 to-amber-700",
  "from-rose-500 to-rose-700",
  "from-cyan-500 to-cyan-700",
  "from-indigo-500 to-indigo-700",
];
function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

const ENTITY_COLORS: Record<string, string> = {
  SG:    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  SMC:   "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  SSI:   "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Veer:  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SMO:   "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  SSG:   "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  Suhel: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
};
function entityChip(e: string) {
  return ENTITY_COLORS[e] ?? "bg-secondary text-muted-foreground";
}

const ACTION_BADGE: Record<string, string> = {
  BUY:       "bg-emerald-500/15 text-emerald-600",
  SELL:      "bg-red-500/15 text-red-600",
  HOLD:      "bg-blue-500/15 text-blue-600",
  REVIEW:    "bg-amber-500/15 text-amber-600",
  REBALANCE: "bg-violet-500/15 text-violet-600",
  OTHER:     "bg-secondary text-muted-foreground",
};

const MEETING_BADGE: Record<string, string> = {
  "In-Person": "bg-blue-500/15 text-blue-600",
  "Call":      "bg-emerald-500/15 text-emerald-600",
  "Email":     "bg-amber-500/15 text-amber-600",
  "Report":    "bg-violet-500/15 text-violet-600",
  "WhatsApp":  "bg-green-500/15 text-green-600",
};

const STATUS_BADGE: Record<string, string> = {
  Acted:   "bg-emerald-500/15 text-emerald-600",
  Ignored: "bg-secondary text-muted-foreground",
  Pending: "bg-amber-500/15 text-amber-600",
};

function priorityBorder(p: string) {
  if (p === "High")   return "border-l-red-500";
  if (p === "Medium") return "border-l-amber-500";
  return "border-l-emerald-500";
}

function actionAging(action: Action) {
  if (action.status !== "Pending") return "";
  const d = Math.floor((Date.now() - new Date(action.created_at).getTime()) / 86400000);
  if (d > 60) return "text-red-500";
  if (d > 30) return "text-amber-500";
  return "text-muted-foreground";
}

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function toggleArr(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdvisorsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) return <AdvisorProfile advisorId={selectedId} onBack={() => setSelectedId(null)} />;
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
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Advisor Management</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground mt-1">Advisors</h1>
          <p className="text-sm text-muted-foreground mt-1">Track relationships, meetings, and action accountability.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-navy text-navy-foreground text-[12px] font-medium hover:bg-navy/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Advisor
        </button>
      </div>

      {/* Conflict banner */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-[13px] font-semibold text-destructive">
              {conflicts.length} Advisor Conflict{conflicts.length > 1 ? "s" : ""} Detected
            </p>
            {conflicts.slice(0, 4).map((c, i) => (
              <p key={i} className="text-[12px] text-destructive/80">
                <strong>{c.buyers.join(", ")}</strong> advises BUY · <strong>{c.sellers.join(", ")}</strong> advises SELL on{" "}
                <span className="font-medium capitalize">{c.security}</span> — review required
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading advisors…
        </div>
      ) : advisors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <Users className="h-6 w-6 opacity-40" />
          </div>
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
                className="text-left relative rounded-xl border border-border bg-surface shadow-elegant hover:shadow-elevated hover:border-primary/20 transition-all duration-200 group overflow-hidden"
              >
                {/* Gold top accent */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={cn(
                      "h-11 w-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[13px] font-bold shrink-0 shadow-sm",
                      avatarGradient(a.name)
                    )}>
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {a.name}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">{a.firm ?? "Independent"}</p>
                    </div>
                    {/* Active indicator */}
                    <span className="h-2 w-2 rounded-full bg-success shrink-0 mt-1" title="Active" />
                  </div>

                  {a.mandate && (
                    <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3 italic">{a.mandate}</p>
                  )}

                  {a.entities && a.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {a.entities.slice(0, 5).map(e => (
                        <span key={e} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", entityChip(e))}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] border-t border-border pt-3 mt-1">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium text-foreground">{meetingCounts[a.id] ?? 0}</span> meetings
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span className="font-medium text-foreground">{stats.total}</span> actions
                    </span>
                    {stats.pending > 0 && (
                      <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                        {stats.pending} pending
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showForm && (
        <AdvisorForm
          onClose={() => setShowForm(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["advisors"] }); setShowForm(false); }}
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
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Advisors
      </button>

      {/* Profile hero — dark navy card */}
      <div className="relative overflow-hidden rounded-xl border border-border shadow-elevated bg-gradient-to-br from-navy via-navy to-[oklch(0.22_0.06_265)]">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="relative px-6 py-6 flex flex-col sm:flex-row gap-5">
          {/* Avatar */}
          <div className={cn(
            "h-16 w-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[20px] font-bold shrink-0 shadow-lg ring-2 ring-white/10",
            avatarGradient(advisor.name)
          )}>
            {initials(advisor.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-[22px] font-semibold text-navy-foreground tracking-tight">{advisor.name}</h2>
                <p className="text-[13px] text-navy-foreground/60 mt-0.5">{advisor.firm ?? "Independent Advisor"}</p>
                {advisor.mandate && (
                  <p className="text-[12px] italic text-navy-foreground/50 mt-1.5 max-w-xl">{advisor.mandate}</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-white/15 bg-white/5 text-[12px] text-navy-foreground/80 hover:bg-white/10 transition-colors"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => setShowMeetingForm(true)}
                  className="flex items-center gap-1.5 px-4 h-8 rounded-md bg-white/15 text-[12px] font-medium text-navy-foreground hover:bg-white/20 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Meeting
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-3 text-[12px] text-navy-foreground/60">
              {advisor.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{advisor.phone}</span>}
              {advisor.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{advisor.email}</span>}
              {advisor.fee_type && advisor.fee_type !== "None" && (
                <span>{advisor.fee_type}{advisor.fee_amount ? ` · ${advisor.fee_amount}%` : ""}</span>
              )}
              {advisor.relationship_since && (
                <span>Since {new Date(advisor.relationship_since).getFullYear()}</span>
              )}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {advisor.entities?.map(e => (
                <span key={e} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-navy-foreground/85 border border-white/10">
                  {e}
                </span>
              ))}
              {advisor.asset_classes?.map(c => (
                <span key={c} className="px-2.5 py-0.5 rounded-full text-[11px] text-navy-foreground/55 border border-white/10">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard — KPI card pattern */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Meetings",  value: meetings.length,                             sub: "recorded",             icon: Calendar,       accent: false },
          { label: "Actions Given",   value: totalActions,                                sub: "from all meetings",    icon: MessageSquare,  accent: false },
          { label: "Acted Upon",      value: `${actedCount}`,                             sub: `${actedPct}% execution rate`, icon: CheckCircle, accent: actedPct >= 70 },
          { label: "Est. P&L Impact", value: pnlSum ? formatAmount(pnlSum) : "—",         sub: "from acted items",     icon: TrendingUp,     accent: false },
        ].map(({ label, value, sub, icon: Icon, accent }) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border p-4 shadow-elegant",
              accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface"
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</p>
            </div>
            <p className="text-[26px] font-semibold tabular-nums tracking-tight leading-none text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Action items */}
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Action Items</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Recommendations from all meetings</p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-secondary">
            {(["All", "Pending", "Acted", "Ignored"] as const).map(f => (
              <button
                key={f}
                onClick={() => setActionFilter(f)}
                className={cn(
                  "px-3 h-7 rounded-md text-[12px] font-medium transition-colors",
                  actionFilter === f
                    ? "bg-surface shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredActions.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground text-[13px]">
            No action items{actionFilter !== "All" ? ` with status "${actionFilter}"` : ""}.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredActions.map(action => (
              <div
                key={action.id}
                className={cn("px-5 py-4 border-l-[3px] hover:bg-secondary/40 transition-colors", priorityBorder(action.priority))}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Action type badge */}
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 mt-0.5",
                    ACTION_BADGE[action.action_type] ?? ACTION_BADGE.OTHER
                  )}>
                    {action.action_type}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{action.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {action.security_name && (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-secondary text-foreground font-medium border border-border">
                          {action.security_name}
                        </span>
                      )}
                      {action.entity_name && (
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", entityChip(action.entity_name))}>
                          {action.entity_name}
                        </span>
                      )}
                      {action.timeline && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] text-muted-foreground bg-secondary border border-border">
                          ⏱ {action.timeline}
                        </span>
                      )}
                      {action.target_amount && (
                        <span className="text-[11px] text-muted-foreground">₹ {formatAmount(action.target_amount)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_BADGE[action.status] ?? STATUS_BADGE.Pending)}>
                      {action.status}
                    </span>
                    <span className={cn("text-[11px]", actionAging(action))}>{daysAgo(action.created_at)}</span>
                    {action.status === "Pending" && (
                      <>
                        <button
                          onClick={() => updateAction.mutate({ id: action.id, status: "Acted" })}
                          className="px-2.5 h-7 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border border-emerald-500/20 transition-colors"
                        >
                          Mark Acted
                        </button>
                        <button
                          onClick={() => updateAction.mutate({ id: action.id, status: "Ignored" })}
                          className="px-2.5 h-7 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:bg-secondary transition-colors"
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
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[13px] font-semibold text-foreground">Meeting History</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""} recorded</p>
        </div>

        {meetings.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground text-[13px]">No meetings recorded yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {meetings.map(m => {
              const mActions = actions.filter(a => a.meeting_id === m.id);
              const expanded = expandedMeeting === m.id;
              return (
                <div key={m.id} className="px-5 py-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[13px] font-semibold text-foreground">
                          {new Date(m.meeting_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium", MEETING_BADGE[m.meeting_type] ?? "bg-secondary text-muted-foreground")}>
                          {m.meeting_type}
                        </span>
                        {mActions.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                            {mActions.length} action{mActions.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {m.ai_summary && (
                        <p className={cn("text-[12px] text-muted-foreground leading-relaxed", !expanded && "line-clamp-2")}>{m.ai_summary}</p>
                      )}
                      {m.attendees && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1">👥 {m.attendees}</p>
                      )}
                    </div>
                    {(m.ai_summary || m.raw_notes || mActions.length > 0) && (
                      <button
                        onClick={() => setExpandedMeeting(expanded ? null : m.id)}
                        className="text-[12px] font-medium text-primary hover:underline shrink-0"
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-3 pl-0">
                      {m.raw_notes && (
                        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed font-mono">
                          {m.raw_notes}
                        </div>
                      )}
                      {mActions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions from this meeting</p>
                          {mActions.map(a => (
                            <div key={a.id} className={cn("flex items-start gap-2 pl-3 border-l-2", priorityBorder(a.priority).replace("[3px]", ""))}>
                              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", ACTION_BADGE[a.action_type] ?? ACTION_BADGE.OTHER)}>
                                {a.action_type}
                              </span>
                              <span className="text-[12px] text-foreground">{a.description}</span>
                              {a.security_name && <span className="text-[11px] text-muted-foreground shrink-0">· {a.security_name}</span>}
                              <span className={cn("ml-auto text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full", STATUS_BADGE[a.status] ?? STATUS_BADGE.Pending)}>
                                {a.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.next_meeting_date && (
                        <p className="text-[12px] text-muted-foreground">
                          📅 Next meeting:{" "}
                          <span className="text-foreground font-medium">
                            {new Date(m.next_meeting_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
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
          advisorName={advisor.name}
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

// ─── Shared slide-over shell ──────────────────────────────────────────────────

const inputCls = "mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-shadow";
const textareaCls = "mt-1 w-full px-3 py-2.5 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none transition-shadow";
const selectCls = "mt-1 w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";
const labelCls = "block text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-1";

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

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-[520px] bg-surface border-l border-border h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">{advisor ? "Edit Advisor" : "Add Advisor"}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fill in the advisor's details</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <label className="block">
            <span className={labelCls}>Name *</span>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Rahul Sharma" />
          </label>

          <label className="block">
            <span className={labelCls}>Firm / Company</span>
            <input value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))} className={inputCls} placeholder="e.g. ICICI Securities" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Phone</span>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+91 98..." />
            </label>
            <label className="block">
              <span className={labelCls}>Email</span>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="advisor@firm.com" />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Mandate / Scope</span>
            <textarea value={form.mandate} onChange={e => setForm(f => ({ ...f, mandate: e.target.value }))} rows={3} className={textareaCls} placeholder="Manages equity portfolio for SG entity…" />
          </label>

          <div>
            <span className={labelCls}>Asset Classes</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ASSET_CLASSES.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, asset_classes: toggleArr(f.asset_classes, c) }))}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                    form.asset_classes.includes(c)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Entities</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ENTITIES.map(e => (
                <button key={e} type="button"
                  onClick={() => setForm(f => ({ ...f, entities: toggleArr(f.entities, e) }))}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                    form.entities.includes(e)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Fee Type</span>
              <select value={form.fee_type} onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))} className={selectCls}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Fee Amount (%)</span>
              <input type="number" step="0.01" value={form.fee_amount}
                onChange={e => setForm(f => ({ ...f, fee_amount: e.target.value }))} className={inputCls} placeholder="0.50" />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Relationship Since</span>
            <input type="date" value={form.relationship_since}
              onChange={e => setForm(f => ({ ...f, relationship_since: e.target.value }))} className={inputCls} />
          </label>

          <label className="block">
            <span className={labelCls}>Internal Notes</span>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={textareaCls} />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 h-9 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 h-9 rounded-md bg-navy text-navy-foreground text-[13px] font-medium hover:bg-navy/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {advisor ? "Save Changes" : "Add Advisor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting Form ─────────────────────────────────────────────────────────────

function MeetingForm({ advisorId, advisorName, onClose, onSaved }: {
  advisorId: string;
  advisorName: string;
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
  const [jsonResponse, setJsonResponse] = useState("");
  const [parseError, setParseError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedItems, setEditedItems] = useState<ExtractedItem[]>([]);
  const [autoDetect, setAutoDetect] = useState(true);
  const [saving, setSaving] = useState(false);

  const copyPrompt = async () => {
    const schema = `{
  "summary": "3-4 sentence summary of the meeting",
  "key_topics": ["topic1", "topic2"],
  "action_items": [
    {
      "action_type": "BUY|SELL|HOLD|REVIEW|REBALANCE|OTHER",
      "description": "Clear description of what needs to be done",
      "security_name": "stock or fund name if mentioned, else null",
      "asset_class": "Direct Equity|Equity MF|Debt MF|PMS|AIF|Bonds|REIT|ETF|null",
      "entity_name": "SG|SMC|SSI|Veer|SMO|SSG|Suhel|null",
      "target_amount": null,
      "timeline": "Immediate|This Week|This Month|This Quarter|null",
      "priority": "High|Medium|Low"
    }
  ],
  "next_meeting_suggestion": "suggested next meeting topic or empty string"
}`;
    const prompt = `You are analyzing meeting notes for a family office (SG Family Wealth). Extract structured information and return ONLY valid JSON matching the schema below — no prose, no markdown code fences, just raw JSON.\n\nSchema:\n${schema}\n\nAdvisor: ${advisorName}\n\nMeeting Notes:\n${rawNotes.trim() || "[paste your meeting notes here]"}`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const parseAndContinue = () => {
    if (!jsonResponse.trim()) { setParseError("Paste the JSON from ChatGPT first."); return; }
    try {
      const clean = jsonResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const data = JSON.parse(clean);
      setEditedSummary(data.summary ?? "");
      setEditedItems(data.action_items ?? []);
      setParseError("");
      setStep(3);
    } catch {
      setParseError("Invalid JSON — make sure you copied the full response from ChatGPT without any extra text.");
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

  const STEP_LABELS = ["Meeting Details", "Notes & Parse", "Review & Save"];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-[600px] bg-surface border-l border-border h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Add Meeting</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Step {step} of 3 — {STEP_LABELS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex shrink-0 gap-1 px-5 py-3 border-b border-border">
          {([1, 2, 3] as const).map(s => (
            <div key={s} className={cn(
              "flex-1 h-1.5 rounded-full transition-colors",
              s <= step ? "bg-primary" : "bg-border"
            )} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Step 1: Details */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Date *</span>
                  <input type="date" value={details.meeting_date}
                    onChange={e => setDetails(d => ({ ...d, meeting_date: e.target.value }))}
                    className={inputCls} />
                </label>
                <label className="block">
                  <span className={labelCls}>Type</span>
                  <select value={details.meeting_type}
                    onChange={e => setDetails(d => ({ ...d, meeting_type: e.target.value }))}
                    className={selectCls}>
                    {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className={labelCls}>Attendees</span>
                <input value={details.attendees} placeholder="e.g. Suresh Goel, Rahul (ICICI Direct)"
                  onChange={e => setDetails(d => ({ ...d, attendees: e.target.value }))}
                  className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Next Meeting Date (optional)</span>
                <input type="date" value={details.next_meeting_date}
                  onChange={e => setDetails(d => ({ ...d, next_meeting_date: e.target.value }))}
                  className={inputCls} />
              </label>
            </>
          )}

          {/* Step 2: Notes + ChatGPT prompt */}
          {step === 2 && (
            <>
              <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 space-y-1 text-[12px] text-muted-foreground">
                <p className="font-semibold text-foreground text-[13px]">Free AI extraction — no API key needed</p>
                <p>1. Paste meeting notes below</p>
                <p>2. "Copy Prompt" → paste in ChatGPT (or any LLM) → get JSON</p>
                <p>3. Paste JSON below → "Parse & Continue"</p>
              </div>

              <label className="block">
                <span className={labelCls}>Meeting Notes</span>
                <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)}
                  placeholder="Paste notes, email thread, WhatsApp messages…"
                  rows={7} className={textareaCls} />
              </label>

              <button onClick={copyPrompt}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-primary/40 text-primary text-[13px] font-medium hover:bg-primary/5 transition-colors">
                <Clipboard className="h-4 w-4" />
                {copied ? "✓ Copied! Paste in ChatGPT" : "Copy Prompt for ChatGPT"}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground shrink-0">Paste ChatGPT's JSON response</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <label className="block">
                <span className={labelCls}>JSON Response from ChatGPT</span>
                <textarea value={jsonResponse}
                  onChange={e => { setJsonResponse(e.target.value); setParseError(""); }}
                  placeholder={'{\n  "summary": "...",\n  "action_items": [...]\n}'}
                  rows={7}
                  className="mt-1 w-full px-3 py-2.5 rounded-md border border-border bg-background text-[12px] text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
                {parseError && <p className="text-[12px] text-destructive mt-1.5">{parseError}</p>}
              </label>

              <button onClick={parseAndContinue} disabled={!jsonResponse.trim()}
                className="w-full h-10 rounded-md bg-navy text-navy-foreground text-[13px] font-medium hover:bg-navy/90 disabled:opacity-50 transition-colors">
                Parse & Continue →
              </button>
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <>
              <label className="block">
                <span className={labelCls}>Summary (editable)</span>
                <textarea value={editedSummary} onChange={e => setEditedSummary(e.target.value)}
                  placeholder="Add a summary of this meeting…" rows={4} className={textareaCls} />
              </label>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={labelCls}>Action Items ({editedItems.length})</span>
                  <button onClick={addItem} className="text-[12px] font-medium text-primary hover:underline">+ Add item</button>
                </div>
                <div className="space-y-3">
                  {editedItems.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={item.action_type} onChange={e => updateItem(i, { action_type: e.target.value })}
                          className="h-7 px-2 rounded-md border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={item.priority} onChange={e => updateItem(i, { priority: e.target.value })}
                          className="h-7 px-2 rounded-md border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button onClick={() => removeItem(i)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input value={item.description} placeholder="Description of action"
                        onChange={e => updateItem(i, { description: e.target.value })}
                        className="w-full h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={item.security_name ?? ""} placeholder="Security (optional)"
                          onChange={e => updateItem(i, { security_name: e.target.value || null })}
                          className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                        <select value={item.entity_name ?? ""} onChange={e => updateItem(i, { entity_name: e.target.value || null })}
                          className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          <option value="">Entity (optional)</option>
                          {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={item.timeline ?? ""} onChange={e => updateItem(i, { timeline: e.target.value || null })}
                          className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground focus:outline-none">
                          <option value="">Timeline (optional)</option>
                          {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" value={item.target_amount ?? ""} placeholder="Amount ₹"
                          onChange={e => updateItem(i, { target_amount: e.target.value ? parseFloat(e.target.value) : null })}
                          className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                      </div>
                    </div>
                  ))}
                  {editedItems.length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-6">
                      No action items yet — add manually or save without them.
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <input type="checkbox" checked={autoDetect} onChange={e => setAutoDetect(e.target.checked)} className="rounded" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">Auto-detect acted BUY items</p>
                  <p className="text-[11px] text-muted-foreground">Marks BUY actions as Acted if security already exists in portfolio</p>
                </div>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <button
            onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as 1 | 2 | 3)}
            className="px-4 h-9 rounded-md border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !details.meeting_date}
                className="px-4 h-9 rounded-md bg-navy text-navy-foreground text-[13px] font-medium hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="px-4 h-9 rounded-md bg-navy text-navy-foreground text-[13px] font-medium hover:bg-navy/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
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
