"""Verify the recalculated B05 workbook and compare it with an independent baseline."""
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from openpyxl import load_workbook

HERE = Path(__file__).parent
BOOK = HERE / "B05_DCF_TEST_ONLY.xlsx"
REPORT = HERE / "verification.json"


def baseline():
    rev0 = Decimal("1000.0")
    r, m = Decimal("0.06"), Decimal("0.20")
    da, capex, nwc = Decimal("0.04"), Decimal("0.05"), Decimal("0.02")
    tax, netdebt, shares = Decimal("0.25"), Decimal("150.0"), Decimal("100.0")
    rf, erp, beta, kd, dw = Decimal("0.04"), Decimal("0.05"), Decimal("1.10"), Decimal("0.05"), Decimal("0.30")
    g = Decimal("0.020")
    ke = rf + beta * erp
    wacc = (1 - dw) * ke + dw * kd * (1 - tax)
    rev, prev, pv, fcf_last = rev0, rev0, Decimal(0), None
    flows = []
    for t in range(1, 6):
        rev = prev * (1 + r)
        ebitda = rev * m
        da_t = rev * da
        ebit = ebitda - da_t
        nopat = ebit * (1 - tax)
        fcf = nopat + da_t - rev * capex - (rev - prev) * nwc
        flows.append(fcf)
        pv += fcf / (1 + wacc) ** t
        fcf_last, prev = fcf, rev
    tv = fcf_last * (1 + g) / (wacc - g)
    pv_tv = tv / (1 + wacc) ** 5
    ev = pv + pv_tv
    equity = ev - netdebt
    return {"wacc": wacc, "enterprise_value": ev, "equity_value": equity, "per_share": equity / shares,
            "pv_fcf": pv, "pv_tv": pv_tv,
            "flows": [str(x.quantize(Decimal('0.01'), ROUND_HALF_UP)) for x in flows]}


formulas = load_workbook(BOOK, data_only=False)
values = load_workbook(BOOK, data_only=True)
checks = []


def record(name, ok, detail=None):
    checks.append({"id": name, "status": "PASS" if ok else "FAIL", **({"detail": detail} if detail else {})})


record("sheets-present",
       {"Cover", "Inputs", "WACC", "DCF", "Sensitivity", "Checks"}.issubset(set(formulas.sheetnames)),
       formulas.sheetnames)

f_dcf = formulas["DCF"]
record("formulas-preserved-not-hardcoded",
       str(f_dcf["C4"].value).startswith("=") and str(f_dcf["C15"].value).startswith("=")
       and str(f_dcf["B36"].value).startswith("="))

live = sum(1 for ws in formulas.worksheets for row in ws.iter_rows() for cell in row
           if isinstance(cell.value, str) and cell.value.startswith("="))
record("live-formula-count-at-least-120", live >= 120, {"formulas": live})

v_checks = values["Checks"]
by_label = {}
for row in range(4, 16):
    name = v_checks[f"A{row}"].value
    if name:
        by_label[name] = (v_checks[f"B{row}"].value, v_checks[f"C{row}"].value)

statuses = {name: pair[1] for name, pair in by_label.items() if pair[1] is not None}
record("all-verification-checks-ok", len(statuses) >= 9 and all(v == "OK" for v in statuses.values()), statuses)

base = baseline()
per_share = values["DCF"]["B36"].value
record("independent-baseline-matches-per-share",
       per_share is not None and abs(Decimal(str(per_share)) - base["per_share"]) <= Decimal("0.01"),
       {"workbook": per_share, "baseline": str(base["per_share"].quantize(Decimal('0.0001')))})

ev = values["DCF"]["B32"].value
record("independent-baseline-matches-enterprise-value",
       ev is not None and abs(Decimal(str(ev)) - base["enterprise_value"]) <= Decimal("0.05"),
       {"workbook": ev, "baseline": str(base["enterprise_value"].quantize(Decimal('0.01')))})

wacc = values["WACC"]["B19"].value
record("wacc-matches-independent-capm",
       abs(Decimal(str(wacc)) - base["wacc"]) < Decimal("0.0000001"),
       {"workbook": wacc, "baseline": str(base["wacc"])})

centre_labels = ["Grid 1 centre equals DCF", "Grid 2 centre equals DCF", "Grid 3 centre equals DCF"]
centres = [by_label[label][0] for label in centre_labels]
record("three-grid-centres-tie-to-dcf",
       all(c is not None and abs(Decimal(str(c)) - Decimal(str(per_share))) <= Decimal("0.01") for c in centres),
       {"centres": centres, "dcf": per_share})

count = by_label["Sensitivity cells populated"][0]
record("seventy-five-sensitivity-cells-numeric", count == 75, {"counted": count})

flows = [values["DCF"][f"{c}15"].value for c in "CDEFG"]
record("forecast-fcf-all-positive-numeric", all(isinstance(v, (int, float)) and v > 0 for v in flows), flows)

growth = [values["DCF"][f"{c}5"].value for c in "CDEFG"]
record("growth-rows-equal-scenario-growth",
       all(v is not None and abs(Decimal(str(v)) - Decimal("0.06")) < Decimal("0.0001") for v in growth), growth)

result = {"workbook": BOOK.name, "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
          "evidence": "LIBREOFFICE_RECALCULATED_AND_INDEPENDENT_DECIMAL_BASELINE",
          "checks": checks,
          "baseline": {k: (str(v) if isinstance(v, Decimal) else v) for k, v in base.items()},
          "recalculated": {"per_share": per_share, "enterprise_value": ev, "wacc": wacc}}
REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "failed": [c["id"] for c in checks if c["status"] == "FAIL"]},
                 ensure_ascii=False))
