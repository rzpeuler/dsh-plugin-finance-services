# TEST_ONLY P3 native role integration probe

## Scope and claim boundary

This suite exercises real native Host Services and real mounted finance roles.
It is not a visual test.
It is not a commercial supplier acceptance test.
It does not connect to MCP servers.
It does not call external network endpoints.
It does not start a model turn.
It does not measure provider token usage.
It does not establish financial business E2E.
It does not create Office deliverables.
It does not replace native Agents, Tools, FinanceData, or role guards.

All financial observations are explicitly TEST_ONLY.
TOY is a synthetic ticker, not an actual issuer claim.
The two Adapter observations are independently invented.
Their revenue values are not equivalent supplier measurements.
Fallback is selection, not averaging or reconciliation.

## Files

- [Builder](./build.mjs): creates a unique standalone package.
- [Probe entry](./probe.js): creates native Agents, estimates envelopes, records cleanup.
- [Role integration](./after.js): actual dispatcher and public policy checks.
- [In-flight fixture](./inflight.js): owned TEST_ONLY native Adapter lifecycle tests.
- [Helper tests](./helpers.test.mjs): local checks, not native acceptance evidence.
- [P2 recorder source](../p2-live/report-io.js): copied byte-for-byte into each package.

## Ownership boundary

All authored files and generated output stay under this directory.
Each build creates a new UUID package name and directory.
Each native activation creates a new UUID run directory.
Each created Agent receives a new UUID Session ID.
The Session cwd is the owned run's workspace subdirectory.
An exclusive ownership marker fences disposal.
An original canary file detects unintended workspace changes.
The suite never deletes fixture files.
The suite never deletes Session history.
The suite disposes only exact Agents it created.

No workspaceRegistry entry is created, changed, or removed.
No default financial workspace binding is changed.
No Client navigation or draft is touched.
No profile configuration is directly edited.
No package is installed by the builder or probe.
No existing role, data, build, or package source is changed.
No previous package generation is overwritten.
No cached module generation is patched.

## Prerequisites

Use the parent-controlled native Harness runtime.
The native Agent factory must be available.
The native preset registry must be available.
The native Tools service must be available.
The native systemPrompt service must be available.
Native tokenMeter and agentDefaultModel are needed for budget estimates.
No model route is saved or changed.
Reading the selected default route does not invoke it.

BEFORE has no FinanceData or Adapter dependency.
It can measure the existing legacy-compatible numeric role module.
It uses two actual native Workers: modeler and builder.

AFTER needs the newly exported role/data modules installed by the parent.
AFTER also needs both independent P3 TEST_ONLY Adapters installed by the parent.
AFTER reads financeData and financeOperations through actual native Services.
AFTER reads financeTestMcpAdapter and financeTestRestAdapter controls.
Missing optional Services produce explicit NOT_RUN evidence.
Missing Services are never synthesized or hard-injected by this suite.
A PARTIAL receipt is not complete acceptance.

## Build and install sequence

First run local source/helper checks:

```powershell
node --test tests/p3-role-native/helpers.test.mjs
node --check tests/p3-role-native/probe.js
node --check tests/p3-role-native/after.js
node --check tests/p3-role-native/inflight.js
```

Build BEFORE before upgrading the main role module:

```powershell
node tests/p3-role-native/build.mjs before
```

The builder prints the absolute package root and unique package name.
The builder does not install that package.
The parent installs that exact root using the native Plugin Manager.
The parent waits for terminal BEFORE evidence before upgrading the main bundle.
A successful build is not a successful native run.

After the parent upgrades the main role/data modules and installs both Adapters:

```powershell
node tests/p3-role-native/build.mjs after
```

The parent installs the newly printed AFTER package root.
Never substitute an older AFTER package after editing probe sources.
A new package identity avoids stale cached modules.
Keep older packages and receipts for auditability.
Do not remove or reinstall unrelated bundles to run this probe.

## BEFORE measurement

Both Workers are created through the native agents.create factory.
Each Worker mounts its actual independent preset.
The native preset identity and live Agent identity are checked.
The suite assembles each Worker's actual system prompt.
It includes assembled sections and runtime contexts.
It reads the actual native tool header schemas.
It estimates the system message with tokenMeter.estimateMessage.
It measures the native header with and without tools.
The tool-envelope estimate is the difference between those measurements.
The route comes from Agent options or public agentDefaultModel.currentSelection.
No hidden provider configuration is inspected.
No provider route is invoked.

The resulting classification is NATIVE_HEURISTIC_ESTIMATE.
The measured scope is not a complete first turn.
Agent/pre-step Skill catalogue contributions are excluded.
User input is excluded.
Other pre-step contributions are excluded.
Provider usage is excluded.
A before/after delta must retain these qualifications.
Do not describe a lower estimate as measured billing savings.

## AFTER Agent composition

AFTER creates three exact native Agents.
The first selects finance-pitch-agent-modeler.
The second selects the same modeler preset in another Session.
The third selects finance-model-builder-builder.
The same preset does not imply the same source entitlement.
Source bindings remain scoped to exact owned Session IDs.
The writer has no financial query tool in its native schema envelope.
A writer dispatch attempt is also denied by actual native execution.

The probe uses actual ctx.tools.execute with the exact Agent.
The initiating-Agent boundary follows the tested P2 helper.
It never calls a fake Tools dispatcher.
It never invokes a shell, MCP, network, or model Tool.
The retained definition tests are adversarial bypass checks only.
They do not replace normal positive dispatcher coverage.

## Progressive query contract

The model-facing query arguments are action, capability, and query_json.
The native presenter schema must use its supported JSON subset.
The output envelope must use the same supported subset.
All fourteen capability identifiers are discovered from the actual tool schema.
Every capability is described through actual native dispatch.
Every descriptor must carry a strict request schema.
Each descriptor example is checked with an independent basic schema validator.
The example classification must be TEST_ONLY_NOT_PROVIDER_COVERAGE.
Availability must remain SCHEMA_IS_NOT_CONFIGURATION_OR_AUTHORIZATION.
Describing a capability is not a provider-coverage assertion.
Runtime refinements remain authoritative beyond the basic example checker.

The suite parses ToolExecutionResult using its isError discriminant.
Successful structured output comes only from the native value field.
It never guesses structured output from a rendered content string.
The data envelope must mark trust as UNTRUSTED_DATA.
Its result_json must remain within the documented UTF-8 result bound.
The query result status must agree with the outer tool envelope.

## Scoped financial query checks

The first financial query runs before any owned binding is added.
Installation alone must return NOT_AUTHORIZED with null data.
The request is financial.statements for TOY, FY2024, US, and USD.
It requests revenue and EBITDA with actual measurement classification.
The request includes an explicit point-in-time cutoff and maximum age.
No period, freshness, currency conversion, or missing value is invented.

Bindings are appended to the current policy only.
The independent MCP-style Adapter uses the original capiq source key.
The independent REST/file-style Adapter uses the original daloopa source key.
Both bindings explicitly allow TEST_ONLY observations.
Both initially cover only the first owned modeler Session.
The native durable policy table must match the published policy revision.
The probe never edits that table directly.

The selected MCP-style revenue must normalize to 2,000,000 USD ones.
Its original value must remain 2 and its original scale millions.
Its source ID and Adapter provenance must remain attached.
After the MCP-style control becomes NOT_AUTHORIZED, REST is selected.
The fallback revenue must be 2,100,000 USD ones.
The trace must explain the skipped MCP-style source.
The result must not average those independently invented values.
The original control states are restored during cleanup.

## Authorization and input negatives

The same-preset second Session cannot borrow the first Session's bindings.
query.sourceIds filters candidates and cannot grant access.
The source-role original allowlist cannot be expanded through policy JSON.
An unknown role is rejected during policy validation.
A writer role cannot be inserted into a source binding.
An extra endpoint or identity field cannot be inserted into a binding.
Rejected policy changes must preserve the current revision and catalogue.

Model query JSON cannot supply role, Session, scope, or Agent identity.
Model query JSON cannot supply endpoints, URLs, or headers.
Nested entity identity extras are also rejected.
Malformed JSON is rejected.
Missing query_json is rejected for query.
Unexpected query_json is rejected for describe.
Selected capability and JSON capability must agree.
Unknown capability identifiers are rejected.
A multibyte 51,000-byte input proves the UTF-8 bound, not merely length.

A cloned Agent object cannot borrow the exact native grant.
An altered expected source SHA cannot borrow the exact native grant.
A captured definition cannot execute with a writer or cloned Agent.
A same-preset definition may describe that other live Agent's own contract.
That does not authorize that other Agent's financial query.
Disposed-Agent held definitions must reject.

## Controlled in-flight provider

The additional provider is explicitly labeled TEST_ONLY.
It has a unique owned Adapter ID and source ID.
It registers through native financeData.registerAdapter.
It receives an explicit owned source binding.
It does not replace the independent Adapter positive/fallback tests.
It does not replace FinanceData, role authority, or native Tools.
It uses withheld Promises to control validation and query completion.
Its raw data is synthetic, local, and never commercial.

Provider authorization is changed while validation is awaiting.
Provider authorization is changed while query is awaiting.
Neither late response may publish successful financial data.
Cancellation occurs after the real provider query has started.
The held raw response is released only after cancellation settles.
The retired provider's unsubscribe deliberately throws TEST_ONLY_SECRET.
That error text is never returned in a report.
Native catalogue disposalFailures must increase by exactly one.
The retired source must disappear despite the throwing unsubscribe.
The catalogue must not expose the intentional secret marker.

A replacement provider then reuses that same owned Adapter ID.
The old callback is invoked after replacement registration.
A real native follow stream must not publish a stale callback event.
The replacement remains READY.
The follow stream is bounded and closed in finally.
Owned Agent disposal is tested while another provider response is held.
Its eventual result must not publish stale financial data.
Native teardown may drain work before its disposal notification.
Do not infer immediate cancellation latency from the no-publication assertion.
The native query deadline bounds that disposal scenario.

The exact current role grant is separately revoked during an awaited query.
Only a created owned Agent is used for this trusted admission/disposer test.
The native post-await role check must turn the tool result into a denial.
The captured definition and subsequent actual dispatch must also deny.
The revoked Agent is then disposed, not restored into user state.

## Numeric regression smoke

One modeler LBO describe/calculate round trip remains native.
Its own TEST_ONLY example is used.
All returned calculation checks must be true.
This is a source-authorized arithmetic smoke, not seventeen golden reruns.
It proves neither valuation appropriateness nor investment approval.

## Cleanup and receipt acceptance

Cleanup runs independently of individual check failures.
The synthetic provider is unregistered even after an earlier failed check.
Held provider Promises are released in finally paths.
Only owned TEST_ONLY control states are restored.
Policy cleanup reads the current revision for every CAS attempt.
It subtracts owned scope IDs only from known owned Adapter rows.
Other scopes in a shared row are preserved.
Other Adapter rows are preserved.
Concurrent policy conflicts cause a fresh read, not a stale restore.
Persistent conflicts fail cleanup visibly instead of overwriting user changes.
The final durable policy table must match the published policy.

The actual financeOperations.snapshot baseline is awaited.
The final actual snapshot must retain its binding and revision.
The canary hash must remain unchanged.
Every owned native Session must contain zero model/user turn events.
Only marker-fenced exact created Agent handles are disposed.
Files and histories remain retained for inspection.

Each run has an append-only journal and terminal receipt.
The tested P2 recorder contains file failures without skipping cleanup.
Latest evidence is published atomically only after terminal cleanup checks.
BEFORE publishes latest-before.json; AFTER publishes latest-after.json.
Both paths live in this directory, not in the immutable acceptance archive.
The parent copies reviewed receipts into immutable acceptance artifacts.
Any FAIL check or recorder I/O failure means FAIL.
Any NOT_RUN check without other failures means PARTIAL, not PASS.
Rendered plugin inventory resources are intentionally omitted for this fixture.
Native installation and visual rendering remain parent-verification boundaries.
