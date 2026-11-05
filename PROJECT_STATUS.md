# Financial Services 实施状态

当前阶段：P0–P2关键验收通过，P3为PARTIAL_HOST_INTERFACE_GAP，P4为PARTIAL_IMPLEMENTATION_NOT_ACCEPTED，P5为CRITERIA_ESTABLISHED_KERNEL_IMPLEMENTED（持久化与原生Gate待做）。0.4.0-alpha.1已原生applied；P5新增四模式Review Policy与确定性Gate内核，26项策略/Gate测试与364项全量回归通过。P5尚缺自有域持久化、跨会话队列、重启分类、原生无模型Gate探针与工具审批分离证明。默认绑定null/revision19，数据策略revision8且无测试Adapter/grant，所有临时包已移除。见[P3](acceptance/P3.md)、[P4](acceptance/P4.md)、[P5](acceptance/P5.md)记录。

P2历史验收基线 `@local/dsh-financial-services@0.2.2` 当时原生链接安装并enabled/applied，无新增重启要求。P2证据：115本地测试、587原生能力、12原生Client草稿链、141原生数值/权限补验、10禁用底线通过；真实只读Worker及started-root改绑锁通过。004收尾IO失败仍保留，46项独立恢复确认清理，不改失败为PASS。两源Bash角色使用固定数值剖面代替脚本，恰两角色获工具、modeler不写，builder只写自己JSON，不冒称Excel。当前默认绑定null/revision19、用户导航/草稿恢复、所有临时包已移除。缺模板、商业数据授权、Office业务成品、P5强制Gate及视觉/实际鼠标仍明确未完成；没有金融业务E2E成功宣称。详见[阶段记录](acceptance/P2.md)。

本仓库独立于其他投研应用。开发范围仅限本目录；上游 Downloads 源目录和 DSH 安装包只读。`audit/dsh-reference` 是为补足安装包未携带治理文件而获取的 DSH 同版本只读参照 checkout，不是需要改造的宿主或替代服务器。

## 已确认兼容性差异
- 安装版 DSH `0.2.1-rc.5`；参照发行 tag `dsh-v0.2.1-rc.5`，Git commit `b830ec950faba0a46dda564be3e2d854afed94f1`。版本相同不等于已证明所有构建字节相同，实际安装包 exports 与 live Inspect 优先。
- Preset ID 格式只允许小写字母/数字/连字符：使用 `finance-pitch-agent` 而非任务书示例 `finance.pitch-agent`；不改原生校验。
- `uiWorkspace.startSession` 实际返回 `void`，为草稿导航；它不是自动执行 API。保留 `whenDraftExists` 原生规则。
- 当前服务目录与包依赖未发现 `dsh-mcp-manager`。现有 `dsh-mcp-client` 是单服务器配置行，不得冒称完整动态管理或 OAuth。
- Workflow 不支持脚本/中间值持久续跑；金融阶段必须独立提交并在重启后启动新的执行单元。
- User Questions 只允许 live root Agent 直接发起 Web 人机交互；Worker 不可直接询问用户。
- 金融内部 Review Policy 独立于当前工具审批策略 never，不能据此扩大文件或外部数据权限。

## 证据入口
[阶段总账](acceptance/README.md)；[P0记录](acceptance/P0.md)；[P1记录](acceptance/P1.md)；[P2记录](acceptance/P2.md)；[中间验收报告](ACCEPTANCE_REPORT.md)。仅实际执行的测试进入通过数；P2–P6尚未验收。
