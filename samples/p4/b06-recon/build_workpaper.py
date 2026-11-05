"""Build the B06 reconciliation workpaper from the kernel result.

The workpaper presents the kernel output; the Controls sheet carries an
independent Decimal recount so a reader can see the two agree.
"""
import json
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = Path(__file__).parent
OUT = HERE / "B06_RECON_WORKPAPER_TEST_ONLY.xlsx"
inputs = json.loads((HERE / "inputs.json").read_text(encoding="utf-8"))
kernel = json.loads((HERE / "kernel-result.json").read_text(encoding="utf-8"))

BOLD = Font(name="Calibri", size=10, bold=True)
TITLE = Font(name="Calibri", size=14, bold=True)
NORMAL = Font(name="Calibri", size=10)
NOTE = Font(name="Calibri", size=9, italic=True, color="595959")
HEAD_FILL = PatternFill("solid", fgColor="DCE6F1")
PASS_FILL = PatternFill("solid", fgColor="E2EFDA")
WARN_FILL = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
MONEY = '#,##0.00;(#,##0.00)'
QTY = '#,##0.######;(#,##0.######)'
BUCKETS = ["MATCHED", "AMOUNT_BREAK", "QUANTITY_BREAK", "TIMING_BREAK", "GL_ONLY", "SUBLEDGER_ONLY"]

D = Decimal
TOLERANCE = D(inputs["tolerances"]["amount"])
QTOL = D(inputs["tolerances"]["quantity"])


def key_of(record):
    return (record["entity"], record["tradeDate"], record["assetClass"], record["currency"], record["commonKey"])


gl_index = {key_of(r): r for r in inputs["gl"]["records"]}
sub_index = {key_of(r): r for r in inputs["subledger"]["records"]}


def bucket_of(a, b):
    if a is None:
        return "SUBLEDGER_ONLY"
    if b is None:
        return "GL_ONLY"
    qty = D(a["quantity"]) - D(b["quantity"])
    local = D(a["localAmount"]) - D(b["localAmount"])
    base = D(a["baseAmount"]) - D(b["baseAmount"])
    fx = a["fxRate"] != b["fxRate"]
    if abs(qty) > QTOL:
        return "QUANTITY_BREAK"
    if abs(local) > TOLERANCE or abs(base) > TOLERANCE or fx:
        return "AMOUNT_BREAK"
    if a["postingDate"] != b["postingDate"]:
        return "TIMING_BREAK"
    return "MATCHED"


independent = {}
for key in sorted(set(gl_index) | set(sub_index)):
    independent[key] = bucket_of(gl_index.get(key), sub_index.get(key))
ind_counts = {bucket: sum(1 for v in independent.values() if v == bucket) for bucket in BUCKETS}

# per-currency base-amount totals, both sides
def totals(records):
    out = {}
    for r in records:
        d = out.setdefault(r["baseCurrency"], {"gl": D(0), "sub": D(0)})
        d["gl" if records is inputs["gl"]["records"] else "sub"] += D(r["baseAmount"])
    return out


kernel_totals = {(row["key"][0] if isinstance(row["key"], list) else row["key"]): row
                 for row in kernel["summary"]["totals"]["money"]}
base_totals = [row for row in kernel["summary"]["totals"]["money"] if row["key"][0] == "BASE"]
kernel_base = {row["key"][1]: row for row in base_totals}
gl_base = {}
sub_base = {}
for r in inputs["gl"]["records"]:
    gl_base[r["baseCurrency"]] = gl_base.get(r["baseCurrency"], D(0)) + D(r["baseAmount"])
for r in inputs["subledger"]["records"]:
    sub_base[r["baseCurrency"]] = sub_base.get(r["baseCurrency"], D(0)) + D(r["baseAmount"])

controls = []


def control(label, ok, detail):
    controls.append({"control": label, "status": "PASS" if ok else "FAIL", "detail": detail, "ok": ok})


control("Bucket counts equal an independent recount",
        all(kernel["summary"]["counts"][b] == ind_counts[b] for b in BUCKETS),
        " / ".join(f"{b}={ind_counts[b]}" for b in BUCKETS))
control("Joined row count equals the distinct common-key count",
        kernel["summary"]["joinedRows"] == len(independent) and len(gl_index) + len(sub_index) - len(independent) == len(set(gl_index) & set(sub_index)),
        f"joinedRows={kernel['summary']['joinedRows']}, distinctKeys={len(independent)}, glRows={len(gl_index)}, subledgerRows={len(sub_index)}")
control("Per-currency base totals equal independent sums",
        all(D(kernel_base[c]["gl"]) == gl_base.get(c, D(0)) and D(kernel_base[c]["subledger"]) == sub_base.get(c, D(0))
            for c in kernel_base) and set(kernel_base) == set(gl_base) | set(sub_base),
        "; ".join(f"{c}: GL {gl_base.get(c, D(0))} / SUB {sub_base.get(c, D(0))}" for c in sorted(set(gl_base) | set(sub_base))))
control("Break list equals the independent non-matched set",
        {tuple(row["key"]) for row in kernel["breaks"]} == {k for k, v in independent.items() if v != "MATCHED"},
        f"kernelBreaks={len(kernel['breaks'])}, independentBreaks={sum(1 for v in independent.values() if v != 'MATCHED')}")
control("Amount tolerance is inclusive at 0.01",
        independent[("TOY-FUND", "2025-09-30", "EQUITY", "USD", "K10")] == "MATCHED",
        "K10 differs by exactly 0.01 in base amount and is classified MATCHED")
control("Fees and FX differences are not silently netted",
        independent[("TOY-FUND", "2025-09-30", "EQUITY", "USD", "K14")] == "AMOUNT_BREAK",
        "K14 has equal amounts but a different FX rate and is classified AMOUNT_BREAK")
control("No posting, publishing or journal entries", kernel["posting"] is False and kernel["publish"] is False
        and kernel["journalEntries"]["status"] == "DRAFT_ONLY" and kernel["journalEntries"]["entries"] == [],
        f"posting={kernel['posting']}, publish={kernel['publish']}, journalEntries={kernel['journalEntries']['status']}")
control("Root cause is not inferred from a matching key",
        all(row["rootCause"] == "unknown" and row["evidenceStatus"] == "NEEDS_EVIDENCE" for row in kernel["breaks"]),
        "every break carries rootCause=unknown, evidenceStatus=NEEDS_EVIDENCE")
control("Independent trusted critic is not claimed",
        kernel["checks"]["independentTrustedCritic"] == "NOT_PERFORMED" and kernel["controllerSignoff"] == "PENDING",
        f"critic={kernel['checks']['independentTrustedCritic']}, signoff={kernel['controllerSignoff']}")
control("Kernel reports exact-decimal arithmetic", kernel["checks"]["arithmetic"] == "EXACT_DECIMAL",
        kernel["checks"]["arithmetic"])

wb = Workbook()

# ---------------------------------------------------------------- Summary
ws = wb.active
ws.title = "Summary"
ws.column_dimensions["A"].width = 34
ws.column_dimensions["B"].width = 22
ws.column_dimensions["C"].width = 60
ws["A1"] = "B06 — GL to subledger reconciliation workpaper"
ws["A1"].font = TITLE
rows = [
    ("Classification", kernel["classification"]),
    ("Data trust", kernel["dataTrust"]),
    ("Status", kernel["status"]),
    ("Entity / trade date / asOf", f"{kernel['scope']['entity']} / {kernel['scope']['tradeDate']} / {kernel['scope']['asOf']}"),
    ("Asset classes", ", ".join(kernel["scope"]["assetClasses"])),
    ("GL rows / subledger rows / joined", f"{kernel['summary']['glRows']} / {kernel['summary']['subledgerRows']} / {kernel['summary']['joinedRows']}"),
    ("Matched percentage", f"{kernel['summary']['matchedPercentage']['numerator']}/{kernel['summary']['matchedPercentage']['denominator']} rows (exact fraction, not rounded)"),
    ("Tolerances", f"amount {kernel['tolerances']['amount']} inclusive; quantity {kernel['tolerances']['quantity']}"),
    ("Arithmetic", kernel["checks"]["arithmetic"]),
]
r = 3
for label, value in rows:
    ws[f"A{r}"] = label
    ws[f"A{r}"].font = BOLD
    ws[f"B{r}"] = value
    ws[f"B{r}"].font = NORMAL
    r += 1

r += 1
ws[f"A{r}"] = "Bucket"
ws[f"B{r}"] = "Count"
ws[f"C{r}"] = "Independent recount"
for c in "ABC":
    ws[f"{c}{r}"].font = BOLD
    ws[f"{c}{r}"].fill = HEAD_FILL
    ws[f"{c}{r}"].border = BOX
r += 1
for bucket in BUCKETS:
    ws[f"A{r}"] = bucket
    ws[f"B{r}"] = kernel["summary"]["counts"][bucket]
    ws[f"C{r}"] = ind_counts[bucket]
    for c in "ABC":
        ws[f"{c}{r}"].border = BOX
    ws[f"C{r}"].fill = PASS_FILL if kernel["summary"]["counts"][bucket] == ind_counts[bucket] else WARN_FILL
    r += 1

r += 1
ws[f"A{r}"] = "Per-currency base amounts (kernel)"
ws[f"A{r}"].font = BOLD
r += 1
for col, text in (("A", "Currency"), ("B", "GL base"), ("C", "Subledger base")):
    ws[f"{col}{r}"] = text
    ws[f"{col}{r}"].font = BOLD
    ws[f"{col}{r}"].border = BOX
    ws[f"{col}{r}"].fill = HEAD_FILL
r += 1
for currency in sorted(kernel_base):
    row = kernel_base[currency]
    ws[f"A{r}"] = currency
    ws[f"B{r}"] = float(D(row["gl"]))
    ws[f"C{r}"] = float(D(row["subledger"]))
    ws[f"B{r}"].number_format = MONEY
    ws[f"C{r}"].number_format = MONEY
    r += 1

# ---------------------------------------------------------------- Breaks
ws = wb.create_sheet("Breaks")
headers = ["Key", "Bucket", "GL base", "Subledger base", "Delta base", "GL posting", "Sub posting",
           "GL qty", "Sub qty", "Flags", "Root cause", "Evidence", "Critic", "Owner", "Action"]
for i, text in enumerate(headers, start=1):
    cell = ws.cell(row=1, column=i, value=text)
    cell.font = BOLD
    cell.fill = HEAD_FILL
    cell.border = BOX
widths = [8, 17, 14, 15, 12, 12, 12, 11, 11, 42, 11, 17, 14, 10, 12]
for i, width in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = width
for index, row in enumerate(kernel["breaks"], start=2):
    gl, sub = row["gl"], row["subledger"]
    flags = [name for name, hit in row["differences"].items() if hit]
    values = [row["key"][4], row["bucket"],
              float(D(gl["baseAmount"])) if gl else None,
              float(D(sub["baseAmount"])) if sub else None,
              float(D(row["delta"]["baseAmount"])),
              gl["postingDate"] if gl else None, sub["postingDate"] if sub else None,
              float(D(gl["quantity"])) if gl else None, float(D(sub["quantity"])) if sub else None,
              ", ".join(flags), row["rootCause"], row["evidenceStatus"], row["criticStatus"],
              row["owner"] or "", row["action"] or ""]
    for col, value in enumerate(values, start=1):
        cell = ws.cell(row=index, column=col, value=value)
        cell.border = BOX
        cell.font = NORMAL
        if col in (3, 4, 5):
            cell.number_format = MONEY
        if col in (8, 9):
            cell.number_format = QTY

# ---------------------------------------------------------------- extracts
for title, records in (("GL extract", inputs["gl"]["records"]), ("Subledger extract", inputs["subledger"]["records"])):
    ws = wb.create_sheet(title)
    fields = ["commonKey", "assetClass", "currency", "postingDate", "localAmount", "baseAmount",
              "baseCurrency", "quantity", "quantityUnit", "fxRate", "amountScale", "quantityScale"]
    for i, field in enumerate(fields, start=1):
        cell = ws.cell(row=1, column=i, value=field)
        cell.font = BOLD
        cell.fill = HEAD_FILL
        cell.border = BOX
        ws.column_dimensions[get_column_letter(i)].width = max(12, len(field) + 4)
    for index, record in enumerate(records, start=2):
        for i, field in enumerate(fields, start=1):
            value = record[field]
            if field in ("localAmount", "baseAmount"):
                value = float(D(value))
            elif field == "quantity":
                value = float(D(value))
            cell = ws.cell(row=index, column=i, value=value)
            cell.border = BOX
            cell.font = NORMAL
            if field in ("localAmount", "baseAmount"):
                cell.number_format = MONEY

# ---------------------------------------------------------------- Controls
ws = wb.create_sheet("Controls")
ws.column_dimensions["A"].width = 52
ws.column_dimensions["B"].width = 10
ws.column_dimensions["C"].width = 90
ws["A1"] = "Controls — kernel output versus independent recount"
ws["A1"].font = TITLE
for col, text in zip("ABC", ["Control", "Status", "Detail"]):
    cell = ws[f"{col}3"]
    cell.value = text
    cell.font = BOLD
    cell.fill = HEAD_FILL
    cell.border = BOX
for index, row in enumerate(controls, start=4):
    ws[f"A{index}"] = row["control"]
    ws[f"B{index}"] = row["status"]
    ws[f"C{index}"] = row["detail"]
    for col in "ABC":
        ws[f"{col}{index}"].border = BOX
        ws[f"{col}{index}"].font = NORMAL
    ws[f"B{index}"].fill = PASS_FILL if row["ok"] else WARN_FILL
    ws[f"C{index}"].alignment = Alignment(wrap_text=True, vertical="top")

start = 5 + len(controls) + 2
ws[f"A{start}"] = "Scope and limitations"
ws[f"A{start}"].font = BOLD
notes = [
    "TEST_ONLY synthetic extracts; no ledger, subledger or vendor system was accessed.",
    "Underlying transaction evidence is NEEDS_EVIDENCE and the independent trusted critic was NOT_PERFORMED; "
    "an internal-gl/subledger critic cannot be satisfied by caller-supplied data.",
    "Breaks are drafts for investigation: no root cause, owner, clearing date or journal entry is inferred.",
    "Controller sign-off is PENDING; nothing here is posted, published or used for close.",
]
for offset, text in enumerate(notes, start=1):
    cell = ws[f"A{start + offset}"]
    cell.value = text
    cell.font = NOTE
    cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(f"A{start + offset}:C{start + offset}")

wb.save(OUT)
failed = [row["control"] for row in controls if not row["ok"]]
print(json.dumps({"workpaper": str(OUT), "controls": len(controls), "failed": failed, "breaks": len(kernel["breaks"])},
                 ensure_ascii=False))
