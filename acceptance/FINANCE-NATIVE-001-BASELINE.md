# FINANCE-NATIVE-001 Baseline

**Captured:** 2026-11-12 (Asia/Shanghai; session time sample 13:19 +08:00)

## Repository and isolation

- Repository: `rzpeuler/dsh-plugin-finance-services`
- Latest `git fetch origin main` at execution: `eb43a37a9c45718d4c3ab39d3344e1ebdc489fc6` (same as the task's prior SHA).
- An independent clean clone was created at `finance-native-001/`; branch `codex/finance-native-001-install-runtime-e2e` starts at that exact SHA. The pre-existing `financial-services-bundle/` checkout was not modified; it had an existing feature branch and untracked `.acl-recovery/`, `p/`, and `poc/` directories, all left untouched.
- OS: Windows (reported by the task runtime). Node `v24.16.0`; pnpm `11.28.5` from the DSH runtime dependency location. DSH runtime version reported by Plugin Manager installation catalog: `0.2.2-rc.1`.

## Native Profile safety baseline (metadata only)

Read-only Plugin Manager inspection found an already-installed, enabled `@local/dsh-financial-services@0.4.0-alpha.2` bundle whose source is a link into the pre-existing workspace checkout. Two unrelated installed bundles were also listed (`dsh-notify-me`, `dsh-codex-subscription`). No plugin state was changed. Absolute user paths, profile identity, Session text, credentials, and database contents are intentionally omitted.

The current session exposes only the current Profile's native Plugin Manager; no documented isolation-profile creation/selection control was exposed by the Plugin Manager inventory. Reinstalling the same package from the clean clone could replace/retarget the existing active linked bundle. Installing the adapter bundle would also modify the active Profile and load against a Host in which the finance services were not discoverable by the live Cordis Inspect Service catalog. This does not meet the task's reversible/isolation safety condition. Native install, disable, enable, uninstall, restart, test Workspace, and Session actions were therefore stopped before mutation.

## Scope from repository declarations

The repository's runtime manifest and test suite declare 3 main Agents, 9 owned Workers, 22 Skills, 16 commands, and 9 steering examples. These are code/build/test facts, not observations of the active native UI or live Agent registry. See the acceptance report for the difference between source/test evidence and native evidence.
