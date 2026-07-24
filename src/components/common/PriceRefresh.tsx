import { useState } from "react";
import { RefreshCw, Radio } from "lucide-react";
import { toast } from "sonner";
import { useBook, usePriceState } from "@/hooks/use-book";
import { refreshPrices, clearPrices, applyPrices } from "@/lib/prices";
import { useUnits } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Refreshes mutual-fund NAVs across the whole dashboard.
 *
 * Fetches the live AMFI feed via the Netlify proxy, overlays NAVs onto the book by
 * ISIN, and reports exactly what moved. A small pill shows the feed date so a viewer
 * always knows whether they are looking at live or workbook figures.
 */
export function PriceRefresh() {
  const { data: book = [] } = useBook();
  const { prices } = usePriceState();
  const { money } = useUnits();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const id = toast.loading("Fetching latest NAVs…");
    try {
      const snap = await refreshPrices();
      // Report coverage against the current book so the user sees the real effect.
      const { coverage } = applyPrices(book, snap);
      if (coverage && coverage.matchedLots > 0) {
        const dir = coverage.movedValue >= 0 ? "+" : "−";
        toast.success(
          `NAVs updated · ${coverage.matchedLots} funds repriced · ${money(coverage.matchedValue)} live · ${dir}${money(Math.abs(coverage.movedValue))} vs book`,
          { id },
        );
      } else {
        toast.success(`NAVs fetched (as of ${snap.asOf}) — nothing to reprice.`, { id });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fetch NAVs.", { id });
    } finally {
      setBusy(false);
    }
  };

  const live = Boolean(prices);

  return (
    <div className="flex items-center gap-1.5">
      {live && prices && (
        <button
          onClick={() => {
            clearPrices();
            toast.message("Reverted to workbook valuations.");
          }}
          title={`Live NAVs as of ${prices.asOf} · fetched ${new Date(prices.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}. Click to revert to workbook values.`}
          className="hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded-full border border-success/40 bg-success/10 text-success text-[10.5px] font-medium"
        >
          <Radio className="h-3 w-3" />
          NAVs · {prices.asOf}
        </button>
      )}
      <button
        onClick={run}
        disabled={busy}
        title="Refresh mutual-fund NAVs from the live AMFI feed"
        aria-label="Refresh NAVs"
        className="h-9 px-2.5 rounded-full hover:bg-secondary flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors disabled:opacity-50"
      >
        <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
        <span className="hidden lg:inline">{busy ? "Fetching…" : "Refresh NAVs"}</span>
      </button>
    </div>
  );
}

export { CircleSlash };
