"""Verify the B06 workpaper against the extracts, the kernel result and an independent recount.

Also writes the stage evidence record with artifact hashes.
"""
import hashlib
import json
import zipfile
from decimal import Decimal
from pathlib import Path

from openpyxl import load_workbook

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
ACCEPTANCE = ROOT / "acceptance"
WORKPAPER = HERE / "B06_RECON_WORKPAPER_TEST_ONLY.xlsx"
REPORT = HERE / "verification.json"

D = Decimal
BUCKETS = ["MATCHED", "AMOUNT_BREAK", "QUANTITY_BREAK", "TIMING_BREAK", "GL_ONLY", "SUBLEDGER_ONLY"]
inputs = json.loads((HERE / "inputs.json").read_text(encoding="utf-8"))
kernel = json.loads((HERE / "kernel-result.json").read_text(encoding="utf-8"))
checks = []


def record(name, ok, detail=None):
    checks.append({"id": name, "status": "PASS" if ok else "FAIL", **({"detail": detail} if detail else {})})


# ---------------------------------------------------------------- independent recount
def key_of(r):
    return (r["entity"], r["tradeDate"], r["assetClass"], r["currency"], r["commonKey"])


gl = {key_of(r): r for r in inputs["gl"]["records"]}
sub = {key_of(r): r for r in inputs["subledger"]["records"]}
tol, qtol = D(inputs["tolerances"]["amount"]), D(inputs["tolerances"]["quantity"])


def bucket_of(a, b):
    if a is None:
        return "SUBLEDGER_ONLY"
    if b is None:
        return "GL_ONLY"
    if abs(D(a["quantity"]) - D(b["quantity"])) > qtol:
        return "QUANTITY_BREAK"
    if (abs(D(a["localAmount"]) - D(b["localAmount"])) > tol or abs(D(a["baseAmount"]) - D(b["baseAmount"])) > tol
            or a["fxRate"] != b["fxRate"]):
        return "AMOUNT_BREAK"
    if a["postingDate"] != b["postingDate"]:
        return "TIMING_BREAK"
    return "MATCHED"


keys = sorted(set(gl) | set(sub))
buckets = {k: bucket_of(gl.get(k), sub.get(k)) for k in keys}
counts = {b: sum(1 for v in buckets.values() if v == b) for b in BUCKETS}
breaks = sorted(k for k, v in buckets.items() if v != "MATCHED")

with zipfile.ZipFile(WORKPAPER) as archive:
    record("ooxml-integrity", archive.testzip() is None and "[Content_Types].xml" in archive.namelist(),
           {"entries": len(archive.namelist()), "bytes": WORKPAPER.stat().st_size})

wb = load_workbook(WORKPAPER, data_only=True)
record("sheets-present", {"Summary", "Breaks", "GL extract", "Subledger extract", "Controls"} <= set(wb.sheetnames),
       wb.sheetnames)

# ---------------------------------------------------------------- summary
summary = wb["Summary"]
found_counts, found_independent = {}, {}
for row in range(1, summary.max_row + 1):
    label = summary[f"A{row}"].value
    if label in BUCKETS:
        found_counts[label] = summary[f"B{row}"].value
        found_independent[label] = summary[f"C{row}"].value
record("summary-counts-match-kernel", found_counts == {b: kernel["summary"]["counts"][b] for b in BUCKETS}, found_counts)
record("summary-independent-column-matches-recount", found_independent == counts, found_independent)

# ---------------------------------------------------------------- breaks
ws = wb["Breaks"]
rows = []
for row in range(2, ws.max_row + 1):
    if ws[f"A{row}"].value is None:
        continue
    rows.append({
        "key": ws[f"A{row}"].value, "bucket": ws[f"B{row}"].value,
        "gl": ws[f"C{row}"].value, "sub": ws[f"D{row}"].value, "delta": ws[f"E{row}"].value,
        "rootCause": ws[f"K{row}"].value, "evidence": ws[f"L{row}"].value, "critic": ws[f"M{row}"].value,
    })
record("break-row-count", len(rows) == len(breaks), {"workpaper": len(rows), "independent": len(breaks)})
record("break-keys-match-independent-set",
       sorted(r["key"] for r in rows) == sorted(k[4] for k in breaks),
       sorted(r["key"] for r in rows))
mismatch = []
for row in rows:
    match = next(k for k in breaks if k[4] == row["key"])
    a, b = gl.get(match), sub.get(match)
    expected = (D(a["baseAmount"]) if a else D(0)) - (D(b["baseAmount"]) if b else D(0))
    if row["delta"] is None or abs(D(str(row["delta"])) - expected) > D("0.005"):
        mismatch.append({"key": row["key"], "delta": row["delta"], "expected": str(expected)})
record("break-deltas-match-independent-arithmetic", not mismatch, {"mismatches": mismatch})
record("break-cause-not-inferred",
       all(r["rootCause"] == "unknown" and r["evidence"] == "NEEDS_EVIDENCE" and r["critic"] == "NOT_PERFORMED" for r in rows))

# ---------------------------------------------------------------- extracts
record("gl-extract-rows", wb["GL extract"].max_row - 1 == len(inputs["gl"]["records"]),
       {"rows": wb["GL extract"].max_row - 1})
record("subledger-extract-rows", wb["Subledger extract"].max_row - 1 == len(inputs["subledger"]["records"]),
       {"rows": wb["Subledger extract"].max_row - 1})

# ---------------------------------------------------------------- controls
ws = wb["Controls"]
statuses = {}
for row in range(4, ws.max_row + 1):
    label = ws[f"A{row}"].value
    status = ws[f"B{row}"].value
    if label and status in ("PASS", "FAIL"):
        statuses[label] = status
record("controls-all-pass", len(statuses) >= 10 and all(v == "PASS" for v in statuses.values()),
       {"count": len(statuses), "failed": [k for k, v in statuses.items() if v != "PASS"]})

# ---------------------------------------------------------------- kernel governance
record("kernel-status-is-draft", kernel["status"] == "DRAFT_REVIEW_REQUIRED", kernel["status"])
record("kernel-no-posting-or-publish", kernel["posting"] is False and kernel["publish"] is False)
record("kernel-journal-entries-draft-only",
       kernel["journalEntries"]["status"] == "DRAFT_ONLY" and kernel["journalEntries"]["entries"] == [])
record("kernel-critic-and-signoff-not-claimed",
       kernel["checks"]["independentTrustedCritic"] == "NOT_PERFORMED" and kernel["controllerSignoff"] == "PENDING")
record("kernel-underlying-evidence-flagged",
       kernel["checks"]["underlyingTransactions"] == "NEEDS_EVIDENCE")
record("kernel-matched-fraction-exact",
       kernel["summary"]["matchedPercentage"] == {"numerator": str(counts["MATCHED"] * 100),
                                                  "denominator": str(len(keys))},
       kernel["summary"]["matchedPercentage"])
record("kernel-classification-test-only", kernel["classification"] == "TEST_ONLY")

result = {
    "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
    "evidence": "KERNEL_OUTPUT_WORKPAPER_AND_INDEPENDENT_RECOUNT_AGREE_NOT_NATIVE_OR_COMMERCIAL",
    "workpaper": WORKPAPER.name,
    "counts": counts,
    "breaks": len(breaks),
    "checks": checks,
}
REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

if result["status"] == "PASS":
    def sha(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    artifacts = [
        ("samples/p4/b06-recon/B06_RECON_WORKPAPER_TEST_ONLY.xlsx", "reconciliation workpaper"),
        ("samples/p4/b06-recon/kernel-result.json", "GL kernel output"),
        ("samples/p4/b06-recon/inputs.json", "TEST_ONLY GL and subledger extracts"),
    ]
    evidence = {
        "stage": "P4",
        "id": "B06_GL_RECONCILIATION_CREATOR_SIDE_SAMPLE",
        "status": "PASS",
        "claim": "KERNEL_TO_WORKPAPER_WITH_INDEPENDENT_RECOUNT_NOT_AGENT_DELIVERY",
        "business": "finance-gl-reconciler (reader → critic → resolver); numerical subcheck only",
        "classification": "TEST_ONLY",
        "artifacts": [{"path": p, "bytes": (ROOT / p).stat().st_size, "sha256": sha(ROOT / p), "role": role}
                      for p, role in artifacts],
        "counts": counts,
        "breaks": len(breaks),
        "checksPassed": sum(1 for c in checks if c["status"] == "PASS"),
        "checksFailed": sum(1 for c in checks if c["status"] != "PASS"),
        "checks": checks,
        "notClaimed": [
            "Agent or Worker execution", "Ledger, subledger or vendor system access",
            "Trusted independent critic", "Root cause, owner, clearing date or journal entry",
            "Controller sign-off", "Posting, publishing or period close",
        ],
    }
    (ACCEPTANCE / "P4-b06-recon-creator-sample.json").write_text(
        json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

print(json.dumps({"status": result["status"], "passed": sum(1 for c in checks if c["status"] == "PASS"),
                  "failed": [c["id"] for c in checks if c["status"] != "PASS"]}, ensure_ascii=False))
