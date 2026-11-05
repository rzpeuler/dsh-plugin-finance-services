"""Record the B05 creator-side sample as stage evidence with artifact hashes."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = Path(__file__).parent
ACCEPTANCE = ROOT / "acceptance"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


verification = json.loads((SAMPLE / "verification.json").read_text(encoding="utf-8"))
artifacts = ["B05_DCF_TEST_ONLY.xlsx", "B05_DCF_TEST_ONLY.pdf", "build/B05_DCF_TEST_ONLY_uncalculated.xlsx"]
evidence = {
    "stage": "P4",
    "id": "B05_DCF_CREATOR_SIDE_SAMPLE",
    "status": verification["status"],
    "claim": "CREATOR_SIDE_OFFICE_CAPABILITY_SAMPLE_NOT_AGENT_DELIVERY",
    "business": "finance-model-builder / dcf-model direct Skill method",
    "classification": "TEST_ONLY",
    "generatedAt": None,
    "artifacts": [{"path": f"samples/p4/b05-dcf/{a}", "bytes": (SAMPLE / a).stat().st_size, "sha256": sha(SAMPLE / a)}
                  for a in artifacts],
    "recalculatedBy": "LIBREOFFICE_KIT_NATIVE_BACKEND",
    "independentBaseline": verification["baseline"],
    "recalculated": verification["recalculated"],
    "checks": verification["checks"],
    "notClaimed": [
        "Agent or Worker execution",
        "Native Bundle Tool registration",
        "Commercial data or licensing",
        "Comps, precedents, LBO, three-statement, football field or deck",
        "P5 review gate or approval",
        "Visual layout inspection"
    ],
    "blockedProducer": {
        "confinementControls": ["acceptance/P4-native-startup-matrix-006.json", "acceptance/P4-office-env-control-007.json",
                                "acceptance/P4-office-confinement-read-control-008.json"],
        "finding": "Six fixed calls under native confinement exit 0xC0000142 with empty output, including a Windows system executable",
        "binaryWriteGap": "ctx.fs exposes no binary workspace write or artifact publication"
    }
}
out = ACCEPTANCE / "P4-b05-dcf-creator-sample.json"
out.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"status": evidence["status"], "artifacts": len(evidence["artifacts"]), "report": str(out)}, ensure_ascii=False))
