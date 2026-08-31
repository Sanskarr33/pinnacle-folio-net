import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { inr, inrSigned, pct, price, qty, toneOf } from "@/lib/format-portfolio";
import type { HoldingRow } from "@/lib/portfolio-file";
import { ROW, Section, TableScroll, TD, TH } from "./Sections";

const PAGE_SIZE = 50;

type SortKey = keyof Pick<
  HoldingRow,
  | "name"
  | "sleeve"
  | "assetClass"
  | "quantity"
  | "avgPrice"
  | "currentPrice"
  | "value"
  | "cost"
  | "gain"
  | "gainPct"
  | "sector"
  | "marketCap"
  | "amc"
>;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Holding", numeric: false },
  { key: "sleeve", label: "Sleeve", numeric: false },
  { key: "assetClass", label: "Asset class", numeric: false },
  { key: "sector", label: "Sector", numeric: false },
  { key: "marketCap", label: "Mkt cap", numeric: false },
  { key: "amc", label: "AMC", numeric: false },
  { key: "quantity", label: "Qty", numeric: true },
  { key: "avgPrice", label: "Avg price", numeric: true },
  { key: "currentPrice", label: "Price", numeric: true },
  { key: "value", label: "Value", numeric: true },
  { key: "cost", label: "Cost", numeric: true },
  { key: "gain", label: "Gain", numeric: true },
  { key: "gainPct", label: "Gain %", numeric: true },
];

/**
 * The instrument list. 465 rows, so it filters and paginates rather than
 * painting everything at once.
 *
 * Sorting and filtering only reorder and hide rows — no figure is recomputed,
 * and no subtotal is shown for the filtered subset, because summing a filtered
 * selection would be deriving a number the file does not contain.
 */
export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "value",
    dir: "desc",
  });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.sleeve, r.assetClass, r.sector, r.marketCap, r.amc]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    // Copy before sorting: the props array is the loaded file's own array.
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];

      // Absent values sort last in BOTH directions. Treating null as 0 or as
      // -Infinity would let "n/a" rows masquerade as the cheapest or the worst
      // performers, which is exactly the misreading the n/a rule guards against.
      const aNull = av == null || av === "";
      const bNull = bv == null || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "en-IN") * factor;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
    setPage(0);
  }

  return (
    <Section
      title="Holdings"
      subtitle={`${sorted.length.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} lines`}
    >
      <div className="px-4 sm:px-5 py-3 border-b border-border">
        <label className="relative block max-w-sm">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by name, sleeve, sector, AMC…"
            aria-label="Filter holdings"
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring/40"
          />
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 sm:px-5 py-10 text-center text-[12.5px] text-muted-foreground">
          No holdings match “{query}”.
        </p>
      ) : (
        <>
          <TableScroll>
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr className="bg-muted/40">
                  {COLUMNS.map((c, i) => {
                    const active = sort.key === c.key;
                    const Icon = !active
                      ? ChevronsUpDown
                      : sort.dir === "asc"
                        ? ArrowUp
                        : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        aria-sort={
                          active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                        }
                        className={`${TH} ${c.numeric ? "text-right" : "text-left"} ${
                          i === 0 ? "px-4 sm:px-5" : "px-3"
                        } py-2.5`}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(c.key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                            active ? "text-foreground" : ""
                          } ${c.numeric ? "flex-row-reverse" : ""}`}
                        >
                          <Icon className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                          {c.label}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={`${r.name}|${r.sleeve}|${current * PAGE_SIZE + i}`} className={ROW}>
                    <td className={`${TD} text-left px-4 sm:px-5 py-2.5`}>
                      <span className="font-medium">{r.name}</span>
                      {/* These lines have no recorded cost, so their gain is an
                          artefact of a zero basis rather than a return. */}
                      {r.nilCost && (
                        <span
                          title="No recorded cost basis — gain is not meaningful"
                          className="ml-2 inline-block align-middle rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider font-semibold border border-warning/50 bg-warning/15 text-warning-foreground dark:text-warning"
                        >
                          nil cost
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                      {r.sleeve}
                    </td>
                    <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                      {r.assetClass}
                    </td>
                    <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                      {r.sector || "—"}
                    </td>
                    <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                      {r.marketCap || "—"}
                    </td>
                    <td className={`${TD} text-left px-3 py-2.5 text-muted-foreground`}>
                      {r.amc || "—"}
                    </td>
                    <td className={`${TD} text-right px-3 py-2.5`}>{qty(r.quantity, 3)}</td>
                    <td className={`${TD} text-right px-3 py-2.5`}>{price(r.avgPrice)}</td>
                    <td className={`${TD} text-right px-3 py-2.5`}>{price(r.currentPrice)}</td>
                    <td className={`${TD} text-right px-3 py-2.5 font-medium`}>{inr(r.value)}</td>
                    <td className={`${TD} text-right px-3 py-2.5 text-muted-foreground`}>
                      {inr(r.cost)}
                    </td>
                    <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gain)}`}>
                      {inrSigned(r.gain)}
                    </td>
                    <td className={`${TD} text-right px-3 py-2.5 ${toneOf(r.gainPct)}`}>
                      {pct(r.gainPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>

          <nav
            aria-label="Holdings pagination"
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border"
          >
            <p className="text-[11.5px] text-muted-foreground tabular">
              {(current * PAGE_SIZE + 1).toLocaleString("en-IN")}–
              {Math.min((current + 1) * PAGE_SIZE, sorted.length).toLocaleString("en-IN")} of{" "}
              {sorted.length.toLocaleString("en-IN")}
            </p>
            <div className="flex items-center gap-2">
              <PageBtn onClick={() => setPage(current - 1)} disabled={current === 0}>
                Previous
              </PageBtn>
              <span className="text-[11.5px] text-muted-foreground tabular">
                {current + 1} / {pageCount}
              </span>
              <PageBtn onClick={() => setPage(current + 1)} disabled={current >= pageCount - 1}>
                Next
              </PageBtn>
            </div>
          </nav>
        </>
      )}
    </Section>
  );
}

function PageBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}
