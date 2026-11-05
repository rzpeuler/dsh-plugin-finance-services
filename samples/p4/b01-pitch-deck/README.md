# B01 pitch deck — creator-side PPTX sample

**TEST_ONLY · creator-side · DRAFT, not reviewed, not distributable.**

Business: `finance-pitch-agent` (researcher → modeler → deck-writer). Only the deck-writer output
format is represented: no researcher or modeler ran, and no model turn produced these figures.

## Slides

1. Title — target, framing, classification
2. Situation and why now — including what this sample deliberately omits
3. Business snapshot — base-year inputs
4. Valuation — DCF summary, **read from the verified B05 workbook**
5. Sensitivity — WACC × terminal growth 5×5 per-share grid, **read from the same workbook**
6. Key risks and diligence items
7. Sources, scope and limitations

The deck never recomputes valuations itself: `build_deck.py` loads `B05_DCF_TEST_ONLY.xlsx` and
refuses to build if the sensitivity grid contains empty cells. `verify_office.py` then compares every
deck cell back to the workbook and fails on any drift beyond `0.01`.

## Verified

- OOXML integrity; seven slides, each with content.
- Value per share, WACC and terminal growth match the workbook.
- All 25 sensitivity cells match the workbook within `0.01`.
- `TEST_ONLY`/`DRAFT` classification visible.

## Not claimed

No Agent/Worker execution, no commercial data, no comps or precedent transactions, no LBO, no
three-statement model or football field, no P5 approval, and no visual inspection — the deck was
never rendered, so overflow, contrast and font substitution are unchecked.
