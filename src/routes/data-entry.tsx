import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  Info,
  History,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useBook, useTotals } from "@/hooks/use-book";
import { useUnits } from "@/lib/units";
import { formatDate } from "@/lib/format";
import { normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/dashboard/Card";
import {
  subscribeManual,
  getManualSnapshot,
  getServerManualSnapshot,
  addHolding,
  updateManualHolding,
  removeManualHolding,
  restoreRow,
  clearAllManual,
  validateHolding,
  type HoldingInput,
  type ManualHolding,
} from "@/lib/manual-entries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/data-entry")({
  head: () => ({
    meta: [
      { title: "Data Entry — SG Family Wealth" },
      { name: "description", content: "Add, edit and remove holdings directly in the dashboard." },
    ],
  }),
  component: DataEntryPage,
});

const ASSET_CLASSES = [
  "Equity Mutual Funds",
  "Debt Mutual Funds",
  "Equity",
  "ETFs",
  "Bullion",
  "PMS",
  "AIFs",
  "Bonds",
  "Fixed Deposit",
  "ULIP",
  "Cash",
  "Other Investments",
];
const TAX_REGIMES = ["Equity", "Debt", "Other"];

function DataEntryPage() {
  const { data } = useBook();
  const { totals } = useTotals();
  const { money } = useUnits();
  const asOn = totals.asOnDate ?? new Date().toISOString().slice(0, 10);

  const manual = useSyncExternalStore(subscribeManual, getManualSnapshot, getServerManualSnapshot);
  const rows = useMemo(() => data ?? [], [data]);

  const [editing, setEditing] = useState<ManualHolding | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Autocomplete options drawn from the real book so entries stay consistent.
  const entities = useMemo(
    () => [...new Set(rows.map((r) => normaliseEntity(r.entity_name)).filter(Boolean))].sort(),
    [rows],
  );
  const brokers = useMemo(
    () => [...new Set(rows.map((r) => normaliseBroker(r.broker_name)).filter(Boolean))].sort(),
    [rows],
  );

  const tombstones = Object.values(manual.tombstones);

  async function exportEntries() {
    try {
      const { exportXlsx } = await import("@/lib/xlsx-export");
      await exportXlsx({
        fileName: "manual-entries",
        subtitle: `Manual entries to fold into the master workbook · ${manual.holdings.length} added · SG Family Office`,
        sheets: [
          {
            name: "Added holdings",
            freezeCols: 1,
            columns: [
              { header: "Security", key: "s", type: "text", width: 40 },
              { header: "Entity", key: "e", type: "text", width: 16 },
              { header: "Broker", key: "b", type: "text", width: 20 },
              { header: "Folio", key: "f", type: "text", width: 18 },
              { header: "Asset class", key: "ac", type: "text", width: 22 },
              { header: "Units", key: "u", type: "number", width: 12 },
              { header: "Purchased", key: "pd", type: "date", width: 14 },
              { header: "Invested", key: "inv", type: "money" },
              { header: "Current value", key: "cur", type: "money" },
              { header: "Notes", key: "n", type: "text", width: 30 },
            ],
            rows: manual.holdings.map((h) => ({
              s: h.security_name,
              e: h.entity_name,
              b: h.broker_name,
              f: h.folio_number,
              ac: h.asset_class,
              u: h.units,
              pd: h.purchase_date ? new Date(h.purchase_date) : "",
              inv: h.invested_value,
              cur: h.current_value,
              n: h.notes,
            })),
          },
          {
            name: "Removed rows",
            columns: [
              { header: "Security", key: "s", type: "text", width: 40 },
              { header: "Removed", key: "d", type: "date", width: 14 },
              { header: "Reason", key: "r", type: "text", width: 30 },
            ],
            rows: tombstones.map((t) => ({
              s: t.label,
              d: new Date(t.removedAt),
              r: t.reason ?? "",
            })),
          },
        ],
      });
    } catch (err) {
      console.error(err);
      toast.error("Export failed.");
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Data Entry"
        description="Add, correct and remove holdings directly — the whole dashboard updates the moment you save."
        right={
          <div className="flex items-center gap-2">
            {(manual.holdings.length > 0 || tombstones.length > 0) && (
              <button
                onClick={exportEntries}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export
              </button>
            )}
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              Add holding
            </button>
          </div>
        }
      />

      {/* Persistence, stated plainly — never let the user assume cloud durability. */}
      <div className="rounded-xl border border-[var(--chart-3)]/40 bg-[var(--chart-3)]/8 px-5 py-3.5 text-[11.5px] text-foreground/80 flex items-start gap-2">
        <Info className="h-4 w-4 mt-px shrink-0 text-[var(--chart-3)]" />
        <span>
          Entries you make here live in <strong>this browser</strong> and update every view
          instantly. They are <strong>not</strong> written to the cloud: the daily sync rebuilds the
          book from the Excel workbook and would overwrite them. To make an entry permanent and
          visible on other devices, use <strong>Export</strong> and fold it into the master
          workbook. Nothing here is ever lost to the sync — but nothing reaches another device until
          you export it.
        </span>
      </div>

      {(showForm || editing) && (
        <HoldingForm
          key={editing?.id ?? "new"}
          initial={editing}
          asOn={asOn}
          entities={entities}
          brokers={brokers}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* ── Added holdings ──────────────────────────────────────────────────── */}
      <Card
        title="Holdings you added"
        subtitle={
          manual.holdings.length
            ? `${manual.holdings.length} manual holdings · ${money(
                manual.holdings.reduce((s, h) => s + (h.current_value ?? 0), 0),
              )}`
            : "None yet."
        }
      >
        {manual.holdings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nothing added yet. Use <span className="font-medium text-foreground">Add holding</span>{" "}
            above to enter a position that is not in the workbook.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[12px] border-collapse min-w-[760px]">
              <thead>
                <tr className="text-muted-foreground">
                  <Th>Security</Th>
                  <Th>Entity</Th>
                  <Th>Asset class</Th>
                  <Th right>Invested</Th>
                  <Th right>Current</Th>
                  <Th right>Gain</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {manual.holdings.map((h) => (
                  <tr key={h.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-1.5 border-b border-border/40 font-medium">
                      {h.security_name}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/40 text-muted-foreground">
                      {h.entity_name}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/40 text-muted-foreground">
                      {h.asset_class}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                      {money(h.invested_value)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/40 text-right tabular">
                      {money(h.current_value)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-1.5 border-b border-border/40 text-right tabular",
                        (h.unrealised_gain ?? 0) < 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {money(h.unrealised_gain)}
                    </td>
                    <td className="px-3 py-1.5 border-b border-border/40 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditing(h);
                          setShowForm(false);
                        }}
                        title="Edit"
                        className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          removeManualHolding(h.id);
                          toast.message(`Removed “${h.security_name}”.`);
                        }}
                        title="Remove"
                        className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Removed workbook rows ───────────────────────────────────────────── */}
      {tombstones.length > 0 && (
        <Card
          title="Rows you removed"
          subtitle={`${tombstones.length} workbook rows hidden from the book`}
        >
          <ul className="divide-y divide-border/50">
            {tombstones.map((t) => (
              <li key={t.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Removed {formatDate(t.removedAt)}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    restoreRow(t.key);
                    toast.message("Row restored.");
                  }}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] hover:bg-secondary transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Audit log ───────────────────────────────────────────────────────── */}
      {manual.audit.length > 0 && (
        <Card
          title="Change log"
          subtitle="Every add, edit and removal on this device."
          right={
            <button
              onClick={() => {
                if (confirm("Clear ALL manual entries and removals? This cannot be undone.")) {
                  clearAllManual();
                  toast.message("All manual entries cleared.");
                }
              }}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-destructive/40 text-destructive text-[11.5px] hover:bg-destructive/10 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Clear all
            </button>
          }
        >
          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
            {manual.audit.map((a, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[11.5px]">
                <History className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground tabular whitespace-nowrap">
                  {formatDate(a.at)}
                </span>
                <ActionBadge action={a.action} />
                <span className="font-medium truncate">{a.target}</span>
                {a.detail && <span className="text-muted-foreground truncate">· {a.detail}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ─── form ─────────────────────────────────────────────────────────────────────

function HoldingForm({
  initial,
  asOn,
  entities,
  brokers,
  onClose,
}: {
  initial: ManualHolding | null;
  asOn: string;
  entities: string[];
  brokers: string[];
  onClose: () => void;
}) {
  const [f, setF] = useState<Partial<HoldingInput>>(
    initial
      ? {
          security_name: initial.security_name ?? "",
          entity_name: initial.entity_name ?? "",
          broker_name: initial.broker_name ?? "",
          folio_number: initial.folio_number ?? "",
          asset_class: initial.asset_class ?? "",
          category: initial.category ?? "",
          product_type: initial.product_type ?? "",
          taxation: initial.taxation ?? "",
          units: initial.units,
          purchase_date: initial.purchase_date ?? "",
          purchase_price: initial.purchase_price,
          invested_value: initial.invested_value ?? undefined,
          current_value: initial.current_value ?? undefined,
          notes: initial.notes ?? "",
        }
      : { asset_class: "Equity Mutual Funds" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof HoldingInput, v: string | number | null) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  function save() {
    const v = validateHolding(f);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    const input = f as HoldingInput;
    if (initial) {
      updateManualHolding(initial.id, input, asOn);
      toast.success(`Updated “${input.security_name}”.`);
    } else {
      addHolding(input, asOn);
      toast.success(`Added “${input.security_name}”. Every view is updated.`);
    }
    onClose();
  }

  return (
    <Card
      title={initial ? "Edit holding" : "Add a holding"}
      subtitle={`Valued as on ${formatDate(asOn)} · gain, term and allocation are computed for you.`}
      right={
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-[11.5px] hover:bg-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      }
    >
      <datalist id="entity-options">
        {entities.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <datalist id="broker-options">
        {brokers.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Security name" error={errors.security_name} required span2>
          <input
            value={f.security_name ?? ""}
            onChange={(e) => set("security_name", e.target.value)}
            placeholder="e.g. HDFC Flexi Cap Fund – Direct (G)"
            className={inputCls(errors.security_name)}
          />
        </Field>
        <Field label="Entity" error={errors.entity_name} required>
          <input
            list="entity-options"
            value={f.entity_name ?? ""}
            onChange={(e) => set("entity_name", e.target.value)}
            placeholder="e.g. SMC"
            className={inputCls(errors.entity_name)}
          />
        </Field>

        <Field label="Asset class" error={errors.asset_class} required>
          <select
            value={f.asset_class ?? ""}
            onChange={(e) => set("asset_class", e.target.value)}
            className={inputCls(errors.asset_class)}
          >
            <option value="">Choose…</option>
            {ASSET_CLASSES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Broker / custodian">
          <input
            list="broker-options"
            value={f.broker_name ?? ""}
            onChange={(e) => set("broker_name", e.target.value)}
            placeholder="e.g. Kotak"
            className={inputCls()}
          />
        </Field>
        <Field label="Folio / account no.">
          <input
            value={f.folio_number ?? ""}
            onChange={(e) => set("folio_number", e.target.value)}
            className={inputCls()}
          />
        </Field>

        <Field label="Tax regime">
          <select
            value={f.taxation ?? ""}
            onChange={(e) => set("taxation", e.target.value)}
            className={inputCls()}
          >
            <option value="">Unspecified</option>
            {TAX_REGIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Units" error={errors.units}>
          <input
            type="number"
            value={f.units ?? ""}
            onChange={(e) => set("units", num(e.target.value))}
            className={inputCls(errors.units)}
          />
        </Field>
        <Field label="Purchase date" error={errors.purchase_date}>
          <input
            type="date"
            value={f.purchase_date ?? ""}
            onChange={(e) => set("purchase_date", e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className={inputCls(errors.purchase_date)}
          />
        </Field>

        <Field label="Invested amount (₹)" error={errors.invested_value} required>
          <input
            type="number"
            value={f.invested_value ?? ""}
            onChange={(e) => set("invested_value", num(e.target.value))}
            placeholder="Total cost, in rupees"
            className={inputCls(errors.invested_value)}
          />
        </Field>
        <Field label="Current value (₹)" error={errors.current_value} required>
          <input
            type="number"
            value={f.current_value ?? ""}
            onChange={(e) => set("current_value", num(e.target.value))}
            placeholder="Today's value, in rupees"
            className={inputCls(errors.current_value)}
          />
        </Field>
        <Field label="Notes" span2>
          <input
            value={f.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className={inputCls()}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border/50">
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-lg border border-border text-[12px] font-medium hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          {initial ? "Save changes" : "Add holding"}
        </button>
      </div>
    </Card>
  );
}

function inputCls(error?: string) {
  return cn(
    "h-9 w-full rounded-lg border bg-background px-2.5 text-[12.5px] outline-none transition-colors focus:border-primary/60",
    error ? "border-destructive" : "border-border",
  );
}

function Field({
  label,
  error,
  required,
  span2,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", span2 && "sm:col-span-2")}>
      <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error && <span className="text-[10.5px] text-destructive">{error}</span>}
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "font-semibold px-3 py-2 border-b border-border whitespace-nowrap",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    add: "bg-success/15 text-success",
    edit: "bg-[var(--chart-1)]/15 text-[var(--chart-1)]",
    delete: "bg-destructive/15 text-destructive",
    restore: "bg-[var(--chart-3)]/20 text-[var(--chart-3)]",
    clear: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "text-[9.5px] uppercase tracking-wider font-semibold rounded px-1.5 py-px shrink-0",
        map[action] ?? "bg-muted text-muted-foreground",
      )}
    >
      {action}
    </span>
  );
}
