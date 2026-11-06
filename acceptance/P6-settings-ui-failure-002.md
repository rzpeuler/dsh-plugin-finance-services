# P6 Settings UI failure record — 2026-11-06 (Host Config bridge)

## Reported observation after the first row-slot fix

After opening both rows, the user reported that the detail pages showed the expected row titles and descriptions, but both forms said **“配置值当前不可用”**. The finance-review summary also showed “审核策略: original”; that was the first implementation's fallback text, not a verified live value.

## Root cause

The first fix registered the correct `plugins.row.config` keys, but incorrectly assumed Plugin Manager's optional `form` prop contained the rows' Loader `Config`. The UI Plugin Manager builds that prop from `ctx.configForms`, whose mirror contains Settings namespaces. These finance-data/finance-review values are Loader `Config` entries instead; no matching Settings namespace is served, so `form` is absent. The old form therefore rendered its unavailable state.

## Corrective implementation

- Removed all fake default/fallback values from row summaries; a summary now waits for a live Host read.
- Added narrowly scoped `financeOperations.rowConfig` and `saveRowConfig` Client-callable endpoints. These are omitted from the model reflection; agents cannot use the UI configuration actions.
- The Host looks up only the exact `finance-data` / `finance-review` Loader entry by both row id and module name. It reads effective `entry.options.config` and persists using the installed Host `configEditor.edit()` service, which validates and reconciles through Loader. It does not maintain a second settings store or hand-write the profile file.
- The edit request carries the values originally read; stale updates conflict. Only timeout/concurrency or policyId/customJson are accepted. Review policy/custom JSON is validated before the Host invokes Config Editor; internal review instance fields are preserved but not exposed.
- Rebuilt, package-checked, and reinstalled. Remove and install both returned `application: applied`; the two live row-config Slot keys are active and the erroneous bundle-config slot remains empty.
- Full regression now passes 509/509, including native Config Editor bridge tests and strict remote-contract tests.

## Result / remaining check

The user subsequently refreshed/reopened both pages; both displayed **“Host 当前配置值不可用.”** The Host bridge was rendered, but the Client did not unwrap the native `{ ok, value }` RemoteResult envelope, masking the inner response. This third defect and fix are documented in [P6-settings-ui-failure-003.md](P6-settings-ui-failure-003.md); the current installed state is [P6-settings-row-config-004.json](P6-settings-row-config-004.json).
