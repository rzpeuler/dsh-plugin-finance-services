# Read-only Host API inspection

**Captured:** 2026-11-12 (Asia/Shanghai)

**Method:** Cordis Inspect read-only `Service.listService` query on the local Host. No business Service method was invoked, no profile was changed, and no source request was made.

The complete service inventory contained:

- `mcpResources.register(server, provider)` for scoped MCP resources.
- Generic credential operations including `credentials.resolve`, `describe`, `set`, `unset`, and record CRUD; the remote `credentialsController` exposes describe/set/unset.
- `deepseekAccount.getDeviceIdentity()` returning device/account metadata.

It did **not** declare a dynamic MCP Manager service contract for connection registration, probe, restart, watch, or a finance-safe delegated bridge. Generic credential storage is not an OAuth workflow or a licensing decision. Device/account identity is not an attested legal reviewer principal or vendor rights certificate. No service in this inspection provides trusted financial-license review/attestation.

This is a read-only declaration inventory, not proof of every private/undocumented runtime behavior. No private service, method, or DSH Core change was attempted. The exact current consequences are documented in [`MCP_COMPATIBILITY.md`](../../docs/MCP_COMPATIBILITY.md) and [`DATA_CONTRACT.md`](../../docs/DATA_CONTRACT.md).