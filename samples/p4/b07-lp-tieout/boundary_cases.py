"""Boundary cases for the LP tie-out cross-check.

Each case targets a rounding or scale hazard: exact half-cent ties (HALF_EVEN), ties that must round
to even cents, ownership at the extremes, negative carry, distributions above contributions, and a
large but still legal amount. Expectations come from Decimal, not from the JavaScript kernel.
"""
import json
from decimal import Decimal, ROUND_HALF_EVEN
from pathlib import Path

HERE = Path(__file__).parent
CENT = Decimal("0.01")
CONTEXT = {"entity_id": "ENTITY-BOUNDARY", "fund_id": "FUND-BOUNDARY",
           "period_start": "2026-01-01", "period_end": "2026-03-31", "currency": "USD"}


def q(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def money(value: Decimal) -> str:
    text = str(q(value))
    return text if "." in text else text + ".00"


CASES = [
    {
        "id": "half-even-tie-down-to-even",
        "why": "100.01 split in half is 50.005: an exact half-cent tie that must land on the even cent below",
        "totals": {"realized": "100.01", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "0.5", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0.5", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.01",
    },
    {
        "id": "half-even-tie-up-to-even",
        "why": "100.03 split in half is 50.015: an exact half-cent tie that must land on the even cent above",
        "totals": {"realized": "100.03", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "0.5", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0.5", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.01",
    },
    {
        "id": "thirds-with-exact-ownership-sum",
        "why": "three LPs share a net income that does not divide evenly; ownership still sums to exactly one",
        "totals": {"realized": "1000000", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "0.333333333333", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0.333333333333", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-3", "ownership": "0.333333333334", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.01",
    },
    {
        "id": "full-ownership-single-lp",
        "why": "ownership of exactly one must copy the whole net income",
        "totals": {"realized": "1234567.89", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "1", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.00",
    },
    {
        "id": "zero-ownership",
        "why": "a zero share must allocate exactly nothing rather than a rounding crumb",
        "totals": {"realized": "999999.99", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "1", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.00",
    },
    {
        "id": "negative-carry",
        "why": "a negative carry amount must increase the ending balance",
        "totals": {"realized": "500000", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "1", "beginning": "100000", "contributions": "0", "distributions": "0", "carry": "-25000"}],
        "tolerance": "0.00",
    },
    {
        "id": "distributions-above-contributions",
        "why": "negative net flow must still tie out",
        "totals": {"realized": "0", "unrealized": "0", "management_fee": "0", "expenses": "0"},
        "lps": [{"lp_id": "LP-1", "ownership": "1", "beginning": "1000000", "contributions": "10000", "distributions": "250000", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-3", "ownership": "0", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-4", "ownership": "0", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-5", "ownership": "0", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.00",
    },
    {
        "id": "large-amounts-near-scale-limit",
        "why": "amounts near the 24-digit ceiling must not lose precision",
        "totals": {"realized": "900000000000", "unrealized": "100000000000", "management_fee": "50000000000", "expenses": "1"},
        "lps": [{"lp_id": "LP-1", "ownership": "0.5", "beginning": "1000000000000", "contributions": "0", "distributions": "0", "carry": "0"},
                {"lp_id": "LP-2", "ownership": "0.5", "beginning": "0", "contributions": "0", "distributions": "0", "carry": "0"}],
        "tolerance": "0.00",
    },
]


def build(case):
    net = Decimal(case["totals"]["realized"]) + Decimal(case["totals"]["unrealized"]) \
        - Decimal(case["totals"]["management_fee"]) - Decimal(case["totals"]["expenses"])
    expected = {}
    for lp in case["lps"]:
        share = Decimal(lp["ownership"])
        allocated = q(net * share)
        ending = q(Decimal(lp["beginning"]) + Decimal(lp["contributions"]) - Decimal(lp["distributions"]) + allocated - Decimal(lp["carry"]))
        expected[lp["lp_id"]] = {
            "realized": money(Decimal(case["totals"]["realized"]) * share),
            "unrealized": money(Decimal(case["totals"]["unrealized"]) * share),
            "management_fee": money(Decimal(case["totals"]["management_fee"]) * share),
            "expenses": money(Decimal(case["totals"]["expenses"]) * share),
            "allocated_net_income": money(allocated),
            "ending": money(ending),
        }
    fund_nav = sum(Decimal(value["ending"]) for value in expected.values())
    inputs = {
        "schema_version": 1,
        "batch_id": f"BOUNDARY-{case['id'][:24].upper().replace('-', '_')}",
        "statements": {
            **CONTEXT, "coverage": "FULL",
            "source": {"document_id": "STMT-B", "extract_ref": "boundary/statements.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"},
            "lps": [{
                "lp_id": lp["lp_id"], "ownership": lp["ownership"],
                "beginning": money(Decimal(lp["beginning"])), "contributions": money(Decimal(lp["contributions"])),
                "distributions": money(Decimal(lp["distributions"])),
                **{field: expected[lp["lp_id"]][field] for field in ("realized", "unrealized", "management_fee", "expenses", "allocated_net_income")},
                "carry": money(Decimal(lp["carry"])), "ending": expected[lp["lp_id"]]["ending"],
                "commitment": "1000.00", "unfunded": "0.00", "recallable": "0.00",
            } for lp in case["lps"]],
        },
        "nav_pack": {
            **CONTEXT, "coverage": "FULL",
            "source": {"document_id": "NAV-B", "extract_ref": "boundary/nav.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"},
            "totals": {key: money(Decimal(value)) for key, value in case["totals"].items()} | {"nav": money(fund_nav)},
            "terms": {"allocation_method": "PRO_RATA_NET", "ownership_basis": "NAV_PACK_COMMITMENT_FRACTION",
                      "carry_method": "SOURCED_LP_CRYSTALLIZED_AMOUNTS", "rounding_basis": "ALLOCATED_NET_THEN_ENDING",
                      "money_scale": 2, "rounding_method": "HALF_EVEN",
                      "fund_rounding_tolerance": case["tolerance"], "source_ref": "boundary/nav.json"},
            "lps": [{"lp_id": lp["lp_id"], "ownership": lp["ownership"],
                     "beginning": money(Decimal(lp["beginning"])), "contributions": money(Decimal(lp["contributions"])),
                     "distributions": money(Decimal(lp["distributions"])), "carry": money(Decimal(lp["carry"]))} for lp in case["lps"]],
        },
        "commitment_register": {
            **CONTEXT, "coverage": "FULL",
            "source": {"document_id": "REG-B", "extract_ref": "boundary/register.json", "classification": "TEST_ONLY", "input_kind": "SIMULATED_FIXTURE"},
            "lps": [{"lp_id": lp["lp_id"], "commitment": "1000.00", "unfunded": "0.00", "recallable": "0.00"} for lp in case["lps"]],
        },
    }
    return {"id": case["id"], "why": case["why"], "inputs": inputs, "expected": {"lps": expected, "fund_nav": money(fund_nav)}}


cases = [build(case) for case in CASES]
(HERE / "boundary-cases.json").write_text(json.dumps({
    "note": "Expectations computed by Python Decimal with ROUND_HALF_EVEN; TEST_ONLY fixtures.",
    "cases": cases,
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"cases": len(cases)}))
