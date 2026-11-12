# FINANCE-NATIVE-001 — Acceptance Report

**Status: PARTIAL — native Profile safety blocked before mutation.**
**Repository:** `rzpeuler/dsh-plugin-finance-services`
**Base `origin/main`:** `eb43a37a9c45718d4c3ab39d3344e1ebdc489fc6`
**Branch:** `codex/finance-native-001-install-runtime-e2e`
**Final commit SHA:** returned in the final handoff (a commit cannot embed its own SHA).
**Date:** 2026-11-12, Asia/Shanghai.

## 1. Summary and 16-item matrix

The independent clone/build/test/package verification completed successfully. The requested **native end-to-end acceptance did not complete**. Read-only Plugin Manager inspection found the same Financial Services package already installed and enabled in the current Profile as a link to a pre-existing checkout. There was no separate test Profile selection/creation control in the exposed Plugin Manager inventory. Reinstalling could retarget/replace that active link; adding the adapter bundle would mutate the current Profile. In addition, the live Host Service catalog did not expose the Finance services. To comply with the mandatory user-data/Profile-protection stop condition, no Plugin Manager state-changing action, restart, Session, Workspace, model call, adapter activation, source policy change, or query was attempted.

| ID | Status | Finding |
|---|---|---|
| N-01 | PARTIAL | Latest main confirmed; clean isolated Git clone/branch. No isolated native Profile available; current Profile contained an existing linked install. |
| N-02 | BLOCKED | Existing bundle was already listed installed/enabled; this run did not install/reinstall it. Host Finance services were absent from live Inspect catalog. |
| N-03 | NOT_TESTED | No seven-page native UI inspection or screenshots. |
| N-04 | PARTIAL | Build and tests independently validate 3/9/22/16/9 scope and ownership; live presets, Skills, Commands, and steering not inspected. |
| N-05 | NOT_TESTED | No native draft, Session, or Run created. |
| N-06 | NOT_TESTED | No test message submitted; no Session→FinanceRun native event proof. |
| N-07 | NOT_TESTED | No restart or persistence recovery test. |
| N-08 | PARTIAL | Fixture/source permission tests passed within the 378-test suite; native Worker execution, revocation, and restart boundaries not tested. |
| N-09 | BLOCKED | Adapter bundle not installed due current-Profile mutation risk. |
| N-10 | NOT_TESTED | Three adapter identities and metadata are source/test declared only; no live native catalog. |
| N-11 | PARTIAL | Mock-only unit tests exercise default-deny paths; no native finance query or call counter. |
| N-12 | NOT_TESTED | No native Client attempt to claim `VERIFIED`; fixture tests cover Host rejection. |
| N-13 | NOT_TESTED | No native adapter disable/uninstall/reinstall. Source tests cover three independent disposers/rollback. |
| N-14 | BLOCKED | No install lifecycle/rollback executed; no Profile changes were made, so the captured pre-run state remains intact. |
| N-15 | PASS | Frozen install, build, all 378 tests, package checker, and dry-run pack all exited 0. |
| N-16 | PASS (run boundary) | No real upstream requests, TDX file reads, credentials, user Session contents, or user Workspace files were accessed in this run. Native call-level query instrumentation remains untested. |

## 2. Git, worktree, host, and installation method

A fresh clone was created under the requested default workspace, without cleaning, stashing, or changing the existing checkout. The previous checkout's untracked `.acl-recovery/`, `p/`, and `poc/` were preserved untouched. Latest `origin/main` was fetched and resolved to the task's prior SHA. This branch started at that SHA and is independent.

Observed environment: Windows; Node `v24.16.0`; pnpm `11.28.5`; Plugin Manager installation catalog identifies DSH `0.2.2-rc.1`. A read-only Plugin Manager result showed `@local/dsh-financial-services@0.4.0-alpha.2` as installed/enabled, source kind a link into the pre-existing workspace (absolute path redacted), plus two unrelated installed bundles. This is baseline observation only, not this run's installation. The Host and Client Inspect providers responded, but `financeData`, `financeRuns`, and `financeReview` were not catalogued; exact lookups for those Service keys returned “no catalogued Service.”

No separate test Profile was available through the public controls exposed to this session. Since changing the current package link could alter an existing active Profile, and we could not prove a safe reversible target, native installation was not attempted. No current Profile configuration, plugin state, Workspace, Session, or Run was modified.

## 3. Main Bundle and seven pages

Native installation/activation is **not established by this run**. An already-installed row is not proof that the current source tree's build is loaded. No UI page was opened and no screenshots/logs were captured. The seven requested pages, main-agent details tabs, Host Config Editor, Workspace binding, resource disconnection behavior, and enabled service status are all `NOT_TESTED`.

## 4. Scope/runtime assets

The isolated build reported 3 main Agents, 9 owned Workers, 22 Skills, 16 Commands, and 9 steering examples. The 378-test suite includes exact scope, role ownership, assets, package, permission and Client factory assertions. These are build/fixture results only. No claim is made that the native roster/pages displayed them.

## 5. Drafts, Sessions, FinanceRuns, and model

No test Workspace, draft, Session, message, FinanceRun, or model request was created. Draft-only, accepted message, native Run linkage, event sequence, restart recovery, and model availability are `NOT_TESTED`; no result is represented as a native pass.

## 6. Worker permission boundary

Source/fixture tests passed in the full suite for explicit worker allowlists, actual-dispatch guards, filesystem roots, writer restrictions, no-Bash tool shape, executor revocation, and role composition. No native preset registry or model-driven Worker call was exercised. `NATIVE_WORKER_E2E_NOT_RUN`.

## 7. A-share adapter package

Source declaration shows one Plugin Manager package, `@local/dsh-ashare-source-adapters@1.0.0`, with three adapter identities: `ashare-eastmoney-price`, `ashare-ths-consensus`, `ashare-tdx-daily-package`. The code registers three adapters with distinct disposers and tests cleanup/rollback; this is not three independent Plugin Manager install units. Native install/catalog/metadata/UI/uninstall/reinstall were not tested.

## 8. License, policy, and external I/O

We did not run `finance_data_query`, attempt a UI `VERIFIED` update, inspect or change current Profile grants, or call Eastmoney/THS/TDX. No real upstream request or user TDX file read was initiated. Tests use fixtures and mock fetch; they independently cover default deny and Client `VERIFIED` rejection, but do **not** supply native Host invocation-counter evidence. Adapter `UNASSESSED`, grant state, and live authorization status remain `SOURCE_DECLARED_ONLY` / `NOT_TESTED`, not native facts.

## 9. Regression and package

Executed from the isolated clone:

- `pnpm install --frozen-lockfile --ignore-scripts` — PASS (14 packages, lockfile current; no scripts).
- `pnpm run build` — PASS.
- `pnpm test` — PASS, 378/378, 0 failed.
- `pnpm run check:package` — PASS.
- `pnpm pack --dry-run` — PASS; no publish or persistent package install.

Full outputs are summarized in `FINANCE-NATIVE-001-EVIDENCE/regression.json`. The package checker itself states that live Loader lifecycle, browser rendering, Workspace persistence, and financial data were not tested.

## 10. User Profile, Workspace, and data impact

No Profile mutation, restart, user Session inspection, Workspace creation/binding, financial dataset access, credentials, or user-file reads occurred. The pre-existing Financial Services linked install and unrelated plugins were left unchanged. No baseline counters/Session totals were read because the task requires minimizing metadata collection and the Profile could not be isolated safely.

## 11. Outstanding items

- Native Plugin Manager install/activation and lifecycle, all seven pages, and screenshots.
- Isolated Workspace, three role drafts, accepted test message, FinanceRun persistence and restart recovery.
- Native Worker registry and permission/revocation E2E.
- Separate adapter bundle install, live metadata/catalog, native denial instrumentation, `VERIFIED` rejection UI, unload/reinstall.
- Native source/authorization state and Profile before/after comparison.

Blocking reason: no verified isolated test Profile was exposed, while the current Profile already contained an active linked bundle. Continue only after an isolated supported Profile/Workspace is made available or the owner explicitly arranges a safe reversible native test target. Do not weaken license/authorization gates or make real data requests.

## 12. Changed files, branch, and next steps

This acceptance branch adds only baseline/report/evidence files; no product source or DSH Core changes. Branch push and final SHA are recorded in the final GitHub response after commit. No merge to main was performed.

Suggested next steps (maximum five):
1. Provide a disposable DSH test Profile using supported Profile management and a blank test Workspace.
2. Confirm Finance Host services are loaded in that test Profile before any adapter install.
3. Re-run native Plugin Manager install/disable/enable/restart/uninstall with returned application states.
4. Capture the seven UI pages and perform only fixture/no-external-I/O acceptance cases.
5. Keep real-source `AUTHORIZED` and `QUERY_VERIFIED` explicitly unachieved absent valid licensing and exact grants.
