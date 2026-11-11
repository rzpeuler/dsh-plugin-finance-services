# Financial Services local scope status

The plugin is narrowed to three main Agents: `finance-earnings-reviewer`, `finance-market-researcher`, and `finance-model-builder`. Their nine owned Workers remain internal composition support. The active Skill allowlist contains 13 Financial Analysis Skills and 9 Equity Research Skills; only the selected prompts, 16 commands, and nine steering examples are retained.

Agent and Skill trees from the other four domains, the full historical source manifest, source archive/ZIP, duplicate asset trees, and excluded-domain audit snapshots have been removed from the workspace and package. The selected source-origin coordinates and notices for retained assets remain.

Shared workspace, data, review, run, and artifact services remain available to the retained Agent scope. Existing user directories and Session history are not changed.

Historical `0.4.0-alpha.1` validation passed 308/308 tests. For `0.4.0-alpha.2`, package/runtime dependencies target DSH `0.2.2-rc.1`; `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm run build`, the full regression suite (356/356), `pnpm run check:package`, and direct Node ESM imports of all six plugin entrypoints passed. These checks validate local dependency resolution and package artifacts, not a live Loader activation or GUI session. No installation, profile change, or push was performed.
