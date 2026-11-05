# B03 earnings note — creator-side DOCX sample

**TEST_ONLY · creator-side · DRAFT, not reviewed, not distributable.**

Business: `finance-earnings-reviewer` (transcript-reader → model-updater → note-writer). This is the
note-writer output format only; no Worker ran and no model turn produced these figures.

## Structure

1. Quarter at a glance — actual vs consensus vs prior model, with variance in percent and basis points
2. What management said — three labelled transcript paraphrases
3. Guidance and revisions — prior vs new ranges
4. Model update (FY2026E) — prior vs new revenue/EBITDA/margin/EPS with recomputed deltas
5. Thesis and what would change it — claims and risks
6. Sources, scope and limitations — explicit `NOT_USED` / `NOT_RUN` rows

Every variance in the document is computed in `build_note.py` from the stated inputs; none is typed
twice. `verify_office.py` recomputes the same figures independently and fails if the document
disagrees.

## Verified

- OOXML package integrity, required sections present, four tables.
- `TEST_ONLY`/`DRAFT` classification visible; licensed-data row states `NOT_USED` (no FactSet/Daloopa).
- Revenue variance vs consensus (`+1.9%`), vs prior (`+2.9%`), FY2026E revenue revision (`+2.6%`) and
  margin variance (`+10 bp`) each match an independent recomputation.

## Not claimed

No Agent/Worker execution, no licensed or commercial data, no real transcript, no original coverage
workbook update, no P5 approval, and no visual inspection — layout was never rendered.
