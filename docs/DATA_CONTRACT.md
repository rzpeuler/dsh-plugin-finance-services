# FinanceData：A 股只读数据契约

> 当前只保留一个活动 FinanceData 数据面，面向中国大陆 A 股研究；所有 Host、Remote、模型工具和 Adapter 均使用 unversioned canonical API。旧文档、审计记录里出现的 V1/V2、`2.0.0`、`data-api-v1/v2`、`data-contracts/v1/v2`、`registerAdapterV2` 与 `finance_data_query_v2` 均是历史标识，不代表另有活动数据面。

当前策略域为独立的 `financial_data_current`，初始为空。旧 `financial_data` 域中可能留存的授权记录不会迁移、读取、继承或用作回退，保持惰性；本次收敛不删除这些持久记录。

本数据边界不是通用 MCP Manager。当前没有已注册或获授权的 Provider；候选 Reader 均为 `TEST_ONLY`、未注册，默认没有证券符号授权或任何许可。不得据此宣称商业数据源已连接、获得许可或完成金融业务 E2E。

## 契约与公开服务

唯一 FinanceData package/runtime entry 为 `@local/dsh-financial-services/data`；Schema contract 子路径为 `@local/dsh-financial-services/data-contracts`，factory 为 `createDataSchemas(z)`。Host 注入 `financeData` 服务；同进程 Adapter 通过 canonical 注册接口注册：

```js
ctx.effect(() => ctx.financeData.registerAdapter(definition), 'my financial adapter')
```

Adapter metadata 必须声明 `temporalModes`；`validate(query, execution)` 与只读 `query(query, execution)` 返回严格结构。Adapter 状态来自实际 Provider，不得由注册或 `credentialRef` 推断为 READY。精确 disposer 取消该 Adapter 的 inflight 请求并移除目录，不删除用户数据。独立模板见[金融数据适配器示例](../examples/financial-data-adapter/README.md)。

Remote namespace `financeData` 只提供用户操作用的 `catalog`、`setBindings`、`follow`；Agent 查询仅经同进程工具 `finance_data_query` 执行，不能通过 Remote 修改策略或访问原始上游。能力 ID 是契约枚举，不代表存在 Provider；当前模型工具将能力进一步限制为已定义的 A 股股票数据集合。

## A 股查询约束

模型查询必须使用 `market: "CN"`、`entity.scheme: "ticker"` 和六位 `.SH`、`.SZ` 或 `.BJ` 代码。代码格式只验证证券代码形状，**不能证明该证券为普通股**；每个 Adapter 还必须在发出请求前匹配明确配置的普通股 allowlist。allowlist 默认空，不允许全市场枚举，也不从 ETF、LOF、基金或代码外形推断普通股资格。候选 Reader 的符号上限为 20；范围、字段、日期、行数、字节数与超时均须受界限约束。

Query 明确要求 capability、实体、市场、字段、period、asOf、purpose、temporalMode（默认 `strict`）、maxAgeSeconds，以及适用时的 priceAdjustment 或 corporateActionDateBasis。它不接受 Agent/Session/role ID、凭据或授权参数。只读工具不创建或放宽策略；无精确授权、无 Provider 或状态不满足时必须拒绝，不能联网回退或猜测数据。

`strict` 要求可验证时间戳和完整/单记录来源修订证据；`date_bounded` 仅可显式选择并带稳定警告；`current_only` 只表示当前快照，不得用于历史 as-of 或回测。`filings` 仅按公告日期范围检索，reportPeriod 保持独立；公司行为必须指定日期基准；价格调整语义显式声明，未经验证的模式不得声称支持。

## 权限与持久策略：默认拒绝

当前策略保存在独立原生 `financial_data_current` 域，首次状态为空（revision 0、零 bindings）。旧 MCP binding 仍受原角色 `allowedMcpServers` 约束；新增 A-share 来源采用独立 `sourceId` grant，不读取/写入 MCP allowlist，并严格交集 exact role/scope、adapter/source、capability、market、purpose、temporal mode。不能由模型、Adapter 注册、状态 READY、凭据配置或公开端点创建或扩大授权。**无 binding 即拒绝**。

直接金融来源 grant 每次使用都由 Host 检查版本化 `LicenseAssessment`：source/capability/purpose 必须匹配，自动访问、模型处理和会话日志许可需明确为 true，且证据有效、未过期。缺失/未知/需审核返回 `LICENSE_REVIEW_REQUIRED`，限制冲突/拒绝返回 `LICENSE_USE_NOT_AUTHORIZED`，过期 assessment 明确阻断。旧 MCP binding 继续使用 Adapter `validate()` 的三项布尔兼容检查；direct source grant 不接受 Adapter 自报布尔值。`NONE` 认证仅表示无需登录，不表示合法授权。

旧 `financial_data` 域及其 grant 不复制到 `financial_data_current`，也不会由当前代码读取；升级不会复制、继承或隐式授权旧策略。原始 Provider payload 不持久化；获准的模型可见结果仍遵循 DSH 原生日志规则。

## 证据与历史边界

历史 acceptance 记录与审计文档保留以供溯源；可运行的旧契约、Registry、Policy、Normalizer、角色查询与 Adapter fixtures 已移除。旧 API 名称仅在明确标注的历史记录中出现，不表示它们仍可调用，也不证明 A 股来源已验证。MCP transport、真实金融桥接、商业许可及 GUI 视觉验证边界见[MCP 兼容边界](MCP_COMPATIBILITY.md)和[P3 预设标准](../acceptance/P3.md)。

当前运行路径使用统一 schemas、normalizer、fail-closed source policy/registry、独立持久策略域、Host/Remote、A-share-only `finance_data_query` 与 Data Sources UI。`src/data/cnequity-reader.js` 及独立 `examples/ashare-adapters/` 均为未注册候选；后者包含 Eastmoney daily OHLC、THS annual consensus EPS、TDX local daily-package parser 的独立 Adapter definitions，默认没有 ordinary-share allowlist，使用 `UNASSESSED` license 与 `CURRENT_OBSERVED` PIT。Eastmoney/THS/TDX 的数据使用、自动访问、模型处理和会话日志许可仍须逐源核实；未安装、未查询真实数据、未完成 GUI E2E。

## 历史标识

此前曾以 V1/V2 与 `2.0.0` 区分契约、Remote、Runtime 和模型工具。它们只是历史迁移标识；当前公开接口和持久策略均为单一、unversioned canonical plane。旧 V1 `financial_data` grants 留在原域但保持惰性，不迁移、不读取、不用于当前授权。
