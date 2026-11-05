# B06 GL reconciliation — creator-side workpaper

**TEST_ONLY · creator-side · draft for investigation, not posted or signed off.**

Business: `finance-gl-reconciler` (reader → critic → resolver). This sample covers the **numerical
reconciliation subcheck only**: no ledger or subledger system was read, and no Worker ran.

## Pipeline

```text
make_inputs.py        → inputs.json          (16 synthetic keys: 15 GL rows, 15 subledger rows)
run_kernel.mjs        → kernel-result.json   (shipped kernel: src/business/gl-reconciliation.js)
build_workpaper.py    → B06_RECON_WORKPAPER_TEST_ONLY.xlsx
verify_workpaper.py   → verification.json + acceptance/P4-b06-recon-creator-sample.json
```

The workpaper is built **from the kernel output**, and the `Controls` sheet carries an independent
`Decimal` recount of the same extracts, so kernel, product and reviewer are three separate
comparisons rather than one number repeated.

## Expected classification (by construction)

| Bucket | Count | Why |
| --- | ---: | --- |
| MATCHED | 10 | identical records, including K10 which differs by exactly `0.01` (tolerance is inclusive) |
| AMOUNT_BREAK | 2 | K11 base amount differs by `25.00`; K14 amounts agree but the FX rate differs |
| QUANTITY_BREAK | 1 | K12 quantity `1000` vs `995` with identical amounts |
| TIMING_BREAK | 1 | K13 posting date `2025-09-30` vs `2025-10-01` |
| GL_ONLY | 1 | K15 exists only in the GL extract |
| SUBLEDGER_ONLY | 1 | K16 exists only in the subledger extract |

Joined rows `16`, matched fraction `1000/16` (exact fraction, never a rounded percentage).

## Verified

18 checks pass: OOXML integrity, sheet set, bucket counts against both the kernel and an independent
recount, break-key set, break deltas against independent arithmetic, extract row counts, all ten
Controls `PASS`, and the governance claims below.

## Governance boundaries kept by the kernel

- `status = DRAFT_REVIEW_REQUIRED`; no root cause, owner, clearing date or journal entry is inferred.
- `journalEntries.status = DRAFT_ONLY` with no entries; `posting` and `publish` are `false`.
- `underlyingTransactions = NEEDS_EVIDENCE`; the independent trusted critic is `NOT_PERFORMED`;
  controller sign-off is `PENDING`. Caller-supplied data cannot satisfy an internal-gl/subledger critic.
- No cross-currency netting: totals are kept per currency, and quantities per unit.

## Not claimed

No Agent/Worker execution, no real ledger access, no trusted critic, no clearance or posting, no
controller sign-off, and no visual inspection of the workbook.
