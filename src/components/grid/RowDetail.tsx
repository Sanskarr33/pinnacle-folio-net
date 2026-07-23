import type { PortfolioHolding } from "@/lib/types";
import type { Override } from "@/lib/overrides";
import { clearOverride } from "@/lib/overrides";
import {
  displayName,
  normaliseEntity,
  normaliseBroker,
  parseExitLoad,
  taxRegime,
} from "@/lib/portfolio-analytics";
import { formatDate, humanDays, num, pct, pctSigned, addDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Building2,
  Landmark,
  Hash,
  CalendarDays,
  Percent,
  Lock,
  LockOpen,
  Receipt,
  FileText,
  RotateCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useUnits } from "@/lib/units";

/**
 * Everything the book knows about one lot. Expanded from the grid so the table
 * can stay narrow while nothing is hidden — folio, custodian, tax regime, exit-load
 * window and the derived dates all live here.
 */
export function RowDetail({
  row,
  edits,
}: {
  row: PortfolioHolding;
  edits: Record<string, Override>;
}) {
  const { money, moneySigned } = useUnits();

  const term = parseExitLoad(row.exit_load);
  const daysHeld = row.holding_period_days;
  const locked = term && daysHeld != null && daysHeld < term.days;
  const freeOn = term && row.purchase_date ? addDays(row.purchase_date, term.days) : null;

  const regime = taxRegime(row.taxation);
  const ltThreshold = regime === "Equity" ? 365 : 1095;
  const daysToLt =
    row.holding_term === "Long Term" || daysHeld == null ? 0 : Math.max(0, ltThreshold - daysHeld);
  const ltDate = daysToLt > 0 && row.purchase_date ? addDays(row.purchase_date, ltThreshold) : null;

  const gain = row.unrealised_gain ?? 0;
  const editList = Object.values(edits);

  return (
    <div className="bg-secondary/20 border-t border-border px-4 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground">{displayName(row)}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {[row.asset_class, row.category, row.product_type].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
            <p className="text-[16px] font-semibold tabular">{money(row.current_value)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gain</p>
            <p
              className={cn(
                "text-[16px] font-semibold tabular inline-flex items-center gap-1",
                gain >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {gain >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {moneySigned(gain)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-4">
        <Section icon={Building2} title="Ownership">
          <Field label="Entity" value={normaliseEntity(row.entity_name)} strong />
          <Field label="Entity (as recorded)" value={row.entity_name ?? "—"} mono />
          <Field label="Custodian" value={normaliseBroker(row.broker_name)} strong />
          <Field label="Custodian (as recorded)" value={row.broker_name ?? "—"} mono />
          <Field label="Folio number" value={row.folio_number ?? "—"} mono />
          <Field label="Account" value={row.account_name ?? "—"} />
          <Field label="Advisor" value={row.advisor_name ?? "not recorded"} />
        </Section>

        <Section icon={Hash} title="Position">
          <Field label="Units" value={num(row.units, 4)} />
          <Field label="Quantity" value={num(row.quantity, 2)} />
          <Field
            label="Purchase price"
            value={row.purchase_price != null ? `₹${num(row.purchase_price, 4)}` : "—"}
          />
          <Field
            label="Purchase NAV"
            value={row.purchase_nav != null ? `₹${num(row.purchase_nav, 4)}` : "—"}
          />
          <Field
            label="Current price"
            value={row.current_price != null ? `₹${num(row.current_price, 4)}` : "—"}
          />
          <Field
            label="Current NAV"
            value={row.current_nav != null ? `₹${num(row.current_nav, 4)}` : "—"}
          />
          <Field label="ISIN / Ticker" value={row.isin ?? row.ticker ?? "—"} mono />
        </Section>

        <Section icon={Percent} title="Valuation">
          <Field label="Invested" value={money(row.invested_value)} />
          <Field label="Current value" value={money(row.current_value)} strong />
          <Field
            label="Unrealised gain"
            value={moneySigned(row.unrealised_gain)}
            tone={gain >= 0 ? "good" : "bad"}
          />
          <Field
            label="Gain %"
            value={pctSigned(row.gain_percent)}
            tone={(row.gain_percent ?? 0) >= 0 ? "good" : "bad"}
          />
          <Field label="XIRR" value={row.xirr != null ? pct(row.xirr) : "not recorded"} />
          <Field label="% of book" value={pct(row.allocation_percent, 3)} />
          <Field
            label="Scheme / fund type"
            value={[row.scheme_type, row.fund_type].filter(Boolean).join(" · ") || "—"}
          />
        </Section>

        <Section icon={CalendarDays} title="Dates, tax & lock-in">
          <Field label="Purchased" value={formatDate(row.purchase_date)} />
          <Field label="Held for" value={humanDays(row.holding_period_days)} />
          <Field
            label="Holding term"
            value={row.holding_term ?? "—"}
            tone={row.holding_term === "Long Term" ? "good" : undefined}
          />
          <Field
            label="Tax regime"
            value={`${regime}${row.taxation ? ` (${row.taxation})` : ""}`}
          />
          {daysToLt > 0 && (
            <Field
              label="Turns long term"
              value={`${ltDate ? formatDate(ltDate.toISOString()) : "—"} · in ${daysToLt}d`}
              tone="warn"
            />
          )}
          <Field label="Exit load" value={row.exit_load ?? "none recorded"} />
          {term && (
            <Field
              label={locked ? "Exit load status" : "Exit load"}
              value={
                locked
                  ? `Locked · ${term.ratePct}% until ${freeOn ? formatDate(freeOn.toISOString()) : "—"}`
                  : "Free to redeem"
              }
              tone={locked ? "warn" : "good"}
            />
          )}
          {locked && (
            <Field
              label="Cost if sold today"
              value={money((row.current_value ?? 0) * (term!.ratePct / 100))}
              tone="bad"
            />
          )}
        </Section>
      </div>

      {/* Provenance + corrections */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-start justify-between gap-4">
        <p className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3 shrink-0" />
          <span>
            Source: <code className="bg-secondary px-1 rounded">{row.source_sheet ?? "—"}</code>
            {row.source_row != null && <> row {row.source_row}</>}
            {row.report_section && <> · {row.report_section}</>}
            {row.as_on_date && <> · valued {formatDate(row.as_on_date)}</>}
          </span>
        </p>

        {editList.length > 0 && (
          <div className="text-[10.5px]">
            <p className="font-semibold text-[var(--chart-3)] mb-1">
              {editList.length} local correction{editList.length !== 1 ? "s" : ""}
            </p>
            <ul className="space-y-1">
              {editList.map((o) => (
                <li key={o.field} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{o.field}</span>
                  <span className="line-through text-muted-foreground/60">
                    {String(o.original ?? "—")}
                  </span>
                  <span className="font-medium">→ {String(o.value ?? "—")}</span>
                  <button
                    onClick={() => clearOverride(row, o.field)}
                    title="Revert to the workbook value"
                    className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    revert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {row.notes && <p className="mt-2 text-[11px] text-muted-foreground italic">{row.notes}</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-2">
        <Icon className="h-3 w-3 shrink-0" />
        {title}
      </p>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function Field({
  label,
  value,
  strong,
  mono,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
  tone?: "good" | "bad" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={cn(
          "text-right truncate tabular",
          strong && "font-semibold",
          mono && "font-mono text-[10.5px]",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

export { Landmark, Lock, LockOpen, Receipt };
