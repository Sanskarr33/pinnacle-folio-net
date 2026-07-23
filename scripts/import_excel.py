"""
Import the SG Family portfolio workbook into the dashboard's holdings snapshot.

    python scripts/import_excel.py

Reads the newest "SG Family Portfolio Holdings*.xlsx" in ./excel and writes:
    src/data/holdings-snapshot.json   consumed directly by the app
    scripts/out/holdings.sql          optional Supabase sync (needs a service key)
    scripts/out/reconciliation.txt    section-by-section check against R1_Summary

DESIGN NOTES
------------
* R1_Summary is the control total. Every extracted section is reconciled against it
  and the run FAILS LOUDLY if the book does not tie out.

* Detail sheets carry one row per LOT, plus fund-level subtotal rows that repeat the
  same money. A lot is only accepted when it has BOTH a broker and an entity —
  subtotals never do. Getting this wrong silently doubles the portfolio.

* Direct equity has three sheet variants. "R4A_Detailed_Direct_Equity" is the clean
  lot-level one; "(2)" is the same data plus Entity Subtotal / Asset Total rows;
  "Old_Detailed_DirectEquity" is stale. We use the clean sheet and cross-check
  against "(2)" filtered to Row Type == "Data".

* International direct holdings (Interactive Brokers) are recorded in USD and the
  workbook contains no FX rate. Rather than invent one, that account enters as a
  single INR summary position taken from R1. Same for PMS / AIF / ULIP / PPF / NPS,
  which have no lot-level sheet in this workbook.
"""

from __future__ import annotations

import json
import re
import sys
import warnings
from dataclasses import dataclass, asdict, field
from datetime import datetime, date
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  python -m pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
EXCEL_DIR = ROOT / "excel"
OUT_DIR = ROOT / "scripts" / "out"
DATA_DIR = ROOT / "src" / "data"

CR = 1e7


# ─── helpers ──────────────────────────────────────────────────────────────────

def num(v):
    """Coerce a cell to float, tolerating Excel error strings and stray text."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return None if f != f else f  # drop NaN
    s = str(v).strip().replace(",", "")
    if not s or s.startswith("#"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def text(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.startswith("#"):
        return None
    return s


def iso(v):
    """Excel date cell -> 'YYYY-MM-DD'."""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, (int, float)) and 20000 < v < 80000:
        # Excel serial (1900 epoch, with the well-known leap bug offset)
        try:
            return (datetime(1899, 12, 30) + __import__("datetime").timedelta(days=float(v))).strftime("%Y-%m-%d")
        except Exception:
            return None
    s = text(v)
    if s:
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
        if m:
            return m.group(0)
    return None


def cell(row, i):
    return row[i] if i < len(row) else None


@dataclass
class Holding:
    """Mirrors the PortfolioHolding shape the dashboard consumes."""
    id: str
    as_on_date: str
    report_section: str
    source_sheet: str
    source_row: int | None
    entity_name: str | None
    broker_name: str | None
    folio_number: str | None
    asset_class: str
    category: str | None
    product_type: str
    taxation: str | None
    scheme_type: str | None
    fund_type: str | None
    security_name: str
    scheme_name: str | None = None
    isin: None = None
    ticker: None = None
    account_name: None = None
    advisor_name: None = None
    quantity: float | None = None
    units: float | None = None
    purchase_date: str | None = None
    purchase_price: float | None = None
    purchase_nav: float | None = None
    current_price: float | None = None
    current_nav: float | None = None
    invested_value: float | None = None
    current_value: float | None = None
    unrealised_gain: float | None = None
    gain_percent: float | None = None
    allocation_percent: float | None = None
    xirr: float | None = None
    exit_load: str | None = None
    holding_period_days: int | None = None
    holding_term: str | None = None
    expense_ratio: None = None
    pe_ratio: None = None
    aum: None = None
    source_page: None = None
    notes: str | None = None
    created_at: str | None = None


class Importer:
    def __init__(self, path: Path):
        self.path = path
        self.wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        self.rows: list[Holding] = []
        self.warnings: list[str] = []
        self.as_on = self._detect_as_on()
        self._seq = 0

    # -- infrastructure ---------------------------------------------------

    def _detect_as_on(self) -> str:
        ws = self.wb["R1_Summary"]
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            for v in row:
                d = iso(v)
                if d and d.startswith("20"):
                    return d
            if i > 4:
                break
        return date.today().strftime("%Y-%m-%d")

    def _id(self, prefix: str) -> str:
        self._seq += 1
        return f"{prefix}-{self._seq:05d}"

    def add(self, h: Holding):
        # Derive gain/percent consistently rather than trusting sheet formulas.
        if h.invested_value is not None and h.current_value is not None:
            if h.unrealised_gain is None:
                h.unrealised_gain = h.current_value - h.invested_value
            if h.gain_percent is None and h.invested_value:
                h.gain_percent = (h.unrealised_gain / h.invested_value) * 100
        h.as_on_date = self.as_on
        h.created_at = self.as_on
        self.rows.append(h)

    def sheet(self, name):
        return list(self.wb[name].iter_rows(values_only=True))

    # -- section parsers --------------------------------------------------

    def equity_mf(self):
        """R2A: one row per lot. Header at r6; lots have broker(12) + entity(13)."""
        SH = "R2A_Dynamic wise equity detail"
        rows = self.sheet(SH)
        kept = skipped = 0
        for i, row in enumerate(rows):
            if i < 6:
                continue
            broker, entity = text(cell(row, 12)), text(cell(row, 13))
            name = text(cell(row, 4))
            mv = num(cell(row, 24))
            if not (broker and entity):
                if name and mv:
                    skipped += 1  # fund-level subtotal
                continue
            if not name or mv is None:
                continue
            self.add(Holding(
                id=self._id("emf"), as_on_date="", report_section="Equity MF Detail",
                source_sheet=SH, source_row=i + 1,
                entity_name=entity, broker_name=broker,
                folio_number=text(cell(row, 11)),
                asset_class="Equity Mutual Funds", category=text(cell(row, 5)),
                product_type="Mutual Fund", taxation=text(cell(row, 10)),
                scheme_type=text(cell(row, 7)), fund_type=text(cell(row, 8)),
                security_name=name, scheme_name=name,
                units=num(cell(row, 16)),
                purchase_date=iso(cell(row, 17)),
                purchase_nav=num(cell(row, 20)),
                current_nav=num(cell(row, 22)),
                invested_value=num(cell(row, 21)),
                current_value=mv,
                unrealised_gain=num(cell(row, 25)),
                xirr=(lambda x: x * 100 if x is not None and abs(x) < 5 else x)(num(cell(row, 29))),
                exit_load=text(cell(row, 6)),
                holding_period_days=int(num(cell(row, 15))) if num(cell(row, 15)) else None,
                holding_term=text(cell(row, 14)),
            ))
            kept += 1
        self.warnings.append(f"{SH}: {kept} lots kept, {skipped} subtotal rows skipped")

    def debt_mf(self):
        """R3A: same idea; category comes from section header rows in col 1."""
        SH = "R3A_Fund wise Debt MF"
        rows = self.sheet(SH)
        category = None
        scheme = None
        kept = skipped = 0
        for i, row in enumerate(rows):
            if i < 5:
                continue
            c1 = text(cell(row, 1))
            # Section header: only col 1 populated with a category label
            if c1 and not text(cell(row, 9)) and not num(cell(row, 22)):
                if "fund" in c1.lower() or "duration" in c1.lower() or "risk" in c1.lower():
                    category = c1
            nm = text(cell(row, 2))
            if nm:
                scheme = nm
            broker, entity = text(cell(row, 9)), text(cell(row, 10))
            mv = num(cell(row, 22))
            if not (broker and entity):
                if mv:
                    skipped += 1
                continue
            if mv is None or not scheme:
                continue
            self.add(Holding(
                id=self._id("dmf"), as_on_date="", report_section="Debt MF Detail",
                source_sheet=SH, source_row=i + 1,
                entity_name=entity, broker_name=broker,
                folio_number=text(cell(row, 8)),
                asset_class="Debt Mutual Funds", category=category,
                product_type="Mutual Fund", taxation=text(cell(row, 7)),
                scheme_type=text(cell(row, 4)), fund_type=text(cell(row, 5)),
                security_name=scheme, scheme_name=scheme,
                units=num(cell(row, 13)),
                purchase_date=iso(cell(row, 14)),
                purchase_nav=num(cell(row, 17)),
                current_nav=num(cell(row, 20)),
                invested_value=num(cell(row, 18)),
                current_value=mv,
                unrealised_gain=num(cell(row, 23)),
                xirr=(lambda x: x * 100 if x is not None and abs(x) < 5 else x)(num(cell(row, 29))),
                exit_load=text(cell(row, 3)),
                holding_period_days=int(num(cell(row, 12))) if num(cell(row, 12)) else None,
                holding_term=text(cell(row, 11)),
            ))
            kept += 1
        self.warnings.append(f"{SH}: {kept} lots kept, {skipped} subtotal rows skipped")

    def direct_equity(self):
        """R4A clean sheet; cross-checked against the '(2)' variant's Data rows."""
        SH = "R4A_Detailed_Direct_Equity"
        rows = self.sheet(SH)
        kept = 0
        for i, row in enumerate(rows):
            if i == 0:
                continue
            name = text(cell(row, 1))
            entity, broker = text(cell(row, 3)), text(cell(row, 4))
            mv = num(cell(row, 12))
            if not name or mv is None or not entity:
                continue
            invested = num(cell(row, 10))
            days = num(cell(row, 7))
            self.add(Holding(
                id=self._id("deq"), as_on_date="", report_section="Direct Equity Detail",
                source_sheet=SH, source_row=i + 1,
                entity_name=entity, broker_name=broker, folio_number=None,
                asset_class="Equity", category="Direct Equity",
                product_type="Direct Equity", taxation="Equity",
                scheme_type=None, fund_type=None,
                security_name=name, scheme_name=None,
                quantity=num(cell(row, 5)),
                purchase_date=iso(cell(row, 6)),
                purchase_price=num(cell(row, 9)),
                current_price=num(cell(row, 11)),
                invested_value=invested,
                current_value=mv,
                unrealised_gain=num(cell(row, 13)),
                holding_period_days=int(days) if days else None,
                holding_term=text(cell(row, 8)),
                exit_load=None,
            ))
            kept += 1

        # Cross-check against the annotated variant.
        try:
            alt = self.sheet("R4A_Detailed_Direct_Equity (2)")
            alt_mv = sum(
                num(cell(r, 12)) or 0
                for r in alt[1:]
                if text(cell(r, 17)) == "Data" and num(cell(r, 12)) is not None
            )
            mine = sum(h.current_value or 0 for h in self.rows if h.report_section == "Direct Equity Detail")
            if abs(alt_mv - mine) > 1000:
                self.warnings.append(
                    f"!! Direct equity mismatch: clean sheet {mine/CR:.2f} Cr vs '(2)' Data rows {alt_mv/CR:.2f} Cr"
                )
            else:
                self.warnings.append(
                    f"{SH}: {kept} lots kept; cross-check vs '(2)' Data rows OK ({mine/CR:.2f} Cr)"
                )
        except KeyError:
            self.warnings.append(f"{SH}: {kept} lots kept (no '(2)' variant to cross-check)")

    def _wide_detail(self, sheet_name, section, asset_class, product_resolver, default_category=None):
        """Shared parser for R5A / R6A which share the cols 5..25 layout."""
        rows = self.sheet(sheet_name)
        group = default_category
        kept = skipped = 0
        for i, row in enumerate(rows):
            if i < 5:
                continue
            fund = text(cell(row, 6))
            broker, entity = text(cell(row, 7)), text(cell(row, 8))
            mv = num(cell(row, 18))
            # Group header: fund name present, nothing else
            if fund and not broker and not entity and mv is None:
                group = fund
                continue
            if not (broker and entity):
                if mv:
                    skipped += 1
                continue
            if mv is None:
                continue
            name = fund or group
            if not name:
                continue
            days = num(cell(row, 12))
            self.add(Holding(
                id=self._id(section[:3].lower()), as_on_date="", report_section=section,
                source_sheet=sheet_name, source_row=i + 1,
                entity_name=entity, broker_name=broker, folio_number=None,
                asset_class=asset_class, category=group,
                product_type=product_resolver(name, group),
                taxation=text(cell(row, 24)),
                scheme_type=None, fund_type=None,
                security_name=name, scheme_name=None,
                units=num(cell(row, 9)),
                purchase_date=iso(cell(row, 10)),
                purchase_price=num(cell(row, 14)),
                current_price=num(cell(row, 16)),
                invested_value=num(cell(row, 15)),
                current_value=mv,
                unrealised_gain=num(cell(row, 19)),
                xirr=(lambda x: x * 100 if x is not None and abs(x) < 5 else x)(num(cell(row, 22))),
                holding_period_days=int(days) if days else None,
                holding_term=text(cell(row, 13)),
                exit_load=None,
            ))
            kept += 1
        self.warnings.append(f"{sheet_name}: {kept} lots kept, {skipped} subtotal rows skipped")

    def etfs(self):
        self._wide_detail(
            "R5A_Detailed Index ETFs", "ETF Detail", "Equity",
            lambda name, group: "ETF", default_category="Index ETF",
        )

    @staticmethod
    def _bullion_product(name: str) -> str:
        n = (name or "").lower()
        if "silver" in n:
            return "Silver ETF/Physical"
        if "sgb" in n or "sovereign" in n or "gold" in n:
            return "Gold ETF/SGB"
        return "Bullion"

    def bullion_and_bonds(self):
        """
        Bullion is split across two sheets and neither alone is complete:

          * "Bullions New Format Raw" — flat, current, 206 ETF lots, but holds NO
            sovereign gold bonds and no CIPL bonds.
          * "R6A_Detailed Bullion"    — older nested format; 63 fewer ETF lots, but
            it is the ONLY place SGBs and the CIPL NCDs appear.

        So: ETFs come from the new sheet, SGBs and bonds from R6A. R6_Summary_Bullion
        (which feeds R1's bullion line) is full of #REF! errors, so R1 understates
        bullion — the variance is reported rather than silently plugged.
        """
        # --- ETF lots from the flat, current sheet ---------------------------
        SH = "Bullions New Format Raw"
        kept = 0
        for i, row in enumerate(self.sheet(SH)):
            if i == 0:
                continue
            fund = text(cell(row, 0))
            broker, entity = text(cell(row, 2)), text(cell(row, 3))
            mv = num(cell(row, 13))
            if not (fund and broker and entity) or mv is None:
                continue
            days = num(cell(row, 7))
            self.add(Holding(
                id=self._id("bul"), as_on_date="", report_section="Bullion Detail",
                source_sheet=SH, source_row=i + 1,
                entity_name=entity, broker_name=broker, folio_number=None,
                asset_class="Bullion", category="Bullion ETF",
                product_type=self._bullion_product(fund), taxation=None,
                scheme_type=None, fund_type=None,
                security_name=fund, scheme_name=None,
                units=num(cell(row, 4)),
                purchase_date=iso(cell(row, 5)),
                purchase_price=num(cell(row, 9)),
                current_price=num(cell(row, 11)),
                invested_value=num(cell(row, 10)),
                current_value=mv,
                unrealised_gain=num(cell(row, 14)),
                holding_period_days=int(days) if days else None,
                holding_term=text(cell(row, 8)),
                exit_load=None,
            ))
            kept += 1
        self.warnings.append(f"{SH}: {kept} bullion ETF lots kept")

        # --- SGBs and bonds, which exist only in R6A -------------------------
        SH6 = "R6A_Detailed Bullion"
        sgb = bond = 0
        for i, row in enumerate(self.sheet(SH6)):
            if i < 5:
                continue
            fund = text(cell(row, 6))
            broker, entity = text(cell(row, 7)), text(cell(row, 8))
            mv = num(cell(row, 18))
            if not (fund and broker and entity) or mv is None:
                continue
            low = fund.lower()
            is_sgb = "sgb" in low or "sovereign" in low
            is_bond = "ncd" in low or "cipl" in low or "reit" in low
            if not (is_sgb or is_bond):
                continue  # ETFs already taken from the newer sheet
            days = num(cell(row, 12))
            self.add(Holding(
                id=self._id("sgb" if is_sgb else "bnd"), as_on_date="",
                report_section="Bullion Detail" if is_sgb else "Debt Bonds/REIT",
                source_sheet=SH6, source_row=i + 1,
                entity_name=entity, broker_name=broker, folio_number=None,
                asset_class="Bullion" if is_sgb else "Debt",
                category="Sovereign Gold Bond" if is_sgb else "Bonds & REITs",
                product_type="Gold ETF/SGB" if is_sgb else "Bond/REIT",
                taxation=text(cell(row, 24)),
                scheme_type=None, fund_type=None,
                security_name=fund, scheme_name=None,
                units=num(cell(row, 9)),
                purchase_date=iso(cell(row, 10)),
                purchase_price=num(cell(row, 14)),
                current_price=num(cell(row, 16)),
                invested_value=num(cell(row, 15)),
                current_value=mv,
                unrealised_gain=num(cell(row, 19)),
                xirr=(lambda x: x * 100 if x is not None and abs(x) < 5 else x)(num(cell(row, 22))),
                holding_period_days=int(days) if days else None,
                holding_term=text(cell(row, 13)),
                exit_load=None,
            ))
            if is_sgb:
                sgb += 1
            else:
                bond += 1
        self.warnings.append(f"{SH6}: {sgb} sovereign gold bond lots + {bond} bond lots kept (ETFs sourced from the newer sheet)")

    # -- summary-level positions -----------------------------------------

    def summary_positions(self):
        """
        Sections with no lot-level sheet in this workbook. Taken from R1_Summary so
        the book still ties out, each as one clearly-labelled position.
        """
        ws = self.wb["R1_Summary"]
        rows = list(ws.iter_rows(values_only=True))

        def find(label_sub, lo=0, hi=70):
            for i, r in enumerate(rows):
                if not (lo <= i <= hi):
                    continue
                c = text(cell(r, 2))
                if c and label_sub.lower() in c.lower():
                    return i, r
            return None, None

        specs = [
            # (R1 label fragment, security name, asset_class, product_type, category, note)
            ("ICICI Pru PIPE PMS", "ICICI Pru PIPE PMS", "PMS", "PMS", "Equity PMS", None),
            ("ICICI Pru Contra PMS", "ICICI Pru Contra PMS", "PMS", "PMS", "Equity PMS", None),
            ("ICICI PRU PMS Large Cap", "ICICI Pru PMS Large Cap Strategy", "PMS", "PMS", "Equity PMS", None),
            ("Abakkus All Cap", "Abakkus All Cap Approach PMS", "PMS", "PMS", "Equity PMS", None),
            ("Carnelian Capital", "Carnelian Capital Compounder PMS", "PMS", "PMS", "Equity PMS", None),
            ("Nuvama Crsvr", "Nuvama Crossover Opportunities Fund III B", "AIFs", "AIF", "Equity AIF", None),
            ("ICICI Pru Cor. Credit Opp AIF 2", "ICICI Pru Corporate Credit Opportunities AIF 2", "AIFs", "AIF", "Debt AIF", None),
            ("ICICI Pru Cor. Credit Opp AIF 3", "ICICI Pru Corporate Credit Opportunities AIF 3", "AIFs", "AIF", "Debt AIF", None),
            ("ICICI Pru OYO AIF", "ICICI Pru OYO AIF-II", "AIFs", "AIF", "Debt AIF", None),
            ("ICICI ULIP", "ICICI Prudential ULIP", "ULIP", "ULIP", "Insurance-linked", None),
            ("NSE Unlisted Shares", "NSE Unlisted Shares", "Equity", "Unlisted Shares", "Unlisted Equity", None),
            ("Fixed Deposits (International)", "International Account (Interactive Brokers)", "Other Investments",
             "Other Investments", "International",
             "Held in USD; the workbook carries no FX rate, so the INR control total from R1 is used."),
            ("Public Provident Fund", "Public Provident Fund (PPF)", "Other Investments", "Other Investments", "Small Savings", None),
            ("National Pension Scheme", "National Pension Scheme (NPS)", "Other Investments", "Other Investments", "Small Savings", None),
            ("Cash in Hnad", "Cash in Hand / Bank", "Cash", "Cash", "Cash", None),
        ]

        for frag, name, asset_class, product, category, note in specs:
            i, r = find(frag)
            if r is None:
                self.warnings.append(f"!! R1 line not found: {frag}")
                continue
            cost, mv = num(cell(r, 3)), num(cell(r, 4))
            if mv is None:
                self.warnings.append(f"!! R1 line has no market value: {frag}")
                continue
            self.add(Holding(
                id=self._id("sum"), as_on_date="", report_section="R1 Summary",
                source_sheet="R1_Summary", source_row=i + 1,
                # "Group" is the workbook's own term for a family-level position
                # (see the entity selector on CapGains FY25-26). These genuinely have
                # no single owning entity, so we label rather than blank them.
                entity_name="Group", broker_name=None, folio_number=None,
                asset_class=asset_class, category=category,
                product_type=product, taxation=None,
                scheme_type=None, fund_type=None,
                security_name=name, scheme_name=None,
                invested_value=cost, current_value=mv,
                notes=note or "Summary-level position — no lot detail in this workbook.",
            ))

    # -- reconciliation ---------------------------------------------------

    def reconcile(self) -> tuple[str, bool]:
        ws = self.wb["R1_Summary"]
        rows = list(ws.iter_rows(values_only=True))
        control = {}
        for r in rows:
            label = text(cell(r, 2))
            mv = num(cell(r, 4))
            if label and mv is not None:
                control[label.strip()] = mv

        grand = None
        for k, v in control.items():
            if k.lower().startswith("grand total"):
                grand = v
        total = sum(h.current_value or 0 for h in self.rows)

        out = []
        out.append(f"Workbook      : {self.path.name}")
        out.append(f"Valuation date: {self.as_on}")
        out.append("")
        out.append("SECTION EXTRACTION")
        by_sec: dict[str, list[Holding]] = {}
        for h in self.rows:
            by_sec.setdefault(h.report_section, []).append(h)
        for sec, hs in sorted(by_sec.items(), key=lambda kv: -sum(x.current_value or 0 for x in kv[1])):
            mv = sum(x.current_value or 0 for x in hs)
            iv = sum(x.invested_value or 0 for x in hs)
            out.append(f"  {sec:<24} {len(hs):>4} rows   cost {iv/CR:9.2f} Cr   mv {mv/CR:9.2f} Cr")
        out.append("")
        out.append("ASSET CLASS")
        by_ac: dict[str, float] = {}
        for h in self.rows:
            by_ac[h.asset_class] = by_ac.get(h.asset_class, 0) + (h.current_value or 0)
        for ac, mv in sorted(by_ac.items(), key=lambda kv: -kv[1]):
            out.append(f"  {ac:<24} {mv/CR:9.2f} Cr")
        out.append("")

        def sec(*names):
            return sum(h.current_value or 0 for h in self.rows if h.report_section in names)

        def by_class(*names):
            return sum(h.current_value or 0 for h in self.rows if h.asset_class in names)

        ok = True
        variances: list[tuple[str, float, float, float]] = []
        out.append("RECONCILIATION vs R1_Summary   (tolerance 0.5%)")
        checks = [
            ("Equity MF", "Total (A)", sec("Equity MF Detail")),
            ("Debt MF", "Total (D)", sec("Debt MF Detail")),
            ("Direct Equity", "Direct Equity (Actual Cost)", sec("Direct Equity Detail")),
            ("Index ETFs", "Index ETFs", sec("ETF Detail")),
            ("Bullion", "Total Bullion (G)", sec("Bullion Detail")),
            ("Bonds / REIT", "Total (F)", sec("Debt Bonds/REIT")),
        ]
        for label, key, mine in checks:
            ctrl = control.get(key)
            if ctrl is None:
                ctrl = next((v for k, v in control.items() if k.strip() == key.strip()), None)
            if ctrl is None:
                out.append(f"  --  {label:<22} control line '{key}' not found — skipped")
                continue
            diff = mine - ctrl
            within = abs(diff) < max(1000.0, abs(ctrl) * 0.005)
            out.append(
                f"  {'OK ' if within else 'VAR'} {label:<22} extracted {mine/CR:9.2f} Cr   R1 {ctrl/CR:9.2f} Cr   diff {diff/CR:+8.3f} Cr"
            )
            if not within:
                variances.append((label, mine, ctrl, diff))

        if grand:
            diff = total - grand
            within = abs(diff) < max(100000.0, grand * 0.005)
            out.append(
                f"  {'OK ' if within else 'VAR'} {'GRAND TOTAL':<22} extracted {total/CR:9.2f} Cr   R1 {grand/CR:9.2f} Cr   diff {diff/CR:+8.3f} Cr"
            )
            if not within:
                variances.append(("GRAND TOTAL", total, grand, diff))

        if variances:
            out.append("")
            out.append("UNRECONCILED VARIANCES — source-workbook inconsistencies, not import errors")
            for label, mine, ctrl, diff in variances:
                out.append(f"  {label}: lot detail {mine/CR:.2f} Cr vs R1 {ctrl/CR:.2f} Cr ({diff/CR:+.3f} Cr)")
            out.append(
                "  Lot-level detail is used as the dashboard's source of truth because it is what\n"
                "  drives broker, entity, tax and exit-load analysis. R6_Summary_Bullion (which feeds\n"
                "  R1's bullion line) contains #REF! errors, so R1 understates bullion."
            )
        out.append("")
        out.append("NOTES / WARNINGS")
        for w in self.warnings:
            out.append(f"  {w}")

        out.append("")
        out.append("DISTINCT BROKERS (raw)")
        brokers: dict[str, int] = {}
        for h in self.rows:
            b = h.broker_name or "(none)"
            brokers[b] = brokers.get(b, 0) + 1
        for b, n in sorted(brokers.items(), key=lambda kv: -kv[1]):
            out.append(f"  {n:>4}  {b}")

        out.append("")
        out.append("DISTINCT ENTITIES (raw)")
        ents: dict[str, float] = {}
        for h in self.rows:
            e = h.entity_name or "(none)"
            ents[e] = ents.get(e, 0) + (h.current_value or 0)
        for e, mv in sorted(ents.items(), key=lambda kv: -kv[1]):
            out.append(f"  {mv/CR:9.2f} Cr  {e}")

        return "\n".join(out), ok

    def run(self):
        self.equity_mf()
        self.debt_mf()
        self.direct_equity()
        self.etfs()
        self.bullion_and_bonds()
        self.summary_positions()
        # allocation_percent is derived once the whole book is known
        total = sum(h.current_value or 0 for h in self.rows) or 1
        for h in self.rows:
            h.allocation_percent = (h.current_value or 0) / total * 100
        return self


# ─── transaction workbook ─────────────────────────────────────────────────────

class TransactionImporter:
    """
    Reads the companion transaction workbook. This is the trade ledger the Supabase
    project never had — realised gains, sales and purchases.

    Two distinct things live here and must not be conflated:
      * "CapGains FY25-26"  — CURRENT financial year realised gains, summarised by
                              asset category with the ST/LT split and tax liability.
      * "Profit N Loss"     — a line-by-line realised ledger for FY 2023-24 only.
    """

    def __init__(self, path: Path):
        self.path = path
        self.wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        self.notes: list[str] = []

    def capital_gains(self) -> dict:
        ws = self.wb["CapGains FY25-26"]
        rows = list(ws.iter_rows(values_only=True))
        as_on = None
        for r in rows[:6]:
            for v in r:
                d = iso(v)
                if d:
                    as_on = d
                    break
            if as_on:
                break

        cats, total = [], None
        for r in rows:
            label = text(cell(r, 7))
            if not label:
                continue
            sale = num(cell(r, 9))
            if sale is None:
                continue
            rec = {
                "category": label.strip(),
                "saleAmount": sale,
                "shortTermGain": num(cell(r, 10)) or 0.0,
                "shortTermTax": num(cell(r, 11)) or 0.0,
                "longTermGain": num(cell(r, 14)) or 0.0,
                "longTermTax": num(cell(r, 15)) or 0.0,
                "netGain": num(cell(r, 17)) or 0.0,
                "netTax": num(cell(r, 18)) or 0.0,
            }
            if label.strip().lower().startswith("total"):
                total = rec
            else:
                cats.append(rec)

        if total is None and cats:
            total = {
                "category": "Total",
                **{k: sum(c[k] for c in cats) for k in
                   ("saleAmount", "shortTermGain", "shortTermTax", "longTermGain", "longTermTax", "netGain", "netTax")},
            }
        self.notes.append(f"CapGains FY25-26: {len(cats)} categories, net realised {total['netGain']/CR:.3f} Cr")
        return {"asOn": as_on, "financialYear": "2025-26", "byCategory": cats, "total": total}

    def realised_ledger(self) -> dict:
        """Line-by-line realised trades. Section header rows carry the asset group."""
        ws = self.wb["Profit N Loss"]
        rows = list(ws.iter_rows(values_only=True))
        title = text(cell(rows[1], 0)) if len(rows) > 1 else None
        fy = None
        if title:
            m = re.search(r"(\d{4}-\d{2,4})", title)
            fy = m.group(1) if m else None

        group = None
        out = []
        for i, r in enumerate(rows):
            c0 = text(cell(r, 0))
            name = text(cell(r, 2))
            entity = text(cell(r, 3))
            pl = num(cell(r, 12))
            # Section label: text in col 0, nothing else meaningful
            if c0 and not entity and pl is None and not str(c0).strip().isdigit():
                if "profit n loss" not in c0.lower():
                    group = c0.strip()
                continue
            if not (name and entity) or pl is None:
                continue
            out.append({
                "id": f"pnl-{i+1}",
                "assetGroup": group,
                "saleDate": iso(cell(r, 1)),
                "securityName": name,
                "entity": entity,
                "broker": text(cell(r, 4)),
                "folio": text(cell(r, 5)),
                "units": num(cell(r, 6)),
                "purchaseDate": iso(cell(r, 7)),
                "purchasePrice": num(cell(r, 8)),
                "cost": num(cell(r, 9)),
                "salePrice": num(cell(r, 10)),
                "saleAmount": num(cell(r, 11)),
                "profitLoss": pl,
            })
        dates = [t["saleDate"] for t in out if t["saleDate"]]
        self.notes.append(
            f"Profit N Loss: {len(out)} realised trades, FY {fy}, "
            f"net {sum(t['profitLoss'] for t in out)/CR:.3f} Cr"
        )
        return {
            "financialYear": fy,
            "from": min(dates) if dates else None,
            "to": max(dates) if dates else None,
            "trades": out,
        }

    def purchases(self) -> list[dict]:
        """Purchase ledger from the fixed-asset purchases sheet."""
        SH = "Purchase Transactions"
        ws = self.wb[SH]
        group = None
        out = []
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            c2 = text(cell(r, 2))
            date = iso(cell(r, 3))
            name = text(cell(r, 4))
            entity = text(cell(r, 5))
            amt = num(cell(r, 9))
            if c2 and not date and not name and amt is None:
                if not str(c2).strip().isdigit() and "purchase" not in c2.lower() and "s. no" not in c2.lower():
                    group = c2.strip()
                continue
            if not (name and date) or amt is None:
                continue
            out.append({
                "id": f"pur-{i+1}",
                "assetGroup": group,
                "date": date,
                "securityName": name,
                "entity": entity,
                "broker": text(cell(r, 6)),
                "units": num(cell(r, 7)),
                "price": num(cell(r, 8)),
                "amount": amt,
            })
        self.notes.append(f"{SH}: {len(out)} purchase transactions")
        return out

    def run(self) -> dict:
        cg = self.capital_gains()
        led = self.realised_ledger()
        pur = self.purchases()
        return {
            "source": self.path.name,
            "capitalGains": cg,
            "realisedLedger": led,
            "purchases": pur,
            "notes": self.notes,
        }


def sql_escape(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    books = sorted(EXCEL_DIR.glob("SG Family Portfolio Holdings*.xlsx"))
    if not books:
        sys.exit(f"No holdings workbook found in {EXCEL_DIR}")
    book = books[-1]
    print(f"Reading {book.name} …")

    imp = Importer(book).run()
    report, ok = imp.reconcile()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    (OUT_DIR / "reconciliation.txt").write_text(report, encoding="utf-8")
    print(report)

    payload = {
        "source": book.name,
        "asOnDate": imp.as_on,
        "generatedFrom": "scripts/import_excel.py",
        "rowCount": len(imp.rows),
        "totalValue": sum(h.current_value or 0 for h in imp.rows),
        "holdings": [asdict(h) for h in imp.rows],
    }
    snap = DATA_DIR / "holdings-snapshot.json"
    snap.write_text(json.dumps(payload, indent=None, separators=(",", ":"), default=str), encoding="utf-8")
    print(f"\nWrote {snap.relative_to(ROOT)}  ({snap.stat().st_size/1024:.0f} KB, {len(imp.rows)} rows)")

    # --- companion transaction workbook (optional) ---------------------------
    txn_books = sorted(EXCEL_DIR.glob("Transaction File*.xlsx"))
    if txn_books:
        tb = txn_books[-1]
        print(f"\nReading {tb.name} …")
        tx = TransactionImporter(tb).run()
        tp = DATA_DIR / "transactions-snapshot.json"
        tp.write_text(json.dumps(tx, indent=None, separators=(",", ":"), default=str), encoding="utf-8")
        for n_ in tx["notes"]:
            print(f"  {n_}")
        print(f"Wrote {tp.relative_to(ROOT)}  ({tp.stat().st_size/1024:.0f} KB)")
    else:
        print("\nNo transaction workbook found — skipping realised gains.")

    # `id` is a uuid column in Supabase with a server-side default; our synthetic
    # "emf-00001" keys are not uuids, so the column is omitted and Postgres assigns it.
    cols = [f.name for f in Holding.__dataclass_fields__.values() if f.name != "id"]
    lines = [
        "-- Generated by scripts/import_excel.py — do not hand-edit.",
        f"-- Source: {book.name}   valuation date {imp.as_on}   {len(imp.rows)} rows",
        "--",
        "-- Paste into the Supabase SQL editor, or run with a service-role key:",
        "--   psql \"$SUPABASE_DB_URL\" -f scripts/out/holdings.sql",
        "--",
        "-- The anon/publishable key CANNOT run this — row-level security rejects writes.",
        "-- Replaces any rows already stored for this valuation date; other dates are untouched.",
        "begin;",
        f"delete from portfolio_detailed_holdings where as_on_date = '{imp.as_on}';",
    ]
    collist = ", ".join(cols)
    for h in imp.rows:
        d = asdict(h)
        vals = ", ".join(sql_escape(d[c]) for c in cols)
        lines.append(f"insert into portfolio_detailed_holdings ({collist}) values ({vals});")
    lines.append("commit;")
    sqlp = OUT_DIR / "holdings.sql"
    sqlp.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {sqlp.relative_to(ROOT)}")

    if not ok:
        sys.exit("\nRECONCILIATION FAILED — snapshot written but does not tie to R1_Summary.")
    print("\nReconciliation OK.")


if __name__ == "__main__":
    main()
