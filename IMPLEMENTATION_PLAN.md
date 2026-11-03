# IMPLEMENTATION_PLAN — Financial Services Bundle

版本：设计基线 v0.1；P0 已于2026-11-03通过清点与设计验收。任务书唯一执行顺序为 P0→P1→P2→P3→P4→P5→P6，阶段测试先于实现。

## 架构与安全决定

一个用户安装包 `@local/dsh-financial-services`，仓库外开发；不修改 DSH Core 或其他业务项目。Host 插件拥有金融 Workspace 绑定、数据注册表、阶段索引和业务审核事实；Client 只投影 Host/原生 Session 事实。独立扩展示例作为第三方 Adapter 插件，不加入主 Bundle 的 Agent 源码。安装必须通过原生 Plugin Manager。

10 主角色使用 `finance-<agent>` Preset，30 Worker 使用 `finance-<agent>-<worker>` Preset。原生列表没有已验证隐藏接口，内部 Worker 可能在原生列表可见，金融目录只显示主角色。每个主角色只允许所属三个 Worker；spawn、maxDepth=1，不使用 fork 继承高权限。所有主 Agent 以 Managed cookbook 的 read/grep/glob 低权限基线，不从 Cowork frontmatter 增加 Write/Edit/MCP 通配权限。仅源配置指定 Writer 可写任务成果；bash 权限不直接迁移，改为具备路径与业务操作白名单的 Office/计算操作。

Skill 采用源码目录 hash 比较后构造直接子目录技能根：49 核心、3 Agent-only、11 partner，共63名称。角色原始关联保留；源资产统一不等于全角色都有同样工具或数据权限。独立 Skill registry/provider 消费者必须处在同一隔离组，禁止全局默认根污染受限 Worker。技能说明保留原方法，平台特定命令明确改写，原件及变更索引可追踪。

所有可产生副作用的金融阶段只能经过 Host 确定性检查。Review `original/fast/strict/custom` 是内部业务审核，与 Shell/工具审批相互独立。原始文件和用户目录不覆盖；成果采用 session/run/version/hash 索引，版本变化使旧审阅失效。主模型不能自批，未知终止状态不算完成。重启恢复启动新的执行单元，不伪造同一 Workflow 续跑。

商业数据只使用有授权且经过验证的来源。数据状态分 installed/configured/connected/authorized/data-query-verified。未配置保留 Agent 可见性并走用户文件路径；普通网页不替代 KYC、共识或正式NAV。TEST_ONLY Adapter 不计金融 E2E。

## 分阶段实施与预设验收

| 阶段 | 实施内容 | 关键测试 / 完成条件 | 记录 |
|---|---|---|---|
| P0 | 源码/许可/治理/真实API清点；资产hash、迁移决定、边界 | 363文件全hash复算；10/30/63来源覆盖；逐Agent映射；许可审计；所有当前接口核验 | acceptance/P0.md |
| P1 | package/patch/Host/Client；原创图标、中英元信息；单一入口；真实Workspace绑定及引导 | 原生Plugin Manager安装、禁用、启用、卸载、重装；绑定规范path/id持久化；不存在目录拒绝；卸载保留目录与历史 | 实施前建立 acceptance/P1.md |
| P2 | 40独立Preset，63 Skill含资源及命令模板；细粒度工具和spawn约束 | 每个persona与来源SHA；技能实际加载；只读拒写；writer越界拒绝；非白名单委派拒绝；至少2业务Agent原生Session仅草稿启动 | acceptance/P2.md |
| P3 | capability契约/注册/撤销、来源选择、PIT/单位/期间；MCP现有机制适配；第三方插件 | 两种TEST_ONLY Adapter在同一capability上注册/切换/fallback/撤销/卸载；权限与错误；真实UI投影；缺失Manager接口独立标BLOCKED | acceptance/P3.md |
| P4 | 10业务任务模板、受控worker调用、输入/阶段产物、真实Office文件 | 逐Agent步骤与源映射；来源引用；真实Excel公式/平衡校验；可打开PPT/文档；不宣称未执行业务成功 | acceptance/P4.md |
| P5 | 四种Review、启动快照、Host Gate、版本化审阅与恢复 | 中间暂停/fast未人工批准；locked边界；重复/过期/并发审批拒绝；重启后待审一致、新单元接续 | acceptance/P5.md |
| P6 | 全工作台页面、右栏、原生预览/Session/MCP导航、搜索、窄屏/i18n | 生命周期/升级/重启/重装、安全注入/穿越/泄漏/覆盖/断线；真实授权源与离线路径分开；验收和用户说明 | acceptance/P6.md |

## 实施限制及处置

1. 当前 DSH 未提供任务书指定 `dsh-mcp-manager`。不为此修改宿主或建立第二个通用MCP系统。使用当前 `dsh-mcp-client` 可提供的显式连接及scope工具，缺失的动态管理/探测/OAuth验收保留不通过，并继续不依赖该接口的独立工作。
2. 当前没有浏览器控制工具；Inspect 可核验live服务、slot及props，但不能冒称点击/布局验证通过。优先采用现有页面可提供的只读Inspect证据；如后续发现官方浏览器扩展点再按真实能力验证，不启动替代GUI。
3. 安装包不含根AGENTS，使用同版本tag参照治理，实际部署API仍以安装包和live Inspect为准。
4. 上游 Managed Agents/微软365是不同平台，部署脚本只归档审计，绝不调用其云写入/管理员同意操作。
5. 本地源码来自无.git目录，原始commit未知，只报告全树SHA256及逐文件hash，不将GitHub当前HEAD冒充本地SHA。

## 构建与测试策略

先做可安装最小Host/Client，不先堆静态卡片。使用托管Node/pnpm绝对路径，依赖锁定，禁止自动执行待批准安装脚本。单元测试使用确定性TEST_ONLY夹具；原生Loader集成与真实业务E2E分开报告。每次失败保留输出及复测。没有通过关键验收的阶段不标完成；已实现场景、部分替代、未授权外部依赖分开统计。
