# P4 Office runtime / public Host SDK contract audit

## Decision and scope

- Audited 2026-11-05 (Asia/Shanghai): bundle [0.3.0-alpha.2 manifest][bundle], installed DSH 0.2.1-rc.5, Windows x64.
- [Approved P3 exception][exception] permits independent P4 investigation; P3 remains PARTIAL and grants no Shell, arbitrary code, original-file writes, or MCP bypass.
- **Finding:** bundled producers and public process primitives exist; there is no installed end-to-end, exact-Agent Office artifact API. A narrow FinanceOffice service is feasible in principle, not already integrated or accepted.
- **Current unchanged runtime cannot create Office binaries.** Do not advertise Office delivery until the dependency-source handoff, controlled writer bridge, binary publication, and cancellation contracts below are implemented and verified.
- This audit changed only this new document. No production/packageRoot/Profile/install/model/server changes, tests, script execution, or Office generation were performed.
- Loaded `cordis-plugin-development`, `agent-experience`, Office router, XLSX/DOCX/PPTX, recalculation and PDF-export skills. Queried Host Inspect only, after listing providers; no Client/browser/web investigation was needed.
- Installed ASAR manifests/modules were inspected through the Host `read` tool only; copied reference source is supplementary, not proof of installed exports. Missing installed type declarations are not treated as available APIs.

## Preserve the source permission floor

- [Role implementation][role] derives the exact role from trusted assets and binds live authority to the actual Agent, composition, source SHA and adapted-prompt SHA; [retained floor][floor] survives runtime removal.
- [RoleFilesystem][rolefs] fixes `root = agent.session.header.cwd`, rejects changed effective cwd, and assigns `financial-services/artifacts/<agent.id>/`; callers cannot choose another owner/root.
- Its current `write` is UTF-8 `fs.writeText(..., {kind:'createIfAbsent'}, signal, policy)`; `edit` uses content hash plus native version CAS. Binary reads are rejected by its text helper.
- [Role tools][roletools] explicitly say write does not create Office binaries/run scripts. A text file named `.xlsx` is not a workbook; base64 through write is not binary publication.
- Readonly roles, including the nonwriter modeler, must never gain Office-write capability. Writer roles remain MCP-free. Native skills do not add permissions.
- Do not widen the existing write/edit tool schemas, permit generic Python/Shell/cmd, remount ambient tools, or change readonly roles because the creator has wider tools.
- Preserve exact-Agent/grant checks **before and after every asynchronous boundary** in the new Office path, including input reads, dependency resolution, staging, production, recalc, PDF conversion, validation and publication/result delivery.
- Existing text methods are not proof of that stronger Office lifecycle: e.g. write enters through `target.check()` and reads back, but has no binary producer, in-flight registry, or transactional Office publication.

## Installed public contracts — use these names, not invented services

| Surface | Exact public contract / consequence |
| --- | --- |
| `ctx.tools` | `register`, `get(name, scope?)`, `guard`, `restrict`, `execute(ToolExecutionInput)` are live. `execute` applies visibility, pre-policy, monotonic guards, around/post policy and result normalization. |
| Typed delegation | Input includes `callId`, `rootCallId?`, `name`, `arguments`, **`agent`**, `parent?: ToolExecutionToken`, `signal`. Agent is optional in the general type, not optional for Finance authority. |
| `ctx.fs` | `resolve`, `processPath`, `processPathFromHostPath`, `contains`, `lstat`, `stat`, bounded `readBytes`, `readByteRange`, `listDir`, `writeText`, `editText`; **no `writeBytes`, mkdir/allocation, rename/link/atomic binary publish API**. |
| `ctx.sandboxPolicy` | `resolve({session: agent.session})` returns mode, workspaceRoot, sessionId. Do not pass a wider explicit `mode` or request approval/escalation. |
| `ctx.sandbox` | `confine(argv, policy, signal)` returns enforcing argv plus `enforcement: full|partial`, denial signatures and runner-failure rules; it must fail closed, not silently pass through. |
| `ctx.subprocess` | `resolveExecutable(command, env?, signal?)`, `spawn({argv,cwd,stdio,graceMs,signal?,env?})`; handle has `done`, `terminate()`, `waitForExit()`. Executables and fs share one execution world. |
| Process limitation | `subprocess.spawn` has **no Agent or sandboxPolicy field** and applies no defaults; only spawning the result of `sandbox.confine` supplies the process filesystem fence. No automatic Role grant is inferred. |
| `ctx.officeToPdf` | `convert(request, signal?) -> {pdf:Uint8Array,missingFonts,cacheKey,generation}`. Deferred bounded source reader; provider owns queues, scratch and cleanup. This is PDF conversion, not XLSX creation/recalc or artifact publication. |
| PDF source | Request is `{extension,priority,source:{key,version,bytes?,read(signal,maxBytes)->{bytes,version}}}`; `OfficeSourceKey` is a public branded constructor, **not authorization**. Include exact owner/execution-world/input identity in the key. |
| Native-command utility | [Installed module][nativecmd] implements `runNativeCommand` using plain `execFile`. Shell-free does **not** mean role-authorized or sandbox-confined; do not choose it as the Office execution permission boundary. |

Live `officeToPdf` Config entry is `include:office-to-pdf`; its resolved package directory is [the installed package][pdfpkg]. It is already mounted; no second converter manager is needed for PDF.
The complete live Service directory exposes no `nativeDependency`, `NativeDependency.Get`, Office writer/recalc registry, or separate executable-extension/Invocation permission service. Typert invocation dispatch is not an Office/dependency resolver.
Do not turn an Inspect provider into a callable business service, guess service names, or rely on a private Desktop host package.

## Bundled Python: public resolution exists, automatic source handoff does not

- Creator-side `load_workspace_dependencies` returned Python, Python packages, Node, Node packages, pnpm and distribution versions. This proves the creator's query works, **not** that Finance roles can call it.
- The [installed tool manifest][deppkg] publicly exports its root. Its [actual export list][depimpl] includes `resolvePrimaryRuntime`, `readPrimaryRuntime`, `workspaceDependencyPaths`, parsers and installation helpers.
- `resolvePrimaryRuntime(source)` validates an **existing absolute application-owned payload** in place and returns absolute interpreter/library locations; it does not copy/install. It checks platform/architecture, manifest and required entries.
- `workspaceDependencyPaths(root, manifest)` computes platform paths but alone does not validate the payload; prefer the validated resolver, not hand-built interpreter suffixes.
- `installPrimaryRuntime(source, root)` copies/renames trees. **Not permitted here and not needed for the proposed resolver path.** The tool's configured optional `root` can select that preparation path, so it is not an unconditional read-only service.
- There is no live Config entry for this tool/Office-skill package in the inspected Host directory, despite creator-side tools/skills being available. Do not scrape another plugin's private config or assume those contexts are identical.
- **Feasible author-bound route:** the creator uses the returned Python/library locations and [matching selected-payload metadata][selected-runtime] to establish the actual runtime source, verifies it with public `resolvePrimaryRuntime`, then records installation-local `primaryRuntimeSource` in **this project's own trusted Config** in a separately authorized implementation. No other plugin's Config is read/changed; no personal path is hardcoded in code or exposed as a model parameter.
- For this machine the observed selected payload root is `C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime`; this audit read its manifest but did not invoke the resolver or write Config. It is an evidence-backed local binding, not a directory convention to probe on other machines.
- On migration/new machine, missing or incompatible source must return `NOT_CONFIGURED`; never search system Python, guess env/cache paths, or silently install. Author rebinding is sufficient; lack of automatic discovery is **not** a blocker to that route.
- Only if zero-configuration discovery of the application's selected payload is mandatory is an application-owned public resolver service missing; the exported resolver is sufficient with explicit trusted source Config.
- [Bundled metadata][runtime] records Python 3.12.14 / Node 24.21.0; distributions: openpyxl 3.1.5, pandas 3.0.1, python-docx 1.2.0, python-pptx 1.0.2, XlsxWriter 3.2.9, Pillow 12.3.0, lxml 6.1.3, numpy 2.3.5.
- These are bundled distributions, not permissions or executed import checks. No pip/npm/system-Python discovery is required; no helper from an upstream financial skill was executed.
- Proposed dependency additions (not made): explicitly resolve public roots from `@deepseek-ai/dsh-tool-workspace-dependencies@0.2.1-rc.5` and `@deepseek-ai/libreoffice-kit@0.1.5`, not undocumented transitives. Keep existing shared `@deepseek-ai/cordis~4.0.5`, `@deepseek-ai/dsh-scope@0.2.1-rc.5`, Schemastery 3.18.5 and Zod 4.4.3 identities/versions; inject Host fs/sandbox/subprocess/tools rather than install duplicate providers. Python Office libraries come from the validated payload, not new dependencies.

## LibreOffice Kit: portable public CLI/API discovery

- [Installed Kit manifest][kitpkg]: `@deepseek-ai/libreoffice-kit@0.1.5`; public exports are root, `./package.json`, `./cli`.
- [Root exports and implementation][kitimpl] publicly expose `discoverRuntime()`, `createConverter(options?)`, `createConverterFactory(options?)`, format constants and errors.
- `discoverRuntime()` is documented offline discovery: verifies installed, version-matched engine metadata/assets and returns `{version,backend,cliPath,nodeApiPath}`; no engine start/download/build. It was inspected, **not invoked** in this audit.
- Portable plugin CLI resolution: import the declared Kit dependency and call `discoverRuntime()` for `cliPath`; alternatively resolve the **exported** `@deepseek-ai/libreoffice-kit/cli` through the plugin package resolver. Never derive `app.asar.unpacked`, caches or Desktop install roots.
- Obtain standalone Node from the validated primary-runtime result. Desktop `process.execPath` can be Electron, not the required standalone Node; resolve/verify it in the fs/subprocess execution world.
- [Office skill module][skillimpl] itself uses package resolution for Kit and trusted Config for standalone Node; its internal `officeRuntime()` helper is **not exported**.
- [Engine manifest][engine] identifies the bundled Windows-x64 native engine 0.1.5. This is installed metadata evidence, not a recalculation/conversion success or a proof all binaries can execute under the future role fence.
- `createConverter` offers `.convert(request,signal)`, `.recalculate(request,signal)`, `.render(...)`, `.dispose()`. Conversion requests use absolute `inputPath/outputPath`; recalc accepts spreadsheet input and XLSX/ODS output.
- That Node API performs its own Node fs/process operations, not `ctx.fs`, `ctx.subprocess`, exact-Agent grants or native tool approvals. Do **not** call it directly on business-role target paths and describe it as permission-equivalent.
- Kit output uses exclusive `wx` open before content is written; no overwrite is good, but the visible path can be incomplete. Its output is a **staging artifact**, not an atomic completed-file publication primitive.
- For local role integration prefer the discovered CLI under `sandbox.confine` + `subprocess.spawn`; an application-owned higher-level native producer API could replace this later, but is not installed today.
- For PDF, reuse `officeToPdf.convert` on authorized bounded bytes when appropriate; its provider-private scratch is legitimate native internals, not a plugin excuse to bypass role input/output checks. It returns bytes, so final publication is still separate.

## Loaded Office instructions and exact resource locations

| Loaded workflow | Exact instruction resource | Required producer/validation |
| --- | --- | --- |
| Router | [office/SKILL.md][s-office] | Select format skill and requested operation skills; shared runtime/skill trees readonly. |
| XLSX | [office-xlsx/SKILL.md][s-xlsx] | Bundled openpyxl/pandas; preserve editable formulas and types; reopen. Writing formulas does not calculate caches. |
| DOCX | [office-docx/SKILL.md][s-docx] | Bundled python-docx; preserve OOXML/content; reopen and verify. |
| PPTX | [office-pptx/SKILL.md][s-pptx] | Bundled python-pptx; editable text/tables/charts; reopen and verify. |
| Recalculate | [office-recalculate/SKILL.md][s-recalc] | Installed Kit CLI `recalculate`; new output; openpyxl with both `data_only=False/True`, formula preservation and expected cached values. |
| Export PDF | [office-export-pdf/SKILL.md][s-pdf] | Installed Kit CLI `convert`; preserve Office source; nonempty PDF and `%PDF-` check; report validation extent. |
| Sidecar reference | [office/references/sidecar.md][s-sidecar] | Missing PATH command alone is not missing engine. No substitute soffice/npx; no download/install without authorization. |

Loaded recalc/export skills supplied these **observed creator paths, not portable plugin configuration**:
`node = C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe`
`cli = C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar.unpacked\dsh\node_modules\@deepseek-ai\libreoffice-kit\lib\cli.js`
No file-creation command is supplied or executed here. Formula validation, recalculation, PDF conversion and visual rendering are separate claims; this audit proves none of their runtime outcomes.

## Minimal controlled architecture — proposed, NOT installed API

1. Add one plugin-owned **FinanceOffice artifact service**, not another general execution manager. Its trusted Config provides validated primary-runtime source and interpreter-readable readonly fixed producer assets; package resolution supplies Kit.
2. Proposed same-process contract: `financeOffice.describeForAgent(agent)`, `produceForAgent(agent, request, exec)`, synchronous `revokeForAgent(agent)` and awaited `drainForAgent(agent)`; these are **new design**, not discovered Host services. `exec` preserves call token/parent, signal and exact Agent; revocation links grant disposal to the exact Agent's operation AbortControllers.
3. Request is a strict, bounded discriminated JSON union for XLSX/DOCX/PPTX and requested recalc/PDF operations. Admit typed content/financial inputs and server-generated artifact IDs, not code, Python modules, argv, shell, env, executable, workspaceRoot, roleId or output directory.
4. Spreadsheet formulas are data in an explicitly allowed grammar/template, not eval/code. Reject macros, external workbook references, arbitrary links, unsupported functions/active content; ordinary strings must not become formulas accidentally.
5. Trusted actor comes from the native writer call context, checked against active source/prompt hashes and current composition. Derive assigned artifact dir from actual `agent.id`; do not trust caller-submitted Session/owner strings.
6. Keep current UTF-8 write/edit unchanged. Any future narrow writer-only Office bridge must be explicitly admitted by the own-layer tool identity guard/floor; merely registering a global tool will be hidden/denied. No Office tools for readonly roles.
7. A bridge invokes its own service under the current execution context. If it delegates to an existing native **tool**, use `ctx.tools.execute` with the same Agent/signal and parent token/root correlation; a hidden/disallowed tool must fail, not be retried agentless.
8. Never omit Agent, substitute a creator/admin Agent, call a cached/held definition's `.execute`, or use `withoutInitiator` to evade a denial. Public service calls need their own equivalent grant checks; public does not mean authorized.
9. Use immutable fixed trusted producer scripts with bundled libraries, never upstream/model-authored scripts. Verify digest and interpreter-readable resource mapping; an ASAR-internal resource is not automatically readable by Python or a remote execution world.
10. Resolve native Session policy; reject read-only. Narrow broad user modes to workspace-write and further to this artifact operation. For the process fence, use the admitted artifact/staging root as the narrower policy root only after canonical containment in the original Session root; do not change Session cwd.
11. Apply `sandbox.confine` to exact fixed argv, then `subprocess.spawn` with returned argv and explicit cwd/stdio/env/grace/signal. Honor enforcement/runner-failure evidence; fail closed on missing mapping, unsupported confinement or insufficient enforcement. Do not silently run unconfined.
12. Typed JSON may travel via the public stdin data/pipe seam; caller cannot choose its transport as a way to inject arguments. Scrub Python import/environment influence, disable bytecode writes, reject user-site/PYTHONPATH overrides and enforce the validated bundled library set.
13. Use provider-resolved `fs.processPath`/`processPathFromHostPath`; undefined cross-world mapping is a real error. Never parse opaque FsTarget keys or invent local paths for a remote provider.
14. Run fixed Python to private operation staging; run discovered Kit CLI for recalc/export into **different** staging outputs. Bound bytes/cells/slides/archive expansion/runtime/stdout; preserve originals and reject symlink/junction/special-path inputs and outputs.
15. Reopen and validate each produced format. XLSX must retain formula text and fresh expected caches after recalc; DOCX/PPTX must remain editable and match requested structure; PDF must be nonempty with signature. Provenance stays TEST_ONLY/USER_PROVIDED/UNSOURCED as applicable.
16. Only a successful, still-authorized operation may atomically publish a complete validated file under its own artifact dir, with no-replace semantics. Recheck canonical ancestor identity/containment, exact grant and cancellation immediately before commit and after awaited work; return hash/bytes/path, never a staging-success claim.
17. Cancellation/unload/revocation must stop admissions, revoke authority first, abort queued/active work, terminate **and join** native managed processes, await actual cleanup, then remove registrations. No detached task may later publish or disclose results.
18. Define the publication linearization point: before-commit cancellation/revocation prevents commit; cancellation after committed publication cannot retroactively erase the file and must report committed/cancelled accurately. A grant check only after writing cannot undo an unauthorized write.
19. Reuse Host lifecycle/effects; keep only a bounded per-Agent in-flight set/serialization needed by this service. This is lifecycle ownership, not a second generic job/shell/runtime manager.

## Binary filesystem contract gap and acceptance boundary

- Existing RoleFilesystem allocation/path checks can inform the new service but its `target()` returns a native target, **not** permission to invoke arbitrary host fs. Its UTF-8 read-back helper cannot validate OOXML/PDF bytes.
- Native fs-sandbox fences its two text mutations only; raw Python/Kit/Node writes do not pass through that facade. The process sandbox plus trusted producer's own binary/path validation must supply the separate boundary, with the same declared trusted-code/TOCTOU threat model, not an invented kernel guarantee.
- Public observation events are `fs/write-intent` (single-slot waterfall), `fs/edit-intent` (waterfall), `fs/observed` (synchronous emit), with the **actual execution actor**. They are not generic permission gates or awaited binary before/after hooks.
- [Native text tool][fstool] obtains intent before `writeText` and records mutation observations after; [observation policy][fsgate] keys state by `actor.agent.session`. Dropping actor loses policy ownership. A held-definition call does not repair this.
- No installed `fs/before`, `fs/after`, `file-before-write` binary API or `contractFileBeforeWriteBound` public symbol was found. **Do not use the source-bundle label `contractFileBeforeWriteBound` as a callable contract.**
- Required Office **before/after filesystem invariants** are explicit service responsibilities: authoritative source version/hash before and after reads; no links/cross-owner paths; precommit grant/policy/identity check; postcommit bounded bytes/hash/type verification and accurate observation/result ownership.
- **Preferred project-local implementation:** FinanceOffice owns fixed trusted binary staging/publication under native process confinement, with equivalent checks and an explicit atomic commit protocol; no new general Host manager is necessary. Exclusive `wx` creates private staging, then a same-volume no-replace atomic publication of the **closed complete file** (e.g. validated hardlink publication) supplies commit; `wx` directly on final output is not sufficient.
- Alternative only if desired: a new public binary artifact allocation/publish capability carrying actor, assigned scope, create-if-absent, bounded bytes, cancellation and before/after validation. Both are new implementation work, not installed APIs; this audit authorizes neither code nor tests.
- The project-local route is legitimate for a fixed Python producer, but sandbox workspace permission alone is insufficient: the entire Session workspace must not become a writable target language, and the current installed fs API cannot be claimed to enforce that producer's binary writes. Publication itself must run under the same derived native fence and trusted actor admission, not an unconfined Host-fs fallback.
- If native fs-facade interception for **every** binary mutation, automatic application-payload discovery, or a pre-existing atomic binary publisher is mandatory, the current public SDK is **blocked on those exact contracts**. No private cache/Core patch or second execution manager is an acceptable substitute.
- Otherwise proceed only with the explicitly approved narrow service/Config design, then native-dispatch permission, malformed-input/path, readonly, cross-Agent, stale-version, cancellation/revoke/unload and atomic-publication tests; creator CLI smoke tests alone cannot pass business RoleTool integration.
- Keep P3 partial; P4 Office integration/generation and business acceptance remain **NOT RUN**. Missing original binary templates and commercial data authorization remain independent gaps; this audit does not reconstruct them or complete P5/P6.

## Evidence links (installed paths are audit evidence, not configuration recipes)

[bundle]: <../package.json#L1-L37>
[exception]: <../acceptance/P3-stage-exception-approved.md#L7-L26>
[role]: <../src/role.js#L21-L113>
[floor]: <../src/floor.js#L15-L27>
[rolefs]: <../src/role/filesystem.js#L20-L218>
[roletools]: <../src/role/tools.js#L18-L62>
[deppkg]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tool-workspace-dependencies/package.json#L14-L25>
[depimpl]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tool-workspace-dependencies/lib/index.js#L120-L295>
[runtime]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/primary-runtime/runtime.json#L1-L23>
[selected-runtime]: <C:/Users/Administrator/.dsh/dsh-runtimes/dsh-primary-runtime/runtime.json#L1-L23>
[kitpkg]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/libreoffice-kit/package.json#L1-L49>
[kitimpl]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/libreoffice-kit/lib/index.js#L1623-L2175>
[engine]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/libreoffice-kit-win32-x64/prebuilds.json#L1-L10>
[pdfpkg]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-office-to-pdf/package.json>
[skillimpl]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-skill-office/lib/index.js#L41-L51>
[nativecmd]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-native-command/lib/index.js#L6-L39>
[fstool]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tool-fs/lib/index.js#L603-L615>
[fsgate]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-fs-observation-policy/lib/index.js#L15-L94>
[s-office]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office/SKILL.md>
[s-xlsx]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office-xlsx/SKILL.md>
[s-docx]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office-docx/SKILL.md>
[s-pptx]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office-pptx/SKILL.md>
[s-recalc]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office-recalculate/SKILL.md>
[s-pdf]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office-export-pdf/SKILL.md>
[s-sidecar]: <C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/runtime/office-skills/office/references/sidecar.md>
