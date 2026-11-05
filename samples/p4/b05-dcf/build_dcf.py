"""Build the B05 DCF sample workbook (TEST_ONLY, creator-side).

Synthetic inputs, live formulas, explicit scenario selector, three 5x5
sensitivity grids. Recalculation and verification happen in separate steps.
"""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).with_name("build") / "B05_DCF_TEST_ONLY_uncalculated.xlsx"
BLUE, GREEN = "0000FF", "008000"
b_in = Font(name="Calibri", size=10, color=BLUE)
b_formula = Font(name="Calibri", size=10, color="000000")
b_link = Font(name="Calibri", size=10, color=GREEN)
b_head = Font(name="Calibri", size=10, bold=True)
b_title = Font(name="Calibri", size=14, bold=True)
b_note = Font(name="Calibri", size=9, italic=True, color="595959")
fill_head = PatternFill("solid", fgColor="DCE6F1")
fill_grid = PatternFill("solid", fgColor="F2F2F2")
thin = Side(style="thin", color="BFBFBF")
box = Border(left=thin, right=thin, top=thin, bottom=thin)
MONEY, PCT, PS = '#,##0.0;(#,##0.0)', '0.0%', '0.00'


def put(ws, ref, value, font=None, fmt=None, fill=None, align=None, border=False):
    cell = ws[ref]
    cell.value = value
    if font is not None:
        cell.font = font
    if fmt is not None and not isinstance(fmt, str):
        fill, fmt = fmt, None
    if fmt:
        cell.number_format = fmt
    if fill:
        cell.fill = fill
    if align:
        cell.alignment = Alignment(horizontal=align)
    if border:
        cell.border = box
    return cell


def head(ws, ref, text):
    return put(ws, ref, text, font=b_head, fill=fill_head)


def label(ws, ref, text, font=b_formula):
    return put(ws, ref, text, font=font)


wb = Workbook()

# ------------------------------------------------------------------ Cover
ws = wb.active
ws.title = "Cover"
ws.column_dimensions["A"].width = 26
ws.column_dimensions["B"].width = 100
put(ws, "A1", "B05 — DCF valuation workbook", b_title)
cover = [
    ("Classification", "TEST_ONLY — synthetic inputs; not commercial data"),
    ("Prepared", "Creator-side P4 capability sample; NOT an Agent-driven delivery and NOT reviewed"),
    ("Business", "finance-model-builder / dcf-model method (direct Skill method, not the comps-first /dcf command)"),
    ("Entity", "TOY Corp (fictional)"),
    ("Currency / units", "USD millions unless stated; per-share values in USD"),
    ("asOf", "2025-01-31"),
    ("Valuation date", "FY2024A actuals; five forecast years FY2025E–FY2029E; year-end discounting"),
    ("Sheet guide", "Inputs (blue = hard-coded) → WACC → DCF → Sensitivity (3 grids × 25 live cells) → Checks"),
    ("Colour convention", "Blue = input, black = formula within the sheet, green = link to another sheet"),
    ("Limitations", "No comps/precedents, no LBO, no three-statement model, no scenario-specific WACC inside the grids, "
                    "no P5 review gate, no source licensing. Bear/Base/Bull change growth, margin, beta and terminal growth only."),
    ("Missing upstream assets", "LBO/comps/Nike binary templates are MISSING_SOURCE_ASSET in the preserved archive; this workbook never claims to restore them."),
]
for index, (key, value) in enumerate(cover, start=3):
    label(ws, f"A{index}", key, b_head)
    put(ws, f"B{index}", value, font=b_formula).alignment = Alignment(wrap_text=True, vertical="top")

# ------------------------------------------------------------------ Inputs
ws = wb.create_sheet("Inputs")
ws.column_dimensions["A"].width = 46
for col in "BCDE":
    ws.column_dimensions[col].width = 14
put(ws, "A1", "Inputs — blue figures are hard-coded", b_title)
head(ws, "A3", "Operating inputs")
ops = [("Revenue FY2024A (USD m)", 1000.0, MONEY), ("EBITDA margin FY2024A", 0.20, PCT),
       ("D&A % of revenue", 0.04, PCT), ("Capex % of revenue", 0.05, PCT),
       ("Change in NWC % of revenue change", 0.02, PCT), ("Tax rate", 0.25, PCT),
       ("Net debt (USD m)", 150.0, MONEY), ("Diluted shares (m)", 100.0, '#,##0.0')]
for offset, (text, value, fmt) in enumerate(ops):
    row = 4 + offset
    label(ws, f"A{row}", text)
    put(ws, f"B{row}", value, b_in, fmt, border=True)

head(ws, "A13", "Market inputs")
market = [("Risk-free rate", 0.04, PCT), ("Equity risk premium", 0.05, PCT),
          ("Pre-tax cost of debt", 0.05, PCT), ("Debt / total capital", 0.30, PCT)]
for offset, (text, value, fmt) in enumerate(market):
    row = 14 + offset
    label(ws, f"A{row}", text)
    put(ws, f"B{row}", value, b_in, fmt, border=True)

head(ws, "A19", "Scenario assumptions")
for col, text in zip("ABCDE", ["Scenario", "Revenue growth", "EBITDA margin", "Beta", "Terminal growth"]):
    put(ws, f"{col}20", text, b_head, fill=fill_head, align="center", border=True)
scenarios = [("Bear", 0.03, 0.18, 1.30, 0.015), ("Base", 0.06, 0.20, 1.10, 0.020),
             ("Bull", 0.09, 0.22, 0.90, 0.025)]
for offset, row in enumerate(scenarios):
    r = 21 + offset
    put(ws, f"A{r}", row[0], b_in, border=True)
    for col, value in zip("BCDE", row[1:]):
        put(ws, f"{col}{r}", value, b_in, '0.00' if col == "D" else PCT, border=True)

label(ws, "A25", "Active scenario (1 = Bear, 2 = Base, 3 = Bull)", b_head)
put(ws, "B25", 2, b_in, '0', border=True)
dv = DataValidation(type="list", formula1='"1,2,3"', allow_blank=False)
ws.add_data_validation(dv)
dv.add(ws["B25"])

head(ws, "A27", "Active assumptions — formulas")
active = [("Scenario name", "=CHOOSE($B$25,$A$21,$A$22,$A$23)", None),
          ("Revenue growth", "=CHOOSE($B$25,$B$21,$B$22,$B$23)", PCT),
          ("EBITDA margin", "=CHOOSE($B$25,$C$21,$C$22,$C$23)", PCT),
          ("Beta", "=CHOOSE($B$25,$D$21,$D$22,$D$23)", '0.00'),
          ("Terminal growth", "=CHOOSE($B$25,$E$21,$E$22,$E$23)", PCT)]
for offset, (text, formula, fmt) in enumerate(active):
    r = 28 + offset
    label(ws, f"A{r}", text)
    put(ws, f"B{r}", formula, b_formula, fmt, fill_grid, border=True)

# ------------------------------------------------------------------ WACC
ws = wb.create_sheet("WACC")
ws.column_dimensions["A"].width = 40
ws.column_dimensions["B"].width = 14
put(ws, "A1", "WACC — CAPM for the active scenario", b_title)
head(ws, "A3", "Cost of equity")
label(ws, "A4", "Risk-free rate")
put(ws, "B4", "=Inputs!B14", b_link, PCT, fill_grid, border=True)
label(ws, "A5", "Beta")
put(ws, "B5", "=Inputs!B31", b_link, '0.00', fill_grid, border=True)
label(ws, "A6", "Equity risk premium")
put(ws, "B6", "=Inputs!B15", b_link, PCT, fill_grid, border=True)
label(ws, "A7", "Cost of equity")
put(ws, "B7", "=B4+B5*B6", b_formula, PCT, fill_grid, border=True)

head(ws, "A9", "Cost of debt")
label(ws, "A10", "Pre-tax cost of debt")
put(ws, "B10", "=Inputs!B16", b_link, PCT, fill_grid, border=True)
label(ws, "A11", "Tax rate")
put(ws, "B11", "=Inputs!B9", b_link, PCT, fill_grid, border=True)
label(ws, "A12", "After-tax cost of debt")
put(ws, "B12", "=B10*(1-B11)", b_formula, PCT, fill_grid, border=True)

head(ws, "A14", "Capital structure")
label(ws, "A15", "Debt / total capital")
put(ws, "B15", "=Inputs!B17", b_link, PCT, fill_grid, border=True)
label(ws, "A16", "Equity / total capital")
put(ws, "B16", "=1-B15", b_formula, PCT, fill_grid, border=True)

head(ws, "A18", "WACC")
label(ws, "A19", "WACC (active scenario)")
put(ws, "B19", "=B16*B7+B15*B12", b_formula, PCT, fill_grid, border=True)

# ------------------------------------------------------------------ DCF
ws = wb.create_sheet("DCF")
ws.column_dimensions["A"].width = 40
for col in "BCDEFG":
    ws.column_dimensions[col].width = 13
put(ws, "A1", "DCF — five-year explicit forecast with Gordon terminal value", b_title)
put(ws, "A3", "USD millions", b_head, fill=fill_head)
for col, text in zip("BCDEFG", ["FY2024A", "FY2025E", "FY2026E", "FY2027E", "FY2028E", "FY2029E"]):
    put(ws, f"{col}3", text, b_head, fill=fill_head, align="center", border=True)
cols = ["B", "C", "D", "E", "F", "G"]

label(ws, "A4", "Revenue")
put(ws, "B4", "=Inputs!B4", b_link, MONEY, fill_grid, border=True)
for i in range(1, 6):
    put(ws, f"{cols[i]}4", f"={cols[i-1]}4*(1+Inputs!$B$29)", b_formula, MONEY, border=True)
label(ws, "A5", "Revenue growth")
for i in range(1, 6):
    put(ws, f"{cols[i]}5", f"={cols[i]}4/{cols[i-1]}4-1", b_formula, PCT, border=True)

label(ws, "A6", "EBITDA")
label(ws, "A7", "EBITDA margin")
for i in range(1, 6):
    c = cols[i]
    put(ws, f"{c}6", f"={c}4*Inputs!$B$30", b_formula, MONEY, border=True)
    put(ws, f"{c}7", f"={c}6/{c}4", b_formula, PCT, border=True)

for row, text in [(8, "D&A"), (9, "EBIT"), (10, "Tax on EBIT"), (11, "NOPAT")]:
    label(ws, f"A{row}", text)
for i in range(1, 6):
    c = cols[i]
    put(ws, f"{c}8", f"={c}4*Inputs!$B$6", b_formula, MONEY, border=True)
    put(ws, f"{c}9", f"={c}6-{c}8", b_formula, MONEY, border=True)
    put(ws, f"{c}10", f"=-{c}9*Inputs!$B$9", b_formula, MONEY, border=True)
    put(ws, f"{c}11", f"={c}9+{c}10", b_formula, MONEY, border=True)

for row, text in [(12, "D&A add-back"), (13, "Capex"), (14, "Change in NWC"), (15, "Free cash flow")]:
    label(ws, f"A{row}", text, b_head if row == 15 else b_formula)
for i in range(1, 6):
    c, p = cols[i], cols[i - 1]
    put(ws, f"{c}12", f"={c}8", b_formula, MONEY, border=True)
    put(ws, f"{c}13", f"=-{c}4*Inputs!$B$7", b_formula, MONEY, border=True)
    put(ws, f"{c}14", f"=-({c}4-{p}4)*Inputs!$B$8", b_formula, MONEY, border=True)
    put(ws, f"{c}15", f"={c}11+{c}12+{c}13+{c}14", Font(name="Calibri", size=10, bold=True), MONEY, border=True)

head(ws, "A17", "Discounting")
label(ws, "A18", "Period (years)")
label(ws, "A19", "Discount factor")
label(ws, "A20", "PV of free cash flow")
for i in range(1, 6):
    c = cols[i]
    put(ws, f"{c}18", i, b_formula, '0', border=True)
    put(ws, f"{c}19", f"=1/(1+WACC!$B$19)^{c}18", b_formula, '0.000', border=True)
    put(ws, f"{c}20", f"={c}15*{c}19", b_formula, MONEY, border=True)

head(ws, "A22", "Terminal value")
label(ws, "A23", "Terminal growth (g)")
put(ws, "B23", "=Inputs!B32", b_link, PCT, fill_grid, border=True)
label(ws, "A24", "WACC")
put(ws, "B24", "=WACC!B19", b_link, PCT, fill_grid, border=True)
label(ws, "A25", "Terminal-year FCF (FY2030E)")
put(ws, "B25", "=G15*(1+B23)", b_formula, MONEY, fill_grid, border=True)
label(ws, "A26", "Terminal value (Gordon)")
put(ws, "B26", '=IF(B24>B23,B25/(B24-B23),"n/a")', b_formula, MONEY, fill_grid, border=True)
label(ws, "A27", "PV of terminal value")
put(ws, "B27", "=B26*G19", b_formula, MONEY, fill_grid, border=True)

head(ws, "A29", "Valuation bridge")
bridge = [("Sum of PV of free cash flow", "=SUM(C20:G20)", MONEY, b_formula),
          ("PV of terminal value", "=B27", MONEY, b_formula),
          ("Enterprise value", "=B30+B31", MONEY, b_head),
          ("Less: net debt", "=-Inputs!B10", MONEY, b_formula),
          ("Equity value", "=B32+B33", MONEY, b_head),
          ("Diluted shares (m)", "=Inputs!B11", '#,##0.0', b_formula),
          ("Value per share (USD)", "=B34/B35", PS, b_head)]
for offset, (text, formula, fmt, font) in enumerate(bridge):
    r = 30 + offset
    label(ws, f"A{r}", text, font)
    cell = put(ws, f"B{r}", formula, font, fmt, border=True)
    if offset == 6:
        cell.fill = PatternFill("solid", fgColor="FFF2CC")

head(ws, "A38", "Model checks")
checks = [("Five forecast years discounted", '=IF(COUNT(C20:G20)=5,"OK","FAIL")'),
          ("Terminal growth below WACC", '=IF(B23<B24,"OK","FAIL")'),
          ("No negative FCF in the forecast", '=IF(MIN(C15:G15)>0,"OK","FAIL")'),
          ("Value per share positive", '=IF(B36>0,"OK","FAIL")')]
for offset, (text, formula) in enumerate(checks):
    r = 39 + offset
    label(ws, f"A{r}", text)
    put(ws, f"B{r}", formula, b_formula, fill=fill_grid, border=True)

# ------------------------------------------------------------------ Sensitivity
ws = wb.create_sheet("Sensitivity")
ws.column_dimensions["A"].width = 30
for col in "BCDEFGH":
    ws.column_dimensions[col].width = 13
put(ws, "A1", "Sensitivity — live closed-form grids tied to the DCF", b_title)
note = put(ws, "A2", "Each grid is a 5×5 live formula block; the centre cell of each grid must equal DCF!B36. "
                     "The closed form is the algebraic equivalent of the explicit DCF for constant growth, constant margin and year-end discounting.",
           b_note)
note.alignment = Alignment(wrap_text=True, vertical="top")
ws.merge_cells("A2:H2")
ws.row_dimensions[2].height = 30

head(ws, "A4", "Factor definitions")
defs = [("Revenue FY2024A", "=Inputs!B4", MONEY),
        ("Revenue growth (r)", "=Inputs!B29", PCT),
        ("Base EBITDA margin", "=Inputs!B30", PCT),
        ("D&A % revenue", "=Inputs!B6", PCT),
        ("Capex % revenue", "=Inputs!B7", PCT),
        ("NWC % of revenue change", "=Inputs!B8", PCT),
        ("Tax rate", "=Inputs!B9", PCT),
        ("Net debt", "=Inputs!B10", MONEY),
        ("Diluted shares", "=Inputs!B11", '#,##0.0'),
        ("Base WACC", "=WACC!B19", PCT),
        ("Base terminal growth", "=Inputs!B32", PCT)]
for offset, (text, formula, fmt) in enumerate(defs):
    r = 5 + offset
    label(ws, f"A{r}", text)
    put(ws, f"B{r}", formula, b_link, fmt, fill_grid, border=True)


def s_formula(r):
    q = f"((1+$B$6)/(1+$A{r}))"
    return f"=IF(ABS({q}-1)<1E-9,5/(1+$A{r}),{q}*(1-{q}^5)/(1-{q}))"


def k_formula(margin_ref):
    return f"=(({margin_ref}-$B$8)*(1-$B$11)+$B$8-$B$9-$B$10*$B$6/(1+$B$6))"


offsets = [-2, -1, 0, 1, 2]
NET = "-$B$12)/$B$13"

# Grid 1: WACC rows x terminal growth columns
g1_title = 18
head(ws, f"A{g1_title}", "Grid 1 — WACC (rows) × terminal growth (columns): value per share")
label(ws, f"A{g1_title + 1}", "Base factor K (base margin)")
put(ws, f"B{g1_title + 1}", k_formula("$B$7"), b_formula, '0.00000', fill_grid, border=True)
put(ws, f"H{g1_title}", "Σ q^t", b_head, fill=fill_head, align="center")
h1 = g1_title + 2
for j, off in enumerate(offsets):
    col = get_column_letter(2 + j)
    put(ws, f"{col}{h1}", f"=$B$15+{off}*0.0025", b_formula, PCT, fill_grid, align="center", border=True)
for i, off in enumerate(offsets):
    r = h1 + 1 + i
    put(ws, f"A{r}", f"=$B$14+{off}*0.005", b_formula, PCT, fill_grid, border=True)
    put(ws, f"H{r}", s_formula(r), b_formula, '0.0000', fill_grid, border=True)
    for j in range(5):
        col = get_column_letter(2 + j)
        f = (f"=($B${g1_title + 1}*$B$5*$H{r}+$B${g1_title + 1}*$B$5*(1+$B$6)^5*(1+{col}${h1})"
             f"/($A{r}-{col}${h1})/(1+$A{r})^5{NET}")
        put(ws, f"{col}{r}", f, b_formula, PS, border=True)
grid1_center = f"D{h1 + 3}"

# Grid 2: WACC rows x margin columns
g2_title = h1 + 7
head(ws, f"A{g2_title}", "Grid 2 — WACC (rows) × EBITDA margin (columns): value per share")
put(ws, f"H{g2_title}", "Σ q^t", b_head, fill=fill_head, align="center")
h2 = g2_title + 1
head(ws, f"A{h2}", "Margin per column")
for j, off in enumerate(offsets):
    col = get_column_letter(2 + j)
    put(ws, f"{col}{h2}", f"=$B$7+{off}*0.01", b_formula, PCT, fill_grid, align="center", border=True)
k2 = h2 + 1
label(ws, f"A{k2}", "Factor K")
for j in range(5):
    col = get_column_letter(2 + j)
    put(ws, f"{col}{k2}", k_formula(f"{col}{h2}"), b_formula, '0.00000', fill_grid, border=True)
for i, off in enumerate(offsets):
    r = k2 + 1 + i
    put(ws, f"A{r}", f"=$B$14+{off}*0.005", b_formula, PCT, fill_grid, border=True)
    put(ws, f"H{r}", s_formula(r), b_formula, '0.0000', fill_grid, border=True)
    for j in range(5):
        col = get_column_letter(2 + j)
        f = (f"=({col}${k2}*$B$5*$H{r}+{col}${k2}*$B$5*(1+$B$6)^5*(1+$B$15)"
             f"/($A{r}-$B$15)/(1+$A{r})^5{NET}")
        put(ws, f"{col}{r}", f, b_formula, PS, border=True)
grid2_center = f"D{k2 + 3}"

# Grid 3: terminal growth rows x margin columns
g3_title = k2 + 7
head(ws, f"A{g3_title}", "Grid 3 — terminal growth (rows) × EBITDA margin (columns): value per share")
put(ws, f"H{g3_title}", "Σ q^t at base WACC", b_head, fill=fill_head, align="center")
h3 = g3_title + 1
label(ws, f"A{h3}", "Base Σ q^t at base WACC")
q_base = "((1+$B$6)/(1+$B$14))"
put(ws, f"H{h3}", f"=IF(ABS({q_base}-1)<1E-9,5/(1+$B$14),{q_base}*(1-{q_base}^5)/(1-{q_base}))",
    b_formula, '0.0000', fill_grid, border=True)
head(ws, f"A{h3 + 1}", "Margin per column")
for j, off in enumerate(offsets):
    col = get_column_letter(2 + j)
    put(ws, f"{col}{h3 + 1}", f"=$B$7+{off}*0.01", b_formula, PCT, fill_grid, align="center", border=True)
k3 = h3 + 2
label(ws, f"A{k3}", "Factor K")
for j in range(5):
    col = get_column_letter(2 + j)
    put(ws, f"{col}{k3}", k_formula(f"{col}{h3 + 1}"), b_formula, '0.00000', fill_grid, border=True)
for i, off in enumerate(offsets):
    r = k3 + 1 + i
    put(ws, f"A{r}", f"=$B$15+{off}*0.0025", b_formula, PCT, fill_grid, border=True)
    for j in range(5):
        col = get_column_letter(2 + j)
        f = (f"=({col}${k3}*$B$5*$H${h3}+{col}${k3}*$B$5*(1+$B$6)^5*(1+$A{r})"
             f"/($B$14-$A{r})/(1+$B$14)^5{NET}")
        put(ws, f"{col}{r}", f, b_formula, PS, border=True)
grid3_center = f"D{k3 + 3}"

grid1_range = f"B{h1 + 1}:F{h1 + 5}"
grid2_range = f"B{k2 + 1}:F{k2 + 5}"
grid3_range = f"B{k3 + 1}:F{k3 + 5}"

# ------------------------------------------------------------------ Checks
ws = wb.create_sheet("Checks")
ws.column_dimensions["A"].width = 52
ws.column_dimensions["B"].width = 16
ws.column_dimensions["C"].width = 14
put(ws, "A1", "Checks — tie-outs and integrity", b_title)
for col, text in zip("ABC", ["Test", "Result", "Status"]):
    put(ws, f"{col}3", text, b_head, fill=fill_head, border=True)
checks = [
    ("DCF value per share", "=DCF!B36", PS, None),
    ("Grid 1 centre equals DCF", f"=Sensitivity!{grid1_center}", PS,
     '=IF(ABS(B{r}-DCF!B36)<=0.01,"OK","FAIL")'),
    ("Grid 2 centre equals DCF", f"=Sensitivity!{grid2_center}", PS,
     '=IF(ABS(B{r}-DCF!B36)<=0.01,"OK","FAIL")'),
    ("Grid 3 centre equals DCF", f"=Sensitivity!{grid3_center}", PS,
     '=IF(ABS(B{r}-DCF!B36)<=0.01,"OK","FAIL")'),
    ("WACC independent recompute",
     "=((1-Inputs!B17)*(Inputs!B14+Inputs!B31*Inputs!B15))+(Inputs!B17*Inputs!B16*(1-Inputs!B9))", PCT,
     '=IF(ABS(B{r}-WACC!B19)<0.0000001,"OK","FAIL")'),
    ("EV equals PV(FCF) + PV(TV)", "=DCF!B32", MONEY,
     '=IF(ABS(B{r}-(DCF!B30+DCF!B31))<=0.01,"OK","FAIL")'),
    ("Equity equals EV minus net debt", "=DCF!B34", MONEY,
     '=IF(ABS(B{r}-(DCF!B32-Inputs!B10))<=0.01,"OK","FAIL")'),
    ("Scenario selector in range", "=Inputs!B25", '0', '=IF(AND(B{r}>=1,B{r}<=3),"OK","FAIL")'),
    ("All DCF model checks OK", '=IF(COUNTIF(DCF!B39:B42,"OK")=4,"OK","FAIL")', None, "=B{r}"),
    ("Sensitivity cells populated",
     f"=COUNT(Sensitivity!{grid1_range},Sensitivity!{grid2_range},Sensitivity!{grid3_range})", '0',
     '=IF(B{r}=75,"OK","FAIL")'),
    ("Sensitivity minimum positive",
     f"=MIN(Sensitivity!{grid1_range},Sensitivity!{grid2_range},Sensitivity!{grid3_range})", PS,
     '=IF(B{r}>0,"OK","FAIL")'),
]
for offset, (text, formula, fmt, status) in enumerate(checks):
    r = 4 + offset
    label(ws, f"A{r}", text)
    put(ws, f"B{r}", formula, b_link if "!" in str(formula) else b_formula, fmt, border=True)
    if status:
        put(ws, f"C{r}", status.replace("{r}", str(r)), b_formula, border=True)

head(ws, "A16", "Known limitations")
notes = [
    "TEST_ONLY synthetic inputs; no commercial data, licence or vendor access.",
    "Grids vary one parameter pair around the active scenario and hold the others fixed; they are not probability weighting.",
    "Year-end discounting only; no mid-year convention toggle in this sample.",
    "No comps, precedents, LBO, three-statement model, football field or deck.",
    "P5 review gate not implemented: this file is DRAFT and must not be distributed.",
]
for offset, text in enumerate(notes):
    put(ws, f"A{17 + offset}", text, b_note)

OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)
print(f"wrote {OUT}")
