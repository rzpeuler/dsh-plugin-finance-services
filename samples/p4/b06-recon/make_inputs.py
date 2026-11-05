"""Emit the TEST_ONLY GL/subledger extracts used by the B06 workpaper.

The JSON produced here is the auditable ground truth for the sample; every
subsequent step reads it rather than repeating the numbers.
"""
import json
from pathlib import Path

OUT = Path(__file__).parent / "inputs.json"
ENTITY, TRADE, ASOF = "TOY-FUND", "2025-09-30", "2025-09-30"

# key, assetClass, currency, quantity, quantityUnit, localAmount, baseAmount, glPosting, subPosting, glQty, subQty, glBase, subBase, glFx, subFx
ROWS = [
    ("K01", "EQUITY", "USD", "1000", "SHARES", "125000.00", "125000.00"),
    ("K02", "EQUITY", "USD", "500", "SHARES", "62500.00", "62500.00"),
    ("K03", "EQUITY", "USD", "250", "SHARES", "31250.00", "31250.00"),
    ("K04", "BOND", "USD", "100", "CONTRACTS", "98000.00", "98000.00"),
    ("K05", "BOND", "USD", "50", "CONTRACTS", "49000.00", "49000.00"),
    ("K06", "EQUITY", "USD", "800", "SHARES", "100000.00", "100000.00"),
    ("K07", "EQUITY", "USD", "300", "SHARES", "37500.00", "37500.00"),
    ("K08", "BOND", "USD", "25", "CONTRACTS", "24500.00", "24500.00"),
    ("K09", "EQUITY", "EUR", "100", "SHARES", "9000.00", "9750.00"),
    ("K10", "EQUITY", "USD", "120", "SHARES", "15000.00", "15000.00"),
    ("K11", "EQUITY", "USD", "400", "SHARES", "50000.00", "50000.00"),
    ("K12", "EQUITY", "USD", "1000", "SHARES", "125000.00", "125000.00"),
    ("K13", "EQUITY", "USD", "75", "SHARES", "9375.00", "9375.00"),
    ("K14", "EQUITY", "USD", "60", "SHARES", "7500.00", "7500.00"),
    ("K15", "BOND", "USD", "10", "CONTRACTS", "9800.00", "9800.00"),
    ("K16", "EQUITY", "USD", "90", "SHARES", "11250.00", "11250.00"),
]
GL_ONLY, SUB_ONLY = {"K15"}, {"K16"}


def record(key, asset, currency, quantity, unit, local, base, posting, fx="1.000000000000000000"):
    return {
        "entity": ENTITY, "tradeDate": TRADE, "assetClass": asset, "currency": currency,
        "commonKey": key, "postingDate": posting, "localAmount": local, "baseAmount": base,
        "baseCurrency": "USD", "amountScale": "ONES", "quantity": quantity,
        "quantityScale": "ONES", "quantityUnit": unit, "fxRate": fx,
    }


gl_records, sub_records = [], []
for key, asset, currency, quantity, unit, local, base in ROWS:
    gl_posting = sub_posting = TRADE
    gl_qty = sub_qty = quantity
    gl_base = sub_base = base
    gl_fx = sub_fx = "1.000000000000000000"
    if key == "K10":
        sub_base = "14999.99"          # within the inclusive 0.01 tolerance
    elif key == "K11":
        sub_base = "49975.00"          # 25.00 base-amount break
    elif key == "K12":
        sub_qty = "995"                # quantity break, amounts identical
    elif key == "K13":
        sub_posting = "2025-10-01"     # timing break, amounts identical
    elif key == "K14":
        sub_fx = "1.010000000000000000"  # FX-rate difference with equal amounts
    if key not in SUB_ONLY:
        gl_records.append(record(key, asset, currency, gl_qty, unit, local, gl_base, gl_posting, gl_fx))
    if key not in GL_ONLY:
        sub_records.append(record(key, asset, currency, sub_qty, unit, local, sub_base, sub_posting, sub_fx))

payload = {
    "classification": "TEST_ONLY",
    "scope": {"entity": ENTITY, "tradeDate": TRADE, "asOf": ASOF, "assetClasses": ["EQUITY", "BOND"]},
    "gl": {"asOf": ASOF, "records": gl_records},
    "subledger": {"asOf": ASOF, "records": sub_records},
    "tolerances": {"amount": "0.01", "quantity": "0"},
}
OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"path": str(OUT), "glRows": len(gl_records), "subledgerRows": len(sub_records),
                  "keys": len({r["commonKey"] for r in gl_records} | {r["commonKey"] for r in sub_records})}))
