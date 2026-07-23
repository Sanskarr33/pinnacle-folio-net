import { useMemo } from "react";
import { X, Filter, RotateCcw } from "lucide-react";
import type { PortfolioHolding } from "@/lib/types";
import { normaliseEntity, normaliseBroker, displayName } from "@/lib/portfolio-analytics";
import { cn } from "@/lib/utils";

export interface Filters {
  entity: string[];
  assetClass: string[];
  broker: string[];
  category: string[];
  term: string[];
  search: string;
}

export const EMPTY_FILTERS: Filters = {
  entity: [],
  assetClass: [],
  broker: [],
  category: [],
  term: [],
  search: "",
};

export type FilterKey = keyof Omit<Filters, "search">;

/** Field each filter dimension reads, normalised the same way the rest of the app does. */
export const DIMENSION_ACCESSOR: Record<FilterKey, (r: PortfolioHolding) => string> = {
  entity: (r) => normaliseEntity(r.entity_name),
  assetClass: (r) => r.asset_class?.trim() || "Unclassified",
  broker: (r) => normaliseBroker(r.broker_name),
  category: (r) => r.category?.trim() || "Uncategorised",
  term: (r) => r.holding_term?.trim() || "Unclassified",
};

const LABELS: Record<FilterKey, string> = {
  entity: "Entity",
  assetClass: "Asset class",
  broker: "Custodian",
  category: "Category",
  term: "Term",
};

export function applyFilters(rows: PortfolioHolding[], f: Filters): PortfolioHolding[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    for (const key of Object.keys(DIMENSION_ACCESSOR) as FilterKey[]) {
      const selected = f[key];
      if (selected.length && !selected.includes(DIMENSION_ACCESSOR[key](r))) return false;
    }
    if (!q) return true;
    return (
      displayName(r).toLowerCase().includes(q) ||
      (r.folio_number ?? "").toLowerCase().includes(q) ||
      normaliseEntity(r.entity_name).toLowerCase().includes(q) ||
      normaliseBroker(r.broker_name).toLowerCase().includes(q)
    );
  });
}

export function toggleFilter(f: Filters, key: FilterKey, value: string): Filters {
  const cur = f[key];
  return {
    ...f,
    [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
  };
}

export function activeCount(f: Filters): number {
  return (
    (Object.keys(DIMENSION_ACCESSOR) as FilterKey[]).reduce((n, k) => n + f[k].length, 0) +
    (f.search.trim() ? 1 : 0)
  );
}

/**
 * Cross-filter control. Every chart on the analytics page both reads these filters
 * and can set them by clicking a segment, so the page behaves as one linked view
 * rather than eight independent charts.
 */
export function FilterBar({
  rows,
  filters,
  onChange,
}: {
  rows: PortfolioHolding[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const options = useMemo(() => {
    const out = {} as Record<FilterKey, string[]>;
    for (const key of Object.keys(DIMENSION_ACCESSOR) as FilterKey[]) {
      out[key] = Array.from(new Set(rows.map(DIMENSION_ACCESSOR[key]))).sort();
    }
    return out;
  }, [rows]);

  const n = activeCount(filters);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-elegant p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold shrink-0">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </span>

        <input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search security, folio, entity…"
          aria-label="Search holdings"
          className="h-8 flex-1 min-w-[180px] max-w-xs rounded-md border border-input bg-surface px-2.5 text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        {(Object.keys(DIMENSION_ACCESSOR) as FilterKey[]).map((key) => (
          <select
            key={key}
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(toggleFilter(filters, key, e.target.value));
            }}
            aria-label={`Filter by ${LABELS[key]}`}
            className="h-8 rounded-md border border-input bg-surface px-2 text-[12px] max-w-[150px]"
          >
            <option value="">
              {LABELS[key]}
              {filters[key].length ? ` (${filters[key].length})` : ""}
            </option>
            {options[key].map((o) => (
              <option key={o} value={o}>
                {filters[key].includes(o) ? "✓ " : ""}
                {o}
              </option>
            ))}
          </select>
        ))}

        {n > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border text-[12px] font-medium hover:bg-secondary transition-colors ml-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear {n}
          </button>
        )}
      </div>

      {n > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-border">
          {(Object.keys(DIMENSION_ACCESSOR) as FilterKey[]).flatMap((key) =>
            filters[key].map((v) => (
              <Chip
                key={`${key}-${v}`}
                label={`${LABELS[key]}: ${v}`}
                onRemove={() => onChange(toggleFilter(filters, key, v))}
              />
            )),
          )}
          {filters.search.trim() && (
            <Chip
              label={`Search: ${filters.search}`}
              onRemove={() => onChange({ ...filters, search: "" })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60",
        "px-2 py-0.5 text-[11px] font-medium",
      )}
    >
      <span className="truncate max-w-[220px]">{label}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
