# Financial Services 实施状态

当前阶段：P0、P1关键验收已通过，P2实施中，Client真实草稿链待验；两源Bash例外只保守禁Shell，受控计算替代仍未实现。用户再次完整重启后，原生能力587/587通过：40不同persona全文、63技能、角色权限/路径/CAS与独立Session均已验证。真实Worker以deepseek-account/deepseek-flash只读玩具数据并返回模型结果，已开始root改绑锁也通过；该次总汇写入发生UNKNOWN文件错误，保留失败，另以46/46原生恢复检查确认自有资源清理，未把失败安装改PASS。禁用retained-floor实际10/10通过，主Bundle已恢复启用。候选为链接安装 `@local/dsh-financial-services@0.2.1`；默认绑定保持null、revision17。Client Host初始化与Remote注册、Host graph及全部依赖通过，但当前页未报告Client apply，尚无真实草稿预填证据。没有真实金融业务E2E、商业查询或Office成品。

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
