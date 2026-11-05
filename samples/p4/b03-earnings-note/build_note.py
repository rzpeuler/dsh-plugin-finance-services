"""Build the B03 earnings note (DOCX, TEST_ONLY, creator-side).

All figures are synthetic. Every variance is computed here, never typed twice.
"""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Cm, RGBColor

OUT = Path(__file__).parent / "B03_EARNINGS_NOTE_TEST_ONLY.docx"

TICKER, PERIOD, ASOF = "TOY", "FY2025Q3 (quarter ended 2025-09-30)", "2025-11-04"
D = Decimal


def money(value, places=1):
    q = D(value).quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return f"{q:,.{places}f}"


def pct(value, places=1):
    q = (D(value) * 100).quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return f"{q:.{places}f}%"


def delta_pct(actual, reference):
    return (D(actual) - D(reference)) / D(reference)


# ---------------------------------------------------------------- inputs
actual = {"revenue": D("1050"), "ebitda": D("210"), "eps": D("1.10")}
consensus = {"revenue": D("1030"), "ebitda": D("205"), "eps": D("1.05")}
prior = {"revenue": D("1020"), "ebitda": D("198"), "eps": D("0.98")}
for src in (actual, consensus, prior):
    src["margin"] = src["ebitda"] / src["revenue"]

prior_fy = {"revenue": D("1140"), "ebitda": D("228"), "eps": D("1.55")}
new_fy = {"revenue": D("1170"), "ebitda": D("238"), "eps": D("1.62")}

doc = Document()
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)
for section in doc.sections:
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)


def heading(text, level=1):
    h = doc.add_heading(text, level=level)
    return h


def note(text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.italic = True
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(0x59, 0x59, 0x59)
    return p


def table(rows, widths=None):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = t.cell(r, c)
            cell.text = str(value)
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(9)
                    if r == 0:
                        run.bold = True
            if c > 0:
                cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    if widths:
        for c, width in enumerate(widths):
            for row in t.rows:
                row.cells[c].width = Cm(width)
    return t


# ---------------------------------------------------------------- title block
title = doc.add_heading(f"{TICKER} — FY2025Q3 earnings review", level=0)
subtitle = doc.add_paragraph()
run = subtitle.add_run("DRAFT — TEST_ONLY synthetic data — creator-side sample, not an Agent delivery")
run.bold = True
run.font.size = Pt(9)

meta = [
    ("Ticker / period", f"{TICKER} / {PERIOD}"),
    ("As of", ASOF),
    ("Business", "finance-earnings-reviewer (transcript-reader → model-updater → note-writer)"),
    ("Classification", "TEST_ONLY; no FactSet/Daloopa or other licensed data was used"),
    ("Status", "DRAFT / REVIEW_REQUIRED — no P5 approval gate exists yet"),
]
for key, value in meta:
    p = doc.add_paragraph()
    p.add_run(f"{key}: ").bold = True
    p.add_run(value)

# ---------------------------------------------------------------- 1. quarter at a glance
heading("1. Quarter at a glance", 1)
rows = [["USD m except EPS", "Actual", "Consensus", "Δ vs consensus", "Prior model", "Δ vs prior"]]
for label, key in (("Revenue", "revenue"), ("EBITDA", "ebitda"), ("EBITDA margin", "margin"), ("EPS (USD)", "eps")):
    if key == "margin":
        a, c, p = actual[key], consensus[key], prior[key]
        rows.append([label, pct(a), pct(c), f"{(a - c) * 10000:+.0f} bp".replace("-", "−"),
                     pct(p), f"{(a - p) * 10000:+.0f} bp".replace("-", "−")])
    else:
        a, c, p = actual[key], consensus[key], prior[key]
        fmt = (lambda v: f"{v:,.2f}") if key == "eps" else money
        rows.append([label, fmt(a), fmt(c), f"{delta_pct(a, c) * 100:+.1f}%".replace("-", "−"),
                     fmt(p), f"{delta_pct(a, p) * 100:+.1f}%".replace("-", "−")])
table(rows, widths=[3.6, 2.3, 2.3, 3.0, 2.6, 2.6])
note("Margin variance is shown in basis points; all other variances are percent of the reference figure. "
     "Consensus and prior-model values are synthetic TEST_ONLY references, not vendor estimates.")

# ---------------------------------------------------------------- 2. transcript read
heading("2. What management said", 1)
for text in [
    "Demand commentary: the synthetic transcript describes volume growth in the core segment offset by pricing pressure in the "
    "value tier; management did not quantify the split.",
    "Guidance language: full-year revenue guidance was raised to USD 4,150–4,200m and EBITDA margin guidance to 19.5–20.0%, "
    "with the caveat that input costs remain volatile.",
    "Capital allocation: no change to the synthetic buyback authorisation; no dividend change was discussed.",
]:
    doc.add_paragraph(text, style="List Bullet")
note("These are TEST_ONLY paraphrases written for this sample. They are not a real transcript and must not be cited as "
     "management commentary.")

# ---------------------------------------------------------------- 3. guidance
heading("3. Guidance and revisions", 1)
rows = [["Guidance item", "Prior", "New", "Direction"],
        ["FY2025 revenue (USD m)", "4,050–4,100", "4,150–4,200", "Raised"],
        ["FY2025 EBITDA margin", "19.0–19.5%", "19.5–20.0%", "Raised"],
        ["FY2026 revenue growth (implied)", "6.0%", "6.8%", "Raised"]]
table(rows, widths=[6.2, 3.4, 3.4, 2.8])

# ---------------------------------------------------------------- 4. model update
heading("4. Model update — FY2026E", 1)
rows = [["Line", "Prior", "New", "Δ"]]
for label, key, places in (("Revenue (USD m)", "revenue", 1), ("EBITDA (USD m)", "ebitda", 1),
                           ("EBITDA margin", None, 1), ("EPS (USD)", "eps", 2)):
    if key is None:
        a = prior_fy["ebitda"] / prior_fy["revenue"]
        b = new_fy["ebitda"] / new_fy["revenue"]
        rows.append([label, pct(a), pct(b), f"{(b - a) * 100:+.0f} bp".replace("-", "−")])
        continue
    fmt = (lambda v: f"{v:,.2f}") if places == 2 else money
    rows.append([label, fmt(prior_fy[key]), fmt(new_fy[key]),
                 f"{delta_pct(new_fy[key], prior_fy[key]) * 100:+.1f}%".replace("-", "−")])
table(rows, widths=[5.6, 3.0, 3.0, 3.0])
note("The percentage changes are computed from the two model states above; they are not copied from a vendor "
     "estimate-revision feed.")

# ---------------------------------------------------------------- 5. thesis and risks
heading("5. Thesis and what would change it", 1)
doc.add_paragraph("The synthetic case rests on three claims, each of which needs independent evidence before any "
                  "recommendation:", style="List Bullet")
for text in [
    "Volume growth in the core segment persists through the next two reported quarters.",
    "Pricing pressure in the value tier stays contained within the guided margin range.",
    "Working-capital intensity does not absorb the incremental EBITDA (see the B05 DCF for the ΔNWC assumption).",
]:
    p = doc.add_paragraph(text)
    p.paragraph_format.left_indent = Cm(0.8)
    p.style = doc.styles["List Bullet 2"]
heading("Risks", 2)
for text in [
    "Guidance revision could be a pull-forward rather than a level change — not evidenced in this sample.",
    "Input-cost volatility is explicitly management-flagged; no sensitivity is quantified here.",
    "The consensus and prior-model references are synthetic, so the variance is illustrative only.",
]:
    doc.add_paragraph(text, style="List Bullet")

# ---------------------------------------------------------------- 6. sources
heading("6. Sources, scope and limitations", 1)
rows = [["Item", "Status"],
        ["Actuals, consensus, prior model, guidance, transcript", "TEST_ONLY synthetic values authored for this sample"],
        ["Licensed data (FactSet, Daloopa)", "NOT_USED — no entitlement exists for this environment"],
        ["Original coverage workbook", "NOT_PRESENT — this note does not update a real workbook"],
        ["Worker execution", "NOT_RUN — no transcript-reader/model-updater/note-writer Session executed"],
        ["Review gate", "NOT_IMPLEMENTED (P5); this document is a draft"],
        ["Visual delivery", "NOT_INSPECTED — structure and text are machine-checked only"]]
table(rows, widths=[7.0, 9.0])

doc.save(OUT)
print(f"wrote {OUT} with {len(doc.paragraphs)} paragraphs and {len(doc.tables)} tables")
