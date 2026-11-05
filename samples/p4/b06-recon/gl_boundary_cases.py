"""Boundary cases for the GL reconciliation kernel, with expectations from an independent model.

The model follows the documented bucket precedence and inclusive tolerances:
quantity break, then amount/FX break, then timing break, then matched; a missing side is
GL_ONLY or SUBLEDGER_ONLY. Amounts are compared after scaling and at two decimal places.
"""
import json
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).parent
SCOPE = {"entity": "ENTITY-GL", "tradeDate": "2026-03-31", "asOf": "2026-03-31", "assetClasses": ["EQ"]}
COMMON = {"entity": "ENTITY-GL", "tradeDate": "2026-03-31", "assetClass": "EQ", "currency": "USD",
          "baseCurrency": "USD", "amountScale": "ONES", "quantityScale": "ONES", "quantityUnit": "UNITS"}


def record(common_key, local, base, quantity, posting, fx="1"):
    return {**COMMON, "commonKey": common_key, "localAmount": local, "baseAmount": base,
            "quantity": quantity, "postingDate": posting, "fxRate": fx}


def expect(gl, sub, tolerance):
    """Mirror the documented rules with Decimal, independently of the JavaScript kernel."""
    if gl is None:
        return "SUBLEDGER_ONLY"
    if sub is None:
        return "GL_ONLY"
    local = Decimal(gl["localAmount"]) - Decimal(sub["localAmount"])
    base = Decimal(gl["baseAmount"]) - Decimal(sub["baseAmount"])
    qty = Decimal(gl["quantity"]) - Decimal(sub["quantity"])
    amount_tol = Decimal(tolerance["amount"])
    quantity_tol = Decimal(tolerance["quantity"])
    if abs(qty) > quantity_tol:
        return "QUANTITY_BREAK"
    if abs(local) > amount_tol or abs(base) > amount_tol or gl["fxRate"] != sub["fxRate"]:
        return "AMOUNT_BREAK"
    if gl["postingDate"] != sub["postingDate"]:
        return "TIMING_BREAK"
    return "MATCHED"


CASES = [
    ("amount-at-tolerance", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.01", "100.01", "10", "2026-03-31")),
    ("amount-over-tolerance", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.02", "100.02", "10", "2026-03-31")),
    ("zero-tolerance-exact", {"amount": "0", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.00", "100.00", "10", "2026-03-31")),
    ("zero-tolerance-one-cent", {"amount": "0", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.01", "100.01", "10", "2026-03-31")),
    ("quantity-at-tolerance", {"amount": "0.01", "quantity": "0.5"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.00", "100.00", "10.5", "2026-03-31")),
    ("quantity-over-tolerance", {"amount": "0.01", "quantity": "0.5"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.00", "100.00", "11", "2026-03-31")),
    ("quantity-outranks-amount", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "100.50", "100.50", "11", "2026-03-31")),
    ("fx-differs-amounts-equal", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31", "1.0000"), record("K1", "100.00", "100.00", "10", "2026-03-31", "1.0001")),
    ("timing-only", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-30"), record("K1", "100.00", "100.00", "10", "2026-03-31")),
    ("gl-only", {"amount": "0.01", "quantity": "0"}, record("K1", "100.00", "100.00", "10", "2026-03-31"), None),
    ("subledger-only", {"amount": "0.01", "quantity": "0"}, None, record("K1", "100.00", "100.00", "10", "2026-03-31")),
    ("sign-flip", {"amount": "0.01", "quantity": "0"},
     record("K1", "100.00", "100.00", "10", "2026-03-31"), record("K1", "-100.00", "-100.00", "10", "2026-03-31")),
]

cases = []
for case_id, tolerance, gl, sub in CASES:
    inputs = {
        "classification": "TEST_ONLY",
        "scope": SCOPE,
        "gl": {"asOf": SCOPE["asOf"], "records": [gl] if gl else []},
        "subledger": {"asOf": SCOPE["asOf"], "records": [sub] if sub else []},
        "tolerances": tolerance,
    }
    cases.append({"id": case_id, "inputs": inputs, "expectedBucket": expect(gl, sub, tolerance),
                  "tolerance": tolerance})

(HERE / "gl-boundary-cases.json").write_text(json.dumps({
    "note": "Expectations computed by an independent Python model of the documented bucket rules; TEST_ONLY fixtures.",
    "cases": cases,
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"cases": len(cases)}))
