# P6 Settings UI failure record — 2026-11-06

## Reported observation

The user reported that the `finance-data` settings page did not expose `requestTimeoutMs` or `maxConcurrentQueries`, while `finance-review` looked as expected. This report refers to the pre-fix installation; no screenshot or independent browser capture was provided.

## Reproduction/diagnosis

- Live `plugins.row.config` initially had no occupants.
- The bundle had incorrectly registered the Financial Services `WorkspacePage` at `plugins.bundle.config`, a slot for the bundle's own settings form. This presented workbench content instead of row-scoped configuration pages.
- The Host schemas existed independently: `finance-data` declares `requestTimeoutMs` (default 10000, range 1–300000) and `maxConcurrentQueries` (default 32, range 1–128); `finance-review` declares the expected `policyId` and `customJson` fields.

## Fix and current verification

- Removed the incorrect `plugins.bundle.config` registration.
- Added `plugins.row.config` pages keyed by `@local/dsh-financial-services#finance-data` and `@local/dsh-financial-services#finance-review`.
- The first attempted form was coded to present the two runtime limits and the review `policyId`/`customJson`, but it relied on Plugin Manager's optional `form` prop and never established that prop contained Loader Config values. Its `form.mutate` save path was not exercised.
- Rebuilt and checked the package. At that point the regression was 505/505.
- Removed and reinstalled the existing bundle through Plugin Manager; both operations returned `application: applied`. Live Slot inspection showed both row-config keys active and `plugins.bundle.config` empty.

## Result / superseding observation

This first correction proved Slot occupancy only, not populated fields. The user later opened both pages and observed **“配置值当前不可用”** on each; the finance-review summary's `original` text was fallback content, not a verified live value. That defect and its second correction are recorded in [P6-settings-ui-failure-002.md](P6-settings-ui-failure-002.md). No UI save was exercised during this first attempt.

Machine evidence for the first installation snapshot: [`P6-settings-row-config-002.json`](P6-settings-row-config-002.json).
