"""Build a TEST_ONLY LP tie-out fixture and its expectations with Python's Decimal.

The point is independence: the expectations here come from the documented arithmetic
(pro-rata net income, allocated-then-ending rounding), not from the JavaScript kernel.
"""
import json
from decimal import Decimal, ROUND_HALF_EVEN
from pathlib import Path

HERE = Path(__file__).parent
CENT = Decimal("0.01")

TOTALS = {
    "realized": Decimal("2000000"),
    "unrealized": Decimal("500000"),
    "management_fee": Decimal("120000"),
    "expenses": Decimal("30000"),
}
NET = TOTALS["realized"] + TOTALS["unrealized"] - TOTALS["management_fee"] - TOTALS["expenses"]

LPS = [
    {"lp_id": "LP-ALPHA", "ownership": "0.45", "beginning": Decimal("1000000"),
     "contributions": Decimal("250000"), "distributions": Decimal("100000"), "carry": Decimal("50000"),
     "commitment": Decimal("1500000"), "unfunded": Decimal("300000"), "recallable": Decimal("200000")},
    {"lp_id": "LP-BETA", "ownership": "0.35", "beginning": Decimal("800000"),
     "contributions": Decimal("100000"), "distributions": Decimal("60000"), "carry": Decimal("40000"),
     "commitment": Decimal("900000"), "unfunded": Decimal("150000"), "recallable": Decimal("90000")},
    {"lp_id": "LP-GAMMA", "ownership": "0.20", "beginning": Decimal("400000"),
     "contributions": Decimal("50000"), "distributions": Decimal("20000"), "carry": Decimal("10000"),
     "commitment": Decimal("500000"), "unfunded": Decimal("80000"), "recallable": Decimal("60000")},
]

def money(value: Decimal) -> str:
    return str(value.quantize(CENT, rounding=ROUND_HALF_EVEN))

expected = {}
for lp in LPS:
    share = Decimal(lp["ownership"])
    allocated = (NET * share).quantize(CENT, rounding=ROUND_HALF_EVEN)
    ending = (lp["beginning"] + lp["contributions"] - lp["distributions"] + allocated - lp["carry"]).quantize(CENT, rounding=ROUND_HALF_EVEN)
    expected[lp["lp_id"]] = {
        "realized": money(TOTALS["realized"] * share),
        "unrealized": money(TOTALS["unrealized"] * share),
        "management_fee": money(TOTALS["management_fee"] * share),
        "expenses": money(TOTALS["expenses"] * share),
        "allocated_net_income": money(allocated),
        "ending": money(ending),
    }

nav_total = sum(Decimal(v["ending"]) for v in expected.values())
context = {
    "entity_id": "ENTITY-TEST",
    "fund_id": "FUND-TEST",
    "period_start": "2026-01-01",
    "period_end": "2026-03-31",
    "currency": "USD",
}
statements_source = {"document_id": "STMT-1", "extract_ref": "fixture/statements.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"}
nav_source = {"document_id": "NAV-2", "extract_ref": "fixture/nav.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"}
register_source = {"document_id": "REG-3", "extract_ref": "fixture/register.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"}

inputs = {
    "schema_version": 1,
    "batch_id": "B07-LP-CROSSCHECK",
    "statements": {
        **context, "coverage": "FULL", "source": statements_source,
        "lps": [{
            "lp_id": lp["lp_id"], "ownership": lp["ownership"],
            "beginning": money(lp["beginning"]), "contributions": money(lp["contributions"]),
            "distributions": money(lp["distributions"]),
            "realized": expected[lp["lp_id"]]["realized"], "unrealized": expected[lp["lp_id"]]["unrealized"],
            "management_fee": expected[lp["lp_id"]]["management_fee"], "expenses": expected[lp["lp_id"]]["expenses"],
            "allocated_net_income": expected[lp["lp_id"]]["allocated_net_income"],
            "carry": money(lp["carry"]), "ending": expected[lp["lp_id"]]["ending"],
            "commitment": money(lp["commitment"]), "unfunded": money(lp["unfunded"]), "recallable": money(lp["recallable"]),
        } for lp in LPS],
    },
    "nav_pack": {
        **context, "coverage": "FULL", "source": nav_source,
        "totals": {k: money(v) for k, v in TOTALS.items()} | {"nav": money(nav_total)},
        "terms": {
            "allocation_method": "PRO_RATA_NET", "ownership_basis": "NAV_PACK_COMMITMENT_FRACTION",
            "carry_method": "SOURCED_LP_CRYSTALLIZED_AMOUNTS", "rounding_basis": "ALLOCATED_NET_THEN_ENDING",
            "money_scale": 2, "rounding_method": "HALF_EVEN",
            "fund_rounding_tolerance": "0.02", "source_ref": nav_source["extract_ref"],
        },
        "lps": [{
            "lp_id": lp["lp_id"], "ownership": lp["ownership"],
            "beginning": money(lp["beginning"]), "contributions": money(lp["contributions"]),
            "distributions": money(lp["distributions"]), "carry": money(lp["carry"]),
        } for lp in LPS],
    },
    "commitment_register": {
        **context, "coverage": "FULL", "source": register_source,
        "lps": [{"lp_id": lp["lp_id"], "commitment": money(lp["commitment"]),
                 "unfunded": money(lp["unfunded"]), "recallable": money(lp["recallable"])} for lp in LPS],
    },
}

(HERE / "inputs.json").write_text(json.dumps(inputs, indent=2) + "\n", encoding="utf-8")
(HERE / "expected.json").write_text(json.dumps({
    "note": "Computed by Python Decimal with ROUND_HALF_EVEN from the documented pro-rata rules.",
    "net_income": money(NET),
    "fund_nav": money(nav_total),
    "lps": expected,
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"lps": len(LPS), "fund_nav": money(nav_total)}))
