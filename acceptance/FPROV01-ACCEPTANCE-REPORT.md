# FPROV-01 acceptance report

**Status: PARTIAL / EXTERNAL_LICENSE_BLOCKED**

> Historical FPROV-01 record from the first implementation commit. Dated corrections for Git publication, reviewer trust, and external evidence availability are appended below; the current isolated integration result is in [FINANCE-3A-FPROV-INTEGRATION-REPORT.md](FINANCE-3A-FPROV-INTEGRATION-REPORT.md).

The requested code, contracts, candidate Adapters, tests and documentation are implemented in the local task branch. Production-source acceptance remains blocked: the reviewed external audit does not establish automated-access, model-processing, session-logging/retention or redistribution rights for Eastmoney, THS or TDX. All three Adapters remain `UNASSESSED`, and exact direct-source bindings fail closed until valid Host LicenseAssessment evidence is entered. No live Adapter/provider query was made.

## Delivered

- `acceptance/FPROV01-BASELINE.md` was written before implementation. It records the original HEAD, branch, initial dirty-tree caveat and pre-work architecture.
- Additive v1 `LicenseAssessment` plus exact direct `sourceId` grant support. Legacy MCP `sourceAllowlistKey`/role allowlist behavior remains separate. Writers remain denied; no policy binding is implicit. `finance_data_query` is usable by non-writer roles with empty MCP allowlists, but Host FinanceData source policy is the only authority for financial-source access.
- Host-stamped review time, fail-closed unknown/restricted/expired assessments, exact source/capability/purpose and processing-right checks before Adapter validation and I/O; separate registration, connection, authentication and license status projections in the Data Sources catalog/panel.
- Additive research intent and four PIT quality levels. Historical replay requires strict historical evidence; current-only and reconstructed/unverified records do not satisfy historical replay. Current-only requests retain fresh-asOf and source capture requirements.
- Independent `examples/ashare-adapters/` Host plugin with 3 separate Adapter IDs and exact disposers: Eastmoney one-day unadjusted daily OHLC, THS explicitly labelled current annual aggregate EPS per-share rows for the narrow 600519.SH scope, and TDX one-day official dated ZIP parser using a trusted local directory only. No TDX download, broad enumeration, TDX TCP path, or unsupported fields.
- Versioned contract, source matrix, next-decision log, parser fixtures, direct-grant integration test and this report. Existing package build remains self-contained; the example plugin is not auto-installed or activated.

## Verification

- Full test suite: **367 passed, 0 failed**, via `pnpm test` (local Node 24.16.0).
- Fixture/Host-policy tests cover Eastmoney JSON mapping, explicit THS aggregate EPS and unit recognition, TDX ZIP parsing, three separate registrations/disposers, no-default-symbol denial, no network access without a direct grant, and a mocked current-observation request after an exact verified grant. The mocked response is synthetic and is not external data.
- Bundle build completed: `pnpm build` generated the self-contained Host/role/floor/data and Client artifacts.
- Package integrity/hash check: `pnpm check:package` passed (manifest, exports, localized metadata, patch, Client syntax and generated/source hashes).
- No UI install/click-through, native profile restart, real upstream request, or licensed-source E2E was performed. The current DSH Profile was not modified.

## Source-specific truth and external blockers

- A bounded one-session external source audit was conducted outside this repository. The external audit folder/report is not included in this checkout or package; its non-payload summary, scope and public endpoint references are recorded in [the source matrix](../docs/FPROV01-SOURCE-MATRIX.md). It does not establish contractual rights, broad coverage, immutable source history or strict PIT.
- Eastmoney requests omit BJ market mapping, volume/amount output and multi-day arrays. THS refuses tables without an explicit consensus/aggregate EPS per-share header and does not claim historical consensus. TDX does not emit volume/amount and opens only the exact requested date-named local file beneath the trusted configured directory.
- FinanceData's existing observation schema cannot faithfully carry a per-row daily series trading date. These adapters intentionally support one day at a time; multi-day query support is a deferred schema/capability decision.

## Repository and scope notes

- The pre-task worktree was already dirty across 1,782 paths; see baseline. No clean/reset/stash or bulk restore was run. Built artifacts were clean before build, then regenerated from the current working tree.
- No DSH Core changes, secret/token handling, Writer/Shell/raw-MCP permission expansion, plugin install/enable, commit, push, PR or merge occurred.
- Final production acceptance requires independent official terms/contract evidence and a trusted Host review; public reachability, tests, registration or `READY` state are not permission.

## Dated corrections — 2026-11-12

1. **Git status:** The statement in the original report that no commit or push occurred was true when that report was written, but is no longer current. FPROV-01 commit `bf7e1011eeb20068f6a011bb9a416078fea0ddc9` was pushed to `origin/feat/financial-services`; the current integration branch is based on it. See the new integration report for this task's final publication/merge result.
2. **Reviewer trust:** Earlier code stamped a Client-entered `VERIFIED` assessment with a Host timestamp but had no trusted reviewer principal. This did not prove vendor authorization. Current code rejects remote `VERIFIED` writes and demotes pre-existing direct-source `VERIFIED` claims to `REVIEW_REQUIRED` in the in-memory view without rewriting stored data. The positive `VERIFIED` path is used only by explicit unit fixtures; there is no trusted reviewer identity API and no production source permission.
3. **External evidence:** The source-audit folder referenced by the first version of this report was outside the repository and is not packaged. Its stale relative link has been replaced by a self-contained sanitized summary in `docs/FPROV01-SOURCE-MATRIX.md`; raw payloads and exact returned values remain outside this repository.
4. **Validation:** The 367/0 result on local Node 24.16.0 is historical for the earlier commit. The current integration's frozen install, DSH/runtime version, build, regression, package and security results are recorded separately in `FINANCE-3A-FPROV-INTEGRATION-REPORT.md` and its evidence directory.
