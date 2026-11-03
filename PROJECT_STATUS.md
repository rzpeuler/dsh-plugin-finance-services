# Financial Services 实施状态

当前阶段：P0、P1关键验收已通过，进入P2。`@local/dsh-financial-services@0.1.2`骨架已在desktop Profile原生安装并启用；38单元测试及20真实Host检查通过，安装/禁用/启用/卸载/重装均applied。当前只实现Workspace绑定与入口，尚无金融业务E2E；视觉/页面点击和Desktop进程重启未验证。

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
[阶段总账](acceptance/README.md)；[P0记录](acceptance/P0.md)；[P1记录](acceptance/P1.md)；[中间验收报告](ACCEPTANCE_REPORT.md)。仅实际执行的测试进入通过数；P2–P6尚未验收。
