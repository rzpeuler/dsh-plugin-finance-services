# MCP compatibility and current Host boundary

**Current DSH runtime:** `0.2.2-rc.1` according to the installed runtime package manifest inspected for this integration. This records the runtime target; this task did not install or activate the bundle in a Profile and did not repeat a native MCP handshake.

## What the current Host exposes

The read-only Host Service inventory exposes `mcpResources.register(server, provider)` for scoped resources and a generic credential service (`resolve`, `describe`, `set`, `unset`, and record operations). The inspected service catalog did not expose a dynamic MCP Manager contract for registering a connection, probing/restarting/watching it, or authorizing a finance-specific bridge. Generic credential storage is not an OAuth grant or license approval.

The service catalog also does not expose a trusted financial-license reviewer principal/attestation API. `deepseekAccount.getDeviceIdentity()` is platform/device identity metadata, not a legal reviewer workflow, source scope, or vendor rights certificate. We do not repurpose it as one. Consequently the FinanceData UI cannot promote a source to `VERIFIED`; the Host rejects Client-submitted `VERIFIED` and direct-source queries remain blocked unless a future trusted Host review path is implemented.

## Project guardrails

- Do not add a second general-purpose MCP Manager or invent OAuth/credential semantics.
- Do not treat configuration presence, resource registration, a public response, or `READY` state as source permission.
- Do not use global MCP tools to bypass exact role/scope grants, writer denial, the Host permission floor, or the Agent's own tool boundary.
- Do not replace the initiating Agent, invoke a raw definition directly, or remove approval/sandbox checks to bridge finance data.
- Direct source IDs remain disjoint from legacy `allowedMcpServers` / `sourceAllowlistKey` MCP policy.

## Historical P3 evidence (not current-runtime acceptance)

The previous P3 branch recorded seven native stdio transport checks, two unload checks, and separate dispatcher/role-boundary probes in Git history at `388e310bd1c919ad3841e11de5f0418aa79a0483`. Those checks targeted the then-installed `0.2.1-rc.5` release and are not evidence of this task's current runtime, a dynamic Manager, a finance-safe MCP bridge, OAuth, source licensing, or financial E2E. The historical acceptance files are intentionally not restored to the current package.

## Current P3 status

Native MCP transport compatibility remains **PARTIAL**. No dynamic Manager/finance bridge is available in the inspected public Host service catalog, no commercial MCP was configured, and no real finance source was queried. Current FinanceData policy is fail-closed and source permissions remain `UNASSESSED`. See the [Data Contract](DATA_CONTRACT.md) and [integration report](../acceptance/FINANCE-3A-FPROV-INTEGRATION-REPORT.md).