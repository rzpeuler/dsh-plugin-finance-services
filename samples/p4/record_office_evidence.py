"""Record the DOCX/PPTX creator-side samples as stage evidence with hashes."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P4 = Path(__file__).parent
ACCEPTANCE = ROOT / "acceptance"
REPORT = P4 / "creator-office-verification.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


verification = json.loads(REPORT.read_text(encoding="utf-8"))
if verification["status"] != "PASS":
    raise SystemExit("refusing to record a failing verification")

artifacts = [
    ("B03", "samples/p4/b03-earnings-note/B03_EARNINGS_NOTE_TEST_ONLY.docx", "finance-earnings-reviewer note"),
    ("B01", "samples/p4/b01-pitch-deck/B01_PITCH_DECK_TEST_ONLY.pptx", "finance-pitch-agent deck"),
]
evidence = {
    "stage": "P4",
    "id": "B03_DOCX_B01_PPTX_CREATOR_SIDE_SAMPLE",
    "status": "PASS",
    "claim": "CREATOR_SIDE_OFFICE_FORMAT_SAMPLES_NOT_AGENT_DELIVERY",
    "classification": "TEST_ONLY",
    "artifacts": [{"business": business, "path": path, "bytes": (ROOT / path).stat().st_size, "sha256": sha(ROOT / path)}
                  for _, path, business in artifacts],
    "crossArtifact": {
        "deckReads": "samples/p4/b05-dcf/B05_DCF_TEST_ONLY.xlsx",
        "checked": ["value per share", "WACC", "terminal growth", "25 sensitivity cells"],
        "tolerance": 0.01
    },
    "checks": verification["checks"],
    "checksPassed": sum(1 for c in verification["checks"] if c["status"] == "PASS"),
    "checksFailed": sum(1 for c in verification["checks"] if c["status"] != "PASS"),
    "notClaimed": [
        "Agent or Worker execution",
        "Licensed or commercial data",
        "Real transcript or mandate",
        "Comps, precedents, LBO, three-statement or football field",
        "P5 review gate or approval",
        "Visual rendering or layout inspection"
    ]
}
out = ACCEPTANCE / "P4-office-docx-pptx-creator-sample.json"
out.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"status": evidence["status"], "checks": evidence["checksPassed"], "artifacts": len(evidence["artifacts"])},
                 ensure_ascii=False))
