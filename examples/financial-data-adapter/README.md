# FinanceData：A 股适配器独立 Host 插件模板

这是私有、不可发布（`private:true`）的独立示例包 `@local/finance-data-adapter-example`，只实现当前唯一活动的 unversioned FinanceData 契约。主 Bundle 唯一 package/runtime entry 为 `@local/dsh-financial-services/data`；Schema contract 子路径为 `@local/dsh-financial-services/data-contracts`。需要用户显式安装本目录；不会随主包或测试包自动启用。默认状态为 `NOT_CONFIGURED`，且默认普通股 ticker allowlist 为空。内置数据是 `TEST_ONLY` 合成夹具，不代表任何真实证券、Provider、商业数据或 OAuth。

## 使用与授权边界

1. 复制整个目录后修改包名、patch row ID、metadata ID/source ID、Host 控制服务名、语言资源与图标，避免冲突。
2. 在提供 FinanceData Host 的 DSH 环境中，由用户通过原生插件管理器显式安装。无安装脚本、无外部 npm 依赖，不导入主功能包运行时值。
3. Adapter 默认 `NOT_CONFIGURED`；可信 Host 可在同进程测试控制中设置状态，但 READY 只表示合成夹具可读，不能证明来源或许可。
4. `createAdapter({ ordinaryEquitySymbols })` 的符号 allowlist 是可信 Host 输入，默认 `[]`。活动查询要求 `market: "CN"` 和六位 `.SH`、`.SZ`、`.BJ` ticker；代码形状不是普通股资格证明。必须在发出请求前由来源 Adapter 校验显式普通股名单；不能枚举全市场，也不能推断 ETF/LOF/基金为普通股。内置假数据仅绑定虚构的格式样例 `999999.SH`，不声称它是上市证券或普通股；生产 Adapter 必须换成经用户确认的真实普通股配置及真实数据源。
5. Adapter 注册不授予任何角色或 Session 查询权限。当前 source policy 存在独立的 `financial_data_current` 域，初始为空且默认 fail-closed；只有可信用户通过 Data Sources 显式建立精确 binding，且不超出角色原始来源 allowlist，才能查询。旧 `financial_data` grants 不迁移、不读取，保持惰性。
6. 非 `TEST_ONLY` 来源还须对每次查询逐项证明 `licensePermitted`、`modelProcessingPermitted`、`sessionLoggingPermitted` 均为 true；缺失、false 或未知均拒绝。商业许可与来源条件未核实之前不能将夹具改标为商业或声称授权。

## Adapter 契约

Host 暴露 `financeData.registerAdapter(definition) -> disposer`。插件通过 `inject = ['financeData']` 注入，并在 `ctx.effect` 中注册、返回清理函数。Metadata 与数据结构按 `@local/dsh-financial-services/data-contracts` 的 strict schema：

```js
{
  metadata: {
    id, version, sourceId, label, testOnly, licenseClass,
    capabilities: [{ id, markets, fields, temporalModes, priority, quality }],
    // credentialRef? 仅为可信 Host 引用，不是凭证值
  },
  state: { getSnapshot, subscribe },
  validate(query, { signal, requestId }) { return { compatible, code } },
  async query(query, { signal, requestId }) {
    return { observations, corporateActions: [], filings: [], warnings }
  }
}
```

此模板只声明 `financial.statements` / `CN` / `current_only`，只接受 `revenue`、`ebitda`，限定 FY2024、`PRC_GAAP`、合并口径及 CNY。它拒绝非 `current_only` 查询，并输出 `availabilityEvidence`、`revisionEvidence`、`reference` 与 `licenseClass`；current snapshot 不声称历史可得性，不可用于历史 as-of、回测或 source revision chain。所有 Query 字段必须由 Host strict schema 验证；未覆盖字段、时期、能力或时间模式应明确拒绝。

当前模型查询只提供 A 股股票边界：`market=CN`，`entity.scheme=ticker`，六位 `.SH/.SZ/.BJ` 代码；支持能力及其余 Query 结构由 Host 的当前 schema 决定。Ticker 语法不等同于证券类别授权。来源偏好只选择来源，不授予权限。Adapter 不能接收/生成 Agent、Session、role ID、策略 binding 或秘密凭证。

## 状态、凭证与清理

状态为 `READY` / `NOT_CONFIGURED` / `NOT_AUTHORIZED` / `UNAVAILABLE` / `ERROR`，`verifiedAt` 必须是实际状态检查时刻。生产 query 必须传播 AbortSignal，不得将 Provider 异常正文、令牌、密钥写入 warning / code / reference。模板不配置 endpoint、apiKey、password、token 或任意用户文件路径，不接触凭证服务。真实凭证只能按当前 DSH 公开 Host 凭证接口在可信边界内使用，不能发送到模型、catalog、reference 或前端。

`financeExampleDataAdapter` 的 `setState`、`failNextQuery`、`changed`、`getSnapshot`、`diagnostics` 仅供可信 Host 测试；错误码是固定白名单。卸载会精确注销 Adapter、Host 服务并清空订阅，旧控制引用不能修改已卸载实例。

## 检查与分发

在 Bundle 根目录可运行 `node --check examples/financial-data-adapter/index.js` 与 `node --check examples/financial-data-adapter/client.js` 做语法检查；通用契约、Policy/Registry 与 Host 行为由 `pnpm test` 覆盖。本示例只展示 `registerAdapter` 接口与 TEST_ONLY 合成快照，不连接真实数据源。历史资料中使用过 `registerAdapterV2`、版本化契约路径及带版本后缀的工具名；这些均不是当前接口。示例包包含完整 runtime、patch、locale、原创 SVG 与 manifest exports/files；没有主包的生产导入。
