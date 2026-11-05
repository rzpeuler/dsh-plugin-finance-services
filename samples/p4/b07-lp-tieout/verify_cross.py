"""Compare the JavaScript kernel's output with the Python expectations, field by field.

This is a cross-implementation check: BigInt arithmetic in JavaScript against Decimal in Python,
both applying the documented pro-rata allocation and cent rounding.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
expected = json.loads((HERE / "expected.json").read_text(encoding="utf-8"))
kernel = json.loads((HERE / "kernel-result.json").read_text(encoding="utf-8"))
inputs = json.loads((HERE / "inputs.json").read_text(encoding="utf-8"))

checks = []


def record(name, ok, detail=None):
    checks.append({"id": name, "status": "PASS" if ok else "FAIL", **({"detail": detail} if detail else {})})


record("kernel-returned-a-result", isinstance(kernel, dict) and "statements" in kernel)
record("no-validation-flags", kernel.get("flags") == [], {"flags": kernel.get("flags")})
record("kernel-recommends-pass", kernel.get("recommendation") == "PASS", {"recommendation": kernel.get("recommendation")})
record("fund-status-pass", (kernel.get("fund") or {}).get("status") == "PASS", {"fund": kernel.get("fund", {}).get("status")})

by_id = {item["lp_id"]: item for item in kernel.get("statements", [])}
record("all-lps-reported", set(by_id) == set(expected["lps"]), {"lps": sorted(by_id)})

mismatches = []
for lp_id, want in expected["lps"].items():
    item = by_id.get(lp_id)
    if not item:
        mismatches.append({"lp_id": lp_id, "problem": "missing from kernel output"})
        continue
    for field, wanted in want.items():
        found = next((c for c in item["checks"] if c["field"] == field), None)
        if found is None:
            mismatches.append({"lp_id": lp_id, "field": field, "problem": "check missing"})
        elif found["recomputed"] != wanted:
            mismatches.append({"lp_id": lp_id, "field": field, "kernel": found["recomputed"], "python": wanted})
        elif found["status"] != "PASS":
            mismatches.append({"lp_id": lp_id, "field": field, "problem": f"status {found['status']}"})
record("every-allocation-and-ending-agrees", not mismatches, mismatches)

fund_checks = {c["field"]: c for c in (kernel.get("fund") or {}).get("checks", [])}
record("recomputed-fund-sum-matches-python-total",
       fund_checks.get("recomputed_lp_sum_vs_nav", {}).get("recomputed") == expected["fund_nav"],
       {"kernel": fund_checks.get("recomputed_lp_sum_vs_nav", {}).get("recomputed"), "python": expected["fund_nav"]})

report = {
    "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
    "evidence": "JAVASCRIPT_KERNEL_VS_PYTHON_DECIMAL_ON_THE_SAME_FIXTURE_TECHNICAL_TEST_ONLY",
    "fixture": "inputs.json",
    "input_classification": inputs["statements"]["source"]["classification"],
    "checks": checks,
    "lps": len(expected["lps"]),
    "fund_nav": expected["fund_nav"],
}
(HERE / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": report["status"], "checks": len(checks), "failed": [c["id"] for c in checks if c["status"] != "PASS"]}))
