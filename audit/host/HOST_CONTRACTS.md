# Financial Services：DSH Host / Client 源码适配契约

类型：P0 只读审计参考；不是插件实现或安装验收。参照 tag `dsh-v0.2.1-rc.5`，commit `b830ec950faba0a46dda564be3e2d854afed94f1`；审计前 `git status --short` 为空。唯一写入范围为本审计目录。

## 1. 证据与安装包对照

- 任务书已完整读取：[原任务书](<C:/Users/Administrator/Downloads/Financial_Services_DSH_Creator_Prompt_v1.md>)。治理见 [GOVERNANCE](<GOVERNANCE.md>)。
- [runtime-contracts.json](<runtime-contracts.json>) 收录参照源码逐文件 SHA-256、合约源行号、30 个目标包的安装 manifest、完整 exports、每个具体导出目标的存在性/字节 hash/行数及 JS 末尾导出子句。由 [只读采集脚本](<collect-contract-evidence.py>) 从 ASAR 二进制目录和指定源码路径计算，不启动应用、不执行安装包模块、不修改 ASAR。
- 30 个目标包中 29 个有独立安装包；29 个 exports 与发行 tag 完全一致；83 个具体缺失目标全部为 `.d.ts`，具体 `.js` 缺失为 0。不能因此宣称可直接对 Desktop 安装目录进行 TypeScript 构建，也不能把 manifest 的 `./src/*` 当成实际配送源码。
- `dsh-client-ui-slots` 无独立安装 manifest，但为 [shell 静态基线](<../dsh-reference/packages/client/web/src/platform.ts#L8-L15>)；不是 Slot 功能缺失。基线同时包含 `zod`、React、Cordis、store、ui-primitives、dockkit。
- 本子任务先 list Inspect，后 exact 查询 Host `settings` / `storageDomain` / `commands` 成功，`mcpManager` 明确不存在。随后 Client `remote` 查询超时；父任务此前已成功 Inspect `uiWorkspace` 和 Slots，本次超时不撤销先前证据。本报告不把源码审计等同于新插件的 live mount 或 GUI 行为验证。

## 2. 必须修正的 MCP 前提

**任务书 §7.4 的 `dsh-mcp-manager` 在此 tag 不存在，不是一个默认关闭但可启用的服务。** 参照全树 `mcp-manager|mcpManager` 无命中；ASAR `@deepseek-ai` 目录仅有 `dsh-mcp-client` / `dsh-mcp-resources` 两个 MCP 包；live exact Inspect 返回 `no catalogued Service named "mcpManager"`。

真实机制与证据：

| 项 | 本版真实能力 | 精确依据 |
|---|---|---|
| 连接 | 每个 Loader entry 一个服务器；`stdio` / `streamable-http` | [Config 与 apply](<../dsh-reference/packages/mcp/mcp-client/src/index.ts#L119-L203>)；[transport](<../dsh-reference/packages/mcp/mcp-client/src/transport.ts#L31-L45>) |
| 启动/断线 | 初始连接和 discovery；自动指数退避重连；工具列表变更同步；耗尽预算移除工具 | [README](<../dsh-reference/packages/mcp/mcp-client/README.md#L89-L93>) |
| 生命周期 | fiber disposal 断开连接、停止重连并注销工具；配置重载重建实例 | [apply](<../dsh-reference/packages/mcp/mcp-client/src/index.ts#L178-L202>) |
| 资源 | scoped provider `register(server, provider)`，list/templates/read 工具 | [MCP resources](<../dsh-reference/packages/mcp/mcp-resources/src/index.ts#L74-L125>) |
| 工具桥 | 公开 `createMcpToolDefinition(ctx, options)`，调用者自行拥有 transport/deadline/teardown | [桥定义](<../dsh-reference/packages/mcp/mcp-client/src/tools.ts#L195-L246>) |
| 不存在 | 动态 Server Registry / manager 状态目录 / 公共 restart、probe、watch、交互 OAuth、Credential-ref Config 字段 | [实际 Config](<../dsh-reference/packages/mcp/mcp-client/src/index.ts#L51-L142>)；[实际 transport](<../dsh-reference/packages/mcp/mcp-client/src/transport.ts#L31-L45>) |

安装 JS 直接对照：[mcp-client lib](<C:/Users/Administrator/AppData/Local/Programs/DeepSeek%20Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-mcp-client/lib/index.js#L746-L836>) 只导出 `Config, apply, createMcpToolDefinition, inject, name`，无 manager class 或管理 Service。内部 `connection.ts` 即使有 `startConnection` 也不是该包根导出的管理 API，禁止深导入替代。

适配决定：`§7.4 原生 Manager 等价性 = BLOCKED`；已配置的 `mcp-client` 连接与资源使用可作 `PARTIAL` 替代，不能伪装原生配置页或状态 API。金融 Bundle 自有 Data Capability Registry 只治理金融能力/Adapter，不成为另一个通用 MCP Manager。连接配置、自动 reconnect、stdio 协议协商的临时 probe 不等于面向金融 UI 的 `probe/restart/watch` 管理接口。未配置凭据保持 `NOT_CONFIGURED`；OAuth 依赖必须由供应商或外部授权流程解决，禁止标记 authorized。不要从 Loader ACTIVE、配置存在或工具已发现推断 data-query-verified。

## 3. 合法 Client → Host：plain JS、无 Core 改动

### 3.1 已存在的两条路径

1. 会话内人类动作：Host `ctx.commands.register()`；Client 原生 `ctx.remote.commands.execute(agent, line, attachments, signal?)`。工具若代表同一非授权动作，可直接调用该动作的业务 Service，而不是模拟用户 slash command。[commands register/execute](<../dsh-reference/packages/interaction/commands/src/index.ts#L333-L388>)。首次引导没有 Agent，不为调用 command 而创建额外 Session。
2. 全局/首次引导：Bundle 自有 Cordis Service + **严格 InvocationDescriptor**，Host `ctx.typert.register()` 注册；同 Bundle Client `ctx.remote.$mount()` 挂载描述。Gateway 继续拥有鉴权、Peer、输入验证、取消及 RemoteResult；不加 HTTP route，不改内核 `api-remotes` 静态选择。

只继承 `TypertRemoteService` 或调用 `Remote` 不会产生浏览器可挂载的严格字段 schema；SRC discovery 不恢复被擦除的类型，Client 不能挂载 `src-json` 替代严格 codec。[Gateway](<../dsh-reference/packages/api/gateway/README.md#L24-L60>)。但**并非必须先跑 Typert codegen**：公开 Registry 接受精确 descriptor，源码测试本身手写 strict contribution：[真实注册测试](<../dsh-reference/packages/api/gateway/tests/strict-source.host.spec.ts#L13-L59>)、[手写 spec 与卸载测试](<../dsh-reference/packages/typert/registry/tests/typert.spec.ts#L110-L145>)。

### 3.2 最小合法 descriptor（建议片段，不是已实现插件）

下列是本 Bundle 自有共享模块，可打入 Host 与 Client；`package` 与 service 名仅为本 Bundle 拟定值。只绑定 ID/path，实际 Host 方法仍必须核实 canonical 路径、Workspace 存在性、访问权限和配置 revision。

```js
import { z } from 'zod'
const requestSchema = z.strictObject({
  workspaceId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
})
const resultSchema = z.strictObject({
  workspaceId: z.string().min(1),
  path: z.string().min(1),
  revision: z.number().int().nonnegative(),
})
const requestCodec = {
  mode: 'strict', typeSymbol: '@local/financial-services#BindRequest',
  create: () => requestSchema,
}
const resultCodec = {
  mode: 'strict', typeSymbol: '@local/financial-services#Binding',
  create: () => resultSchema,
}
export const financeRemote = {
  package: '@local/financial-services',
  descriptors: [{
    id: '@local/financial-services#financeOperations/bindWorkspace',
    service: 'financeOperations', namespace: 'financeOperations',
    method: 'bindWorkspace', invocation: { kind: 'direct' },
    parameters: [{
      name: 'request', wire: 'request', source: 'json', codec: requestCodec,
    }],
    result: resultCodec,
  }],
}
```

`create` 必须返回真实 Zod schema；这里不用 tool JSON Schema 投影，故不必虚构 `jsonSchema`。若将此动作额外投影为 Agent 工具，应显式定义工具 schema，或提供匹配 codec 的 JSON Schema 后再投影。可选公开辅助 `createTypertRemoteInfo(spec, z)` 生成相同 descriptors，见 [factory](<../dsh-reference/packages/typert/protocol/src/remote-info.ts#L20-L81>) 与 [spec 类型](<../dsh-reference/packages/typert/protocol/src/types.ts#L588-L626>)；该形式每个 parameter 需同时提供 `codec` / `strictCodec`，不是直接 descriptor 的必需字段。

Host 装配片段：

```js
// FinanceOperations 是 Bundle 自有 service class，不是 DSH 既有服务名。
// extends TypertRemoteService；constructor(ctx) 调用 super(ctx, 'financeOperations')。
// bindWorkspace(request) 实现且仅实现真实 Host 核验和持久写入。
ctx.plugin(FinanceOperations)
ctx.typert.register({
  package: financeRemote.package, face: 'host', schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: financeRemote.descriptors,
})
// 同一 bindWorkspace 由受授权的工具直接调用 ctx.financeOperations.bindWorkspace(request)。
```

Service 的 visible binding 由 [TypertRemoteService](<../dsh-reference/packages/typert/protocol/src/index.ts#L232-L259>) 提供；已有其他基类时可用公开 `bindTypertRemote(this, serviceKey)`。严格派发优先 `ctx.typert.local`，只核实 binding 后执行 descriptor 指定方法，不依赖 SRC 装饰器扫描：[Gateway dispatch](<../dsh-reference/packages/api/gateway/src/index.ts#L810-L885>)。资源授权若需要非 owner 访问，不可遗漏实际触及的资源；本例首次配置属于 global profile 操作，默认不向非 owner 开放。

Client 装配片段：

```js
// 自有 Client apply 注入 remote 后；financeRemote 是本Bundle打包的共享定义。
await ctx.remote.$mount(financeRemote)
const bindWorkspace = async request => {
  const result = await ctx.remote.financeOperations.bindWorkspace(request)
  if (!result.ok) throw result.error
  return result.value
}
// 在 slots.register 的 inject 面返回 bindWorkspace；组件拿不到 ctx/整项service。
```

上例 `model` 为空只实现合法派发，不会自动向 Inspect 提供金融 Service 的反射说明；正式公开扩展需补齐自有反射/文档或维护明确接口，不能因 Inspect 尚未列出就推断 Service 未激活。`$mount` 是 effect-owned；重复 endpoint 会拒绝，卸载撤销后保留的调用句柄会失败。若自己手工注册 descriptor，不再声明一个会被 Loader 自动加载的重复 `./typert` contribution；如果改用自动 `./typert` 装配，则删除手动注册。不要同时 `$mount` 与 `typert.remotes.register` 同一 contribution。[Registry](<../dsh-reference/packages/typert/registry/README.md#L44-L48>)。

### 3.3 Client 模块与共享身份

plain factory 可从 shell baseline `require('zod').z` 取 Zod；ESM 构建则正常 `import { z } from 'zod'` 并把基线 external 到 shell。证据：[platform](<../dsh-reference/packages/client/web/src/platform.ts#L8-L15>)。不要在 Client runtime require 非基线 feature 包；本例直接 descriptor 不需 runtime 导入 `dsh-typert-protocol`。若用 factory 辅助，应将公开纯辅助与本 Bundle schema 编译入自有 Client 模块，不发明模块表供应商。

Host Cordis / Loader / scope 等身份敏感运行库要保持宿主共享身份：声明适配版本 peer + dev，Host 打包 external，不嵌入第二份 Cordis。Client 的 Cordis/React 等基线由 shell 供应，不能自带第二份。`dsh-typert-protocol` 本身在源码政策中列为 duplicate-safe，不能误说其所有符号强制要求共享模块身份；其 Cordis 依赖仍需正确共享。`schemastery` default 属允许普通依赖的安全导出。依据：[dependency rules](<../dsh-reference/packages/client/AGENTS.md#L63-L85>)、[identity 分类测试](<../dsh-reference/scripts/verify-package-dependencies.spec.ts#L232-L247>)。只注入 Service 不等于必须 npm 依赖所有对应包；type-only / 浏览器构建关系放 devDependencies，Host 真正值导入逐项分类，别把全部运行包加入 dependencies。

## 4. Slot / 数据加载

- 一个 `sidebar.panellist` 新 list id + 同名 `main` 新 keyed key；不要覆盖 occupied key。跨所有者 slot 用 `slots.inject()` 等声明生命周期；`dsh.client.inject` 是信息元数据，不是 apply 执行排序。[注册规则](<../dsh-reference/packages/client/AGENTS.md#L142-L150>)。
- 组件只接收派生 props；owner 已知数据走 owner props，仅本组件临时数据用 local state，共享视图状态用声明 store；业务事实由 Host service 持有。所有可外部变动 render 数据走框架 hook，不手写订阅/轮询/`useSyncExternalStore`。[Client 规则](<../dsh-reference/packages/client/AGENTS.md#L11-L40>)。
- Bundle 自有 `finance` resource protocol 可封装上述严格 Remote 的查询/流；在 apply 的 effect 中 `resources.register`，组件通过 `useResource(address)` 消费。不用 React effect 发 fetch、复制资源缓存。四态 `none/loading/live/failed`，failed 保留旧值时必须显示过期/错误；dispose/abort 后停止流。[resource API](<../dsh-reference/docs/subsystems/client-resources.md#L22-L86>)。
- 新跨 Host 事件不会自动进入 `ctx.remote.$on`；原生 allowlist 是构建期固定选择。Bundle 自有 follow stream / baseline query 支撑重连，不改 Core allowlist，也不把 best-effort 通知当持久事实。[API Remotes](<../dsh-reference/packages/api/remotes/README.md#L73-L79>)。

## 5. Settings 与 Workspace

- 可编辑字段由 Host plugin Config `.volatile()` 提供；ns 是唯一 Loader row id，不是 npm package 名，不存在任意 `settings.register(namespace, object)`。Client 用原生 `remote.settings.describe/update/replace/mutate`，携带读到的 `expectedRevision`；优先 `mutate`，不回写被遮蔽的 secret。[Settings](<../dsh-reference/packages/settings/settings/README.md#L24-L49>)、[控制器方法](<../dsh-reference/packages/api/settings-controller/src/index.ts#L97-L157>)。
- `plugins.bundle.config` key 是 Bundle npm package 名；其 owner 可传 `form`，但该字段 optional，不能假设任意 bundle 都有单一自动 form。[slot props](<../dsh-reference/packages/client/ui-plugin-manager/src/client/slot-contract.ts#L25-L30>)、[config slots](<../dsh-reference/packages/client/ui-plugin-manager/src/client/slot-contract.ts#L125-L150>)。
- 首次 Workspace 选择/注册可用父任务已核实的 native workspace API；再用共享 Host bind 方法核验真实 registry record，保存规范 `workspaceId/path` 与 revision。仅浏览器 localStorage 不够；不要用全局 `initializeDefault`。改变 binding 只影响新任务。
- `uiWorkspace.startSession(workspaceId, {agentPreset,prompt,whenDraftExists})` 返回 `void`；只初始化草稿，不代表提交或创建成功，不能 await 它获得 sessionId。[签名](<../dsh-reference/packages/client/ui-workspace/src/client/navigation.ts#L73-L89>)。若业务必须取得 id，用已有 `connectWorkspace` / Host create 的真实返回值并保留草稿语义，不把二者混写。
- Session create 只接受 workspaceId 或 cwd 二选一，使用 Workspace path 并 attach；cwd 不改为 artifacts 子目录。[Session create](<../dsh-reference/packages/api/session-controller/src/commands.ts#L111-L149>)。

## 6. Review、持久化与隔离

- Review 是金融业务事实，不是 `approval` 工具权限；原生权限请求需 open turn 且 fail-closed，不能用它充当长期业务状态机。[approval](<../dsh-reference/packages/interaction/user-approval/README.md#L25-L52>)。
- Review 决策必须 user-only，不投影到 Agent 工具、不让 `actor:'human'` 参数充当授权；模型工具可提出 review/query 状态/提交新版本，不能 approve/reject 自己。后阶段的执行器和金融数据动作必须确定性核实已批准版本，不仅 prompt 暂停。
- Host `storageDomain.open(defineDomain(...))` 保存 runs/reviews/artifact metadata；handle 归调用方 close。单 record `table.update` 在写链中原子读改写，适合 review version/status 一次性结算；无跨表事务，别把一连串 put 宣称原子。[domain update](<../dsh-reference/packages/storage/storage-domain/src/domain.ts#L82-L118>)、[持久语义/限制](<../dsh-reference/packages/storage/storage-domain/README.md#L83-L94>)。核验、actor、policyVersion、artifactHash、状态迁移及 continuation intent 尽量放同一权威 record。
- 原生问题可作 UI 交互；子 Agent 不直接提问；continued 回复是新消息，不恢复已经完成工具调用。仅依赖模型问答不是强制 Review。[user questions](<../dsh-reference/packages/interaction/user-questions/README.md#L27-L40>)。Workflow 无脚本持久 checkpoint 的边界保留，批准后启动新阶段执行单元。
- `skills` registry 层合并会继承 global；`includeDefaultRoots:false` 只控制该 filesystem provider，不排除其他全局 provider。若要求只发现授权技能，**每个 role 使用独立 `skills` 隔离组，组内共同装载 `dsh-skill` registry、`dsh-skill-filesystem`、`dsh-tool-skill` 及其技能消费者**。新增 provider service 若在 preset 内不 isolate 会被拒绝。[继承](<../dsh-reference/packages/skill/skill/src/index.ts#L345-L423>)、[泄漏拒绝](<../dsh-reference/packages/preset/agent-preset-registry/src/mount.ts#L204-L214>)。
- finance-only provider 设置 `includeDefaultRoots:false`、显式 role roots；不要另带 bundled 默认根。根直接子目录 `SKILL.md` 或 flat `.md`，非递归；保留资源相对路径。[filesystem](<../dsh-reference/packages/skill/skill-filesystem/src/index.ts#L159-L176>)、[发现](<../dsh-reference/packages/skill/skill-filesystem/src/index.ts#L730-L755>)。技能隔离不等于文件权限；仍需工具 restrict/guard 与 writer 路径边界。

## 7. 外部 Adapter / Deliverables / Plugin Manager

Adapter 是另一 DSH 插件：依赖注入 Bundle 提供的公共金融 registry Service，调用 `register(adapter)` 返回 disposer 并用 ctx.effect 拥有，卸载必须注销、取消在途请求、拒绝旧 provider 句柄。Service Definition / Provider / Consumer 分工清晰；不要用 global/window 单例或 runtime import 另一个 Client feature 组件。外部 Adapter 可自由实现 MCP/REST/file 的窄金融 query；Host 执行层按 calling Agent/Worker + capability/source 白名单校验，禁止通过 broad raw MCP 工具绕过。测试 Adapter 标记 `TEST_ONLY`，不得纳入真实金融 E2E。

Deliverables 沿用 `present` durable declaration + Session-scoped file resource + `sidebarRight.openResource`，保留独立金融 manifest/index 存 hash/version/review。不能 runtime import `ui-deliverables` 卡片组件、造 Office 查看器或把变更 diff 当业务审核记录。[交付卡/动作](<../dsh-reference/packages/client/ui-deliverables/README.md#L33-L39>)、[sidebar controller](<../dsh-reference/packages/client/ui-sidebar-right/README.md#L81-L97>)。全局工作台显示时 sidebar 的 on-screen Session 可能不存在；先 `uiWorkspace.openSession` 导航至成果所属 Session，再用真实 session-addressed 资源打开；必须测试切换时序，不借当前无关 Session 的权限。卡片声明不保存文件本体，文件缺失必须明确失败。

Bundle 关闭/卸载只撤销服务、工具、资源 provider、slots、Adapter、监听器和任务；不删除 Workspace、原始文件、Session 历史、业务记录。preset revision 被现有 Agent retain 时可能继续存活，不能把声明删除误报为所有旧会话已停止。[revision 回收](<../dsh-reference/packages/preset/agent-preset-registry/src/index.ts#L81-L100>)、[retain 收集](<../dsh-reference/packages/preset/agent-preset-registry/src/index.ts#L148-L151>)。金融执行器仍应在全局服务卸载后 fail-closed。

Plugin Manager 安装/启用/禁用/移除是唯一 Profile 修改通道；本次审计不调用管理动作。安装结果 `application` / warnings 为准，不凭 pnpm exit 0 断言 live success；无 HMR 可能 restart-required。移除次序为 deselect → unload → pnpm remove → publication；失败保留已完成步骤，不私自回滚用户业务数据。[生命周期](<../dsh-reference/packages/boot/plugin-manager/README.md#L148-L162>)。activation slot 只代表用户一次启用引导，不是 Host once-only 持久标志；用自己的 persisted binding/onboarding version 防重复引导。

## 8. 阻塞/验收标准（均未由本子任务执行）

| ID | 必须通过的真实测试 | 未通过的声明限制 |
|---|---|---|
| HC01 | Loader 安装 Bundle；Host strict register + Client $mount；无 Session 全局调用 bind；同参数工具调用共享方法；错类型/额外字段在业务执行前拒绝 | 不得宣称 P1 Workspace闭环 |
| HC02 | mount/dispose/re-enable：remote、资源、slots、Adapter 不残留；旧句柄失败；没有第二份 Cordis | 不得宣称生命周期完成 |
| HC03 | volatile Settings roundtrip、stale revision拒绝、Host重启恢复 binding；不存在/移动/无权限目录拒绝 | 不得宣称持久配置完成 |
| HC04 | 10主/30Worker各自实际skills.list/get；跨role技能/用户全局provider不可见；资源脚本可读；registry泄漏audit为空 | 不得按文件数量宣称隔离 |
| HC05 | 直接tool/MCP/子代理入口均拒绝非白名单；只读Worker无写/通用shell；writer canonical路径、链接/穿越/并发覆盖测试 | 不得宣称安全隔离 |
| HC06 | Review工具自批拒绝、伪actor拒绝、旧hash/过期版本/重复并发批准拒绝；后阶段executor直接调用也拒绝；持久结算后才发布 | 不得宣称强制人审 |
| HC07 | Host重启/断线：review事实一致，未知运行标明未知；批准后新执行单元，不伪装原位Workflow恢复 | 不得宣称可恢复工作流 |
| HC08 | 两个独立TEST_ONLY adapter热插拔、同capability选择/fallback/单位期间归一、撤销、真实UI投影 | 不得宣称外部扩展完成 |
| HC09 | MCP真实已配置连接与真实查询分别检验；无Manager时UI清楚说明，禁显示虚构restart/probe/watch/OAuth | §7.4原接口仍BLOCKED |
| HC10 | present文件跨Session打开、原生预览/Office/native-open可用；Host重启后索引可恢复、文件丢失真实失败 | 不得以静态卡片算交付闭环 |
| HC11 | Plugin Manager install/off/on/remove；检查application与Client同步；禁止删除用户文件历史；retain中的旧Session有明确边界 | 不得宣称可安装产品验收 |

本次已执行：只读版本/clean-tree检查、源内容核对、ASAR manifest/exports/存在性/hash采集、Host Inspect查询。未执行：插件实现、安装、构建、业务E2E、GUI渲染、用户Profile修改。
