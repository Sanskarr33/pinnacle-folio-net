import { useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UploadCloud, FileText, Trash2, Plus, Loader2,
  Save, RefreshCw, X, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { invalidateCache } from "@/lib/data-service";
import { parseTransactionScreenshot, type ParsedTransaction } from "@/lib/api/transactions.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/dashboard/Card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/add-transaction")({
  head: () => ({
    meta: [
      { title: "Add Transaction — SG Family Wealth" },
      { name: "description", content: "Add transactions by uploading a screenshot or entering details manually." },
    ],
  }),
  component: AddTransactionPage,
});

const ENTITIES = ["SG", "SMC", "SSI", "Veer", "SMO", "SSG", "Suhel"] as const;
const ASSET_CLASSES = [
  "Direct Equity", "Equity MF", "ETF", "REIT",
  "Bonds", "Fixed Deposit", "PMS", "AIF",
] as const;

const ALLOWED_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];
function isAllowedMediaType(t: string): t is AllowedMediaType {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(t);
}

const REFRESH_URL = "/.netlify/functions/refresh-prices";

function calcFinancialYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

function emptyTransaction(): ParsedTransaction {
  return {
    transaction_type: "BUY",
    transaction_date: null,
    financial_year: null,
    asset_class: null,
    security_name: null,
    entity_name: null,
    broker: null,
    folio_number: null,
    quantity: null,
    price: null,
    amount: null,
    purchase_date: null,
    purchase_price: null,
    cost_of_acquisition: null,
    realised_gain: null,
    notes: null,
  };
}

type EditableRow = ParsedTransaction & { _id: string };

function withId(t: ParsedTransaction): EditableRow {
  return { ...t, _id: crypto.randomUUID() };
}
function stripId({ _id, ...rest }: EditableRow): ParsedTransaction {
  return rest;
}

function missingRequiredFields(rows: ParsedTransaction[]): number {
  return rows.filter(
    (r) => !r.transaction_date || !r.asset_class || !r.security_name || !r.entity_name || r.amount == null,
  ).length;
}

const inputCls =
  "w-full h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const selectCls = cn(inputCls, "cursor-pointer");
const labelCls = "text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium";
const fieldCls = "flex flex-col gap-1.5";

// ─── Page ──────────────────────────────────────────────────────────────────

function AddTransactionPage() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justSaved, setJustSaved] = useState<number | null>(null);

  async function saveRows(toSave: ParsedTransaction[]): Promise<boolean> {
    if (toSave.length === 0) {
      toast.error("Nothing to save.");
      return false;
    }
    const missing = missingRequiredFields(toSave);
    if (missing > 0) {
      toast.error(
        `${missing} row${missing === 1 ? "" : "s"} missing a required field (date, asset class, security, entity, or amount).`,
      );
      return false;
    }

    setIsSaving(true);
    try {
      const payload = toSave.map((r) => ({
        ...r,
        financial_year: r.financial_year || calcFinancialYear(r.transaction_date),
      }));
      const { error } = await supabase.from("sg_transactions").insert(payload);
      if (error) throw error;

      invalidateCache();
      await queryClient.invalidateQueries();

      toast.success(`${toSave.length} transaction${toSave.length === 1 ? "" : "s"} saved`);
      setJustSaved(toSave.length);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save: ${msg}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshPrices() {
    setIsRefreshing(true);
    try {
      const res = await fetch(REFRESH_URL, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Edge function ${res.status}: ${text}`);
      }
      const data = await res.json();
      invalidateCache();
      await queryClient.invalidateQueries();
      toast.success(`Prices updated — ${data?.updated ?? 0} holdings refreshed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to refresh: ${msg}`);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto animate-in fade-in duration-500 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Operations</p>
        <h1 className="text-[28px] font-semibold tracking-tight mt-1">Add Transaction</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Upload a broker or contract-note screenshot for Claude to parse, or enter a transaction manually.
        </p>
      </div>

      {justSaved !== null && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-success text-[13px] font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {justSaved} transaction{justSaved === 1 ? "" : "s"} saved. Prices refresh automatically every weekday evening — refresh now to update current values immediately.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefreshPrices}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-surface hover:bg-secondary text-[12px] font-medium text-foreground transition-colors disabled:opacity-60"
            >
              {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isRefreshing ? "Refreshing…" : "Refresh Prices"}
            </button>
            <button
              onClick={() => setJustSaved(null)}
              className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload Screenshot</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <UploadPanel onSave={saveRows} isSaving={isSaving} />
        </TabsContent>
        <TabsContent value="manual">
          <ManualPanel onSave={saveRows} isSaving={isSaving} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Upload Screenshot ───────────────────────────────────────────────

function UploadPanel({
  onSave, isSaving,
}: {
  onSave: (rows: ParsedTransaction[]) => Promise<boolean>;
  isSaving: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function parseFile(mediaType: AllowedMediaType, base64: string) {
    setIsParsing(true);
    try {
      const result = await parseTransactionScreenshot({ data: { base64, mediaType } });
      if (result.length === 0) {
        toast.error("No transactions found in that file — try a clearer screenshot.");
        return;
      }
      setRows(result.map(withId));
      toast.success(`Parsed ${result.length} transaction${result.length === 1 ? "" : "s"} — review before saving.`);
    } catch (err) {
      toast.error(`Could not parse file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsParsing(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const mediaType = file.type;
    if (!isAllowedMediaType(mediaType)) {
      toast.error("Please upload a PNG, JPG, WEBP, or PDF file.");
      return;
    }
    setFileName(file.name);
    setRows([]);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      setPreviewUrl(mediaType === "application/pdf" ? null : result);
      void parseFile(mediaType, base64);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function updateRow(id: string, patch: Partial<ParsedTransaction>) {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }
  function addBlankRow() {
    setRows((prev) => [...prev, withId(emptyTransaction())]);
  }

  async function handleSaveClick() {
    const ok = await onSave(rows.map(stripId));
    if (ok) {
      setRows([]);
      setFileName(null);
      setPreviewUrl(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className={cn(
            "rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/30",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {isParsing ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-[13px] font-medium text-foreground">Reading {fileName} with Claude…</p>
              <p className="text-[12px]">This usually takes a few seconds.</p>
            </div>
          ) : previewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img src={previewUrl} alt="Uploaded screenshot preview" className="max-h-48 rounded-lg border border-border shadow-elegant" />
              <p className="text-[12px] text-muted-foreground">{fileName} — click or drop to replace</p>
            </div>
          ) : fileName ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-[13px] font-medium text-foreground">{fileName}</p>
              <p className="text-[12px]">Click or drop to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <UploadCloud className="h-8 w-8" />
              <p className="text-[13px] font-medium text-foreground">Drag &amp; drop a screenshot, or click to upload</p>
              <p className="text-[12px]">PNG, JPG, or PDF · contract notes, broker screenshots, statements</p>
            </div>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card
          title={`Parsed transactions (${rows.length})`}
          subtitle="Review and edit before saving — nothing is written until you click Save."
          right={
            <button
              onClick={addBlankRow}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
          }
        >
          <EditableTransactionTable rows={rows} onUpdate={updateRow} onRemove={removeRow} />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-navy text-navy-foreground text-[13px] font-semibold hover:bg-navy/90 disabled:opacity-60 transition-colors"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving…" : `Save ${rows.length} to Database`}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

const TABLE_HEADERS = [
  "Type", "Date", "FY", "Asset Class", "Security", "Entity", "Broker", "Folio",
  "Qty", "Price", "Amount", "Purchase Date", "Purchase Price", "Cost of Acq.", "Realised Gain", "Notes", "",
];

function EditableTransactionTable({
  rows, onUpdate, onRemove,
}: {
  rows: EditableRow[];
  onUpdate: (id: string, patch: Partial<ParsedTransaction>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-y border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            {TABLE_HEADERS.map((h, i) => (
              <th key={i} className="px-2.5 py-2 text-left font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id} className="border-b border-border/40 hover:bg-secondary/20">
              <td className="px-2.5 py-1.5">
                <select
                  value={r.transaction_type}
                  onChange={(e) => onUpdate(r._id, { transaction_type: e.target.value as "BUY" | "SELL" })}
                  className={cn(selectCls, "w-[72px]")}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="date"
                  value={r.transaction_date ?? ""}
                  onChange={(e) => onUpdate(r._id, {
                    transaction_date: e.target.value || null,
                    financial_year: r.financial_year || calcFinancialYear(e.target.value),
                  })}
                  className={cn(inputCls, "w-[135px]")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="text"
                  value={r.financial_year ?? ""}
                  onChange={(e) => onUpdate(r._id, { financial_year: e.target.value || null })}
                  placeholder="2026-27"
                  className={cn(inputCls, "w-[72px]")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <select
                  value={r.asset_class ?? ""}
                  onChange={(e) => onUpdate(r._id, { asset_class: e.target.value || null })}
                  className={cn(selectCls, "w-[130px]")}
                >
                  <option value="">—</option>
                  {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="text"
                  value={r.security_name ?? ""}
                  onChange={(e) => onUpdate(r._id, { security_name: e.target.value || null })}
                  className={cn(inputCls, "w-[160px]")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <select
                  value={r.entity_name ?? ""}
                  onChange={(e) => onUpdate(r._id, { entity_name: e.target.value || null })}
                  className={cn(selectCls, "w-[90px]")}
                >
                  <option value="">—</option>
                  {ENTITIES.map((en) => <option key={en} value={en}>{en}</option>)}
                </select>
              </td>
              <td className="px-2.5 py-1.5">
                <input type="text" value={r.broker ?? ""} onChange={(e) => onUpdate(r._id, { broker: e.target.value || null })} className={cn(inputCls, "w-[110px]")} />
              </td>
              <td className="px-2.5 py-1.5">
                <input type="text" value={r.folio_number ?? ""} onChange={(e) => onUpdate(r._id, { folio_number: e.target.value || null })} className={cn(inputCls, "w-[100px]")} />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.quantity ?? ""}
                  onChange={(e) => onUpdate(r._id, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[80px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.price ?? ""}
                  onChange={(e) => onUpdate(r._id, { price: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[90px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.amount ?? ""}
                  onChange={(e) => onUpdate(r._id, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[100px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input type="date" value={r.purchase_date ?? ""} onChange={(e) => onUpdate(r._id, { purchase_date: e.target.value || null })} className={cn(inputCls, "w-[135px]")} />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.purchase_price ?? ""}
                  onChange={(e) => onUpdate(r._id, { purchase_price: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[100px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.cost_of_acquisition ?? ""}
                  onChange={(e) => onUpdate(r._id, { cost_of_acquisition: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[110px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input
                  type="number"
                  value={r.realised_gain ?? ""}
                  onChange={(e) => onUpdate(r._id, { realised_gain: e.target.value === "" ? null : Number(e.target.value) })}
                  className={cn(inputCls, "w-[100px] text-right")}
                />
              </td>
              <td className="px-2.5 py-1.5">
                <input type="text" value={r.notes ?? ""} onChange={(e) => onUpdate(r._id, { notes: e.target.value || null })} className={cn(inputCls, "w-[140px]")} />
              </td>
              <td className="px-2.5 py-1.5">
                <button onClick={() => onRemove(r._id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 2: Manual Entry ────────────────────────────────────────────────────

function ManualPanel({
  onSave, isSaving,
}: {
  onSave: (rows: ParsedTransaction[]) => Promise<boolean>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ParsedTransaction>(emptyTransaction());
  const fy = calcFinancialYear(form.transaction_date);

  function set<K extends keyof ParsedTransaction>(key: K, value: ParsedTransaction[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await onSave([{ ...form, financial_year: fy || form.financial_year }]);
    if (ok) setForm(emptyTransaction());
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={fieldCls}>
          <span className={labelCls}>Transaction Type</span>
          <div className="inline-flex p-1 rounded-lg bg-secondary/60 border border-border w-fit gap-1">
            {(["BUY", "SELL"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set("transaction_type", t)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors",
                  form.transaction_type === t
                    ? t === "BUY"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-700 dark:text-red-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className={fieldCls}>
            <label className={labelCls}>Entity *</label>
            <select required value={form.entity_name ?? ""} onChange={(e) => set("entity_name", e.target.value || null)} className={cn(selectCls, "h-9")}>
              <option value="" disabled>Select entity</option>
              {ENTITIES.map((en) => <option key={en} value={en}>{en}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Asset Class *</label>
            <select required value={form.asset_class ?? ""} onChange={(e) => set("asset_class", e.target.value || null)} className={cn(selectCls, "h-9")}>
              <option value="" disabled>Select asset class</option>
              {ASSET_CLASSES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Security Name *</label>
            <input required type="text" value={form.security_name ?? ""} onChange={(e) => set("security_name", e.target.value || null)} placeholder="e.g. HDFC Bank Ltd" className={cn(inputCls, "h-9")} />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Transaction Date *</label>
            <input required type="date" value={form.transaction_date ?? ""} onChange={(e) => set("transaction_date", e.target.value || null)} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Financial Year</label>
            <input type="text" value={fy} readOnly placeholder="Auto-calculated" className={cn(inputCls, "h-9 bg-secondary/40 text-muted-foreground cursor-not-allowed")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Broker</label>
            <input type="text" value={form.broker ?? ""} onChange={(e) => set("broker", e.target.value || null)} className={cn(inputCls, "h-9")} />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Folio Number</label>
            <input type="text" value={form.folio_number ?? ""} onChange={(e) => set("folio_number", e.target.value || null)} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Quantity</label>
            <input type="number" value={form.quantity ?? ""} onChange={(e) => set("quantity", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Price</label>
            <input type="number" value={form.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Amount *</label>
            <input required type="number" value={form.amount ?? ""} onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Purchase Date</label>
            <input type="date" value={form.purchase_date ?? ""} onChange={(e) => set("purchase_date", e.target.value || null)} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Purchase Price</label>
            <input type="number" value={form.purchase_price ?? ""} onChange={(e) => set("purchase_price", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Cost of Acquisition</label>
            <input type="number" value={form.cost_of_acquisition ?? ""} onChange={(e) => set("cost_of_acquisition", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Realised Gain</label>
            <input type="number" value={form.realised_gain ?? ""} onChange={(e) => set("realised_gain", e.target.value === "" ? null : Number(e.target.value))} className={cn(inputCls, "h-9")} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Notes</label>
            <input type="text" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} className={cn(inputCls, "h-9")} />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-navy text-navy-foreground text-[13px] font-semibold hover:bg-navy/90 disabled:opacity-60 transition-colors"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Saving…" : "Save Transaction"}
          </button>
        </div>
      </form>
    </Card>
  );
}
