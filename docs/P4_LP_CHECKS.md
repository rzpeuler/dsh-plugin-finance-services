# P4 LP capital-account tie-out numerical library

Status: **LOCAL_COMPONENT_ONLY / NOT_A_NATIVE_TOOL_OR_BUSINESS_E2E**. [P3 remains PARTIAL](<../acceptance/P3-stage-exception-approved.md>); [P4 acceptance](<../acceptance/P4.md>) is not complete.

## Public library

`@local/dsh-financial-services/business-checks/lp-v1` exports `describe()` and `tieout(jsonText)`. The [implementation](<../src/business/lp-tieout.js#L1-L170>) accepts only bounded strict JSON text and returns a DRAFT/REVIEW_REQUIRED numerical recommendation. It reads no files, calls no MCP/model, authenticates no source or license, grants no permissions and never edits or distributes statements.

The input is a separate P4 typed-extract adaptation, **not** the original narrow Worker output schema. [Source mapping](<P4_BUSINESS_MAP.md#L70-L74>) preserves the actual business: generated LP capital-account statement batch versus independently designated fund NAV pack and commitment register, not generic financial-statement auditing.

## Source checks and explicit limited profile

- [Original NAV tie-out](<../assets/source-archive/plugins/agent-plugins/statement-auditor/skills/nav-tieout/SKILL.md#L12-L38>): beginning + contributions − distributions + allocated net income − crystallized carry = ending; compare every line with inclusive `0.01` tolerance.
- Exact decimal/BigInt arithmetic; money up to six fractional places and ownership as a twelve-decimal fraction, not percent. Output remains decimal strings, without IEEE-754 rounding claims.
- The finite supported allocation profile is explicitly PRO_RATA_NET, caller-sourced LP crystallized carry, and a declared rounding method. No firm waterfall is inferred or independently validated.
- Per-line tolerance stays `0.01`. Fund NAV is checked only for complete matching LP sets and FULL coverage. The source allows “within rounding”; this adaptation requires explicit sourced fund rounding tolerance bounded by one line tolerance per LP, never silently inventing a tolerance or hiding the residual.
- Reported versus recomputed ownership, P&L/fees/expenses/carry, commitment/unfunded/recallable and total NAV are separate checks. Equal and opposite errors cannot make individual lines pass merely because the fund sum agrees.
- Prior-ending/current-beginning and optional next-beginning continuity are independent. Absent adjacent periods are `NOT_PROVIDED`, not evidence that they matched.
- Missing NAV/register/LP coverage, duplicate LP IDs, wrong entity/fund/currency/period, unknown fields, invalid dates, unsafe JSON structure or unsupported terms fail closed/HOLD. Unfunded and recallable compare with the actual supplied register; this library does not infer their business formula.

## Unverified boundaries

“Authoritative” means caller-designated input here, not proven access to the trusted `nav` MCP. Matching document IDs are rejected as non-independent, but different IDs do not authenticate documents. TEST_ONLY/USER_PROVIDED/UNSOURCED classifications are declarations, not licenses.

[Unit tests](<../tests/business-lp-tieout.test.js>) exercise calculations and counterexamples only. Real document extraction, Source Policy/Agent authorization, original three-Worker calls, Office inspection/delivery and human IR sign-off remain separate P4/P5 work. No native Tool was added and no readonly Worker gained write/Shell access.
