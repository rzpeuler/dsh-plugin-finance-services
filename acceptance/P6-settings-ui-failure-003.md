# P6 Settings UI failure record — 2026-11-06 (RemoteResult decoding)

## User observation after the Host Config Editor bridge

After refreshing and reopening both Configure pages, the user reported: **“二者均显示：Host 当前配置值不可用。”** This is the latest human-rendered observation before the fix below; neither page's effective values were confirmed.

## Root cause

The Client treated `financeOperations.rowConfig()` and `saveRowConfig()` as returning their inner objects directly. Native unary Remote calls return an envelope `{ ok, value }` (or `{ ok: false, error }`); other bundle Client code already checks `result.ok` and reads `result.value`. The row form read `status` from the envelope instead of `value.status`, so it always fell back to the localized unavailable message and could not recognize a save result. This UI parsing bug also masked whether the Host had returned `READY` or a specific error.

## Correction and current verification

- Client now checks the Remote envelope and decodes `value` before reading `status`, `configJson`, or save results; Remote errors retain their message.
- Updated the built-client VM stub to return the real `{ ok, value }` envelope.
- Rebuilt and package-checked; full regression passes 509/509 (`P6-row-config-038.tap`).
- Removed/reinstalled through Plugin Manager; both returned `application: applied`; both live `plugins.row.config` keys remain active.

## Result / remaining check

The user subsequently reopened both pages and confirmed that the expected fields/controls display; they also reported a save persisted and the original value was restored. This closes field rendering and ordinary save-persistence for the row forms. The exact changed field/value and whether a policy change was applied to a new service lifecycle were not specified, so those are not claimed. See the pre-check evidence [`P6-settings-row-config-004.json`](P6-settings-row-config-004.json) and human acceptance [`P6-settings-row-config-005.json`](P6-settings-row-config-005.json).
