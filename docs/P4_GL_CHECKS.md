# B06 GL/subledger deterministic check kernel — limited scope

Status: **TEST_ONLY kernel checks passed; not B06 business execution or P4 acceptance.** P3 stays PARTIAL; P4-FIN-CHECK is not all-pass. No Worker, commercial provider, Office, independent critic or P5 approval gate was run by these checks.

## Source basis read before implementation

- [P3 approved independence exception](<../acceptance/P3-stage-exception-approved.md#L20-L26>) and [P4 criteria](<../acceptance/P4.md#L13-L23>).
- [B06 source map](<P4_BUSINESS_MAP.md#L46-L50>).
- Original [gl-recon](<../assets/source-archive/plugins/agent-plugins/gl-reconciler/skills/gl-recon/SKILL.md#L8-L53>): normalize common grain/dates/units; full outer join; six buckets; amount tolerance 0.01 and quantity 0; break list/counts/totals/matched percentage.
- Original [break-trace](<../assets/source-archive/plugins/agent-plugins/gl-reconciler/skills/break-trace/SKILL.md#L10-L39>): underlying transactions on both sides are required for cause/owner/clear-date/action; diagnosis never posts.
- Original [critic](<../assets/source-archive/managed-agent-cookbooks/gl-reconciler/subagents/critic.yaml#L5-L18>): independent trusted internal GL/subledger checks, not counterparty files.
- Original [main guardrails](<../assets/source-archive/plugins/agent-plugins/gl-reconciler/agents/gl-reconciler.md#L19-L29>): transaction trace then independent verification before resolver; no ledger posting.

## API and explicit adaptations

[Kernel](<../src/business/gl-reconciliation.js>) exports `reconcileGl(jsonText)` and the Zod 4 `glReconciliationInputSchema` for parsing that JSON string. The function applies additional cross-record scope/duplicate/unit checks after schema parsing. No object API is accepted: getters, proxies and cycles are rejected without inspection. No filesystem/network/LLM/SDK, arbitrary code/formula evaluation, tool definition or registration is present.

Strict JSON input shape (all record fields required; example is synthetic caller data):

```json
{
  "classification": "TEST_ONLY",
  "scope": {"entity":"TEST_FUND","tradeDate":"2026-11-04","asOf":"2026-11-05","assetClasses":["EQUITY"]},
  "gl": {"asOf":"2026-11-05","records":[{
    "entity":"TEST_FUND","tradeDate":"2026-11-04","assetClass":"EQUITY","currency":"USD","commonKey":"ABC_ACCOUNT1",
    "postingDate":"2026-11-04","localAmount":"10.00","baseAmount":"10.00","baseCurrency":"USD","amountScale":"ONES",
    "quantity":"1","quantityScale":"ONES","quantityUnit":"SHARES","fxRate":"1"
  }]},
  "subledger": {"asOf":"2026-11-05","records":[]},
  "tolerances":{"amount":"0.01","quantity":"0"}
}
```

- Classification is exactly `TEST_ONLY | USER_PROVIDED | UNSOURCED`, a declaration rather than a license grant or real provider result. Input values remain `UNTRUSTED_DATA`; original record values are preserved under `inputData`.
- Bound: 64 KiB UTF-8 total input and 256 records **per side**, whichever binds first; 16 asset classes maximum, bounded 64-character identifiers. Larger extracts must be partitioned by caller without losing duplicate-key checks; this kernel does not certify such partitioning. Unknown fields, capability/identity/path/credential/command/provider fields and prototype keys are rejected. This is not a general secret-detection or DLP system.
- Exact dates must be real ISO calendar dates. Side `asOf` must equal scope `asOf`; trade date cannot follow `asOf`. Entity/date/class must fit scope. Identifiers/currencies are trim/uppercase normalized; duplicate normalized keys on either side are rejected, never aggregated.
- Caller provides a common key at the lowest agreed grain. Join tuple: entity, trade date, asset class, local currency, common key. Currency changes therefore produce two one-sided rows, never an implicit FX match. Base currency and semantic quantity unit must agree on paired rows.
- Money is a signed decimal string with at most 36 integer digits and 2 fractional digits; extra precision is rejected, never rounded. Quantity/FX allow 18 fractional digits. BigInt scaled arithmetic is used throughout; no hidden epsilon. Negative balances/quantities are valid; nulls, numeric JSON amounts, NaN/Infinity, exponent syntax and negative tolerances are rejected. FX rate must be explicitly positive.
- Scale enums `ONES | THOUSANDS | MILLIONS` explicitly normalize money and quantity. Quantity units are `UNITS | SHARES | CONTRACTS`. No currency conversion, scale inference, FX-rate derivation or rate-consistency verification occurs.
- Default tolerances are amount `0.01`, quantity `0`; inclusive on both local/base amounts and quantity. Explicit FX rates compare exactly. A rate difference is conservatively an amount-comparison exception, **not** a proved FX cause.
- Primary bucket precedence: one-sided, quantity, monetary/FX, posting-date, matched. All comparison-difference flags remain visible when multiple columns disagree. This is an explicit deterministic adaptation of overlapping source conditions, not additional cause evidence.
- Summary has counts, per-bucket/per-unknown-cause totals, local/base amounts grouped separately by currency, quantities grouped by class/currency/unit. No cross-currency grand total exists. Netting never overrides row-level breaks. Matched percentage is an exact rational `{numerator: matched*100, denominator: fullOuterRowCount}` in strings, or `null` for both sides empty; no invented 100%.
- Breaks sort by base currency, then absolute base-amount delta descending and canonical key as tie-breaker. Ranking across unlike currencies would imply an unprovided FX conversion, so no global converted-materiality rank is claimed.

Every row retains `rootCause: unknown`, `evidenceStatus: NEEDS_EVIDENCE` and `criticStatus: NOT_PERFORMED`, even if values match. Controller signoff is `PENDING`; journal entries are empty and `DRAFT_ONLY`; posting/publishing are false. Caller assertions cannot upgrade trust. Underlying transactions, cause/owner/clear date/action, independent trusted critic confirmation/rejection and the resolver report remain **unimplemented and unverified**. Matching is arithmetic, not approval, source authorization or independent review.

## Checks actually run

[Tests](<../tests/business-gl-reconciliation.test.js>): 24 passing Node tests cover all six join buckets, overlapping flags, default/policy tolerance boundaries, exact huge/signed/zero/18-digit values, explicit scale normalization, FX mismatch without cause inference, per-currency totals, net-offset traps, deterministic ordering and independent calls, duplicates/scope/asOf/unit failures, empty sides, null/type/nonfinite/precision/date failures, strict authority-field rejection, object/getter/proxy/cycle/prototype cases and UTF-8/row limits. Fixtures are synthetic TEST_ONLY data; no business E2E or actual data retrieval is claimed.

Run with bundled Node:

```powershell
& 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --test tests/business-gl-reconciliation.test.js
```
