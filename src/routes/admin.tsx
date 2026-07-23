import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Users, ShieldCheck, UserCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — SG Family Wealth" }],
  }),
  component: AdminPage,
});

interface SGUser {
  id: string;
  name: string;
  role: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login: string | null;
  created_at: string;
}

async function fetchAllUsers(): Promise<SGUser[]> {
  const { data, error } = await supabase
    .from("sg_users")
    .select("*")
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SGUser[];
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: {
      label: "Approved",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    pending: {
      label: "Pending",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    rejected: {
      label: "Rejected",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
  };
  const s = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = !user || user.role === "admin";

  // Redirect non-admins. This must be an effect, not an early return: bailing out
  // before useQuery below would change the hook order between renders, which React
  // treats as a corrupted component.
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate({ to: "/", replace: true });
    }
  }, [user, navigate]);

  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["sgUsers"],
    queryFn: fetchAllUsers,
    staleTime: 30 * 1000,
    // Never fetch the user list for someone who is not an admin.
    enabled: isAdmin,
  });

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const rejected = users.filter((u) => u.status === "rejected");

  async function approve(id: string) {
    if (!user) return;
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("sg_users")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.name,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("User approved successfully");
      refetch();
    } catch (err) {
      console.error("[admin] approve error:", err);
      toast.error("Failed to approve user");
    } finally {
      setActionLoading(null);
    }
  }

  async function reject(id: string) {
    setActionLoading(id);
    try {
      const { error } = await supabase.from("sg_users").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
      toast.success("User rejected");
      refetch();
    } finally {
      setActionLoading(null);
    }
  }

  async function revoke(id: string) {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("sg_users")
        .update({ status: "rejected" })
        .eq("id", id)
        .neq("id", user?.id ?? ""); // can't revoke yourself
      if (error) throw error;
      toast.success("Access revoked");
      refetch();
    } finally {
      setActionLoading(null);
    }
  }

  const isLocker = (id: string) => actionLoading === id;

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          Settings · Admin
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Approve or reject access requests, manage existing users, and monitor activity.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Clock, label: "Pending", value: pending.length, cls: "text-amber-500" },
          { icon: UserCheck, label: "Approved", value: approved.length, cls: "text-emerald-600" },
          { icon: Users, label: "Total Users", value: users.length, cls: "text-foreground" },
        ].map(({ icon: Icon, label, value, cls }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-surface p-4 shadow-elegant"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className={cn("h-3.5 w-3.5", cls)} />
              <span className="text-[10px] uppercase tracking-[0.18em] font-medium">{label}</span>
            </div>
            <p className={cn("mt-2 text-[26px] font-semibold tabular-nums tracking-tight", cls)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-surface shadow-elegant overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-[13px] font-semibold">Pending Requests ({pending.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {["Name", "Requested", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium",
                        h === "Actions" ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium">{u.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDate(u.requested_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => approve(u.id)}
                          disabled={isLocker(u.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 px-3 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => reject(u.id)}
                          disabled={isLocker(u.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 px-3 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All users table */}
      <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">All Users</h2>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {["Name", "Role", "Status", "Last Login", "Approved By", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium whitespace-nowrap",
                        h === "Actions" ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium">
                      {u.name}
                      {u.id === user?.id && (
                        <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{u.role}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(u.last_login)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{u.approved_by ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === "rejected" && (
                          <button
                            onClick={() => approve(u.id)}
                            disabled={isLocker(u.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Re-approve
                          </button>
                        )}
                        {u.status === "approved" && u.id !== user?.id && (
                          <button
                            onClick={() => revoke(u.id)}
                            disabled={isLocker(u.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Revoke
                          </button>
                        )}
                        {u.id === user?.id && (
                          <span className="text-[11px] text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && users.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border/40 bg-secondary/20">
            <span className="text-[11px] text-muted-foreground">
              {users.length} user{users.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
