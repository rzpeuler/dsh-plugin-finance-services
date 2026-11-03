# Financial Services Bundle 治理与审计约束

类型：本轮 P0 审计参考。适用对象是仓库外 Financial Services Bundle；不是向 DSH 发行参照提交改动的授权。

## 写入范围与事实级别

本子任务仅写 `financial-services-bundle/audit/host/`。发行参照源码、Desktop 安装包、用户 Profile、其他业务项目全部只读。未运行依赖安装、Plugin Manager 管理动作、应用启动或构建，不通过 shell 遍历 ASAR 虚拟目录；ASAR 二进制仅供 metadata/hash 离线采集，输出仍限定在本目录。

已读 [任务书](<C:/Users/Administrator/Downloads/Financial_Services_DSH_Creator_Prompt_v1.md>)、[根治理](<../dsh-reference/AGENTS.md>)、[packages 治理](<../dsh-reference/packages/AGENTS.md>)、[Client 治理](<../dsh-reference/packages/client/AGENTS.md>)、[Web 治理](<../dsh-reference/packages/web/AGENTS.md>) 及触及目录的治理。本文与 [HOST_CONTRACTS](<HOST_CONTRACTS.md>) 不是 Core 修改方案。哈希及精确导出证据统一归 [runtime-contracts.json](<runtime-contracts.json>)，不把 schema/README 存在等同于真实行为测试。

## 必须遵守的实施规则

| 规则 | Financial Bundle 的具体落实 | 依据 |
|---|---|---|
| 业务属于插件 | Host金融服务、Controller、Adapter、Review运行在Bundle；不改Agent loop/Session/Subagent内核 | [根规则](<../dsh-reference/AGENTS.md#L133-L145>)、[业务分层](<../dsh-reference/packages/AGENTS.md#L13-L17>) |
| 注册是effect | 服务贡献、slots、工具、Adapter、resource provider、streams均有明确fiber owner及disposer；测试dispose后移除 | [注册规范](<../dsh-reference/AGENTS.md#L133-L139>)、[生命周期测试](<../dsh-reference/packages/AGENTS.md#L19-L20>) |
| 插件导出形态单一 | service plugin默认导出class；function plugin用named name/inject/Config/apply，不混合default | [plugin exports](<../dsh-reference/packages/AGENTS.md#L5-L6>) |
| optional service显式读取 | optional用ctx.get + undefined检查；实际hard依赖列inject，不猜服务 | [service读取](<../dsh-reference/packages/AGENTS.md#L5-L6>) |
| 检查发生于执行器 | Worker权限、数据能力授权、Review关口在真正操作入口检查；UI隐藏/prompt不算授权 | [不可绕过](<../dsh-reference/packages/AGENTS.md#L15-L17>) |
| 提交后才发布 | 持久写成功后才更新Runs/Review/UI；失败不发布“已批准/已保存” | [commit point](<../dsh-reference/packages/AGENTS.md#L17-L18>) |
| 模型输入可追溯 | 使用已支持消息/工具记录；不擅自append未知Session事件或实验plugin记录 | [模型与日志](<../dsh-reference/AGENTS.md#L137-L138>) |
| 作用域与isolate不同 | role工具/provider按scope隔离；在preset提供skills服务必须连同全部消费者使用同realm隔离 | [isolation说明](<../dsh-reference/packages/preset/agent-preset-registry/src/mount.ts#L58-L82>) |
| 组件零ctx | 数据/回调从派生props进入；不给组件whole-service、手写hook或React context逃生口 | [Client props](<../dsh-reference/packages/client/AGENTS.md#L11-L44>) |
| 加载状态走resource | resource数据通过useResource；业务组件不重写fetch/cache/polling，不同步镜像Host数据到store | [数据纪律](<../dsh-reference/packages/client/AGENTS.md#L21-L32>) |
| 不导入其他feature UI | type-only可跨feature；行为通过注入Service，UI通过slots；不滥用dsh.client.external | [export纪律](<../dsh-reference/packages/client/AGENTS.md#L34-L40>) |
| 客户端共享身份 | Cordis/React等从shell基线取；Host身份敏感库保持peer external；只为真实Host值导入声明安装依赖 | [依赖规则](<../dsh-reference/packages/client/AGENTS.md#L63-L85>) |
| 声明不等于激活顺序 | 跨slot所有者使用slots.inject；dsh.client.inject不排序apply | [注册生命周期](<../dsh-reference/packages/client/AGENTS.md#L142-L150>) |
| 主题/i18n/无障碍 | CSS Modules +语义token；产品字符串用locale；键盘焦点/Escape/错误反馈/窄屏需要真实验证 | [样式规则](<../dsh-reference/packages/client/AGENTS.md#L115-L121>) |
| 凭据安全 | 只在Host持有供应商密钥；UI不回显；不因设置存在判定授权；带凭据请求拒绝重定向 | [Web规则](<../dsh-reference/packages/web/AGENTS.md#L3-L5>) |

## 审批权限边界

金融 `original/fast/strict/custom` 只治理可放宽的内部业务暂停，不改变 `approval.ask/never`、permission preset、沙箱或MCP写入权限。发布报告、客户发送、正式记账、交易资金动作、KYC签字等永久禁项不可经任何Review配置解除。

普通业务操作可由UI与工具共享一个Host方法；批准、回答用户问题、降低策略等赋予权限的动作必须 user-only。不得为“所有UI动作都应有工具”而添加模型自批工具。人类actor从真实交互上下文派生，不能相信模型参数。强制Review检查位于后续阶段执行器及各有副作用接口，禁止仅让LLM自觉等待。

业务持久化使用Bundle拥有的domain/manifest，不双写另一套原生问题真相，不从浏览器localStorage恢复批准。原生问答用于呈现交互，其continued回复不能恢复已结束工具调用；Host重启后新阶段重新启动，不能宣称Workflow脚本原位恢复。

## MCP 与接口缺失治理

本版无 `dsh-mcp-manager`：记录实质差异并提供Bundle内部金融适配，不加Core补丁、不开发通用第二manager。真实配置entry的一连接、自动reconnect和工具同步可复用；公共动态restart/probe/watch/OAuth必须明确不可用。第三方Adapter插件通过Cordis金融服务注册/注销，不改十个主Agent源码，也不能自动放开新增源给全部角色。

公开机制缺失时不得深导入安装包内部 `connection.ts`、猜测lib导出、把Inspect provider当业务service调用、直写Profile patch、修改用户其他插件配置。需要新增方案时先核实exports/Service/事件模式，使用本Bundle严格Remote descriptor合法装配；尚未真实mount就标为待验证。

## 验证与报告

- product可见功能必须有真实Loader组合测试；仅ctx.plugin或mock单元测试不够。[组合测试规则](<../dsh-reference/packages/AGENTS.md#L7-L7>)。
- 每项registry必须有dispose/HMR安全测试；并发用例拥有各自路径、端口、子进程，不能只在串行通过。[测试要求](<../dsh-reference/packages/AGENTS.md#L19-L20>)。
- 使用最窄检查覆盖实际变更，报告仅已运行的命令；不在只读参照中构建或修复无关失败。P1应在Bundle自身执行构建/安装/真实mount，再评价实施状态。
- GUI安装状态、Host activation、Client同步、用户可见结果是四个不同证据级别。更改Client源码不会天然HMR；必须先构建对应Client bundle，且只有同checkout的dev:web watcher有效时才承诺自动更新。[模块构建要求](<../dsh-reference/packages/client/modules/README.md#L40-L54>)。
- 本轮采集是审计，不是P1实现；阻塞与验收标准见 [HC01–HC11](<HOST_CONTRACTS.md#8-阻塞验收标准均未由本子任务执行>)。`IMPLEMENTED/PARTIAL/BLOCKED/NOT_CONFIGURED` 必须逐项标注，`TEST_ONLY`永远不等于真实商业数据E2E。
