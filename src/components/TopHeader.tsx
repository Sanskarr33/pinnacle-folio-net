import { Bell, Search, Calendar, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getMarketTickers } from "@/lib/data-service";
import { marketTickers as fallback } from "@/lib/dummy-data";
import type { MarketTicker } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function TopHeader() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const refreshedAt = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const { data: tickers = fallback } = useQuery({
    queryKey: ["marketTickers"],
    queryFn: getMarketTickers,
    staleTime: 60 * 1000,
  });

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate({ to: "/login", replace: true });
    toast.success("Signed out successfully");
  }

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center px-6 gap-4">
      <SidebarTrigger className="text-muted-foreground" />

      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-muted-foreground border-r border-border pr-4 mr-2">
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <div className="flex flex-col leading-none">
          <span className="tabular">{today}</span>
          <span className="text-[10px] text-muted-foreground/60 mt-0.5">Data as of {refreshedAt} IST</span>
        </div>
      </div>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search holdings, entities, transactions…"
          className="pl-9 h-9 bg-secondary/60 border-transparent focus-visible:bg-surface text-[13px]"
        />
        <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-surface">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 text-[11px] tabular pr-4 border-r border-border">
          {tickers.map((t) => <Ticker key={t.label} {...t} />)}
        </div>

        <button className="relative h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-border">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold tracking-wide shrink-0">
            {initials}
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-[12px] font-semibold">{user?.name ?? "—"}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider capitalize">
              {user?.role ?? "viewer"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="ml-1 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Ticker({ label, value, change, up }: MarketTicker) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground font-medium tracking-wider">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
      <span className={up ? "text-success" : "text-destructive"}>{change}</span>
    </div>
  );
}
