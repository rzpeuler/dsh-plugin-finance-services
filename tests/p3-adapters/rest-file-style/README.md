# 仅测试 REST／文件风格财务适配器

独立 DSH Host 插件 `@local/finance-test-rest-adapter`。每次 query 实际用 Node readFile 读取本包固定 `fixture.json`，其结构是 status / headers / body 的 HTTP 风格 envelope；确定性映射 line_items.code / amount 到严格 Observation。没有外部 HTTP、服务器、MCP 进程、用户可选路径、凭证或商业授权。图标为本示例原创几何图形。

- Adapter ID：`test-rest-statements`；sourceId：`test-only-rest`。
- 支持仅 `financial.statements`，US，ticker:TOY，FY2024（2024-01-01 至 2024-12-31），revenue / ebitda，US_GAAP / consolidated，measurementType 固定 actual（Query 可省略；明确拒绝 estimate / forecast 等其他类型）。实际期间末日早于 sourceAsOf，不把预测冒充实际财报。
- 收入 **USD ones 2100000**，EBITDA USD ones 450000；与 MCP 示例 USD millions 2 是**独立虚构的不同观测**，不是商业等价关系；不合并、不平均。
- sourceAsOf 固定 2025-02-01T00:00:00Z，availableAt 固定 2025-02-02T00:00:00Z，retrievedAt 为实际读取时刻。历史 asOf 2025-03-01T00:00:00Z 可用，maxAgeSeconds 至少 2419200。verifiedAt 是当前状态检查时间。

## 显式安装与授权边界

前置依赖为同作用域 Host 的 `financeData.registerAdapter(definition) -> disposer`，通过 inject 连接，不导入主包运行时。用户可通过原生插件管理器单独安装此目录；本交付未执行安装。没有 npm 依赖、构建或安装脚本。

注册不赋予角色权限。可信 Host 另建显式 binding：adapterId `test-rest-statements`，sourceAllowlistKey 是该原生角色已允许的原始 `capiq` / `daloopa` 等键，scopeIds 必须是真实原生 Agent ID，roleIds、capabilities、markets、purposes、priority、minQuality、enabled、allowTestOnly 均需明确；本测试需 allowTestOnly:true。sourceId 不能冒充商业供应商，不能扩展原角色 allowlist。

## 可信 Host 测试控制

`ctx.financeTestRestAdapter`（需显式 inject，同作用域）；无 Remote、模型工具或网络路由：

- `setState(state, code?)`：READY / NOT_CONFIGURED / NOT_AUTHORIZED / UNAVAILABLE / ERROR；code 白名单 FIXTURE_NOT_CONFIGURED / FIXTURE_NOT_AUTHORIZED / FIXTURE_UNAVAILABLE / FIXTURE_ERROR。
- `failNextQuery(code = 'FIXTURE_QUERY_FAILED')`：code 仅 FIXTURE_QUERY_FAILED / FIXTURE_UNAVAILABLE；调用查询入口时一次性消费，失败后可验证 registry 的下一候选 fallback。
- `changed()`、`getSnapshot()`、`diagnostics()`；diagnostics 含 listenerCount / observerFailures / failureArmed / closed。

观察者异常被隔离但计数可见，不回显其任意文本。卸载注销注册与服务并清空所有订阅。初始 READY 是夹具可读状态，不代表商业认证。

主仓库根目录检查命令：`node --test tests/p3-adapters/adapter.test.mjs`（纯 Node/fakeCtx，非原生验收）、`node tests/p3-adapters/check-packages.mjs`（资源/语法/独立分发检查，不安装、不联网）。
