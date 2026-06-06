import { Bell, Search, ChevronDown, Calendar } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";

export function TopHeader() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center px-6 gap-4">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-muted-foreground border-r border-border pr-4 mr-2">
        <Calendar className="h-3.5 w-3.5" />
        <span className="tabular">{today}</span>
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
          <Ticker label="NIFTY" value="24,812" change="+0.42%" up />
          <Ticker label="SENSEX" value="81,420" change="+0.38%" up />
          <Ticker label="USD/INR" value="83.42" change="-0.08%" up={false} />
          <Ticker label="GOLD" value="71,240" change="+0.91%" up />
        </div>

        <button className="relative h-9 w-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        <div className="flex items-center gap-2.5 pl-2 border-l border-border">
          <div className="h-9 w-9 rounded-full bg-navy text-navy-foreground flex items-center justify-center text-[11px] font-semibold tracking-wide">
            SG
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-[12px] font-semibold">Suresh Gupta</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Principal</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}

function Ticker({ label, value, change, up }: { label: string; value: string; change: string; up: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground font-medium tracking-wider">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
      <span className={up ? "text-success" : "text-destructive"}>{change}</span>
    </div>
  );
}
