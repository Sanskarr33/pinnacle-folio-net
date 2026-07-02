import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHoldingDetail } from "@/lib/data-service";
import type { PortfolioHolding, SGHoldingRow } from "@/lib/types";
import type { ColDef } from "./HoldingsTable";
import { COLS_DEFAULT, getCellText, cellColor } from "./HoldingsTable";

const CR = 10_000_000;
const SKELETON_WIDTHS = [60, 80, 45, 70, 55, 65, 50, 75];

function fmtCr(v: number) {
  return `₹${(v / CR).toFixed(2)} Cr`;
}

function fmtPctSigned(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function SubRows({
  securityName,
  assetClasses,
  colSpan,
}: {
  securityName: string;
  assetClasses: string | string[];
  colSpan: number;
}) {
  const key = Array.isArray(assetClasses) ? assetClasses.join(",") : assetClasses;
  const { data: rows = [], isLoading } = useQuery<SGHoldingRow[]>({
    queryKey: ["holdingDetail", securityName, key],
    queryFn: () => getHoldingDetail(securityName, assetClasses),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-0 pb-2">
          <div className="mx-6 mt-1 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3">
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-0 pb-2">
          <div className="mx-6 mt-1 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-[11.5px] text-muted-foreground">
            No detail rows available.
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 pb-2">
        <div className="mx-6 mt-1 rounded-lg border border-border/50 bg-secondary/20 overflow-hidden">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/40">
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Entity</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Account / Folio</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Qty</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Avg Cost</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Current Value</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Invested</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Gain / Loss</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Gain %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const inv = r.invested_value ?? 0;
                const cur = r.current_value ?? 0;
                const gain = r.unrealised_gain ?? cur - inv;
                const gainPct = r.gain_percent ?? r.gain_pct ?? (inv > 0 ? ((cur - inv) / inv) * 100 : null);
                const avgCost = r.average_cost ?? 0;
                const qty = r.quantity ?? 0;
                return (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{r.entity_name || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.account_name || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {qty.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {avgCost > 0 ? avgCost.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtCr(cur)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtCr(inv)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", gain >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {`${gain >= 0 ? "+" : "−"}${fmtCr(Math.abs(gain))}`}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", gainPct == null ? "text-muted-foreground" : gainPct >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {gainPct != null ? fmtPctSigned(gainPct) : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export function ExpandableHoldingsTable({
  rows,
  columns = COLS_DEFAULT,
  isLoading = false,
  emptyMessage = "No holdings found for this filter.",
  assetClasses,
}: {
  rows: PortfolioHolding[];
  columns?: ColDef[];
  isLoading?: boolean;
  emptyMessage?: string;
  assetClasses: string | string[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // +2 for chevron col + # col
  const totalCols = columns.length + 2;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="px-3 py-2.5 w-8" />
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
                  <td className="px-3 py-3 w-8" />
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
                <td colSpan={totalCols} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <LayoutList className="h-8 w-8 opacity-30" />
                    <span className="text-[13px]">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.flatMap((row, idx) => {
                const name = row.security_name || row.scheme_name || `row-${idx}`;
                const isOpen = expanded.has(name);
                const mainRow = (
                  <tr
                    key={`row-${idx}`}
                    className={cn(
                      "border-b border-border/40 transition-colors",
                      isOpen ? "bg-secondary/20" : "hover:bg-secondary/30",
                    )}
                  >
                    <td
                      className="px-3 py-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => toggle(name)}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-150",
                          isOpen && "rotate-90",
                        )}
                      />
                    </td>
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
                );
                if (!isOpen) return [mainRow];
                return [
                  mainRow,
                  <SubRows
                    key={`sub-${idx}`}
                    securityName={name}
                    assetClasses={assetClasses}
                    colSpan={totalCols}
                  />,
                ];
              })}
          </tbody>
        </table>
      </div>

      {!isLoading && rows.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
          <span className="text-[11px] text-muted-foreground">
            {rows.length} record{rows.length !== 1 ? "s" : ""}
            {" · "}click ▶ to expand entity breakdown
          </span>
        </div>
      )}
    </div>
  );
}
