# 仅测试 MCP 风格财务适配器

这是可单独安装的 DSH Host 插件 `@local/finance-test-mcp-adapter`，并非 MCP 管理器，也不是任何商业供应商的实现、授权或等价性证明。只用包内进程内 `client.tools.call({ name: 'financial_statements', arguments: { symbol, period, market, fields, asOf } })`，读取其 `structuredContent`。不启动进程、服务器，不发送网络请求，不读取凭证。图标为本示例原创几何图形。

- Adapter ID：`test-mcp-statements`；sourceId：`test-only-mcp`。
- 只有 `financial.statements` / `US` / `ticker:TOY` / FY2024（2024-01-01 至 2024-12-31），字段 `revenue`、`ebitda`，US_GAAP、consolidated，measurementType 固定 actual（Query 可省略；明确拒绝 estimate / forecast 等其他类型）。实际期间末日早于 sourceAsOf，不把预测冒充实际财报。
- 虚构收入为 **USD millions 2**，EBITDA 为 USD millions 0.4。与 REST 示例的 2100000 是**两条不同的虚构观测**，不是相同数据的商业等价校验；不得合并或取平均。
- sourceAsOf 固定为 2025-02-01T00:00:00Z，availableAt 固定为 2025-02-02T00:00:00Z；retrievedAt 为实际查询时刻。2025-03-01T00:00:00Z 的历史查询可合法使用该已公开的虚构记录，maxAgeSeconds 应至少 2419200。状态 verifiedAt 为实际检查时刻，不冒充历史授权。

## 安装与权限

需已提供 `financeData.registerAdapter(definition) -> disposer` 的 Financial Services Host。由用户显式通过原生插件管理器安装**本目录**；不会自动安装主包或另一适配器。本包只有注入 `financeData` 的公开服务契约，无跨包运行时导入、依赖、构建脚本。注册并不赋予任何角色来源权限。

可信 Host 必须另设显式 SourcePolicy binding：adapterId 为 `test-mcp-statements`；sourceAllowlistKey 是该角色原始允许的 `capiq` 或 `daloopa` 等**原始键**，不是 sourceId；scopeIds 是实际原生 Agent ID，roleIds 是该 Agent 的原生角色 ID；capabilities、markets、purposes、priority、minQuality、enabled、allowTestOnly 均需显式指定。测试绑定必须 allowTestOnly:true。不要更改原角色 allowlist 或将测试 sourceId 假冒为供应商。

## 仅可信 Host 的测试控制

同作用域注入 `financeTestMcpAdapter`。未注册 Remote、模型工具、HTTP 路由或 sourceScript：

- `setState('READY'|'NOT_CONFIGURED'|'NOT_AUTHORIZED'|'UNAVAILABLE'|'ERROR', code?)`，code 可选且只接受 FIXTURE_NOT_CONFIGURED / FIXTURE_NOT_AUTHORIZED / FIXTURE_UNAVAILABLE / FIXTURE_ERROR。
- `failNextQuery('FIXTURE_QUERY_FAILED'|'FIXTURE_UNAVAILABLE' = 'FIXTURE_QUERY_FAILED')`：仅下一次查询入口失败（故障在覆盖验证之前一次性消费，不追溯影响已开始的查询）。
- `changed()`：更新 verifiedAt 并通知订阅者，返回 notified / observerFailures。
- `getSnapshot()`：状态快照副本。
- `diagnostics()`：closed / listenerCount / observerFailures / failureArmed。

一个观察者抛错不会中断其他观察者或撤销，失败计数对 Host 可见；不保留任意异常文本。卸载注销 adapter、服务，清除所有订阅；保留的旧控制对象不能改变已卸载实例。初始状态 READY 仅表示虚构本地夹具可读，**不表示商业认证通过**。

## 检查

在主仓库根目录运行 `node --test tests/p3-adapters/adapter.test.mjs` 和 `node tests/p3-adapters/check-packages.mjs`。前者是明确标记的 fakeCtx/纯 Node 测试，不是原生安装验收；后者只检查本地分发资源、独立导入和语法，不安装、不联网。`generate-packages.mjs` 是一次性生成来源，所有已生成文件随交付提供；不能重跑覆盖现有文件。
