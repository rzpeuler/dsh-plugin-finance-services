# 金融数据接口 1.0.0（P3实施中）

本基础层是金融数据能力接口，不是通用MCP Manager。当前只验证TEST_ONLY插件；不宣称商业源已连接、获得许可或完成金融业务E2E。

## 契约与公开服务

版本化公开子路径`@local/dsh-financial-services/data-contracts/v1`的[contracts.js](../src/data/contracts.js)提供自包含`createDataSchemas(z)`；[normalization.js](../src/data/normalization.js)原子校验/规范化；[registry.js](../src/data/registry.js)管理自有注册、选择、取消与撤销。Host注入服务`financeData`，第三方只需声明该依赖：

```js
ctx.effect(() => ctx.financeData.registerAdapter(definition), 'my financial adapter')
```

定义包含严格`metadata`、可观察的`state.getSnapshot()/subscribe()`、`validate(query, execution)`及只读`query(query, execution)`。状态来自实际Provider，不从注册或credentialRef存在推断READY。exact disposer取消该Adapter的inflight并移除目录，不删除用户文件。示例见[独立模板](../examples/financial-data-adapter/README.md)。

14稳定capability ID仅表示支持的接口名称，不代表14类来源均已授权或有可执行Provider。当前两个测试插件只提供`financial.statements`；其余能力无Provider时明确不可用。

## 请求与观察

请求明确capability、entity scheme/id、market、requiredFields、financial period、asOf、purpose、maxAgeSeconds；可附目标单位、会计口径、合并范围、measurementType及来源偏好。来源偏好不是授权。模型JSON不可传Agent、Session、roleId、凭据或授权。

观察保留field/value/unit、period、measurementType、accountingBasis/consolidation、sourceAsOf/availableAt/retrievedAt、revision、引用和licenseClass。`actual`不是审计或正式NAV签字证明；一致预期只能用`estimate`，不能以历史财报、网页研究或模型猜测替代。

- 时点：`sourceAsOf <= availableAt <= retrievedAt <= now`；sourceAsOf和availableAt均不得晚于请求asOf。历史检索允许retrievedAt晚于asOf，但不能事后回填当时不可得的数据。
- 实际观察的period.end不得晚于sourceAsOf所写日历日期；consensus估计可覆盖未来期间，仍受原可得时点约束。
- 倍率只作明确维度内的ones/thousands/millions/billions或ratio/percent/basis_points转换。不同币种没有FX依据则拒绝；不猜测会计口径或合并范围等价。
- 不同Provider、期间、修订和口径仍为独立观察，绝不去重平均。源值/单位、Adapter ID/version/source ID及TEST_ONLY标记保留在provenance中。缺失必需字段/空值不补零。
- 引用只接受无凭据、无query/fragment的canonical HTTPS或URN。错误/状态使用有限类别，不输出Provider异常正文或任意vendor code。

## 授权与持久策略

注册默认无任何角色授权。显式binding需同时指定Adapter、原Managed YAML的sourceAllowlistKey、roleIds、实际scopeIds（原生Agent/Session ID）、capabilities、markets、purposes、优先级/质量门槛与是否允许TEST_ONLY。

`[原角色源允许列表] ∩ [明确Session/角色/能力binding] ∩ [当前exact-Agent grant与source/prompt SHA] ∩ [Provider实际状态/许可]`全部通过才查询。writer永无查询入口。新增Adapter不会自动把新能力授予所有角色或该角色其他Session。

非TEST_ONLY来源除了READY，还需validate逐请求返回`licensePermitted/modelProcessingPermitted/sessionLoggingPermitted`三个明确true；缺少任一个即NOT_AUTHORIZED。分类标签、凭据配置、网页可见或商业供应商名称均不证明许可。

策略存于原生`financial_data` v1 domain。Host串行执行prepare→durable put→commit；CAS冲突或保存失败不发布新授权，策略变化取消旧inflight。卸载Adapter不自动清除用户策略；测试只按自有scope删除自有临时绑定，revision不倒退。原始Provider payload不持久化，授权后的模型可见结果仍遵循DSH原生日志规则。

## 边界与本轮证据

[26项原生服务检查](../acceptance/P3-foundation-native-pass-001.json)及[6项卸载审计](../acceptance/P3-adapter-unload-audit.json)通过：两个独立TEST_ONLY Adapter、来源回退/单位/PIT/许可状态、同角色跨Session拒绝、原生持久CAS与清理。原卸载审计遗漏await的失败独立保留。

模型查询工具与Data Sources前端尚未接入；真实MCP/商业许可/视觉均未验证。参见[MCP兼容边界](MCP_COMPATIBILITY.md)和[P3预设标准](../acceptance/P3.md)。
