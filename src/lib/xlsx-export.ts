// Formatted Excel export.
//
// CSV loses everything that makes a sheet usable — number formats, column widths,
// frozen headers, filters — so anything exported for actual work goes out as a real
// .xlsx instead. Numbers are written as NUMBERS with a display format, never as
// pre-formatted strings: "₹1.25 Cr" in a cell cannot be summed, sorted or charted,
// which would defeat the point of exporting to Excel at all.
//
// ExcelJS is ~2 MB, so it is loaded on demand — the first export pays for it, the
// rest of the dashboard never does.

import type { Unit } from "./units";
import { unitDivisor, unitSuffix } from "./units";

export type XlsxCellType = "text" | "money" | "number" | "pct" | "date";

export interface XlsxColumn {
  header: string;
  /** Key into the row record. */
  key: string;
  type?: XlsxCellType;
  width?: number;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: Array<Record<string, unknown>>;
  /** Bold, top-bordered totals row appended at the bottom. */
  totals?: Record<string, unknown>;
  /** Freeze panes below the header (and optionally right of N columns). */
  freezeCols?: number;
}

export interface XlsxOptions {
  fileName: string;
  sheets: XlsxSheet[];
  /** Money is divided by this unit and the header labelled accordingly. */
  unit?: Unit;
  /** Shown in a subtitle row above the table. */
  subtitle?: string;
}

const HEADER_BG = "FF0F1E33"; // deep navy, matches the app's masthead
const HEADER_FG = "FFFFFFFF";
const BORDER = "FFD8DEE7";

/** Excel number formats. Money format carries the unit so the sheet is self-describing. */
function numFmt(type: XlsxCellType, unit: Unit): string | undefined {
  switch (type) {
    case "money": {
      const suffix = unitSuffix(unit === "auto" ? "crore" : unit).trim();
      // Negative in brackets and red, the convention finance readers expect.
      const tail = suffix ? ` "${suffix}"` : "";
      return `#,##0.00${tail};[Red](#,##0.00${tail})`;
    }
    case "number":
      return "#,##0.00";
    case "pct":
      return '0.00"%";[Red]-0.00"%"';
    case "date":
      return "dd-mmm-yyyy";
    default:
      return undefined;
  }
}

function scale(value: unknown, type: XlsxCellType | undefined, unit: Unit): unknown {
  if (type !== "money") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return value / unitDivisor(unit === "auto" ? "crore" : unit);
}

/**
 * Build and download a formatted workbook. Returns once the download has been
 * triggered; throws if the sheet library fails to load.
 */
export async function exportXlsx(opts: XlsxOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const unit = opts.unit ?? "crore";
  const wb = new ExcelJS.Workbook();
  wb.creator = "SG Family Wealth";
  wb.created = new Date();

  for (const sheet of opts.sheets) {
    // Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 chars.
    const safeName = sheet.name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet";
    const ws = wb.addWorksheet(safeName, {
      views: [{ state: "frozen", xSplit: sheet.freezeCols ?? 0, ySplit: opts.subtitle ? 2 : 1 }],
    });

    let headerRowIndex = 1;
    if (opts.subtitle) {
      const sub = ws.addRow([opts.subtitle]);
      sub.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
      ws.mergeCells(1, 1, 1, Math.max(1, sheet.columns.length));
      headerRowIndex = 2;
    }

    const header = ws.addRow(
      sheet.columns.map((c) =>
        c.type === "money"
          ? `${c.header} (${unitSuffix(unit === "auto" ? "crore" : unit).trim()})`
          : c.header,
      ),
    );
    header.font = { bold: true, color: { argb: HEADER_FG }, size: 10.5 };
    header.alignment = { vertical: "middle", wrapText: true };
    header.height = 26;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      cell.border = { bottom: { style: "thin", color: { argb: HEADER_BG } } };
    });

    for (const r of sheet.rows) {
      const row = ws.addRow(
        sheet.columns.map((c) => {
          const v = scale(r[c.key], c.type, unit);
          return v === null || v === undefined ? "" : (v as string | number | Date);
        }),
      );
      row.eachCell((cell, col) => {
        const c = sheet.columns[col - 1];
        if (!c) return;
        const fmt = numFmt(c.type ?? "text", unit);
        if (fmt) cell.numFmt = fmt;
        cell.alignment = { horizontal: c.type && c.type !== "text" ? "right" : "left" };
        cell.border = { bottom: { style: "hair", color: { argb: BORDER } } };
        cell.font = { size: 10 };
      });
    }

    if (sheet.totals) {
      const row = ws.addRow(
        sheet.columns.map((c) => {
          const v = scale(sheet.totals?.[c.key], c.type, unit);
          return v === null || v === undefined ? "" : (v as string | number | Date);
        }),
      );
      row.font = { bold: true, size: 10 };
      row.eachCell((cell, col) => {
        const c = sheet.columns[col - 1];
        if (!c) return;
        const fmt = numFmt(c.type ?? "text", unit);
        if (fmt) cell.numFmt = fmt;
        cell.alignment = { horizontal: c.type && c.type !== "text" ? "right" : "left" };
        cell.border = { top: { style: "double", color: { argb: HEADER_BG } } };
      });
    }

    sheet.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width ?? (c.type === "text" ? 30 : 16);
    });

    // Autofilter over the header + body so the sheet is immediately sortable.
    if (sheet.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex + sheet.rows.length, column: sheet.columns.length },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName.endsWith(".xlsx") ? opts.fileName : `${opts.fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has definitely been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
