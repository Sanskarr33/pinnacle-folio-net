import { useState, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Lock, User, Shield, TrendingUp, Users } from "lucide-react";
import type { AuthUser } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign In — SG Family Wealth" }],
  }),
  component: LoginPage,
});

// ─── PIN Input — 4 individual boxes with auto-advance ─────────────────────────

function PinInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleChange = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = value.padEnd(4, " ").split("");
    chars[idx] = digit || " ";
    const next = chars.join("").trimEnd();
    onChange(next);
    if (digit && idx < 3) refs[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[idx]) {
        const chars = value.split("");
        chars[idx] = "";
        onChange(chars.join(""));
      } else if (idx > 0) {
        refs[idx - 1].current?.focus();
        const chars = value.split("");
        chars[idx - 1] = "";
        onChange(chars.join(""));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    onChange(text);
    if (text.length === 4) refs[3].current?.focus();
    else if (text.length > 0) refs[text.length - 1].current?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] && value[i] !== " " ? value[i] : ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={cn(
            "h-12 w-12 rounded-xl border-2 bg-secondary/40 text-center text-xl font-bold caret-transparent",
            "focus:border-primary focus:outline-none focus:ring-0 focus:bg-secondary/60",
            "transition-all duration-150",
            value[i] && value[i] !== " "
              ? "border-primary/60 text-foreground"
              : "border-border text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      ))}
    </div>
  );
}

// ─── Left decorative panel ─────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex flex-col relative overflow-hidden"
      style={{
        flex: "0 0 58%",
        background: "linear-gradient(145deg, #060b19 0%, #0a1428 55%, #0d1f3c 100%)",
      }}
    >
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Decorative wealth chart */}
      <svg
        viewBox="0 0 560 220"
        className="absolute bottom-0 left-0 right-0 w-full opacity-[0.12]"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,200 L0,170 C40,155 80,140 120,118 C160,96 190,88 230,68 C270,48 310,35 350,22 C390,9 430,5 470,4 C500,3 530,4 560,3 L560,200 Z"
          fill="url(#chartFill)"
        />
        <path
          d="M0,170 C40,155 80,140 120,118 C160,96 190,88 230,68 C270,48 310,35 350,22 C390,9 430,5 470,4 C500,3 530,4 560,3"
          stroke="white"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Data points */}
        {[
          [0, 170], [120, 118], [230, 68], [350, 22], [470, 4], [560, 3],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="white" opacity="0.6" />
        ))}
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-12 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white font-bold text-sm tracking-tight shrink-0"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            SG
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-semibold text-white">SG Family Wealth</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Command Centre</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="mt-auto mb-auto">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-medium mb-4">
            Private · Secure · Consolidated
          </p>
          <h1 className="text-[38px] font-bold text-white leading-[1.15] tracking-tight max-w-md">
            Your family office<br />command centre.
          </h1>
          <p className="mt-4 text-[15px] text-white/55 max-w-sm leading-relaxed">
            Real-time portfolio intelligence, consolidated across all entities, asset classes, and advisors.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: TrendingUp, text: "₹309 Cr+ AUM tracked live across 7 entities" },
              { icon: Shield, text: "PIN-based access — only approved family members" },
              { icon: Users, text: "Multi-entity view with granular drill-downs" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Icon className="h-3.5 w-3.5 text-white/60" />
                </div>
                <span className="text-[13px] text-white/60">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-white/25 tracking-wider uppercase">
          SG Family Office · Confidential
        </p>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function LoginPage() {
  const [tab, setTab] = useState<"signin" | "request">("signin");

  // Sign In state
  const [siName, setSiName] = useState("");
  const [siPin, setSiPin] = useState("");
  const [siLoading, setSiLoading] = useState(false);

  // Request Access state
  const [raName, setRaName] = useState("");
  const [raPin, setRaPin] = useState("");
  const [raConfirm, setRaConfirm] = useState("");
  const [raLoading, setRaLoading] = useState(false);
  const [raSuccess, setRaSuccess] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Sign In ─────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!siName.trim()) { toast.error("Please enter your name"); return; }
    if (siPin.length !== 4) { toast.error("PIN must be exactly 4 digits"); return; }

    setSiLoading(true);
    try {
      const pinHash = await hashPin(siPin);

      const { data, error } = await supabase
        .from("sg_users")
        .select("id, name, role, status")
        .ilike("name", siName.trim())
        .eq("status", "approved")
        .eq("pin_hash", pinHash)
        .maybeSingle();

      if (error) {
        console.error("[auth] sign-in error:", error.message);
        toast.error("An error occurred. Please try again.");
        return;
      }

      if (!data) {
        toast.error("Invalid name or PIN, or access not yet approved.");
        return;
      }

      // Update last_login (fire and forget)
      supabase
        .from("sg_users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => {});

      login({ id: data.id, name: data.name, role: data.role as AuthUser["role"] });
      navigate({ to: "/" });
    } catch (err) {
      console.error("[auth] sign-in exception:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSiLoading(false);
    }
  }

  // ── Request Access ──────────────────────────────────────────────────────────

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!raName.trim()) { toast.error("Please enter your name"); return; }
    if (raPin.length !== 4) { toast.error("PIN must be exactly 4 digits"); return; }
    if (raPin !== raConfirm) { toast.error("PINs do not match"); return; }

    setRaLoading(true);
    try {
      // Check for duplicate name
      const { data: existing } = await supabase
        .from("sg_users")
        .select("id, status")
        .ilike("name", raName.trim())
        .not("status", "eq", "rejected")
        .maybeSingle();

      if (existing) {
        toast.error(
          existing.status === "pending"
            ? "A request with this name is already pending approval."
            : "This name is already registered.",
        );
        return;
      }

      const pinHash = await hashPin(raPin);

      const { error } = await supabase.from("sg_users").insert({
        name: raName.trim(),
        pin_hash: pinHash,
        role: "viewer",
        status: "pending",
      });

      if (error) {
        console.error("[auth] request-access error:", error.message);
        toast.error("Failed to submit request. Please try again.");
        return;
      }

      setRaSuccess(true);
    } catch (err) {
      console.error("[auth] request-access exception:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRaLoading(false);
    }
  }

  const inputCls =
    "w-full h-10 rounded-lg border border-border bg-secondary/40 px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 py-2 text-[13px] font-medium rounded-md transition-all",
      active
        ? "bg-surface text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex min-h-screen bg-background">
      <LeftPanel />

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              SG
            </div>
            <div>
              <p className="text-[13px] font-semibold">SG Family Wealth</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Command Centre</p>
            </div>
          </div>

          <h2 className="text-[24px] font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Sign in to access your family portfolio.</p>

          {/* Tabs */}
          <div className="mt-6 flex p-1 rounded-xl bg-secondary/60 border border-border gap-1">
            <button className={tabCls(tab === "signin")} onClick={() => setTab("signin")}>
              Sign In
            </button>
            <button className={tabCls(tab === "request")} onClick={() => setTab("request")}>
              Request Access
            </button>
          </div>

          {/* ── Sign In form ── */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="mt-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                  Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={siName}
                    onChange={(e) => setSiName(e.target.value)}
                    placeholder="Your first name"
                    autoComplete="username"
                    autoFocus
                    className={cn(inputCls, "pl-9")}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                  4-Digit PIN
                </label>
                <PinInput value={siPin} onChange={setSiPin} disabled={siLoading} />
              </div>

              <button
                type="submit"
                disabled={siLoading || siPin.length !== 4 || !siName.trim()}
                className="mt-2 w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {siLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {siLoading ? "Signing in…" : "Sign In"}
              </button>

              <p className="text-center text-[11.5px] text-muted-foreground">
                Don't have access?{" "}
                <button type="button" onClick={() => setTab("request")} className="text-primary hover:underline">
                  Request it here
                </button>
              </p>
            </form>
          )}

          {/* ── Request Access form ── */}
          {tab === "request" && (
            <>
              {raSuccess ? (
                <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6 text-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                    <Shield className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">Request submitted</p>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    Your access request is pending approval by the admin. You'll be able to sign in once approved.
                  </p>
                  <button
                    onClick={() => { setTab("signin"); setRaSuccess(false); setRaName(""); setRaPin(""); setRaConfirm(""); }}
                    className="mt-2 text-[12.5px] text-primary hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestAccess} className="mt-6 space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={raName}
                        onChange={(e) => setRaName(e.target.value)}
                        placeholder="First name (e.g. Priya)"
                        autoFocus
                        className={cn(inputCls, "pl-9")}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                      Choose a 4-Digit PIN
                    </label>
                    <PinInput value={raPin} onChange={setRaPin} disabled={raLoading} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                      Confirm PIN
                    </label>
                    <PinInput value={raConfirm} onChange={setRaConfirm} disabled={raLoading} />
                  </div>

                  {raPin.length === 4 && raConfirm.length === 4 && raPin !== raConfirm && (
                    <p className="text-[12px] text-destructive">PINs do not match</p>
                  )}

                  <button
                    type="submit"
                    disabled={raLoading || raPin.length !== 4 || raConfirm.length !== 4 || raPin !== raConfirm || !raName.trim()}
                    className="mt-2 w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {raLoading && (
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    )}
                    {raLoading ? "Submitting…" : "Submit Request"}
                  </button>

                  <p className="text-center text-[11.5px] text-muted-foreground">
                    Already have access?{" "}
                    <button type="button" onClick={() => setTab("signin")} className="text-primary hover:underline">
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </>
          )}

          <p className="mt-10 text-center text-[10.5px] text-muted-foreground/50">
            SG Family Office · Private & Confidential
          </p>
        </div>
      </div>
    </div>
  );
}
