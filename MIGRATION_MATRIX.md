# MIGRATION_MATRIX

状态：P0 设计/源码映射完成后用于逐项实施跟踪；当前运行时迁移尚未验收。

## 逐 Agent 完整映射

10 主 Prompt → 30 精确 Worker → Skills → MCP/数据能力 → 输入 → 输出 → 审核节点 → 计划测试的源文件、行号、SHA与全文，统一保存在 [完整 Agent 映射](audit/agents/AGENT_MAPPING.md) 和 [机器映射](audit/agents/agent-mapping.json)。不在此复制容易漂移的全文。40 个提示词并非40个同权通用角色。主Prompt13节点（6明确停审+7专业交接）与Skill内20组/44条件节点实例分开保留，仅实际使用相应方法时实例化，不能机械给所有角色统一加Gate。

| 主角色 | DSH 主 Preset ID | 状态 | 核心产物 | 业务验收 |
|---|---|---|---|---|
| pitch-agent | finance-pitch-agent | PLANNED | 估值Excel/football field/模板pitch deck | 模型与deck两次明确停审，引用named range |
| market-researcher | finance-market-researcher | PLANNED | 行业/竞争格局/comps/ideas/note及可选slides | comps与note停审；有条件outline审批 |
| earnings-reviewer | finance-earnings-reviewer | PLANNED | 模型更新/盈利研究稿 | 真实filing/transcript/consensus时点，最终专业审核 |
| meeting-prep-agent | finance-meeting-prep-agent | PLANNED | 客户briefing pack/持仓与关系摘要 | CRM/NAV合法来源，无客户发送 |
| model-builder | finance-model-builder | PLANNED | DCF/LBO/三表/comps模型与audit | build/audit/sensitivity原顺序与停审区别 |
| gl-reconciler | finance-gl-reconciler | PLANNED | 经critic验证的breaks/调整建议 | 主不写；resolver不可正式记账 |
| kyc-screener | finance-kyc-screener | PLANNED | 文档缺口/rules/hits/escalation | 正式筛查来源，主不写、不最终评级签字 |
| valuation-reviewer | finance-valuation-reviewer | PLANNED | GP package/valuation/LP报告草稿 | 专业授权及正式NAV边界 |
| month-end-closer | finance-month-end-closer | PLANNED | accrual/rollforward/variance/close pack | Controller审核；poster仅建议不正式记账 |
| statement-auditor | finance-statement-auditor | PLANNED | LP statement tieout/flags | IR/finance签字及不分发 |

## 全部非 Agent 资产

- [逐文件迁移清单](SOURCE_INVENTORY.md) 覆盖363源文件；[机器决定](audit/migration-decisions.json) 含每个资产目标、依赖、计划测试与不可直接移植原因。
- [Skill 变体审计](audit/upstream/SKILL_VARIANTS.md) 覆盖63金融名称/111实例及全部来源目录hash，保留角色归属，不以名称覆盖不同内容。
- 41金融业务命令需要原生command或对应Preset草稿入口；29 steering样例只是任务模板来源，不是成功运行记录。
- 商业连接器、Managed Agent云接口、M365管理员工具、缺失标准模板的逐项适配边界以 [兼容矩阵](COMPATIBILITY_MATRIX.md) 为准。

每项只在P2/P3/P4相应测试实际通过后更新 IMPLEMENTED。源码清点、计划测试和模拟工具均不计迁移运行通过。
