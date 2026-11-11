# FPROV-01 baseline

- Captured: 2026-11-11 (Asia/Shanghai)
- Repository: local `financial-services-bundle` checkout
- Requested base: `origin/feat/financial-services`
- HEAD: `b9eeb079f9d5d4d51bc11a9299403bd7cf36e2b5` (`feat/financial-services`, same as `origin/feat/financial-services`; one commit ahead of `origin/main` at `1089564f9345070b44fc9c36772d2ef80a7aca15`)
- Implementation branch: `codex/fprov-01-ashare-adapters`, created at the same HEAD without resetting or cleaning the worktree.

## Existing local worktree state

The checkout was already dirty before this task: `git status --short` reported 1,782 paths. It includes broad deletions from historical source/audit/test assets, modifications to runtime docs, README, registry/policy/normalizer/contracts/Host/Client/role query and tests, and untracked narrowed runtime assets, data Reader candidate code and tests. These changes were present before the FPROV-01 branch was created and were not authored or removed by this task. They are being preserved in place; no reset, stash, clean, or bulk restore was performed. Some files to be changed by FPROV-01 are among these pre-existing edits, so implementation must be reviewed against their actual working-tree contents rather than the base commit alone.

## Relevant working-tree baseline

- FinanceData runtime is unversioned/canonical and A-share scoped in the current local docs; policy currently derives source authorization from `role.allowedMcpServers` and `binding.sourceAllowlistKey`, which conflates direct data-source grants with MCP allowlists.
- Adapter metadata currently encodes `TEST_ONLY / USER_PROVIDED / COMMERCIAL / PUBLIC_LICENSED`, while non-TEST_ONLY execution depends on three Adapter-returned permission booleans. This does not provide a separate auditable license assessment or authentication state.
- Temporal validation currently models `strict`, `date_bounded`, and `current_only`; the task requires explicit historical/current/reconstructed/unverified quality levels without silently relaxing strict historical requests.
- `src/data/cnequity-reader.js` is present as an untracked local candidate: three source-specific factories (TDX daily bars, EastMoney financial statements, CNINFO announcement index) currently use TEST_ONLY safeguards; inspect exact mapping and source identity before modifying.
- No production Provider is registered or authorized in the current local candidate; source licenses, model-processing and session-logging rights remain unverified. Real external queries must remain blocked until Host-owned evidence verifies permission.
- Data Sources UI, Adapter example, and data tests have local modifications; preserve their behavior and extend them compatibly.

## External audit evidence reviewed

The [A-share source audit report](../../a_share_data_source_audit_001/reports/A-SHARE-DATA-SOURCE-LIVE-AUDIT-001-REPORT.md) reports bounded single-session smoke checks, not license or stability approval. THS anonymous EPS/consensus sample and hot-topic sample were observed; EastMoney quote/daily-bar, selected financial indicators/report/news endpoints were observed; TDX official daily package parsed for one date, while tested TDX TCP daily/minute calls failed and quote/tick calls returned no rows in the tested after-hours window. The report explicitly leaves use licenses, automation/model processing, logging, coverage and historical PIT unproven. The probe is not treated as current Provider registration or query authorization.

## Initial implementation plan

1. Preserve legacy MCP allowlist semantics while introduce a Host-controlled financial-source grant bound to exact role, scope, adapter/source, capability, market, purpose and temporal intent; default all newly registered adapters to zero grants.
2. Add a versioned LicenseAssessment and separate authentication/connection/query states; never infer permission from anonymous reachability, READY status, credentials, or Adapter self-assertion.
3. Add versioned temporal-quality semantics with safe legacy compatibility and strict historical refusal; current observations remain current-only and reconstructed/unverified data cannot satisfy historical replay.
4. Implement three independently identifiable A-share source adapters at the narrowest audited coverage; use TEST_ONLY fixtures for parser/runtime tests and never present fixtures as external E2E.
5. Extend the Host/Data Sources status contract, tests, docs, source matrix, and acceptance report. Do not modify DSH Core, install into a profile, or claim real-data authorization absent evidence.

## Known blockers at baseline

- Commercial/reuse, automated-access, AI processing, logging/retention and redistribution permissions are not verified by the audit report.
- DSH credential/OAuth and dynamic MCP Manager interfaces are not verified; no secret persistence will be introduced.
- Historical point-in-time coverage is not established for the observed endpoints; strict historical queries must fail closed.
- The dirty checkout contains unrelated/pre-existing changes, including deletions; commits must be limited to the FPROV implementation and necessary dependent working-tree baseline, not sweep those deletions into the task commit.
