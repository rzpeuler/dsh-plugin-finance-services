# B05 DCF sample — creator-side Office capability evidence

**Status: TEST_ONLY, creator-side, NOT an Agent-driven delivery, NOT reviewed, NOT distributable.**

This sample exists to pin down what a future native Office producer must satisfy for
`finance-model-builder` / the `dcf-model` Skill method: a live, auditable five-year DCF with a
scenario selector, a working-capital-aware free-cash-flow build, a Gordon terminal value and three
5×5 sensitivity grids that must tie back to the explicit model.

It is produced by the **creator's** Office toolchain (Python `openpyxl` + LibreOffice Kit), not by a
Finance Agent or a Bundle Tool. The plugin-side producer is currently blocked: see
[P4 acceptance §0.4.0-alpha.1](../..//acceptance/P4.md) — six fixed calls under the native Windows
confinement runner exit `0xC0000142`, and the public Host filesystem exposes no binary workspace
write.

## Files

| File | Meaning |
| --- | --- |
| `B05_DCF_TEST_ONLY.xlsx` | Deliverable: recalculated workbook with live formulas **and** cached values |
| `B05_DCF_TEST_ONLY.pdf` | PDF rendered by LibreOffice Kit from the recalculated workbook |
| `build/B05_DCF_TEST_ONLY_uncalculated.xlsx` | Recalculation input; formulas without caches |
| `build_dcf.py` | Deterministic builder (all inputs and layout) |
| `verify_dcf.py` | Re-open, structural checks, independent decimal baseline |
| `verification.json` | Machine result of the last verification run |

## Workbook contents

- **Cover** — classification, entity, units, asOf, colour convention, limitations, missing upstream assets.
- **Inputs** — blue hard-coded operating/market inputs; Bear/Base/Bull rows; `CHOOSE`-driven active
  assumptions; data-validated scenario selector (`1..3`).
- **WACC** — CAPM cost of equity, after-tax cost of debt, capital structure, WACC (active scenario).
- **DCF** — FY2025E–FY2029E revenue → EBITDA → D&A → EBIT → tax → NOPAT → capex/ΔNWC → FCF →
  discount factors → PV; Gordon terminal value; EV → net debt → equity → value per share; four model checks.
- **Sensitivity** — three 5×5 live grids: WACC × g, WACC × margin, g × margin. Each grid cell is a
  closed-form equivalent of the explicit model; every grid centre is required to equal `DCF!B36`.
- **Checks** — grid-centre ties, an independent WACC recompute, EV/equity bridge identities,
  selector range, DCF check roll-up, 75-cell population, minimum-positive grid value.

## Reproduce

```text
python samples/p4/b05-dcf/build_dcf.py
node <libreoffice-kit cli> recalculate --input samples/p4/b05-dcf/build/B05_DCF_TEST_ONLY_uncalculated.xlsx \
     --output samples/p4/b05-dcf/B05_DCF_TEST_ONLY.xlsx
python samples/p4/b05-dcf/verify_dcf.py
node <libreoffice-kit cli> convert --input samples/p4/b05-dcf/B05_DCF_TEST_ONLY.xlsx \
     --output samples/p4/b05-dcf/B05_DCF_TEST_ONLY.pdf
```

## Verified (creator-side)

- 261 live formulas are preserved after recalculation; no formula was replaced by a constant.
- LibreOffice recalculated the workbook (native backend, no missing fonts).
- Every `Checks` status is `OK`; the three grid centres equal the DCF value per share within `0.01`.
- An **independent Python `Decimal` baseline** reproduces WACC `7.775%`, EV `2,287.68` and value per
  share `21.3768` (workbook values agree within `0.05` / `0.01`).
- All forecast FCFs are positive and the growth row equals the scenario growth.
- The PDF carries a `%PDF-` signature and is non-empty (100,190 bytes).

## Not claimed

- Not an Agent or Worker execution; no model turn produced these numbers.
- Not a commercial data product: inputs are synthetic `TEST_ONLY` values, and the DCF is the direct
  Skill method — not the comps-first `/dcf` command.
- No comps, precedents, LBO, three-statement model, football field or pitch deck.
- No sensitivity to WACC-per-scenario, no mid-year convention, no probability weighting.
- No P5 review gate: the file is a draft and must not be distributed, posted or signed off.
- Structure and numbers are machine-checked; **visual layout was not inspected**.
