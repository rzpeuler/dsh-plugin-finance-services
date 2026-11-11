# Active runtime scope

Status: locally generated and package-checked; **not installed or pushed**. The package contains only the selected Financial Analysis / Equity Research Agent and Skill scope. The historical four-domain Agent/Skill catalogues, source archive, duplicate Skill trees, and source snapshot have been removed from this workspace and are not shipped.

## Active main Agents

Only these main Agent presets are registered:

- `finance-earnings-reviewer` — Equity Research.
- `finance-market-researcher` — Equity Research.
- `finance-model-builder` — Financial Analysis.

Each main Agent retains its three owned Worker presets as internal composition support (nine Workers total); Workers are not listed as main Agents. No six-domain classification form or domain toggles are part of this scope.

## Active Skills and related assets

The 22-Skill allowlist is recorded in [`assets/runtime-scope.json`](../assets/runtime-scope.json):

- Financial Analysis — 13 Skills.
- Equity Research — 9 Skills.

The package also contains 16 commands from those two vertical directories and nine steering examples for the selected main Agents. The runtime manifest, selected prompts, command drafts, Skill assets, and role-isolated Skill roots are limited to these roles and allowlisted Skills. No other domain's Agent or Skill persona is registered or bundled.

## Removed historical content

The full 10-main/30-Worker source manifest, four-domain Agent and Skill trees, 363-file source archive and ZIP snapshot, full-source ownership/reference ledgers, and source-audit generator outputs have been removed. Only active runtime assets and their selected source-origin coordinates remain. This deliberately discards the previous full-catalogue audit trail; the selected source files are no longer recoverable from this workspace.

Workspace, Run, Review, and data-source code remains shared infrastructure for the retained Agent scope. Existing user directories, Session history, and persistent review/run records are not changed.

## Rebuild and validation

Run `pnpm run build`, `pnpm test`, and `pnpm run check:package` from this bundle directory. The build validates the pruned manifest, selected asset hashes and preset patch, then builds package artifacts. This change has not been installed, pushed, or visually validated in the live GUI.
