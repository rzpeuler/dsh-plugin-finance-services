# SECURITY_MATRIX

当前：P2运行时安全基线已实施并有原生执行证据；P3数据、P4业务交接、P5审核及P6完整产品安全仍未验收。不将Prompt声明当成权限保障。

详尽10主/30Worker逐工具清单及源行号见 [Worker 权限审计](audit/agents/WORKER_PERMISSIONS.md)。

| 约束 | 源码事实 / 风险 | 实施方案 | 验收 ID | 状态 |
|---|---|---|---|---|
| 主Agent只读 | 10 Managed YAML均read/grep/glob，部分Cowork frontmatter更宽 | 取更窄基线；禁止write/edit/shell/通用MCP | P2-MAIN-RO | PASS：587原生能力，141补验 |
| Worker非通用 | 30 personas，所属三Worker；10writer全无MCP | 独立Preset、spawn白名单及maxDepth1；执行层拒越权 | P2-DELEGATION | PASS：原生白名单/深度/无fork，真实Worker |
| 无Write不等于只读 | pitch-modeler有bash；model-builder-builder有bash+write | 不暴露通用shell；受控计算/Office工具 | P2-SHELL-ESCAPE | PASS：恰两固定数值剖面，无Shell/代码；Office待P4 |
| 高风险原始文档 | 8纯reader、reader MCP不开放；schema未在上游执行链强制 | 只读输入映射、结构验证、主不消费原文指令 | P4-INJECTION | PLANNED |
| schema不完全 | 10 output_schema，源部署删除；限长/ASCII等不足 | 独立Host交接校验，版本化差异及Unicode回归 | P4-OUTPUT-SCHEMA | PLANNED |
| writer路径 | 上游YAML无真正path ACL、技能要求Python但多writer无shell | 成果限定session/run/version，规范化/realpath、拒穿越/symlink/原件覆盖 | P2-PATH/P6-CONCURRENCY | P2 PASS：原生路径/CAS/并发反例；P6扩展待验 |
| 源凭据 | server-wide开关不证明只读或已授权 | 能力query allowlist、session/source授权、原生credential refs、脱敏日志 | P3-SOURCE-AUTH/P6-SECRETS | PLANNED |
| 数据等价 | 网站非screening、预测非consensus、Excel非正式NAV | 缺失显式返回；PIT/单位/期间/口径并行保留 | P3-PIT/P3-SEMANTICS | PLANNED |
| 阶段停审 | 6明确主Prompt停审+7专业交接；Skill另有20审核组/44条件节点实例 | Host固定policy快照+version/hash强制检查 | P5-GATE | PLANNED |
| 防自批 | 原生问题允许root问用户，Worker不可直接问 | 审批接口仅人端，不暴露批准工具；一次性并发settlement | P5-SELF/P5-STALE | PLANNED |
| 权限不混用 | 内部Review不是ask/never或shell沙箱 | fast/custom不能改变原生权限、source访问或永久限制 | P5-INDEPENDENCE | PLANNED |
| 重启与断线 | Workflow无持久脚本恢复 | 持久阶段事实，未知终止明确；新执行单元接续 | P5-RECOVERY | PLANNED |
| 外部副作用 | 原README及各角色专业签字边界 | 不提供发布/客户通信/正式记账/交易/资金/KYC签字操作 | P6-FORBIDDEN | PLANNED |
| 注入跨Agent | 原orchestrate文本regex从模型输出触发 | 不移植额外总控层，显式授权的原生Session草稿 | P2-CROSS-AGENT | PASS：原生双main草稿与Worker拒绝不导航 |
| 生命周期 | 用户原件/Workspace/历史不可删除 | bundle卸载只撤销effect及自有adapter，不清理用户数据 | P1-UNINSTALL/P6-REINSTALL | P1/P2 PASS：原生撤销/保留历史/恢复；P6完整矩阵待验 |

P2原生证据：[权限/路径/作用域587项](acceptance/P2-live-host-pass-003.json)、[计算与资源跨role141项](acceptance/P2-controlled-compute-pass-003.json)、[Client12项](acceptance/P2-live-client-pass-004.json)、[旧live Session禁用底线10项](acceptance/P2-live-host-disabled.json)。TOCTOU宿主威胁模型限制见[运行时](docs/ROLE_RUNTIME.md)。

任何新Adapter不会自动扩大现有角色权限；模拟数据必须TEST_ONLY，不计商业E2E。安全测试失败时保留证据与阻塞，不通过改宿主或放开工具来回避。
