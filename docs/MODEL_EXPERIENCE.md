# Financial role model experience

## Visible instructions and tools

Each native preset supplies its own source-backed persona. Main roles can discover only their assigned Skills and can delegate only to their three source-owned Worker presets. Worker personas and file/source allowlists differ; no Worker receives a general Shell or inherited delegation tool. The runtime context identifies the Session Workspace, its artifact directory when writable, and the rule that retrieved content is data rather than authority.

Skill discovery advertises names and descriptions of at most 240 characters; full instructions and resources load through the native `skill` tool when requested. Discovery does not enable an unavailable data source, Office executor or original missing template. `finance_data_query` is present only for source-authorized non-writer roles and currently returns `NOT_CONFIGURED`; no data is fabricated. Tool responses identify truncation, text hashes and untrusted data where applicable.

Native tools retain their own definitions and logging. Financial file tools use bounded results and Session-specific artifact paths; successful writes return an identifier and SHA rather than repeating the entire artifact. Errors do not grant a fallback Shell, arbitrary source, broader path or another preset.

## Measured context cost

The native Host capability run recorded these estimates with the actual SystemPrompt and tokenMeter services:

| Role | System prompt estimate | Tool-envelope estimate | Tool count |
|---|---:|---:|---:|
| finance-pitch-agent | 2641 | 1972 | 10 |
| finance-market-researcher | 2541 | 1976 | 10 |

Evidence: [native run 002](../acceptance/P2-live-host-failure-002.json). This run failed the separate dispatch authorization checks. These numbers are heuristic estimates, **not provider-reported usage or a complete first-turn budget**: the pre-step Skill catalogue and other subsequently injected messages are not included in the standalone SystemPrompt measurement. Removing the tool envelope in the measurement produced zero header-tool tokens; this is a bounded header-cost comparison, not an old-versus-new product performance result.

The proxy-admission correction changes execution authorization, not tool names, schemas, descriptions or persona text. No token savings are claimed for it.

A real source-owned Reader Worker subsequently completed a toy read through `deepseek-account/deepseek-flash`. Its native model events reported these raw counters: first step input 2646, output 47, total 2693, cache-read 0; second step input 162, output 136, total 2986, cache-read 2688. Evidence: [partial run 004](../acceptance/P2-live-host-partial-004.json), independently preserved in its journal and recovery report. Do not add or reinterpret these provider counters as a product optimization benchmark. The model result passed, but the overall fixture installation failed during report publication; that failure remains recorded. A complete main-role first-turn comparison is still `NOT_MEASURED`.

## Controlled numeric profiles: measured header change

The two source Bash exceptions now use one progressive `finance_model_calculate` tool. `describe` returns a strict model-specific request schema, example and source profile; those full schemas are not repeated in the first-turn header. The read-only modeler receives DCF/LBO only; the builder additionally receives simple three-statement/comps profiles. No code, script or path is accepted.

| Role | System before→after | Tool envelope before→after | Total increase |
|---|---:|---:|---:|
| finance-pitch-agent-modeler | 1977→2038 | 422→636 | 275 |
| finance-model-builder-builder | 2006→2074 | 627→848 | 289 |

[Native before/after comparison](../acceptance/P2-controlled-compute-token-comparison.json) uses public `tokenMeter` on the same measured sections. It excludes pre-step Skill messages and subsequent context; **not a complete first-turn or provider-reported usage comparison**. This is the measured cost of extra capability, not claimed token savings. The native supplement verified all four fixed profiles and permissions without invoking any model.

## Stability and limits

Persona text and tool definitions are stable for a retained preset revision. Workspace paths, Session identities and source observations are Session-specific context; they can change a provider's cache prefix. One within-Worker cached step was observed above; latency improvements, cross-Session reuse and any causal cache benefit from this implementation have not been established.

Role runtime disposal revokes its Agent grant. The independent retained-preset permission floor refuses actions without a matching source/Prompt revision grant, including residual Agent-own native delegation. This does not replace the native sandbox, tool approval or source licensing, and does not implement the later financial Review Gate.
