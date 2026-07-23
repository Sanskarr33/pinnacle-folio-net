"""
Import advisor meeting minutes into the dashboard.

    python scripts/import_minutes.py

Reads every PDF/DOCX in "Minutes for meetings with advisors/" and writes
    src/data/meetings-snapshot.json

DESIGN NOTES
------------
* These are SOURCE DOCUMENTS. The import is one-way and the app treats them as
  read-only: re-running this replaces the snapshot wholesale. Anything a user
  authors (action status, their own notes) lives separately in localStorage and is
  keyed on stable ids so it survives re-import.

* Ids are derived from the FILENAME, not from row order, so re-importing does not
  orphan the status a user has already recorded against an action.

* Two document shapes exist and both are handled:
    - 8 "MOM_*" PDFs: a key/value header block, numbered sections, and an
      "Action Items" table.
    - 1 DOCX: free-form narrative with no header table.

* Action tables come out of the PDF flattened — the wide "Action Item" column and
  the narrow "Owner" column interleave as long and short lines. Parsing is
  best-effort, so the RAW section text is always kept alongside the parsed items;
  the UI shows both. Never silently drop a commitment because a regex missed it.
"""

from __future__ import annotations

import json
import re
import sys
import warnings
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf is required:  python -m pip install pypdf python-docx")
try:
    import docx
except ImportError:
    sys.exit("python-docx is required:  python -m pip install pypdf python-docx")

ROOT = Path(__file__).resolve().parent.parent
MINUTES_DIR = ROOT / "Minutes for meetings with advisors"
DATA_DIR = ROOT / "src" / "data"
OUT_DIR = ROOT / "scripts" / "out"

# ─── Advisor identity ─────────────────────────────────────────────────────────
# Filenames and headers spell the same firm several ways; this is the single place
# that decides what a firm is called, mirroring normaliseBroker() on the app side.

ADVISOR_PATTERNS: list[tuple[str, str, str]] = [
    # (regex over filename+header, canonical name, stable key)
    (r"360\s*one|360one",              "360 ONE",                     "360-one"),
    (r"barclays",                      "Barclays Private Bank",       "barclays"),
    (r"icici\s*pru|icicipru",          "ICICI Prudential",            "icici-pru"),
    (r"incred",                        "InCred Wealth",               "incred"),
    (r"shriram",                       "Shriram Wealth",              "shriram"),
    (r"bajaj",                         "Bajaj Broking",               "bajaj"),
    (r"kotak",                         "Kotak Securities",            "kotak"),
    (r"nuvama",                        "Nuvama",                      "nuvama"),
]

MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"], 1)}


def resolve_advisor(*texts: str) -> tuple[str, str]:
    blob = " ".join(texts).lower()
    for pattern, name, key in ADVISOR_PATTERNS:
        if re.search(pattern, blob):
            return name, key
    return "Unattributed advisor", "unattributed"


def parse_date(text: str) -> str | None:
    """Pull the first real date out of a header line. Returns ISO or None."""
    if not text:
        return None
    t = text.strip()
    # "Thursday, May 08, 2026" / "April 09, 2026" / "May 2026"
    m = re.search(r"([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})", t)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s+([A-Z][a-z]+)\s+(\d{4})", t)
    if m and m.group(2).lower() in MONTHS:
        return f"{m.group(3)}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    # Compact filename form: "14Jul2026" / "8May2026"
    m = re.search(r"(\d{1,2})([A-Z][a-z]{2})[a-z]*(\d{4})", t)
    if m:
        mon = next((k for k in MONTHS if k.startswith(m.group(2).lower())), None)
        if mon:
            return f"{m.group(3)}-{MONTHS[mon]:02d}-{int(m.group(1)):02d}"
    # Month + year only — anchor to the 1st and flag imprecision to the caller
    m = re.search(r"\b([A-Z][a-z]+)\s+(\d{4})\b", t)
    if m and m.group(1).lower() in MONTHS:
        return f"{m.group(2)}-{MONTHS[m.group(1).lower()]:02d}-01"
    return None


# ─── Extraction ───────────────────────────────────────────────────────────────

def extract_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    if path.suffix.lower() == ".docx":
        d = docx.Document(str(path))
        parts = [p.text for p in d.paragraphs]
        for table in d.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells]
                if any(cells):
                    parts.append(" | ".join(cells))
        return "\n".join(parts)
    return ""


def clean_lines(raw: str) -> list[str]:
    """Drop repeated PDF running headers/footers that would otherwise pollute sections."""
    out = []
    for line in raw.split("\n"):
        s = line.rstrip()
        if not s.strip():
            out.append("")
            continue
        low = s.lower()
        if re.search(r"page\s+\d+\s*$", low) and ("confidential" in low or "minutes of meeting" in low):
            continue
        if low.strip() in {"confidential", "confidential | not for circulation"}:
            continue
        if re.match(r"^\s*minutes of meeting\s*\|", low) and "page" in low:
            continue
        out.append(s)
    return out


HEADER_KEYS = [
    "Meeting Date", "Duration", "Platform", "Meeting Type", "Client", "Counterparty",
    "Represented By", "SMC Representatives", "Circulated To", "Prepared By", "Status",
    "Follow-up Date", "Advisor", "Format", "Key Focus Areas", "Products Presented",
    "Client Risk Profile", "Hosted With", "Meeting Format", "Client / Initiating",
]


def parse_header(lines: list[str]) -> dict[str, str]:
    """
    The header is a two-column table flattened to "Key Value" lines, sometimes with
    two key/value pairs on one line. Values can wrap onto the following line.
    """
    head = lines[:40]
    found: dict[str, str] = {}
    current: str | None = None

    for line in head:
        s = line.strip()
        if not s:
            continue
        matched = False
        for key in HEADER_KEYS:
            m = re.match(rf"^{re.escape(key)}\s+(.*)$", s, re.I)
            if m:
                value = m.group(1).strip()
                # A second key can share the line: "Meeting Date X Meeting Type Y"
                for other in HEADER_KEYS:
                    m2 = re.search(rf"\s{re.escape(other)}\s+", value, re.I)
                    if m2 and other.lower() != key.lower():
                        found[other] = value[m2.end():].strip()
                        value = value[: m2.start()].strip()
                        break
                found[key] = value
                current = key
                matched = True
                break
        if not matched and current and len(s) < 90 and not re.match(r"^\d+\.", s):
            prev = found.get(current, "")
            # A continuation looks like a wrapped cell: it starts lowercase, or closes a
            # bracket the value left open. Anything else is the next block of the
            # document and must not be absorbed (Status used to swallow a whole heading).
            # "Status" is a short terminal field — a following lowercase line is the
            # next paragraph of the document, not a wrapped cell, so never extend it.
            looks_continuation = (
                bool(prev)
                and current != "Status"
                and not prev.endswith((".", ")"))
                and (s[:1].islower() or prev.count("(") > prev.count(")"))
            )
            if looks_continuation:
                found[current] = f"{prev} {s}".strip()
            else:
                current = None
    return found


# Some documents prefix headings with a decorative rule: "━  1.  Meeting Purpose",
# so any leading box-drawing/dash glyphs are consumed before the section number.
SECTION_RE = re.compile(
    r"^[\s─-╿■-◿—–\-–—]*(\d+)\.\s{1,3}([A-Z][^\n]{2,90}?)\s*$"
)


@dataclass
class Section:
    number: str
    heading: str
    text: str


def parse_sections(lines: list[str]) -> list[Section]:
    idx: list[tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        m = SECTION_RE.match(line)
        if m:
            idx.append((i, m.group(1), m.group(2).strip()))
    out: list[Section] = []
    for n, (start, num, heading) in enumerate(idx):
        end = idx[n + 1][0] if n + 1 < len(idx) else len(lines)
        body = "\n".join(lines[start + 1: end]).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if body:
            out.append(Section(num, heading, body))
    return out


def parse_bullets(text: str) -> list[str]:
    """Key takeaways are bulleted with ● / • ; join their wrapped continuations."""
    items: list[str] = []
    cur: list[str] = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            continue
        if s.startswith(("●", "•", "○", "▪")):
            if cur:
                items.append(" ".join(cur).strip())
            cur = [s.lstrip("●•○▪ ").strip()]
        elif cur:
            cur.append(s)
    if cur:
        items.append(" ".join(cur).strip())
    return [re.sub(r"\s{2,}", " ", i) for i in items if len(i) > 12]


# Imperative verbs that begin an action item in these minutes.
ACTION_VERBS = (
    "execute|prepare|email|share|send|review|confirm|evaluate|circulate|provide|draft|"
    "schedule|conduct|coordinate|finalise|finalize|update|arrange|follow|reconcile|"
    "obtain|initiate|complete|submit|revert|present|deliver|set up|set-up|organise|"
    "organize|compile|validate|verify|check|explore|assess|identify|introduce|onboard|"
    "trim|switch|rebalance|redeem|invest|deploy|book|liquidate|hold|monitor|track|"
    "communicate|discuss|revisit|consider|request|collect|issue|process|action|allocate"
)
ACTION_START = re.compile(rf"^\s*(?:\d+[\).]?\s+)?({ACTION_VERBS})\b", re.I)
OWNER_HINT = re.compile(
    r"\((SMC|Shriram|Barclays|InCred|ICICI|Bajaj|360|Kotak|Founders|Wealth|Broking)"
    r"|Team\b|Office\)|Wealth\)|\bBroking\b|\bFamily Office\b",
    re.I,
)


@dataclass
class ParsedAction:
    id: str
    title: str
    owner: str
    target: str


def parse_actions(section_text: str, meeting_id: str) -> list[ParsedAction]:
    """
    Best-effort split of the flattened action table.

    An item begins at a line starting with an imperative verb (or a bare row number)
    and runs until the owner column starts — detected as a short line that looks like
    a name/organisation. Anything ambiguous stays in the raw text, which the UI shows
    alongside these, so nothing is lost if this mis-splits.
    """
    lines = [l.rstrip() for l in section_text.split("\n")]

    # DOCX tables survive extraction as pipe-delimited rows: "1 | Action text | Owner".
    # That is unambiguous, so it is handled first and exactly rather than heuristically.
    pipe_rows = [l for l in lines if l.count("|") >= 2 and l.strip()]
    if len(pipe_rows) >= 2:
        items: list[ParsedAction] = []
        for row in pipe_rows:
            cells = [c.strip() for c in row.split("|")]
            # Drop the header row
            if re.fullmatch(r"#?", cells[0], re.I) and re.match(r"action", cells[1], re.I):
                continue
            num, title, owner = "", "", ""
            if re.fullmatch(r"\d+", cells[0]):
                num, title = cells[0], cells[1]
                owner = cells[2] if len(cells) > 2 else ""
            else:
                title = cells[0]
                owner = cells[1] if len(cells) > 1 else ""
            title = re.sub(r"\s{2,}", " ", title).strip(" .;")
            if len(title) > 12:
                items.append(
                    ParsedAction(
                        id=f"{meeting_id}#a{len(items) + 1}",
                        title=title if len(title) < 400 else title[:397] + "…",
                        owner=re.sub(r"\s{2,}", " ", owner)[:120],
                        target="",
                    )
                )
        if items:
            return items

    # Skip the preamble and the table header row
    start = 0
    for i, l in enumerate(lines):
        if re.match(r"^\s*(#\s+)?Action Item\b", l, re.I):
            start = i + 1
            break
    body = [l for l in lines[start:] if l.strip()]

    items: list[ParsedAction] = []
    cur_title: list[str] = []
    cur_owner: list[str] = []
    in_owner = False

    def flush():
        nonlocal cur_title, cur_owner, in_owner
        title = re.sub(r"\s{2,}", " ", " ".join(cur_title)).strip(" .;")
        owner = re.sub(r"\s{2,}", " ", " ".join(cur_owner)).strip()
        if len(title) > 15:
            items.append(
                ParsedAction(
                    id=f"{meeting_id}#a{len(items) + 1}",
                    title=title if len(title) < 400 else title[:397] + "…",
                    owner=owner[:120],
                    target="",
                )
            )
        cur_title, cur_owner, in_owner = [], [], False

    for line in body:
        s = line.strip()
        if re.fullmatch(r"\d+", s):          # bare row number in numbered tables
            if cur_title:
                flush()
            continue
        starts_new = bool(ACTION_START.match(s))
        looks_owner = bool(OWNER_HINT.search(s)) and len(s) < 60

        if starts_new and cur_title and (in_owner or looks_owner is False and len(cur_owner) > 0):
            flush()
        if starts_new and not cur_title:
            cur_title = [s]
            continue
        if looks_owner and cur_title:
            in_owner = True
            cur_owner.append(s)
            continue
        if in_owner:
            # Short trailing fragment still belongs to the owner cell
            if len(s) < 45 and not starts_new:
                cur_owner.append(s)
                continue
            flush()
            cur_title = [s]
            continue
        cur_title.append(s)

    if cur_title:
        flush()
    return items


KIND_MAP = [
    (r"annual", "annual"),
    (r"pitch|product|proposal|exploration|presentation", "pitch"),
    (r"call|virtual", "call"),
    (r"review", "review"),
]


def guess_kind(meeting_type: str, title: str) -> str:
    blob = f"{meeting_type} {title}".lower()
    for pattern, kind in KIND_MAP:
        if re.search(pattern, blob):
            return kind
    return "review"


@dataclass
class ImportedMeeting:
    id: str
    advisor: str
    advisorKey: str
    date: str | None
    dateIsApproximate: bool
    title: str
    kind: str
    meetingType: str
    duration: str
    platform: str
    client: str
    attendees: list[str]
    circulatedTo: str
    preparedBy: str
    status: str
    followUp: str
    sourceFile: str
    purpose: str
    keyTakeaways: list[str]
    sections: list[dict]
    actionsRaw: str
    actions: list[dict]
    wordCount: int


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def import_file(path: Path) -> ImportedMeeting:
    raw = extract_text(path)
    lines = clean_lines(raw)
    text = "\n".join(lines)
    header = parse_header(lines)
    advisor, advisor_key = resolve_advisor(path.stem, "\n".join(lines[:25]))

    date = (
        parse_date(header.get("Meeting Date", ""))
        or parse_date(path.stem)
        or parse_date("\n".join(lines[:12]))
    )
    approx = bool(date and date.endswith("-01") and not re.search(r"\d{1,2},\s*\d{4}", header.get("Meeting Date", "")))

    sections = parse_sections(lines)
    by_heading = {s.heading.lower(): s for s in sections}

    def find(*keys: str) -> Section | None:
        for k in keys:
            for h, s in by_heading.items():
                if k in h:
                    return s
        return None

    purpose = find("meeting purpose", "purpose")
    takeaways = find("key takeaways", "key portfolio observations")
    attendees_sec = find("attendee")
    actions_sec = find("action item")

    # Title: the line above the "Advisor | Client" strapline, else the header type
    title = ""
    for l in lines[:12]:
        s = l.strip()
        if s and not s.lower().startswith(("minutes of meeting", "mom", "confidential")) and len(s) > 18:
            title = s
            break
    if not title:
        title = header.get("Meeting Type", path.stem.replace("_", " "))

    attendees: list[str] = []
    if attendees_sec:
        NOISE = ("minutes of meeting", "confidential", "not for circulation", "page ")
        for line in attendees_sec.text.split("\n"):
            row = re.sub(r"\s{2,}", " ", line.strip())
            low = row.lower()
            if not row or len(row) < 3:
                continue
            if low.startswith(("name ", "#")) or any(n in low for n in NOISE):
                continue
            # The organisation column wraps, leaving orphan fragments like "Fund" —
            # fold those onto the row above rather than listing them as separate people.
            if attendees and (len(row) < 16 or row[:1].islower()):
                attendees[-1] = f"{attendees[-1]} {row}"
                continue
            attendees.append(row)
    for k in ("Represented By", "SMC Representatives"):
        if header.get(k):
            attendees.append(header[k])

    meeting_id = f"mom_{slug(path.stem)}"

    # Some documents (the DOCX) head their action table with a bare "Action Items"
    # line that carries no section number, so it never becomes a Section. Fall back to
    # scanning the raw text rather than losing the commitments entirely.
    actions_text = actions_sec.text if actions_sec else ""
    if not actions_text:
        for i, l in enumerate(lines):
            if re.fullmatch(r"\s*action items?\s*:?\s*", l, re.I):
                actions_text = "\n".join(lines[i + 1:]).strip()
                break
    parsed_actions = parse_actions(actions_text, meeting_id) if actions_text else []

    return ImportedMeeting(
        id=meeting_id,
        advisor=advisor,
        advisorKey=advisor_key,
        date=date,
        dateIsApproximate=approx,
        title=re.sub(r"\s{2,}", " ", title)[:160],
        kind=guess_kind(header.get("Meeting Type", ""), title),
        meetingType=header.get("Meeting Type", ""),
        duration=header.get("Duration", ""),
        platform=header.get("Platform", header.get("Format", header.get("Meeting Format", ""))),
        client=header.get("Client", header.get("Client / Initiating", "")),
        attendees=attendees[:14],
        circulatedTo=header.get("Circulated To", ""),
        preparedBy=header.get("Prepared By", ""),
        status=header.get("Status", ""),
        followUp=header.get("Follow-up Date", ""),
        sourceFile=path.name,
        purpose=purpose.text[:2000] if purpose else "",
        keyTakeaways=parse_bullets(takeaways.text) if takeaways else [],
        sections=[asdict(s) for s in sections],
        actionsRaw=actions_text,
        actions=[asdict(a) for a in parsed_actions],
        wordCount=len(text.split()),
    )


def main() -> int:
    if not MINUTES_DIR.exists():
        sys.exit(f"Folder not found: {MINUTES_DIR}")

    files = sorted(
        p for p in MINUTES_DIR.iterdir()
        if p.suffix.lower() in {".pdf", ".docx"} and not p.name.startswith("~$")
    )
    if not files:
        sys.exit(f"No PDF/DOCX files in {MINUTES_DIR}")

    meetings: list[ImportedMeeting] = []
    print(f"Reading {len(files)} documents from {MINUTES_DIR.name}/\n")
    for f in files:
        m = import_file(f)
        meetings.append(m)
        flag = " (date approximate)" if m.dateIsApproximate else ""
        print(
            f"  {m.advisor:<22} {m.date or '????-??-??'}{flag:<18} "
            f"{len(m.sections):>2} sections  {len(m.keyTakeaways):>2} takeaways  "
            f"{len(m.actions):>2} actions   {m.sourceFile}"
        )

    meetings.sort(key=lambda m: (m.date or "0000"), reverse=True)

    advisors = []
    for m in meetings:
        if not any(a["key"] == m.advisorKey for a in advisors):
            advisors.append({"key": m.advisorKey, "name": m.advisor})
    for a in advisors:
        a["meetingCount"] = sum(1 for m in meetings if m.advisorKey == a["key"])
        a["actionCount"] = sum(len(m.actions) for m in meetings if m.advisorKey == a["key"])
    advisors.sort(key=lambda a: (-a["meetingCount"], a["name"]))

    payload = {
        "source": MINUTES_DIR.name,
        "generatedFrom": "scripts/import_minutes.py",
        "generatedAt": datetime.now().strftime("%Y-%m-%d"),
        "advisors": advisors,
        "meetings": [asdict(m) for m in meetings],
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = DATA_DIR / "meetings-snapshot.json"
    out.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = [
        f"Minutes import — {payload['generatedAt']}",
        f"Source: {MINUTES_DIR}",
        "",
        f"{len(meetings)} meetings across {len(advisors)} advisors",
        "",
    ]
    for a in advisors:
        report.append(f"  {a['name']:<24} {a['meetingCount']} meetings, {a['actionCount']} actions")
    report.append("")
    report.append("PER MEETING")
    for m in meetings:
        report.append(
            f"  {m.date} {m.advisor:<22} sections={len(m.sections):<3} "
            f"takeaways={len(m.keyTakeaways):<3} actions={len(m.actions):<3} words={m.wordCount:<6} {m.sourceFile}"
        )
        if not m.actions and m.actionsRaw:
            report.append("      !! action section found but nothing parsed — raw text retained")
        if not m.actionsRaw:
            report.append("      -- no action-items section in this document")
    (OUT_DIR / "minutes-import.txt").write_text("\n".join(report), encoding="utf-8")

    print(f"\n{len(meetings)} meetings, {len(advisors)} advisors, "
          f"{sum(len(m.actions) for m in meetings)} actions parsed")
    print(f"Wrote {out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.0f} KB)")
    print(f"Wrote {(OUT_DIR / 'minutes-import.txt').relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
