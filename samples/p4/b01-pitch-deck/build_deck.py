"""Build the B01 pitch deck (PPTX, TEST_ONLY, creator-side).

Valuation figures are read from the verified B05 workbook, so the deck cannot
drift from the model it references.
"""
from pathlib import Path

from openpyxl import load_workbook
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

HERE = Path(__file__).parent
OUT = HERE / "B01_PITCH_DECK_TEST_ONLY.pptx"
WORKBOOK = HERE.parent / "b05-dcf" / "B05_DCF_TEST_ONLY.xlsx"
NAVY = RGBColor(0x17, 0x35, 0x4D)
GREY = RGBColor(0x59, 0x59, 0x59)
LIGHT = RGBColor(0xDC, 0xE6, 0xF1)

if not WORKBOOK.exists():
    raise SystemExit(f"missing verified workbook: {WORKBOOK}")
values = load_workbook(WORKBOOK, data_only=True)

dcf = values["DCF"]
summary = {
    "enterprise_value": dcf["B32"].value,
    "net_debt": -dcf["B33"].value,
    "equity_value": dcf["B34"].value,
    "shares": dcf["B35"].value,
    "per_share": dcf["B36"].value,
    "wacc": dcf["B24"].value,
    "terminal_growth": dcf["B23"].value,
    "fcf": [dcf[f"{c}15"].value for c in "CDEFG"],
}

sens = values["Sensitivity"]
label_row = next(r for r in range(1, 60) if sens[f"A{r}"].value == "Base factor K (base margin)")
header_row = label_row + 1
grid_rows = list(range(header_row + 1, header_row + 6))
g_values = [sens[f"{c}{header_row}"].value for c in "BCDEF"]
wacc_values = [sens[f"A{r}"].value for r in grid_rows]
grid = [[sens[f"{c}{r}"].value for c in "BCDEF"] for r in grid_rows]

if any(v is None for row in grid for v in row):
    raise SystemExit("sensitivity grid is not fully calculated; recalculate the workbook first")

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
BLANK = prs.slide_layouts[5]


def slide(title, kicker=None):
    s = prs.slides.add_slide(BLANK)
    s.shapes.title.text = title
    s.shapes.title.text_frame.paragraphs[0].font.size = Pt(30)
    s.shapes.title.text_frame.paragraphs[0].font.color.rgb = NAVY
    s.shapes.title.text_frame.paragraphs[0].font.bold = True
    s.shapes.title.top = Inches(0.45)
    s.shapes.title.left = Inches(0.7)
    s.shapes.title.width = Inches(11.9)
    s.shapes.title.height = Inches(1.0)
    if kicker:
        box = s.shapes.add_textbox(Inches(0.7), Inches(1.35), Inches(11.9), Inches(0.4))
        p = box.text_frame.paragraphs[0]
        p.text = kicker
        p.font.size = Pt(12)
        p.font.color.rgb = GREY
        p.font.italic = True
    return s


def bullets(s, items, left=0.8, top=1.9, width=11.7, size=16):
    box = s.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(4.6))
    tf = box.text_frame
    tf.word_wrap = True
    for index, item in enumerate(items):
        p = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        p.text = item
        p.font.size = Pt(size)
        p.space_after = Pt(10)
        p.level = 0


def table(s, rows, left=0.8, top=2.0, width=11.7, height=None, size=12, first_col_bold=True):
    shape = s.shapes.add_table(len(rows), len(rows[0]), Inches(left), Inches(top), Inches(width),
                               Inches(height if height else 0.4 * len(rows)))
    t = shape.table
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = t.cell(r, c)
            cell.text = str(value)
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(size)
                if r == 0:
                    p.font.bold = True
                    p.font.color.rgb = NAVY
            if r > 0 and first_col_bold and c == 0:
                for p in cell.text_frame.paragraphs:
                    p.font.bold = True
    for r in range(len(rows)):
        for c in range(len(rows[0])):
            fill = LIGHT if r == 0 else RGBColor(0xFF, 0xFF, 0xFF)
            t.cell(r, c).fill.solid()
            t.cell(r, c).fill.fore_color.rgb = fill
    return t


def money(v, places=1):
    return f"{v:,.{places}f}"


def pct(v, places=2):
    return f"{v * 100:.{places}f}%"


# 1 ---------------------------------------------------------------- title
s = prs.slides.add_slide(prs.slide_layouts[6])
band = s.shapes.add_textbox(Inches(0.9), Inches(2.2), Inches(11.5), Inches(2.6))
tf = band.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "TOY Corp"
p.font.size = Pt(54)
p.font.bold = True
p.font.color.rgb = NAVY
p2 = tf.add_paragraph()
p2.text = "Preliminary valuation discussion"
p2.font.size = Pt(28)
p2.font.color.rgb = GREY
p3 = tf.add_paragraph()
p3.text = "DRAFT — TEST_ONLY synthetic data — creator-side sample, not an Agent delivery"
p3.font.size = Pt(13)
p3.font.color.rgb = RGBColor(0xA6, 0x1B, 0x1B)
p3.font.bold = True

# 2 ---------------------------------------------------------------- situation
s = slide("Situation and why now", "Illustrative framing for a synthetic target; not based on a real mandate")
bullets(s, [
    "The synthetic premise is a scale-up weighing strategic alternatives, with no process underway.",
    "Reported growth has been driven by core-segment volume; value-tier pricing is the pressure point.",
    "Management has raised full-year guidance twice in the synthetic history, which frames the question of whether growth is structural or pulled forward.",
    "This sample only carries the valuation leg: no comps, precedents or LBO are included.",
])

# 3 ---------------------------------------------------------------- snapshot
s = slide("Business snapshot", "Synthetic FY2024A base year, USD millions")
rows = [["Metric", "Value", "Note"],
        ["Revenue", "1,000.0", "FY2024A actual (synthetic)"],
        ["EBITDA margin", "20.0%", "Base-case assumption"],
        ["D&A", "4.0% of revenue", "Base-case assumption"],
        ["Capex", "5.0% of revenue", "Base-case assumption"],
        ["ΔNWC", "2.0% of revenue change", "Applied to incremental revenue"],
        ["Net debt", "150.0", "Deducted from enterprise value"],
        ["Diluted shares", "100.0", "Per-share denominator"]]
table(s, rows, top=2.0, size=13)

# 4 ---------------------------------------------------------------- DCF summary
s = slide("Valuation — DCF summary", "Figures read directly from the verified B05 workbook")
rows = [["Line", "USD m / per share"],
        ["Enterprise value", money(summary["enterprise_value"])],
        ["Less: net debt", money(summary["net_debt"])],
        ["Equity value", money(summary["equity_value"])],
        ["Diluted shares (m)", money(summary["shares"])],
        ["Value per share (USD)", money(summary["per_share"], 2)],
        ["WACC", pct(summary["wacc"])],
        ["Terminal growth", pct(summary["terminal_growth"])]]
table(s, rows, left=0.8, top=1.95, width=6.4, size=13)
box = s.shapes.add_textbox(Inches(7.6), Inches(2.0), Inches(5.0), Inches(3.6))
tf = box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Forecast free cash flow (USD m)"
p.font.size = Pt(14)
p.font.bold = True
p.font.color.rgb = NAVY
for i, flow in enumerate(summary["fcf"]):
    line = tf.add_paragraph()
    line.text = f"FY{2025 + i}E: {money(flow)}"
    line.font.size = Pt(14)
tail = tf.add_paragraph()
tail.text = "Year-end discounting; Gordon terminal value; no mid-year convention."
tail.font.size = Pt(11)
tail.font.italic = True
tail.font.color.rgb = GREY

# 5 ---------------------------------------------------------------- sensitivity
s = slide("Sensitivity — value per share", "WACC (rows) × terminal growth (columns); centre equals the DCF value")
rows = [["WACC \\ g"] + [pct(g, 2) for g in g_values]]
for wacc, row in zip(wacc_values, grid):
    rows.append([pct(wacc, 2)] + [f"{v:,.2f}" for v in row])
table(s, rows, left=0.9, top=2.0, width=11.4, height=0.46 * len(rows), size=12)

# 6 ---------------------------------------------------------------- risks
s = slide("Key risks and diligence items", "What would change the conclusion")
bullets(s, [
    "Guidance quality: confirm whether the raise reflects a level change or a pull-forward.",
    "Pricing: quantify value-tier exposure; management flagged input-cost volatility but sized nothing.",
    "Working capital: the ΔNWC assumption is a straight percentage of revenue change, not a days-based build.",
    "Terminal value: 2.0% growth drives a large share of enterprise value; test the WACC–g boundary.",
    "Missing evidence: no comps, no precedent transactions, no LBO, no three-statement model.",
])

# 7 ---------------------------------------------------------------- sources
s = slide("Sources, scope and limitations")
bullets(s, [
    "Data: TEST_ONLY synthetic inputs; no licensed vendor data, no FactSet or Daloopa entitlement.",
    "Model: B05 DCF workbook (direct dcf-model method), LibreOffice-recalculated and cross-checked "
    "against an independent Decimal baseline.",
    "Execution: creator-side sample; no Agent or Worker ran, no model turn produced these figures.",
    "Review: no P5 gate exists; this deck is a draft and must not be distributed.",
    "Visual: layout was not rendered or inspected; text and numbers are machine-verified.",
], size=15)

prs.save(OUT)
print(f"wrote {OUT} with {len(prs.slides)} slides")
