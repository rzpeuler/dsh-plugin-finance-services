# Active runtime scope

Status: isolated integration package; **not installed in the current Profile and not visually validated in the live GUI**. Current Git publication/merge state is recorded in the [integration report](../acceptance/FINANCE-3A-FPROV-INTEGRATION-REPORT.md). The package contains only the selected Financial Analysis / Equity Research Agent and Skill scope. Historical four-domain catalogues, source archive, duplicate Skill trees and source snapshot are not shipped.

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

The package also contains 16 commands from those two vertical directories and nine steering examples for the selected main Agents. The runtime manifest, selected prompts, command drafts, Skill assets, and role-isolated Skill roots are limited to these roles and allowlisted Skills. The authoritative scope is exactly 3 main Agents / 9 Workers / 22 Skills (13 Financial Analysis + 9 Equity Research) / 16 commands / 9 steering examples. No other domain's Agent or Skill persona is registered or bundled.

## Removed historical content

The earlier full 10-main/30-Worker catalogue, four-domain Agent/Skill trees, source archive/ZIP and broad P0–P6 acceptance archive are intentionally absent from the current tree and package. The previous full bundle remains reachable in Git history at `1089564f9345070b44fc9c36772d2ef80a7aca15`; this integration does not restore those files. The removal included 271 historical acceptance paths and 27 direct GL/LP core/test/sample paths; current source/tests have no imports of the removed GL/LP business modules. The selected DCF/LBO/three-statement/comps numeric core remains for the chosen Model Builder Worker. Selected source-origin coordinates remain in the current manifest.

Workspace, Run, Review, and data-source code remains shared infrastructure for the retained Agent scope. Existing user directories, Session history, and persistent review/run records are not changed.

## Rebuild and validation

Run `pnpm run build`, `pnpm test`, and `pnpm run check:package` from this bundle directory. The build validates the pruned manifest, selected asset hashes and preset patch, then builds package artifacts. The bundle is not installed in the current Profile or visually validated in the live GUI; branch publication and merge state are recorded in the integration report.
