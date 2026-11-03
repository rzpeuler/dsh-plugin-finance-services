# COMPATIBILITY_MATRIX

当前为 P0 源码与接口适配决定，不是已实现清单。`COMPATIBLE` 表示原生扩展点已核实；`PARTIAL` 表示需要 Bundle 内适配或只能替代部分；`BLOCKED` 表示任务书要求的确切宿主接口不存在；`NOT_CONFIGURED` 表示未配置外部授权。业务运行均尚未验收。

## 宿主与平台

| 原始行为 / 要求 | 当前 DSH 机制及源码证据 | 适配决定 | 状态 | 计划验证 |
|---|---|---|---|---|
| 单一安装单元 | 原生 pluginManager.installBundle/setBundleEnabled/removeBundle；package.json dsh.bundle.patch | 一个 out-of-tree Bundle，不写 Profile 文件 | COMPATIBLE | P1 生命周期 |
| 根治理/当前源码 | 安装包 AGENTS.md 缺失；已取同版本 tag dsh-v0.2.1-rc.5，commit b830ec950faba0a46dda564be3e2d854afed94f1 | 读取参照根/包/Client治理；安装 exports/live Inspect 优先 | PARTIAL | P0 来源记录 |
| 10 独立主 Agent | agentPresets.register/resolve/mount；PresetConfig | 10 finance-前缀声明；已开始Session不改绑 | COMPATIBLE | P2 40声明、原生Session |
| 点号 Preset 示例 | 当前Preset规范为小写字母数字连字符 | 使用 finance-pitch-agent 等，不造隐藏API | PARTIAL | P2 ID 校验 |
| 30 callable_agents | dsh-tool-subagent agentPreset/allowedAgentPresets/maxDepth；spawn | 每主角色独立白名单；不用fork继承 | COMPATIBLE | P2 未授权委派拒绝 |
| Worker 隐藏 | 无已验证原生隐藏Worker roster字段 | 只在金融目录显示10主角色；原生可能显示Worker | PARTIAL | P2 roster检查 |
| 不自动启动任务 | Client uiWorkspace.startSession(workspaceId, options): void | 仅预填草稿；whenDraftExists规则；不得将返回值当Session ID | COMPATIBLE | P2 两业务草稿启动 |
| 专属Workspace | workspaceRegistry.create(path,title?) 只接受真实绝对目录并规范化；resolveByPath/get/status | Host保存path/id；不调用initializeDefault | COMPATIBLE | P1 绑定/缺目录/重启 |
| 原生Workspace归属 | SessionCreateRequest workspaceId/cwd/agentPreset；规范cwd归属索引 | 初始cwd始终根目录，成果子目录不替换cwd | COMPATIBLE | P2 header检查 |
| 本地Skill发现 | dsh-skill-filesystem direct child SKILL.md/customSkillDirs/includeDefaultRoots | 构造直接子项root；隔离registry与全部消费者 | COMPATIBLE | P2 63名称真实读取 |
| 同名Skill保真 | 111金融实例、63名称；逐文件目录hash相同 | 保留所有origin与角色映射；允许有证据统一资产 | COMPATIBLE | P0 重算、P2资源 |
| Claude slash commands | DSH commands登记或对应角色草稿入口 | 保留41金融命令及参数方法，不执行Claude CLI | PARTIAL | P2 命令发现/P4模板 |
| Claude Agent model | 原配置claude-opus-4-7；DSH使用当前可用模型路由 | 不保证原厂模型等效；不偷取或假装已有Anthropic授权 | PARTIAL | P2 模型/工具行为 |
| Managed Agents API | 上游/v1/agents、sessions.stream/steer、callable_agents是厂商预览 | 替换为DSH原生Session/Subagent；不复制云部署编排器 | PARTIAL | P2/P4 原生运行 |
| 输出schema强制 | 上游deploy脚本删除output_schema；validate.py是CLI后验 | Bundle需确定性校验Worker输出，不能信任源注释 | PARTIAL | P4 malformed输出拒绝 |
| 主Agent/Worker权限 | Managed YAML 与Cowork frontmatter不同，主只读；source含bash例外 | 采用更窄基线；受限Worker无Shell；写入仅成果路径；模型输出不授予权限 | PARTIAL | P2 executor拒绝 |
| 唯一金融入口 | live Slots sidebar.panellist/main，已查询树及服务 | 注册新id和同名key，不fork Web | COMPATIBLE | P1 live注册、P6视觉 |
| Client动态模块 | package dsh.client + ./client lazy factory；slots.inject生命周期 | 发行包内构建，变更不承诺无watcher自动刷新 | COMPATIBLE | P1 装配/卸载 |
| 插件配置/启用引导 | plugins.bundle.config / plugins.bundle.activation | 注册自身包名key；Host持久状态为准 | COMPATIBLE | P1首次引导 |
| 文件展示/预览 | present记录deliverables/presented；原生文件卡片按Session事件授权 | 跨会话索引保存坐标，跳转/复用原生展示；不造Office查看器 | COMPATIBLE | P4/P6文件打开 |
| 内部Review强制 | tools.guard可单调拒绝；Host阶段持久事实；userQuestions root-only | 独立Gate，主Agent/Host发问；工具不能自批 | PARTIAL | P5四策略/并发 |
| native approval | dsh-user-approval/permission-presets | 不受内部fast或custom改变；当前never不等于业务批准 | COMPATIBLE | P5工具审批独立 |
| Workflow重启 | dsh-workflow README明确无journaling/resume | 分阶段提交，待审不保持脚本自旋；重启新执行单元 | PARTIAL | P5重启/未知终止 |
| Host持久数据 | storageDomain或自身插件受控存储；不可发明Session事件 | Workspace绑定/阶段/审阅有独立Host所有者与版本；不靠localStorage | COMPATIBLE | P1/P5冷启动 |
| Microsoft365插件 | 上游manifest/Azure consent/Graph routing属于Office Add-in部署 | 仅金融文件方法可复用；不声称租户配置、Outlook、打开文档内交互等价 | UNAVAILABLE_EXTERNAL_DEPENDENCY | P0平台审计/P4文件 |

## 数据源与商业授权

| 来源 / 能力 | 原始配置与当前差异 | 适配决定 | 状态 | 计划验证 |
|---|---|---|---|---|
| 任务书 dsh-mcp-manager | 当前tag packages/mcp只有mcp-client/mcp-resources；live服务无Manager | 不修改DSH/不造通用Manager；任务书动态注册/restart/probe/watch要求无法按原接口实现 | BLOCKED | P3保留缺口 |
| 当前MCP可用机制 | dsh-mcp-client 每entry一连接、自动reconnect/工具同步；mcpResources按需发现/读取 | 显式自有连接配置；能力层只调用允许的只读数据工具 | PARTIAL | P3实际连接/拒绝路径 |
| 交互式OAuth | 未发现MCP Manager完整授权流；不能从URL配置推定授权 | 使用原生credentials引用/供应商人工授权；状态分层显示 | NOT_CONFIGURED | P3无凭据诊断 |
| Daloopa / Morningstar / S&P / FactSet | core .mcp.json配置提供端点，不包含业务数据授权 | 可配置Adapter；按字段/市场/PIT明确能力 | NOT_CONFIGURED | P3授权及来源 |
| Moody’s / MT Newswires / Aiera | 同为商业远程MCP依赖 | 不能新闻冒充正式共识或财务数据 | NOT_CONFIGURED | P3资格选择 |
| LSEG | core /lfa/mcp与partner /lfa/mcp/server-cl不同 | 两配置独立记录，不按同名覆盖；partner8 Skill保留 | NOT_CONFIGURED | P3端点/覆盖 |
| PitchBook / Chronograph / Egnyte / Box | core目录实际12连接器，README部分计数陈旧 | 保留实际配置及许可；不授予全部角色全部工具 | NOT_CONFIGURED | P3作用域/授权 |
| S&P partner3 Skill | 保留Kensho版权/Apache许可证；sp-global/spglobal别名 | 按真实URL与授权解析，不把源码Apache视为数据使用许可 | NOT_CONFIGURED | P0归属/P3能力 |
| KYC / NAV / GL / CRM | 用户文件或受许可正式来源才可使用 | 普通网页不能替代正式筛查/正式NAV；不自动评级/记账/通讯 | PARTIAL | P3/P4来源等级 |
| 本地两个Adapter | TEST_ONLY MCP风格与REST/文件风格、相同capability | 独立扩展验证注册/回退/撤销，不计真实金融E2E | PLANNED | P3扩展测试 |
| 公开网页fallback | 只用于合法公开能力，非供应商等价替换 | 标记等级/时点/许可/字段口径，不LLM猜测缺失值 | PLANNED | P3 PIT/单位/缺失 |

## 上游已缺失的模板与运行时依赖

- `comps-analysis` 声称提供 `examples/comps_example.xlsx`，本地四个同名目录均无此文件。保留方法，但示例保真路线为 PARTIAL。
- `lbo-model` 规定复制 `examples/LBO_Model.xlsx`，三个同名目录均未附。原标准模板路线 BLOCKED；使用用户自有模板需另行验收，不用自创布局冒充原模板。
- `strip-profile` 引用 `examples/Nike_Strip_Profile_Example.pptx`，未附。不能展示虚构示例成品。
- `/mnt/skills/public/...`、`recalc.py` 为 Claude 运行时约定，需映射 DSH Office 计算/验证工具；不把它们当作仓库中已存在的脚本。
- 根 README 的 `claude-for-financial-advisors` 在本地为悬空目录链接，不冒称迁移了未提供的 advisor 整包。
- 完整源句、行号与候选分类见 [资产审计](audit/upstream/ASSET_AUDIT.md)；尚未人工穷尽分类的候选继续显式保留，不算资源验证通过。

## 未验证项

尚无真实金融数据 E2E、原生安装生命周期结果、视觉/点击/移动布局证据。上述 COMPATIBLE 均为接口审计结论，不代表已移植完成。后续实现状态使用 IMPLEMENTED/PARTIAL/BLOCKED/NOT_CONFIGURED 独立报告；阶段记录不得把接口存在改写成业务通过。
