# FINANCE-3A-FPROV-INTEGRATION-001 baseline

Captured before this integration branch's product/code edits; local timestamp `2026-11-12T03:29:36+08:00` (Asia/Shanghai).

## Git and isolation

- Repository alias: `dsh-plugin-finance-services` (the user's existing local clone; path intentionally not repeated here).
- Remote: `origin` → `https://github.com/rzpeuler/dsh-plugin-finance-services.git`.
- Freshly observed remote heads: `main` = `1089564f9345070b44fc9c36772d2ef80a7aca15`; `feat/financial-services` = `b9eeb079f9d5d4d51bc11a9299403bd7cf36e2b5`; `codex/fprov-01-ashare-adapters` = `bf7e1011eeb20068f6a011bb9a416078fea0ddc9`.
- Ancestors: main is ancestor of feat; feat is ancestor of FPROV; FPROV is two commits ahead of main. Fresh fetch in the isolated clone confirmed the same SHAs; no force push or ref rewrite.
- Integration worktree branch: `codex/finance-3a-fprov-integration-001`, created from the exact FPROV SHA `bf7e1011eeb20068f6a011bb9a416078fea0ddc9`. The independent clone/worktree was clean at creation and has no user-local generated data.
- Original FPROV clone is retained untouched at its pushed SHA. It had three untracked top-level directories (`.acl-recovery/`, `p/`, `poc/`; 361 untracked files): host ACL diagnostics and local finance/Lake/cache/database/log artifacts. None was copied, reset, cleaned, stashed, migrated, committed, or pushed during this task. The earlier FPROV commit exists remotely as `bf7e1011...`; its historical report's prior “no commit/push” statement is stale and is corrected separately rather than by rewriting history.
- Initial worktree listing contained the original clone only; no nested worktree/repository was detected. `git ls-files --stage` contained no symlink entries; no submodules were declared. The isolated integration clone was created under the default project workspace. The local A-share audit folder is outside this repository and is not copied into the integration branch.

## Toolchain baseline

- Bundled Node observed: `v24.21.0`; package declares `node >=24.9.0`.
- Repository `package.json` declares DSH peer/runtime `0.2.2-rc.1`; lockfile v9 pins the DSH storage/protocol/scope dependencies at `0.2.2-rc.1` and Cordis `4.1.0`.
- Bundled Node observed: `v24.21.0`; pnpm `v11.28.5`; repository lockfile v9 is frozen and resolved without running install scripts.
- The `dsh` CLI was not on PATH, but the installed Desktop runtime manifest at `resources/app.asar/dsh/package.json` reports `@deepseek-ai/dsh-desktop-runtime` `0.2.2-rc.1`, with `@deepseek-ai/dsh` and its package family also at `0.2.2-rc.1`. This matches the repository's declared DSH requirement. Native Plugin Manager registration/restart behavior is still unverified; no Profile operation was done.
- Clean-clone baseline: `pnpm install --frozen-lockfile --ignore-scripts` exit 0; `pnpm run build` exit 0 and validated the 3/9/22/16/9 scope. After building, `pnpm test` returned 366/367; the sole baseline failure was `tests/theme-contrast.test.js` importing the intentionally removed `audit/dsh-reference` snapshot. The remaining suite passed. This dependency/test is to be replaced with a self-contained check against the live published theme-token contract, not by restoring the DSH snapshot.

## Confirmed product scope from task authority

The user's task explicitly confirms the current 3-main-Agent / 9-Worker / 22-distinct-active-Skill / 16-command / 9-steering-example product contraction is intended. Large source-branch deletions are not presumed accidental and will be checked against runtime scope, manifests, package payload and references before any repair. This integration starts from FPROV's pushed tree, not from the original dirty clone.

## Initial integration plan

1. Reconcile runtime-scope/manifest, docs, prompts, catalogs, UI, package exports, tests and native bundle declarations against the confirmed 3-Agent product.
2. Repair stale FPROV acceptance/evidence metadata while preserving its original historical assertion as a dated correction.
3. Audit exact source Adapter lifecycle/security cases, LicenseAssessment accountability language, PIT and unsupported data boundaries.
4. Install dependencies frozen/with scripts disabled, then run build, full suite, package checks and bounded package/security checks; record actual exit codes and versions.
5. Commit and push only this clean integration branch. Merge into `main` only if every hard gate passes and the freshly fetched target remains safely fast-forwardable under repository policy; otherwise stop with the specific blocked status.
