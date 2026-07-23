import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useBook } from "@/hooks/use-book";
import { consolidateSecurities, normaliseEntity } from "@/lib/portfolio-analytics";
import { inr, pctSigned } from "@/lib/format";

const PAGES: Array<{ label: string; to: string; hint: string }> = [
  { label: "Dashboard", to: "/", hint: "Consolidated position" },
  { label: "Family Overview", to: "/family", hint: "Wealth distribution" },
  { label: "Entities", to: "/entities", hint: "By legal entity" },
  { label: "Asset Allocation", to: "/allocation", hint: "Four allocation lenses" },
  { label: "Analytics", to: "/analytics", hint: "Interactive cross-filtered charts" },
  { label: "Rebalancing", to: "/rebalancing", hint: "Policy bands, drift and trades" },
  { label: "Simulator", to: "/simulator", hint: "What-if trades and wealth over time" },
  { label: "Add Transaction", to: "/add-transaction", hint: "Screenshot or manual entry" },
  { label: "Admin", to: "/admin", hint: "User approvals" },
  { label: "Direct Equity", to: "/equity", hint: "Stock positions" },
  { label: "Mutual Funds", to: "/mutual-funds", hint: "Scheme holdings" },
  { label: "ETFs", to: "/etfs", hint: "Exchange-traded funds" },
  { label: "PMS", to: "/pms", hint: "Managed mandates" },
  { label: "AIFs", to: "/aifs", hint: "Alternatives" },
  { label: "ULIPs", to: "/ulips", hint: "Insurance-linked" },
  { label: "Bonds & Fixed Income", to: "/bonds-fds", hint: "Debt instruments" },
  { label: "Gold & Silver", to: "/bullion", hint: "Bullion exposure" },
  { label: "International", to: "/international", hint: "Offshore exposure" },
  { label: "Acquisition History", to: "/transactions", hint: "When positions were bought" },
  { label: "Capital Gains", to: "/capital-gains", hint: "Tax timing & harvesting" },
  { label: "Exit Load Tracker", to: "/exit-load", hint: "Redemption penalties" },
  { label: "Advisor Meetings", to: "/meetings", hint: "Notes, actionables, what's been done" },
  { label: "Custodian Review", to: "/advisor-review", hint: "By broker" },
  { label: "Reports", to: "/reports", hint: "Exports & printable summary" },
  { label: "Data Source & Health", to: "/data-import", hint: "Where numbers come from" },
  { label: "Settings", to: "/settings", hint: "Theme, source, thresholds" },
];

/**
 * The header search was previously a decorative input with a fake ⌘K badge.
 * This makes it real: pages plus the actual securities in the book.
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: book = [] } = useBook();

  const securities = useMemo(() => consolidateSecurities(book).slice(0, 200), [book]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Where a security lives, so selecting one lands somewhere useful.
  const routeFor = (name: string) => {
    const row = book.find((r) => (r.security_name || r.scheme_name || "") === name);
    const pt = (row?.product_type ?? "").toLowerCase();
    if (pt.includes("mutual fund")) return "/mutual-funds";
    if (pt.includes("direct equity") || pt.includes("unlisted")) return "/equity";
    if (pt.includes("gold") || pt.includes("silver")) return "/bullion";
    if (pt === "etf") return "/etfs";
    if (pt.includes("pms")) return "/pms";
    if (pt.includes("aif")) return "/aifs";
    if (pt.includes("ulip")) return "/ulips";
    if (pt.includes("bond") || pt.includes("reit")) return "/bonds-fds";
    return "/allocation";
  };

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        className="flex-1 max-w-md flex items-center gap-2 h-9 rounded-md border border-transparent bg-secondary/60 hover:bg-secondary px-3 text-left transition-colors"
        aria-label="Search holdings and pages"
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[13px] text-muted-foreground truncate">
          Search holdings, entities, pages…
        </span>
        <kbd className="hidden lg:inline-flex ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-surface shrink-0">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search securities, entities or pages…" />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {PAGES.map((p) => (
              <CommandItem
                key={p.to}
                value={`${p.label} ${p.hint}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate({ to: p.to });
                }}
              >
                <span className="font-medium">{p.label}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{p.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {securities.length > 0 && (
            <CommandGroup heading={`Securities (${securities.length} largest)`}>
              {securities.map((s) => (
                <CommandItem
                  key={s.key}
                  value={s.key}
                  onSelect={() => {
                    onOpenChange(false);
                    navigate({ to: routeFor(s.key) });
                  }}
                >
                  <span className="truncate">{s.key}</span>
                  <span className="ml-auto flex items-center gap-2.5 text-[11px] tabular shrink-0">
                    <span className="text-muted-foreground">{inr(s.current)}</span>
                    <span className={s.gainPct >= 0 ? "text-success" : "text-destructive"}>
                      {pctSigned(s.gainPct, 1)}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
