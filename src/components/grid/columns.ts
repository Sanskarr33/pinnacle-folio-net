// Shared column sets for the Excel-style grid.
//
// `editable` marks which source field a cell writes to when corrected. Derived
// figures (unrealised gain, gain %) are deliberately NOT editable — they are
// recomputed from invested/current so a correction can't leave the row internally
// inconsistent.

import type { GridColumn } from "./DataGrid";
import { displayName, normaliseEntity, normaliseBroker } from "@/lib/portfolio-analytics";

const NAME: GridColumn = {
  key: "display_name",
  label: "Security / Scheme",
  align: "left",
  width: 280,
  value: (r) => displayName(r),
  editable: "security_name",
};

const ENTITY: GridColumn = {
  key: "entity_name",
  label: "Entity",
  align: "left",
  width: 110,
  value: (r) => normaliseEntity(r.entity_name),
  editable: "entity_name",
};

const BROKER: GridColumn = {
  key: "broker_name",
  label: "Custodian",
  align: "left",
  width: 150,
  value: (r) => normaliseBroker(r.broker_name),
  editable: "broker_name",
};

const FOLIO: GridColumn = {
  key: "folio_number",
  label: "Folio",
  align: "left",
  width: 140,
  editable: "folio_number",
};

const CATEGORY: GridColumn = {
  key: "category",
  label: "Category",
  align: "left",
  width: 140,
  editable: "category",
};
const ASSET_CLASS: GridColumn = {
  key: "asset_class",
  label: "Asset class",
  align: "left",
  width: 160,
  editable: "asset_class",
};
const PRODUCT: GridColumn = {
  key: "product_type",
  label: "Product",
  align: "left",
  width: 140,
  editable: "product_type",
};

const INVESTED: GridColumn = {
  key: "invested_value",
  label: "Invested",
  align: "right",
  format: "money",
  total: true,
  editable: "invested_value",
};
const CURRENT: GridColumn = {
  key: "current_value",
  label: "Value",
  align: "right",
  format: "money",
  total: true,
  editable: "current_value",
};
const GAIN: GridColumn = {
  key: "unrealised_gain",
  label: "Gain / Loss",
  align: "right",
  format: "moneySigned",
  total: true,
};
const GAIN_PCT: GridColumn = {
  key: "gain_percent",
  label: "Gain %",
  align: "right",
  format: "pctSigned",
};
const XIRR: GridColumn = {
  key: "xirr",
  label: "XIRR",
  align: "right",
  format: "pct",
  editable: "xirr",
};
const UNITS: GridColumn = {
  key: "units",
  label: "Units",
  align: "right",
  format: "number",
  editable: "units",
};
const QTY: GridColumn = {
  key: "quantity",
  label: "Qty",
  align: "right",
  format: "number",
  editable: "quantity",
};
const PUR_DATE: GridColumn = {
  key: "purchase_date",
  label: "Purchased",
  align: "right",
  format: "date",
  editable: "purchase_date",
};
const PUR_PRICE: GridColumn = {
  key: "purchase_price",
  label: "Buy price",
  align: "right",
  format: "number",
  editable: "purchase_price",
};
const CUR_NAV: GridColumn = {
  key: "current_nav",
  label: "NAV",
  align: "right",
  format: "number",
  editable: "current_nav",
};
const TERM: GridColumn = {
  key: "holding_term",
  label: "Term",
  align: "left",
  width: 100,
  editable: "holding_term",
};
const HELD: GridColumn = {
  key: "holding_period_days",
  label: "Held",
  align: "right",
  format: "days",
  editable: "holding_period_days",
};
const EXIT_LOAD: GridColumn = {
  key: "exit_load",
  label: "Exit load",
  align: "left",
  width: 100,
  editable: "exit_load",
};
const ALLOC: GridColumn = {
  key: "allocation_percent",
  label: "% Book",
  align: "right",
  format: "pct",
};
const TAXATION: GridColumn = {
  key: "taxation",
  label: "Taxation",
  align: "left",
  width: 110,
  editable: "taxation",
  hidden: true,
};
const SOURCE: GridColumn = {
  key: "source_sheet",
  label: "Source sheet",
  align: "left",
  width: 200,
  hidden: true,
};

/** Default set for product pages. */
export const COLS_PRODUCT: GridColumn[] = [
  NAME,
  ENTITY,
  BROKER,
  CATEGORY,
  UNITS,
  CURRENT,
  INVESTED,
  GAIN,
  GAIN_PCT,
  XIRR,
  TERM,
  HELD,
  PUR_DATE,
  EXIT_LOAD,
  FOLIO,
  ALLOC,
  TAXATION,
  SOURCE,
];

/** Full book — everything on. */
export const COLS_FULL_BOOK: GridColumn[] = [
  NAME,
  ENTITY,
  BROKER,
  ASSET_CLASS,
  CATEGORY,
  PRODUCT,
  UNITS,
  QTY,
  PUR_PRICE,
  CUR_NAV,
  CURRENT,
  INVESTED,
  GAIN,
  GAIN_PCT,
  XIRR,
  ALLOC,
  TERM,
  HELD,
  PUR_DATE,
  EXIT_LOAD,
  FOLIO,
  TAXATION,
  SOURCE,
];

/** Tax-oriented view. */
export const COLS_TAX_GRID: GridColumn[] = [
  NAME,
  ENTITY,
  TERM,
  HELD,
  PUR_DATE,
  CURRENT,
  INVESTED,
  GAIN,
  GAIN_PCT,
  { ...TAXATION, hidden: false },
  EXIT_LOAD,
  BROKER,
  FOLIO,
];

/** Fixed income / bonds. */
export const COLS_BONDS_GRID: GridColumn[] = [
  NAME,
  ENTITY,
  BROKER,
  PRODUCT,
  CATEGORY,
  UNITS,
  CURRENT,
  INVESTED,
  GAIN,
  GAIN_PCT,
  XIRR,
  TERM,
  HELD,
  PUR_DATE,
  FOLIO,
];
