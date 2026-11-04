# 财务数据适配器：独立 Host 插件最小模板

这是私有、不可发布（private:true）的独立示例包 `@local/finance-data-adapter-example`，需要用户**显式安装本目录**，不会随主包或测试包自动启用。默认状态 **NOT_CONFIGURED**。仅有 TEST_ONLY 虚构夹具，不提供商业数据、供应商等价性或 OAuth 假实现。图标为本模板原创几何图形。

## 使用步骤

1. 复制整个目录到自己的插件目录，修改 package name、patch row ID、metadata.id、metadata.sourceId、Host 控制服务名、语言资源与图标，避免与其他示例冲突。
2. 在提供 `financeData` 的 DSH Host 中，通过原生插件管理器显式安装该独立目录。包无安装脚本、无外部 npm 依赖、不导入主功能包运行时值。
3. 默认保持 NOT_CONFIGURED。只有可信 Host 插件显式注入 `financeExampleDataAdapter` 后，可为本地测试调用 `setState('READY')`。该服务没有 Remote、模型工具或 HTTP 暴露，模型无法将自己声明为已配置。
4. 可信 Host 另建 SourcePolicy binding。示例 adapterId `example-financial-statements`，sourceId `test-only-template`；sourceAllowlistKey 必须选原生角色原始允许的 capiq / daloopa 等键，不能用本 sourceId 代替，也不能扩展原 allowlist。scopeIds 必须用实际原生 Agent ID，并明确 roleIds / capabilities / markets / purposes / priority / minQuality / enabled / allowTestOnly:true。注册本身不授予角色来源权限。
5. 实际生产接入须替换 fake client、元数据、验证与映射，并以真实授权状态替代测试控制。未完成之前绝不能改为 COMMERCIAL 或将 sourceId 冒充供应商。

## 服务契约

Host 提供 `financeData.registerAdapter(definition) -> disposer`，插件仅 `inject = ['financeData']`，在 `ctx.effect` 内注册并返回清理。definition 是：

```js
{
  metadata: { id, version, sourceId, label, testOnly, licenseClass,
    capabilities: [{ id, markets, fields, priority, quality, pointInTime }],
    /* credentialRef? 仅引用，不是凭证值 */ },
  state: { getSnapshot, subscribe /* listener -> disposer */ },
  validate(query, { signal, requestId }) { return { compatible, code } },
  async query(query, { signal, requestId }) { return { observations, warnings } }
}
```

state 返回 `{state, verifiedAt, code?}`；READY / NOT_CONFIGURED / NOT_AUTHORIZED / UNAVAILABLE / ERROR，verifiedAt 为精确 RFC3339 当前状态验证时间。生产 query 必须传播 AbortSignal，不得将未知异常文本、令牌、密钥写入 warning / code / reference。

Query 由父 Host 严格解析，适配器仍需明确验证覆盖范围。当前模板只支持 `financial.statements`、US、ticker:TOY、FY2024（2024-01-01 至 2024-12-31）、revenue / ebitda、US_GAAP / consolidated。14 个合法 capability ID：company.identity、financial.statements、filings、earnings.transcript、earnings.consensus、prices.history、comps、transactions、macro.rates、portfolio.nav、accounting.gl、accounting.subledger、crm.relationship、compliance.screening。声明自己实际实现的子集，不能仅为通过选择而虚报覆盖。

每项 Observation 必须且只可包含 field、entity、value、unit、period、accountingBasis、consolidation、measurementType、sourceAsOf、availableAt、retrievedAt、revision、reference、licenseClass。measurementType 为必填枚举 actual / estimate / forecast / indicative / identity / record / screening_result；本模板固定 actual。Query.measurementType 可选，指定时只匹配实际覆盖类型；本模板明确拒绝其他类型。financial.statements 的 actual 期间末日不能晚于 sourceAsOf；earnings.consensus 只能是 estimate，不能把预测混入财报实际数据。entity 为 scheme/id，unit 为 dimension/currency/scale，period 为 kind/start/end/可选 label，reference 为无凭证 URI/label。不要提前自行生成 provenance 或 observationId，由 Host 规范化保留原始来源。不同供应商/修订/时期不合并、不平均。

本夹具通过小型进程内 `tools.call` 返回 structuredContent，收入 USD millions 2，EBITDA 0.4。它只是独立的虚构记录，不声称和 REST 夹具或任何商业数据等价。sourceAsOf 2025-02-01T00:00:00Z，availableAt 2025-02-02T00:00:00Z，retrievedAt 当前；asOf 2025-03-01T00:00:00Z 且 maxAgeSeconds >=2419200 可查询历史已公开数据。不能将 availableAt 猜成当前时间或伪造历史可用时间。

## 凭证与配置安全

模板没有任意 endpoint、apiKey、password、token 或用户文件路径配置，不接触凭证服务。可选 credentialRef 只应是可信 Host 预先配置的凭证引用 ID。真实适配器要按 DSH 当前公开 credentials / authorization API 在 Host 内解析、验证和使用凭证，另做服务 API inspect；决不能向模型、catalog、reference 或前端发送密钥。不要用“设置字符串即 OAuth 成功”替代真实授权流程。本地 TEST_ONLY READY 绝不意味着商业认证。

真实非 TEST_ONLY 来源采用许可默认拒绝：生产 validate 可返回 licensePermitted / modelProcessingPermitted / sessionLoggingPermitted 三个可选 boolean，但商业来源查询必须三者经真实授权核验均为 true，分别证明来源使用、模型处理和会话日志许可。不返回、false 或无法验证均不能授权。注册、READY、credentialRef 存在或原角色 allowlist 都不代表获得这些许可。模板维持 NOT_CONFIGURED / TEST_ONLY，不伪造任何许可 true；上线前必须核对供应商合同、数据用途、处理和留存范围。

## 测试控制与卸载

financeExampleDataAdapter 的 `setState(state, code?)`、`failNextQuery(code?)`、`changed()`、`getSnapshot()`、`diagnostics()` 仅供可信 Host 测试。状态 code 白名单 FIXTURE_NOT_CONFIGURED / FIXTURE_NOT_AUTHORIZED / FIXTURE_UNAVAILABLE / FIXTURE_ERROR；故障 code 仅 FIXTURE_QUERY_FAILED / FIXTURE_UNAVAILABLE。changed 返回通知数量与累计 observerFailures；单个订阅者抛错不会阻断其他订阅者，诊断计数不会掩盖失败。卸载会注销 adapter、Host 服务并清空订阅，旧控制引用不能再修改实例。

## 检查与分发

在主仓库根目录运行 `node --test tests/p3-adapters/adapter.test.mjs`（纯 Node/fakeCtx 测试，不等于原生验收）和 `node tests/p3-adapters/check-packages.mjs`（资源/语法/临时独立复制导入检查，无安装或联网）。示例包含完整 runtime、patch、locale/en.json、locale/zh.json、原创 SVG 与 manifest files/exports；没有对测试目录或主包的生产导入。
