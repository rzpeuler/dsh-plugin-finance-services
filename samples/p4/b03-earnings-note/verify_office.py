"""Verify the B03 DOCX and B01 PPTX samples, including cross-artifact consistency."""
import json
import re
import zipfile
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

ROOT = Path(__file__).resolve().parents[3]
NOTE = Path(__file__).resolve().parents[1] / "b03-earnings-note" / "B03_EARNINGS_NOTE_TEST_ONLY.docx"
DECK = Path(__file__).resolve().parents[1] / "b01-pitch-deck" / "B01_PITCH_DECK_TEST_ONLY.pptx"
WORKBOOK = Path(__file__).resolve().parents[1] / "b05-dcf" / "B05_DCF_TEST_ONLY.xlsx"
REPORT = Path(__file__).resolve().parents[1] / "creator-office-verification.json"

D = Decimal
checks = []


def record(name, ok, detail=None):
    checks.append({"id": name, "status": "PASS" if ok else "FAIL", **({"detail": detail} if detail else {})})


def q(value, places):
    return D(value).quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- OOXML integrity
for path, member in ((NOTE, "word/document.xml"), (DECK, "ppt/presentation.xml")):
    with zipfile.ZipFile(path) as archive:
        record(f"ooxml-integrity-{path.suffix.lstrip('.')}",
               archive.testzip() is None and "[Content_Types].xml" in archive.namelist() and member in archive.namelist(),
               {"entries": len(archive.namelist()), "bytes": path.stat().st_size})

# ---------------------------------------------------------------- DOCX
doc = Document(NOTE)
text = "\n".join(p.text for p in doc.paragraphs)
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            text += "\n" + cell.text
headings = [p.text for p in doc.paragraphs if p.style.name.startswith("Heading")]
normalized = [re.sub(r"^[0-9]+\.\s*", "", h).strip() for h in headings]
required = ["Quarter at a glance", "What management said", "Guidance and revisions",
            "Model update", "Thesis and what would change it", "Sources, scope and limitations"]
record("docx-required-sections",
       all(any(h.startswith(r) for h in normalized) for r in required), normalized)
record("docx-table-count", len(doc.tables) == 4, {"tables": len(doc.tables)})
record("docx-classification-visible", "TEST_ONLY" in text and "DRAFT" in text)
record("docx-no-licensed-data-claim", "NOT_USED" in text and "FactSet" in text)

# independent recomputation of the reported variances
actual, consensus, prior = D("1050"), D("1030"), D("1020")
expected_revenue_vs_consensus = q((actual - consensus) / consensus * 100, 1)
expected_revenue_vs_prior = q((actual - prior) / prior * 100, 1)
note_values = f"{expected_revenue_vs_consensus:+.1f}%".replace("-", "−")
note_values_prior = f"{expected_revenue_vs_prior:+.1f}%".replace("-", "−")
record("docx-variance-matches-independent-recompute",
       note_values in text and note_values_prior in text,
       {"vs_consensus": note_values, "vs_prior": note_values_prior})

old_fy, new_fy = D("1140"), D("1170")
expected_delta = f"{q((new_fy - old_fy) / old_fy * 100, 1):+.1f}%".replace("-", "−")
record("docx-estimate-revision-matches-recompute", expected_delta in text, {"delta": expected_delta})

margin_bp = (D("210") / D("1050") - D("205") / D("1030")) * 10000
record("docx-margin-variance-in-basis-points", f"{q(margin_bp, 0):+.0f} bp" in text,
       {"recomputed": f"{q(margin_bp, 0):+.0f} bp"})

# ---------------------------------------------------------------- PPTX
prs = Presentation(DECK)
record("pptx-slide-count", len(prs.slides) == 7, {"slides": len(prs.slides)})
titles = []
for index, slide in enumerate(prs.slides, start=1):
    words = [sh.text_frame.text for sh in slide.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
    if slide.shapes.title is not None and slide.shapes.title.text.strip():
        titles.append(slide.shapes.title.text)
    record(f"pptx-slide-{index}-has-content", bool(words))

values = load_workbook(WORKBOOK, data_only=True)
dcf = values["DCF"]
expected_per_share = q(dcf["B36"].value, 2)
deck_text = "\n".join(sh.text_frame.text for slide in prs.slides for sh in slide.shapes if sh.has_text_frame)
for table_shape in [sh for slide in prs.slides for sh in slide.shapes if sh.has_table]:
    for row in table_shape.table.rows:
        deck_text += "\n" + " | ".join(cell.text for cell in row.cells)
record("pptx-per-share-matches-workbook", f"{expected_per_share:,.2f}" in deck_text,
       {"expected": f"{expected_per_share:,.2f}"})

expected_wacc = q(dcf["B24"].value * 100, 2)
expected_g = q(dcf["B23"].value * 100, 2)
record("pptx-wacc-and-growth-match-workbook",
       f"{expected_wacc:.2f}%" in deck_text and f"{expected_g:.2f}%" in deck_text,
       {"wacc": f"{expected_wacc:.2f}%", "growth": f"{expected_g:.2f}%"})

sens = values["Sensitivity"]
label_row = next(r for r in range(1, 60) if sens[f"A{r}"].value == "Base factor K (base margin)")
header_row = label_row + 1
grid_rows = list(range(header_row + 1, header_row + 6))
book_grid = [[sens[f"{c}{r}"].value for c in "BCDEF"] for r in grid_rows]

deck_grid = None
for slide in prs.slides:
    for shape in slide.shapes:
        if shape.has_table and len(shape.table.rows) == 6 and len(shape.table.columns) == 6:
            deck_grid = [[shape.table.cell(r, c).text for c in range(6)] for r in range(6)]
record("pptx-sensitivity-table-present", deck_grid is not None)
if deck_grid:
    mismatches = []
    for r in range(5):
        for c in range(5):
            cell = D(deck_grid[r + 1][c + 1].replace(",", ""))
            if abs(cell - q(book_grid[r][c], 2)) > D("0.01"):
                mismatches.append({"row": r, "col": c, "deck": str(cell), "book": str(q(book_grid[r][c], 2))})
    record("pptx-sensitivity-matches-workbook", not mismatches, {"mismatches": mismatches})

record("pptx-disclaimer-visible", "TEST_ONLY" in deck_text and "DRAFT" in deck_text)

result = {"status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
          "evidence": "OOXML_STRUCTURE_TEXT_AND_CROSS_ARTIFACT_CONSISTENCY_NOT_VISUAL",
          "artifacts": {"docx": {"path": str(NOTE.relative_to(ROOT)).replace("\\", "/"), "bytes": NOTE.stat().st_size},
                        "pptx": {"path": str(DECK.relative_to(ROOT)).replace("\\", "/"), "bytes": DECK.stat().st_size}},
          "checks": checks}
REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"status": result["status"], "failed": [c["id"] for c in checks if c["status"] == "FAIL"]},
                 ensure_ascii=False))
