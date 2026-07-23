import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Calculator } from "lucide-react";
import { useUnits, UNIT_OPTIONS, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Switches the display unit for every monetary figure in the app at once.
 * Also exposes decimal precision, since "Crore to 2dp" and "Rupees to 2dp" are
 * very different levels of detail.
 */
export function UnitSelector({ compact = false }: { compact?: boolean }) {
  const { unit, setUnit, digits, setDigits } = useUnits();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = UNIT_OPTIONS.find((o) => o.value === unit) ?? UNIT_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Display units"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border hover:bg-secondary transition-colors",
          compact ? "h-8 px-2 text-[11.5px]" : "h-9 px-2.5 text-[12px]",
        )}
      >
        <Calculator className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{active.label}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-60 rounded-lg border border-border bg-surface shadow-elevated z-50 overflow-hidden"
        >
          <p className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            Display amounts in
          </p>
          {UNIT_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === unit}
              onClick={() => {
                setUnit(o.value as Unit);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-secondary/70 transition-colors",
                o.value === unit && "bg-secondary/50",
              )}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 mt-0.5 shrink-0",
                  o.value === unit ? "text-success" : "opacity-0",
                )}
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{o.label}</span>
                <span className="block text-[10.5px] text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}

          <div className="border-t border-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1.5">
              Decimal places
            </p>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDigits(d)}
                  className={cn(
                    "h-7 w-8 rounded-md border text-[12px] font-medium tabular transition-colors",
                    d === digits
                      ? "border-foreground/30 bg-secondary text-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
