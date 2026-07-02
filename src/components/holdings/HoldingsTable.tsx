import { cn } from "@/lib/utils";
import { LayoutList } from "lucide-react";
import type { PortfolioHolding } from "@/lib/types";

// Must match CR in HoldingsKpiBar.tsx — set to 1 if values already in Crore.
const CR = 10_000_000;

// ─── Column definitions ───────────────────────────────────────────────────────

export type ColFormat = "text" | "cr" | "cr_signed" | "pct" | "pct_signed";

export interface ColDef {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: ColFormat;
}

// Standard columns — used by Mutual Funds, Equity, ETFs, PMS, AIFs, ULIPs, International
export const COLS_DEFAULT: ColDef[] = [
  { key: "display_name",       label: "Security / Scheme",   align: "left" },
  { key: "category",           label: "Category",            align: "left" },
  { key: "current_value",      label: "Value (₹ Cr)",        align: "right", format: "cr" },
  { key: "invested_value",     label: "Invested (₹ Cr)",     align: "right", format: "cr" },
  { key: "unrealised_gain",    label: "Gain / Loss",         align: "right", format: "cr_signed" },
  { key: "gain_percent",       label: "Gain %",              align: "right", format: "pct_signed" },
  { key: "xirr",               label: "XIRR",                align: "right", format: "pct" },
  { key: "allocation_percent", label: "% Book",              align: "right", format: "pct" },
];

// Bonds & FDs — shows product type for sub-category (bonds vs FD vs G-sec)
export const COLS_BONDS: ColDef[] = [
  { key: "display_name",       label: "Security / Scheme",   align: "left" },
  { key: "product_type",       label: "Product",             align: "left" },
  { key: "category",           label: "Category",            align: "left" },
  { key: "current_value",      label: "Value (₹ Cr)",        align: "right", format: "cr" },
  { key: "invested_value",     label: "Invested (₹ Cr)",     align: "right", format: "cr" },
  { key: "unrealised_gain",    label: "Gain / Loss",         align: "right", format: "cr_signed" },
  { key: "gain_percent",       label: "Gain %",              align: "right", format: "pct_signed" },
  { key: "xirr",               label: "XIRR",                align: "right", format: "pct" },
];

// Exit load tracker — highlights exit load terms
export const COLS_EXIT_LOAD: ColDef[] = [
  { key: "display_name",    label: "Security / Scheme", align: "left" },
  { key: "product_type",    label: "Product",           align: "left" },
  { key: "category",        label: "Category",          align: "left" },
  { key: "current_value",   label: "Value (₹ Cr)",      align: "right", format: "cr" },
  { key: "holding_term",    label: "Holding Term",      align: "left" },
  { key: "exit_load",       label: "Exit Load",         align: "left" },
];

// Capital gains — includes holding term for STCG/LTCG classification
export const COLS_CAPITAL_GAINS: ColDef[] = [
  { key: "display_name",    label: "Security / Scheme", align: "left" },
  { key: "category",        label: "Category",          align: "left" },
  { key: "holding_term",    label: "Term",              align: "left" },
  { key: "current_value",   label: "Value (₹ Cr)",      align: "right", format: "cr" },
  { key: "invested_value",  label: "Invested (₹ Cr)",   align: "right", format: "cr" },
  { key: "unrealised_gain", label: "Unrealised Gain",   align: "right", format: "cr_signed" },
  { key: "gain_percent",    label: "Gain %",            align: "right", format: "pct_signed" },
  { key: "xirr",            label: "XIRR",              align: "right", format: "pct" },
];

// ─── Cell rendering ───────────────────────────────────────────────────────────

export function getCellText(row: PortfolioHolding, col: ColDef): string {
  if (col.key === "display_name") {
    return row.security_name || row.scheme_name || "—";
  }
  const v = (row as unknown as Record<string, unknown>)[col.key];
  if (v == null || v === "") return "N/A";

  switch (col.format) {
    case "cr":
      return `₹${((v as number) / CR).toFixed(2)} Cr`;
    case "cr_signed": {
      const n = v as number;
      return `${n >= 0 ? "+" : "−"}₹${(Math.abs(n) / CR).toFixed(2)} Cr`;
    }
    case "pct":
      return `${(v as number).toFixed(2)}%`;
    case "pct_signed": {
      const n = v as number;
      return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    }
    default:
      return String(v);
  }
}

export function cellColor(row: PortfolioHolding, col: ColDef, val: string): string {
  if (val === "N/A") return "text-muted-foreground/60";
  if (col.format === "cr_signed" || col.format === "pct_signed") {
    const v = (row as unknown as Record<string, unknown>)[col.key] as number | null;
    if (v == null) return "";
    return v >= 0 ? "text-emerald-600" : "text-destructive";
  }
  return "";
}

// ─── Skeleton widths for loading state ───────────────────────────────────────
const SKELETON_WIDTHS = [60, 80, 45, 70, 55, 65, 50, 75];

// ─── Component ───────────────────────────────────────────────────────────────

export function HoldingsTable({
  rows,
  columns = COLS_DEFAULT,
  isLoading = false,
  emptyMessage = "No holdings found for this filter.",
}: {
  rows: PortfolioHolding[];
  columns?: ColDef[];
  isLoading?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium w-8">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium whitespace-nowrap",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3">
                    <div className="h-3 w-4 animate-pulse rounded bg-muted" />
                  </td>
                  {columns.map((col, ci) => (
                    <td key={col.key} className="px-4 py-3">
                      <div
                        className={cn(
                          "h-3 animate-pulse rounded bg-muted",
                          col.align === "right" ? "ml-auto" : "",
                        )}
                        style={{
                          width: `${SKELETON_WIDTHS[(i * columns.length + ci) % SKELETON_WIDTHS.length]}%`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <LayoutList className="h-8 w-8 opacity-30" />
                    <span className="text-[13px]">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">
                    {idx + 1}
                  </td>
                  {columns.map((col) => {
                    const val = getCellText(row, col);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 tabular-nums whitespace-nowrap",
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left",
                          cellColor(row, col, val),
                        )}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!isLoading && rows.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
          <span className="text-[11px] text-muted-foreground">
            {rows.length} record{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
