# FINANCE-3A-FPROV-INTEGRATION-001 — integration and acceptance report

**Capture date:** 2026-11-12 (Asia/Shanghai)

**Status:** implementation candidate; final release gates and Git publication are recorded in the dated result section below. Production A-share data access remains blocked (`UNASSESSED`).

## Scope and baseline

This work was performed only in the isolated clone and branch `codex/finance-3a-fprov-integration-001`, created from FPROV commit `bf7e1011eeb20068f6a011bb9a416078fea0ddc9`. The ancestry at baseline was `main` `1089564f9345070b44fc9c36772d2ef80a7aca15` → `feat/financial-services` `b9eeb079f9d5d4d51bc11a9299403bd7cf36e2b5` → FPROV `bf7e1011eeb20068f6a011bb9a416078fea0ddc9`. The pre-edit isolation, clean state, runtime manifest, toolchain, and known baseline regression are recorded in [the baseline](FINANCE-3A-FPROV-BASELINE.md).

The reconciled active scope is exactly **3 main Agents, 9 owned Workers, 22 Skills (13 Financial Analysis + 9 Equity Research), 16 commands, and 9 steering examples**. The 10-Agent/30-Worker catalogue is not restored. GL reconciliation and LP tie-out business modules, 271 historical acceptance paths, and 27 direct GL/LP core/test/sample paths remain intentionally out of the current tree/package. A stale unreachable `gl-reconciler` test fixture was removed; selected DCF/LBO/three-statement/comps numerical support remains for the chosen Model Builder Worker. The prior full bundle and older acceptance state remain traceable at Git commit `1089564f9345070b44fc9c36772d2ef80a7aca15`; native MCP history is summarized at `388e310bd1c919ad3841e11de5f0418aa79a0483`. No deleted catalogues, audit archives, raw source payloads, or private local data were restored or copied.

## FPROV-01 source and authorization boundary

Three A-share Adapter candidates remain separate, **unregistered and `UNASSESSED`**: Eastmoney one-day unadjusted OHLC; THS exact-symbol annual aggregate consensus EPS; and TDX exact-date local package OHLC parser. All default allowlists and direct source bindings are empty. The current task made **zero real upstream requests**, opened no user TDX package, and did not perform licensed-source E2E. Synthetic parser fixtures and mocked Fetch calls are local regression tests only.

The current Host exposes no trusted financial-license reviewer principal or source attestation API. Client-entered `VERIFIED`, evidence links, permission checkboxes, and timestamps cannot establish supplier rights. Remote attempts to write `VERIFIED` are rejected before persistence; pre-existing Client `VERIFIED` source claims are downgraded to `REVIEW_REQUIRED` in the in-memory view without rewriting the saved record. Only isolated Registry tests simulate positive verified facts; they are not production authorization. All Eastmoney/THS/TDX rights for automated access, model processing, session logging/retention, and redistribution remain unverified. See [the sanitized source matrix](../docs/FPROV01-SOURCE-MATRIX.md) and [the contract](../docs/FPROV01-ADAPTER-CONTRACT.md).

PIT declarations remain conservative: `STRICT_HISTORICAL`, `CURRENT_OBSERVED`, `RECONSTRUCTED`, and `UNVERIFIED`; candidates claim `CURRENT_OBSERVED` only. The current observation contract does not encode per-row dates for a multi-day daily series, so candidates remain single-day. No data can be represented as historical merely because it was read from a dated package.

## Changes in this integration

- Preserved direct `sourceId` grants as distinct from legacy MCP `sourceAllowlistKey`; all exact role/scope/source/capability/market/purpose/temporal checks remain fail-closed before Provider I/O.
- Removed the false trust implication from Client-side license review: Host rejects remote `VERIFIED`, persisted claims are demoted in-memory, the UI labels fields as unverified claims, and `VERIFIED` is not selectable.
- Hardened A-share symbol/identity checks, TDX ZIP central/local identity, extent/overlap/CRC validation, bounded file reads, retry/cancellation behavior, and Registry re-entrant disposal cleanup.
- Updated theme aliases to published tokens; tests verify token names only and do not claim WCAG color contrast because the live provider supplies no color values.
- Regenerated the current capability matrix and wired its committed JSON/Markdown to the active manifest. Package whitelist/check now includes this report and its evidence; stale scope assertions were updated to the confirmed 3/9/22/16/9 counts.
- Repaired stale root/runtime/data/MCP/FPROV/P4 docs and external audit links. Historical FPROV “not pushed” and older test-count claims are retained as historical captures with dated correction rather than silently rewritten. External audit payloads remain outside this repository.

## Runtime and Host inspection

The bundled toolchain is Node `v24.21.0`, pnpm `v11.28.5`; package declares DSH `0.2.2-rc.1`. The installed runtime manifest matches that DSH version. Read-only Host service inspection found `mcpResources.register` and generic credential service operations, but no dynamic MCP Manager connection/probe/restart/watch contract or trusted license-reviewer identity. Platform device/account identity is not treated as legal reviewer authority. This source bundle was **not installed** into a Profile and the current GUI was **not visually validated**.

## Validation and publication result

The exact outcomes are recorded in [`FINANCE-3A-FPROV-EVIDENCE/validation.json`](FINANCE-3A-FPROV-EVIDENCE/validation.json) and [`FINANCE-3A-FPROV-EVIDENCE/remote-ancestry.json`](FINANCE-3A-FPROV-EVIDENCE/remote-ancestry.json). Frozen install, build, full regression, package check, and isolated tarball path scan all passed: **378/378 tests**, with no excluded payload matches in the package listing. At the last fresh fetch, `origin/main` and `origin/feat/financial-services` were unchanged from baseline and were ancestors of the FPROV base; the normal-push decision is gated on re-fetching immediately before any `main` update. No DSH Core changes, Profile operations, permission bypass, or real source requests are part of this task.

### Dated result — 2026-11-12

- Local hard gates: **PASS** — `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run build`, `pnpm test` (378/378), `pnpm run check:package`, `pnpm pack`, and tarball allowlist scan.
- Fresh ancestry check before publication: `origin/main=1089564f9345070b44fc9c36772d2ef80a7aca15`, `origin/feat/financial-services=b9eeb079f9d5d4d51bc11a9299403bd7cf36e2b5`; both are ancestors of FPROV base `bf7e1011eeb20068f6a011bb9a416078fea0ddc9`. No force-push was needed at this point.
- Remote integration-branch push and any fast-forward of `main` are recorded in `remote-ancestry.json` after their final result. The current Profile remains untouched and source data remains inaccessible.
