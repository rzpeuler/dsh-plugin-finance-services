# FUX-01 + FRUN-01 local implementation candidate

Status: implemented locally and build-checked; not installed, visually accepted, or business-E2E validated. Scope is limited to the two taskbook items. No DSH core, profile state, or remote repository was changed.

## Implemented

- One Financial Services main panel with the seven internal pages: Agents, Skills, Runs, Deliverables, Review Queue, Data Sources, and Settings. Agents is the initial page; Workspace binding and implementation facts live under Settings.
- Searchable ten-main-Agent directory grouped by the source business-domain map, with availability derived from native preset, declared Worker, and Skill asset status. Agent detail has Overview, Capabilities, Dependencies, and History tabs.
- Standard command/steering tasks and free conversation call the existing native draft path. Drafts remain unsent; no plugin prompt is stored or submitted.
- FinanceRun Host read model persists a Session-linked Run only after a user-authored `user/message` passes Session identity checks and `sessions.flush(session)` succeeds. Agent identity comes from the Session projection. Stored data contains references, codes, and timestamps—not message text, prompts, tool arguments, or tool results.
- Progress, Inputs, Outputs, and Diagnostics are registered as session-scoped right-sidebar page types. Session and recent-run views consume Host streams through Client resources. The Guide provides manual access; the public Client API does not establish a successful submission signal for automatic sidebar opening.
- Replay records Worker turns by parent Session and event-time interval. Step end is shown as `ENDED`, not success; model attempts without a committed assistant message and tool calls without a recorded result remain explicitly unknown. Persisted active Runs become `INTERRUPTED` after restart classification.
- Deliverables and Review Queue expose their existing read models only; no artifact writer, review decision, retry, or business execution was added.

## Checks performed

- `node --check` on `src/run/client.js`, `src/run/host.js`, `src/client-factory.js`, and `src/workbench/client-panel.js`.
- `node --test tests/run-*.test.js`: 10 passed, 0 failed.
- `node scripts/build.mjs`: passed; generated Host/Client artifacts, Run export, and preset patch.
- `node scripts/check-package.mjs`: passed manifest, exports, patch, Client syntax, and source/build hash checks.
- Live Client Inspect confirmed the declared `sidebar.right.pane.tab` keyed session slot. The implementation was not installed, so no Finance tab registration was observed live.

## Not verified / deferred

- The bundle was not installed or enabled, and no profile or global plugin state was changed.
- No connected-page rendering, mouse/keyboard journey, narrow-screen check, unsent-draft acceptance, or Session-switch interaction was run.
- No real Host Loader boot, storage-domain restart test, real user task, successful Worker task, data failure, or process-restart E2E was run. The Host unit test uses an in-memory stub and proves only flush gating and persisted metadata projection.
- Automatic right-sidebar opening after submission remains unsupported without a public Client activity signal; users open the Finance tabs from the native right-sidebar Guide.
- FART-01, FREVIEW-01, FCATALOG-01, and FBIZ-ALL remain out of scope. Existing Deliverables and Review Queue views are not represented as completed business workflows.
