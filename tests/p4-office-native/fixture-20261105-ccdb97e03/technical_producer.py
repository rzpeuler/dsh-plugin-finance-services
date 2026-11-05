"""Fixed TECHNICAL_TEST_ONLY producer. Not financial work or model-owned code."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import time

input_path, action = Path(sys.argv[1]), sys.argv[2]
request = json.loads(input_path.read_text(encoding="utf-8"))
assert set(request) == {"root", "runId", "trust", "inputs", "pdfBase64"}
assert request["trust"] == "TECHNICAL_TEST_ONLY"
assert request["inputs"] == [17, 25]
root = Path(request["root"])
assert root.is_absolute() and root.is_dir() and not root.is_symlink()
assert input_path.parent.resolve() == root.resolve()
marker = json.loads((root / "RUN_ROOT.json").read_text(encoding="utf-8"))
assert marker["runId"] == request["runId"] and marker["trust"] == request["trust"]


def target(name):
    assert "/" not in name and "\\" not in name and name not in {".", ".."}
    path = root / name
    assert not path.is_symlink() and path.parent.resolve() == root.resolve()
    return path


def publish(name, writer):
    final, staging = target(name), target("staging-" + name)
    assert not final.exists() and not staging.exists()
    # Reserve the private stage exclusively; libraries write only this reserved path.
    with staging.open("xb"):
        pass
    writer(staging)
    assert staging.is_file() and not staging.is_symlink() and staging.stat().st_size > 0
    os.link(staging, final)  # Complete-file atomic no-replace; preserve stage/history.
    return {"name": name, "bytes": final.stat().st_size,
            "sha256": hashlib.sha256(final.read_bytes()).hexdigest()}


def json_output(name, value):
    return publish(name, lambda p: p.write_text(json.dumps(value, indent=2), encoding="utf-8"))


if action == "cancel":
    json_output("cancellation.started.json", {"trust": request["trust"], "started": True})
    time.sleep(60)
    json_output("cancellation.UNEXPECTED.json", {"unexpectedLateWrite": True})
elif action == "create":
    from openpyxl import Workbook, load_workbook
    from docx import Document
    from pptx import Presentation
    from pptx.util import Inches
    book = Workbook()
    sheet = book.active
    sheet.title = "Technical"
    sheet.append(["TECHNICAL_TEST_ONLY - not financial work"])
    sheet["A2"], sheet["A3"], sheet["A4"] = 17, 25, "=SUM(A2:A3)"
    outputs = [publish("technical-source.xlsx", book.save)]
    doc = Document()
    doc.add_heading("TECHNICAL_TEST_ONLY", 0)
    doc.add_paragraph("Native Office capability probe. Not a financial business deliverable.")
    outputs.append(publish("technical.docx", doc.save))
    deck = Presentation()
    slide = deck.slides.add_slide(deck.slide_layouts[6])
    slide.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(2)).text = "TECHNICAL_TEST_ONLY\nNot financial work."
    outputs.append(publish("technical.pptx", deck.save))
    assert load_workbook(target("technical-source.xlsx"), data_only=False)["Technical"]["A4"].value == "=SUM(A2:A3)"
    assert any("TECHNICAL_TEST_ONLY" in p.text for p in Document(target("technical.docx")).paragraphs)
    reopened = Presentation(target("technical.pptx"))
    assert len(reopened.slides) == 1 and any("TECHNICAL_TEST_ONLY" in s.text for s in reopened.slides[0].shapes if s.has_text_frame)
    json_output("structure-check.json", {"status": "PASSED", "trust": request["trust"], "outputs": outputs})
elif action == "verify-recalc":
    from openpyxl import load_workbook
    path = target("technical-recalculated.xlsx")
    formula = load_workbook(path, data_only=False)["Technical"]["A4"].value
    cached = load_workbook(path, data_only=True)["Technical"]["A4"].value
    assert formula == "=SUM(A2:A3)" and cached == 42, (formula, cached)
    json_output("recalculation-check.json", {"status": "PASSED", "formula": formula, "cached": cached,
                                            "cacheSource": "NATIVE_LIBREOFFICE_RECALC_NOT_HAND_FILLED"})
elif action == "publish-pdf":
    pdf = base64.b64decode(request["pdfBase64"], validate=True)
    assert 5 < len(pdf) <= 16 * 1024 * 1024 and pdf.startswith(b"%PDF-")
    json_output("pdf-check.json", {"status": "PASSED", "output": publish("technical.pdf", lambda p: p.write_bytes(pdf)),
                                  "validation": "nonempty and PDF signature only; not visual validation"})
else:
    raise ValueError("Unsupported fixed action")
