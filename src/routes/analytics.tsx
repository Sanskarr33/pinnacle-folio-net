import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBook } from "@/hooks/use-book";
import { totals as computeTotals, concentration } from "@/lib/portfolio-analytics";
import { useUnits } from "@/lib/units";
import { pct, pctSigned } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import { ErrorState, Skeleton } from "@/components/common/States";
import { DataGrid } from "@/components/grid/DataGrid";
import { COLS_FULL_BOOK } from "@/components/grid/columns";
import {
  FilterBar,
  EMPTY_FILTERS,
  applyFilters,
  toggleFilter,
  activeCount,
  type Filters,
  type FilterKey,
} from "@/components/analytics/FilterBar";
import {
  CompositionCard,
  RiskReturnCard,
  LeadersCard,
  CostValueCard,
  ConcentrationCurveCard,
  HoldingPeriodCard,
  TreemapCard,
  TaxPostureCard,
  GainHistogramCard,
} from "@/components/analytics/AnalyticsCards";
import { GripVertical, Maximize2, Minimize2, RotateCcw, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SG Family Wealth" },
      {
        name: "description",
        content: "Interactive cross-filtered analysis of the consolidated holdings book.",
      },
    ],
  }),
  component: AnalyticsPage,
});

type CardId =
  | "composition"
  | "treemap"
  | "riskReturn"
  | "leaders"
  | "costValue"
  | "concentration"
  | "holdingPeriod"
  | "taxPosture"
  | "gainHistogram";

const CARD_META: Record<CardId, { title: string; subtitle: string; span: number }> = {
  composition: {
    title: "Composition",
    subtitle: "Click a segment to filter the whole page",
    span: 4,
  },
  treemap: { title: "Weight map", subtitle: "Area is proportional to value", span: 8 },
  costValue: { title: "Cost to value", subtitle: "Invested capital and unrealised gain", span: 7 },
  riskReturn: {
    title: "Return vs position size",
    subtitle: "Each bubble is a consolidated security",
    span: 5,
  },
  leaders: {
    title: "Performance leaders",
    subtitle: "Best and weakest by return on cost",
    span: 6,
  },
  gainHistogram: {
    title: "Return distribution",
    subtitle: "How many lots sit in each return band",
    span: 6,
  },
  concentration: {
    title: "Concentration curve",
    subtitle: "Cumulative share by position rank",
    span: 7,
  },
  taxPosture: {
    title: "Tax & lock-in posture",
    subtitle: "Holding term split and exit-load exposure",
    span: 5,
  },
  holdingPeriod: {
    title: "Holding period",
    subtitle: "Value by how long it has been held",
    span: 6,
  },
};

const DEFAULT_ORDER: CardId[] = [
  "composition",
  "treemap",
  "costValue",
  "riskReturn",
  "leaders",
  "gainHistogram",
  "concentration",
  "taxPosture",
  "holdingPeriod",
];

const LAYOUT_KEY = "sg-analytics-layout";

// Written out in full so Tailwind's scanner can see them — a template literal
// like `xl:col-span-${n}` produces no CSS at build time.
const SPAN_CLASS: Record<number, string> = {
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};

function AnalyticsPage() {
  const { data: book = [], isLoading, error, refetch } = useBook();
  const { money } = useUnits();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [order, setOrder] = useState<CardId[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<CardId[]>([]);
  const [dragging, setDragging] = useState<CardId | null>(null);
  const [dimension, setDimension] = useState<FilterKey>("assetClass");
  const [treeDimension, setTreeDimension] = useState<FilterKey>("entity");
  const [costDimension, setCostDimension] = useState<FilterKey>("assetClass");
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);
  const [showTable, setShowTable] = useState(true);

  // Restore layout after mount (localStorage is unavailable during SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { order?: CardId[]; hidden?: CardId[] };
      if (p.order?.length) {
        // keep any cards added since the layout was saved
        const merged = [...p.order.filter((c) => DEFAULT_ORDER.includes(c))];
        DEFAULT_ORDER.forEach((c) => {
          if (!merged.includes(c)) merged.push(c);
        });
        setOrder(merged);
      }
      if (p.hidden) setHidden(p.hidden.filter((c) => DEFAULT_ORDER.includes(c)));
    } catch {
      /* ignore malformed layout */
    }
  }, []);

  const persist = useCallback((o: CardId[], h: CardId[]) => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ order: o, hidden: h }));
    } catch {
      /* ignore */
    }
  }, []);

  const rows = useMemo(() => applyFilters(book, filters), [book, filters]);
  const t = useMemo(() => computeTotals(rows), [rows]);
  const risk = useMemo(() => concentration(rows), [rows]);
  const bookTotal = useMemo(() => book.reduce((s, r) => s + (r.current_value ?? 0), 0), [book]);

  const select = useCallback((key: FilterKey, value: string) => {
    setFilters((f) => toggleFilter(f, key, value));
  }, []);

  function onDrop(target: CardId) {
    if (!dragging || dragging === target) return setDragging(null);
    setOrder((o) => {
      const next = o.filter((c) => c !== dragging);
      next.splice(next.indexOf(target), 0, dragging);
      persist(next, hidden);
      return next;
    });
    setDragging(null);
  }

  function toggleHidden(id: CardId) {
    setHidden((h) => {
      const next = h.includes(id) ? h.filter((c) => c !== id) : [...h, id];
      persist(order, next);
      return next;
    });
  }

  function resetLayout() {
    setOrder(DEFAULT_ORDER);
    setHidden([]);
    persist(DEFAULT_ORDER, []);
  }

  const filtered = activeCount(filters) > 0;

  function renderCard(id: CardId) {
    switch (id) {
      case "composition":
        return (
          <CompositionCard
            rows={rows}
            dimension={dimension}
            onDimension={setDimension}
            onSelect={select}
            selected={filters[dimension] ?? []}
          />
        );
      case "treemap":
        return (
          <TreemapCard
            rows={rows}
            dimension={treeDimension}
            onDimension={setTreeDimension}
            onSelect={select}
          />
        );
      case "costValue":
        return (
          <CostValueCard rows={rows} dimension={costDimension} onDimension={setCostDimension} />
        );
      case "riskReturn":
        return <RiskReturnCard rows={rows} />;
      case "leaders":
        return <LeadersCard rows={rows} />;
      case "gainHistogram":
        return <GainHistogramCard rows={rows} />;
      case "concentration":
        return <ConcentrationCurveCard rows={rows} />;
      case "taxPosture":
        return <TaxPostureCard rows={rows} />;
      case "holdingPeriod":
        return <HoldingPeriodCard rows={rows} />;
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1800px] mx-auto animate-in fade-in duration-500 space-y-5">
      <PageHeader
        eyebrow="Analysis · Interactive"
        title="Analytics"
        description="Every panel is linked — click a segment anywhere to filter the whole page. Drag cards by the handle to rearrange."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              <Table2 className="h-3.5 w-3.5" />
              {showTable ? "Hide" : "Show"} table
            </button>
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-9 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset layout
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="col-span-12 lg:col-span-6 h-[320px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <FilterBar rows={book} filters={filters} onChange={setFilters} />

          {/* Live KPI strip — reflects the filtered subset, not the whole book */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi
              label="Value"
              value={money(t.currentValue)}
              sub={
                filtered
                  ? `${pct((t.currentValue / (bookTotal || 1)) * 100, 1)} of book`
                  : "whole book"
              }
              accent
            />
            <Kpi label="Invested" value={money(t.investedValue)} sub={`${t.holdingCount} lots`} />
            <Kpi
              label="Unrealised"
              value={money(t.unrealisedGain)}
              sub={pctSigned(t.unrealisedGainPct)}
              tone={t.unrealisedGain >= 0 ? "good" : "bad"}
            />
            <Kpi
              label="XIRR"
              value={t.weightedXirr != null ? pct(t.weightedXirr) : "—"}
              sub={
                t.weightedXirr != null
                  ? `${t.xirrCoveragePct.toFixed(0)}% coverage`
                  : "not recorded"
              }
            />
            <Kpi label="Entities" value={String(t.entityCount)} sub="in this selection" />
            <Kpi
              label="Effective holdings"
              value={risk.effectiveHoldings.toFixed(0)}
              sub={`HHI ${risk.hhi.toFixed(0)}`}
            />
          </div>

          {rows.length === 0 ? (
            <Card title="No matches">
              <p className="py-10 text-center text-[13px] text-muted-foreground">
                No holdings match the current filters.{" "}
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Clear them
                </button>
                .
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-4 items-start">
                {order
                  .filter((id) => !hidden.includes(id))
                  .map((id) => {
                    const meta = CARD_META[id];
                    const expanded = expandedCard === id;
                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={() => setDragging(id)}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(id)}
                        className={cn(
                          "col-span-12 transition-opacity",
                          expanded ? SPAN_CLASS[12] : SPAN_CLASS[meta.span],
                          dragging === id && "opacity-40",
                          dragging &&
                            dragging !== id &&
                            "outline-dashed outline-1 outline-border rounded-xl",
                        )}
                      >
                        <Card
                          title={meta.title}
                          subtitle={meta.subtitle}
                          right={
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setExpandedCard(expanded ? null : id)}
                                title={expanded ? "Collapse" : "Expand to full width"}
                                className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground"
                              >
                                {expanded ? (
                                  <Minimize2 className="h-3.5 w-3.5" />
                                ) : (
                                  <Maximize2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => toggleHidden(id)}
                                title="Hide this card"
                                aria-label={`Hide ${meta.title}`}
                                className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground text-[15px] leading-none"
                              >
                                ×
                              </button>
                              <span
                                title="Drag to rearrange"
                                className="h-7 w-6 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          }
                        >
                          {renderCard(id)}
                        </Card>
                      </div>
                    );
                  })}
              </div>

              {hidden.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                  <span className="text-muted-foreground">Hidden:</span>
                  {hidden.map((id) => (
                    <button
                      key={id}
                      onClick={() => toggleHidden(id)}
                      className="rounded-md border border-border px-2 py-0.5 hover:bg-secondary transition-colors"
                    >
                      + {CARD_META[id].title}
                    </button>
                  ))}
                </div>
              )}

              {showTable && (
                <DataGrid
                  rows={rows}
                  columns={COLS_FULL_BOOK}
                  title="analytics selection"
                  emptyMessage="No holdings match the current filters."
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "bad";
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface p-3 shadow-elegant",
        accent ? "border-border card-premium" : "border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground truncate">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[19px] font-semibold tabular tracking-tight truncate",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}
