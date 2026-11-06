# P6 Settings UI failure record — 2026-11-06 (policy save rejected)

## User observation

After confirming both pages and ordinary save persistence, the user changed `finance-review.policyId` and clicked Save. The page reported **“Host 拒绝了此配置更新”**. The changed policy did not apply.

## Code-level diagnosis and corrective change

`ReviewStore.open()` replayed every persisted decision into the newly selected policy's gate. A decision for a checkpoint that the new policy no longer requires (for example an original-policy `fastSkippable` checkpoint under `fast`) returns `NOT_REQUIRED_BY_POLICY`, which the store treated as corrupt state; Loader reconciliation then refuses/rolls back the Config Editor update. In addition, replaying a same-version decision under a different policy digest could reauthorize it incorrectly.

The fix now:

- Replays only decisions whose `snapshotDigest` equals the active snapshot.
- Retains other decisions unchanged as history, marks a still-required checkpoint `HOLD` with `SNAPSHOT_MISMATCH`, and requires a new review under the new snapshot. It never reuses an old approval for the new policy.
- Makes run classification fail closed on snapshot mismatch.
- Returns sanitized Host rejection categories to the UI instead of concealing every failure behind one generic message.
- Adds tests for original→fast with old required/fast-skippable decisions, preservation of persisted records, re-review under the new snapshot, and sanitized error messages.

## Verification and current blocker

- Targeted policy-switch tests pass; full regression is **511/511**, and package/build checks pass.
- Remove returned `application: applied`; the following install **failed** with `DomainError: domain 'financial_review' is already open`. Live Client slots still show both row-config keys, but this install result is not `applied`; therefore the new Host policy-switch fix is **not yet verified live**.
- The duplicate open domain must be released by the owning Host lifecycle. Do not call `storageDomain.closeAll()` from this Bundle, since that would close domains owned by other services. Restart the current Harness application, then inspect/reinstall only after the Host has remounted cleanly.

## Resolution after restart

The user subsequently restarted the current Harness application and confirmed the full policy test passed: `policyId` changed and saved, the new policy appeared after reload, old decisions remained historical without authorizing the new snapshot, and the original policy was restored. After restart, live row Slots were active and Host schemas plus Config Editor were inspectable. The post-restart functional acceptance is recorded in [`P6-settings-row-config-007.json`](P6-settings-row-config-007.json); the failed-install snapshot above remains as historical evidence in [`P6-settings-row-config-006.json`](P6-settings-row-config-006.json).
