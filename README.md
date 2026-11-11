# Financial Services for DSH

独立、仓库外 Financial Services Bundle。当前版本 **0.4.0-alpha.2 / DSH 0.2.2-rc.1 适配候选，P3与P4均为PARTIAL**，不是完整金融移植产品。P0–P2关键验收通过；P3有217本地、33原生工具/生命周期、15真实Client、7原生MCP transport及独立模板检查，但Manager与安全MCP金融委派/凭据接口仍缺失。当前活动运行范围已收窄为3个主Agent、9个内部Worker、仅来自Financial Analysis与Equity Research垂直插件目录的22项Skill、16条命令和9条引导样例；历史全量审计资产仍保留作溯源，不进入活动目录。历史P4映射仍记载10条原业务线，但活动任务SDK只公开上述3个主Agent的模板；GL/LP本地数值检查库仍是独立技术模块，不构成Agent或商业金融E2E。尚无业务Worker运行或Office交付，原生Windows沙箱下固定`--version`即无法启动子进程，故Office链明确未通过。TEST_ONLY不是商业金融E2E。

> 阶段完成情况与证据索引见 [阶段完成报告](acceptance/COMPLETION_REPORT.md)；逐条追溯见 [TRACEABILITY.md](acceptance/TRACEABILITY.md)。FUX-01 + FRUN-01 的本地候选实现与未验收边界见 [本地验收记录](acceptance/FUX01-FRUN01.md)。

## 当前范围

- 原生 Plugin Manager 单一安装单元，无 DSH Core 修改。
- 一个 Financial Services 导航入口；`finance-data` 与 `finance-review` 的配置在 Plugin Manager 对应行的 Configure 页面。页面由 Host Config Editor 读取/保存 Loader Config（不直接写 Profile 文件、不另建设置存储）；Bundle 本身无独立 Config，启用引导位于原生激活槽。
- Host 负责真实 Workspace 目录验证、规范路径/ID绑定、版本化持久状态；Client 只显示真实 Host 状态。
- 默认仅绑定真实已存在的本地目录。使用原生目录选择器，或输入绝对目录；不会调用全局 initializeDefault，也不会自动执行金融任务。
- 禁用/卸载不删除用户目录、原始附件或 DSH Session 历史。重新安装从Host持久域读取既有绑定；目录已移动则需重新绑定。
- Workspace切换仅改变未来任务默认目录，不移动历史 Session 或成果。
- 活动目录仅列出3个主Agent（earnings-reviewer、market-researcher、model-builder）、9个内部Worker、22项两类垂直Skills、16条相关命令及9条样例；完整历史清单仅用于审计，不注册其他主Agent。
- FUX-01/FRUN-01候选实现提供 Agents、Skills、Runs、Deliverables、Review Queue、Data Sources、Settings 七页；Agent目录只分为 Financial Analysis 与 Equity Research 两组，标准任务和自由对话只准备原生未提交草稿。
- FinanceRun 仅在用户消息接受并成功持久化后建立，与 Session ID/事件引用关联；不保存提示词或工具内容，按真实 Session/Worker 事件显示进度和诊断。右栏可由会话内 Guide 手动打开；当前公开接口不能证明提交动作已完成以自动打开。
- 每个活动角色独立的原生Preset与Skill registry/provider/loader作用域；Writer无MCP，主/Reader无写入。唯一保留的Bash角色是Model Builder的内部Builder Worker，只有固定数值剖面，无通用Shell，不冒称Office工作簿。
- 当前唯一活动金融数据契约为 unversioned FinanceData：A 股只读查询、显式时点/单位/修订证据和 Host fail-closed 来源策略。查询限定 `market=CN` 与六位 `.SH/.SZ/.BJ` ticker；格式不证明普通股资格，Adapter 必须执行显式普通股 allowlist（默认空）。当前策略使用独立 `financial_data_current` 域，初始无 bindings；无已注册 Provider、角色来源 allowlist 为空，未核实的来源许可、模型处理或会话日志许可一律拒绝。旧 `financial_data` grants 留存但保持惰性，不迁移、不读取、不授权。历史版本标识仅作审计记录。详见[数据契约](docs/DATA_CONTRACT.md)。
- 文件操作通过宿主FS/provider与沙箱策略；写入只限该Session分配的成果目录，创建不覆盖、编辑需SHA与原生版本CAS。已有链接/junction拒绝；不宣称提供超越宿主的恶意本地OS进程TOCTOU隔离。
- 独立权限底线随原生retained revision保留；角色/root被撤销或源/Prompt版本不符时，拒绝包括原生Agent-own委派工具在内的操作。
- 当前活动主Agent、Skill目录来源、运行清单与历史归档的边界见[Active Runtime Scope](docs/RUNTIME_SCOPE.md)。

## 安装

要求 DSH `0.2.2-rc.1` 与 Node `>=24.9`。当前候选 `0.4.0-alpha.2` 的原生验收使用 DSH Plugin Manager 链接此源码目录；本地tarball可分发payload，但复制安装的fresh进程矩阵尚未执行，不能当作已验证的安装路线。开发构建使用Python 3（非PATH环境可设置 `FINANCE_BUILD_PYTHON` 为其可执行文件）与锁文件及以下脚本；构建的完整源ZIP补保pnpm默认忽略的两个.gitignore元数据：

```text
pnpm install --ignore-scripts
pnpm run build
pnpm test
pnpm run check:package
pnpm pack
```

不在用户 Profile 目录手写配置或运行包管理器。安装返回 application=applied 才表示已应用；restart-required 必须按提示重启。源码修改不保证现有页面自动刷新，必须先重建Client artifact，并按宿主返回的生命周期操作。上下文预算与未测口径见[模型体验](docs/MODEL_EXPERIENCE.md)。

## 升级与回滚

升级 = 用同一路径重新 `install_bundle`（或先在 Manager 中卸载再安装）。审核策略在服务启动时固定，因此变更后需新的 review-service 生命周期生效。已记录的决定按原 snapshotDigest 保留为审计历史，但**不会**自动授权新策略快照；新策略仍要求的检查点必须按新快照重新审核，策略不再要求的旧检查点不进入当前队列。为兼容既有引用，角色模块 `role-numeric-1` 仍随包保留；FinanceData 当前唯一 canonical package/runtime entry 是 `@local/dsh-financial-services/data`（模块名 `data`），不存在第二个带版本后缀的 runtime 入口。旧 FinanceData API 标识仅为历史记录。引用这些模块的 Preset 继续可用；回滚到旧版本仍是同样的链接安装流程。升级不会删除用户文件、DSH 历史或审核记录。

## 卸载

在原生 Plugin Manager 中移除本 Bundle。卸载会撤下 Host 行与 Client 面板，但**不会**删除用户目录、成果文件、DSH Session 历史，也不会删除 `financial_review` / `financial_artifacts` 自有域中的审核与成果索引；重新安装后可继续读取。若目录本身已移动，需要重新绑定 Workspace。

## 凭据与数据源依赖

本版不保存任何商业数据凭据：Source Policy 只记录 adapter/来源/作用域/能力，真实凭据由宿主 credential 服务负责（当前未接入）。商业 Provider 默认为 `NOT_CONFIGURED` 且不自动授权；三个隔离的 CNEquity Reader factory 仍为 `TEST_ONLY`/`current_only`、未注册，默认普通股 allowlist 为空、许可标志关闭，不代表商业数据或授权。MCP 侧只验证了发行版原生 client 的连接与卸载，Manager 与安全委派接口缺失，见[MCP兼容边界](docs/MCP_COMPATIBILITY.md)。

## Agent 能力目录

活动运行清单仅包含 `earnings-reviewer`、`market-researcher`、`model-builder` 三个主 Agent、各自的三个内部 Worker，以及来自 Financial Analysis / Equity Research 目录的22项 Skill；构建与校验依据见[活动范围说明](docs/RUNTIME_SCOPE.md)。目录入口只创建未提交草稿。

## 排障

- 界面显示"审核服务不可用"：检查 `finance-review` 行是否启用；审核只读模型需要该行处于 active。
- 数据源卡片显示 `NOT_CONFIGURED`：说明没有注册 Adapter 或没有配置来源策略，不代表连接失败。当前 `financial_data_current` policy 初始为空且 fail-closed；旧 `financial_data` grants 不迁移、不读取，保持惰性。
- 写入被拒绝：写入只允许在该 Session 的成果目录内，且编辑需携带当前 SHA；符号链接/junction 一律拒绝。
- 升级后策略没变：策略在服务启动时固定，需要重新加载该行才会应用新配置。

## 首次使用

进入 Financial Services。若尚未绑定，选择或输入一个真实已存在的本地工作目录，确认保存。页面显示原生Workspace ID、规范路径及状态。不存在/无权限/路径移动明确报错；不会把配置存在视为可用。取消目录选择不写配置。目录中的按钮只打开原生未提交草稿并保留已有草稿，不自动调用模型；多目标命令须明确选择主角色。商业Adapter、Office执行与确定性Review Gate仍待后续阶段。

## 权限和业务限制

绑定工作目录不改变 Shell、工具审批、文件沙箱或商业数据授权。金融内部Review与 ask/never 独立。后续金融功能永久禁止自动发布、客户通信、正式总账记账、交易/资金操作及代替专业合规签字。

商业MCP均未配置/未验证；本版DSH没有任务书指定的动态MCP Manager，不能声称支持其restart/probe/watch/OAuth管理接口。源仓库缺失的LBO/comps/Nike二进制模板不会被虚构补齐。阶段记录明确区分静态测试、真实Host集成、UI操作和金融数据E2E。

## 来源和审计

完整源码仓库的 SOURCE_INVENTORY、COMPATIBILITY_MATRIX、MIGRATION_MATRIX、SECURITY_MATRIX、TEST_REPORT 及 acceptance 目录保留每阶段标准和实际结果。根 LICENSE / NOTICE 与所有迁移资产的原始许可同时分发；完整来源文件保存在只读源归档，适配文件带修改标记。商业数据不因开源代码许可而自动获得使用权。

## English summary

An independent out-of-tree DSH bundle. Version 0.4.0-alpha.2 targets DSH 0.2.2-rc.1 and covers P0–P2 accepted work plus partial P3–P6; P3, P4, P5 and P6 are explicitly **not** accepted as complete. The active runtime registers three main presets (earnings-reviewer, market-researcher, model-builder), nine owned Workers, 22 Skills sourced only from the Financial Analysis and Equity Research vertical-plugin directories, plus their scoped commands and steering examples. Broader historical source manifests remain packaged for provenance but are not active catalogues or presets. One unversioned FinanceData contract is active and the model query is A-share-only; the isolated `financial_data_current` policy and role source allowlists are empty, so queries fail closed. Former V1/V2 API identifiers and TEST_ONLY Adapter checks are historical evidence only, not active Providers; any persisted grants in the former `financial_data` domain remain inert. Required native Manager/credential and safe MCP delegation contracts remain unavailable. Source permissions are enforced by narrow provider-backed tools and a retained-revision permission floor; no general Shell is exposed. A deterministic review gate, durable review store, read model and read-only workbench are implemented and verified without model calls; commercial adapters and native Office delivery remain blocked. Native registration, static tests and business E2E are reported separately. Installation is user-requested only; disable/uninstall preserves user files and native history. Review policy never grants tool, sandbox or commercial data permissions.
