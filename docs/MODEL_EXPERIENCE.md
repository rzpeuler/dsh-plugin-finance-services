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

The proxy-admission correction changes execution authorization, not tool names, schemas, descriptions or persona text. No token savings are claimed for it. Actual Worker usage and a complete request comparison remain pending the fresh-process model smoke; absent measurements must remain `NOT_MEASURED`.

## Stability and limits

Persona text and tool definitions are stable for a retained preset revision. Workspace paths, Session identities and source observations are Session-specific context; they can change a provider's cache prefix. Provider cache hits, latency improvements and cross-Session reuse have not been measured.

Role runtime disposal revokes its Agent grant. The independent retained-preset permission floor refuses actions without a matching source/Prompt revision grant, including residual Agent-own native delegation. This does not replace the native sandbox, tool approval or source licensing, and does not implement the later financial Review Gate.
