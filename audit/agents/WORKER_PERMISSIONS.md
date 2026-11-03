# Worker 权限审计与安全边界

**仅源码事实与迁移约束；未实施DSH运行时权限。** Managed YAML为工具白名单基线，插件Prompt frontmatter不是提权来源。主Prompt/Worker全文与所有SHA见 [agent-mapping.json](<C:/Users/Administrator/Documents/deepseek-harness/default-workspace/financial-services-bundle/audit/agents/agent-mapping.json>)；完整业务链见 [AGENT_MAPPING.md](<C:/Users/Administrator/Documents/deepseek-harness/default-workspace/financial-services-bundle/audit/agents/AGENT_MAPPING.md>)。

## 1. 主Agent：全体只读调度

| Main | Built-in allowlist | MCP server allowlist（均server-wide，非per-tool） | Worker白名单 | 证据 |
|---|---|---|---|---|
| pitch-agent | `read, grep, glob` | `capiq, daloopa` | `pitch-researcher`, `pitch-modeler`, `pitch-deck-writer` | [agent.yaml:10–18](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/agent.yaml#L10-L18>)；[agent.yaml:27](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/agent.yaml#L27>) |
| market-researcher | `read, grep, glob` | `capiq, factset` | `market-sector-reader`, `market-comps-spreader`, `market-note-writer` | [agent.yaml:10–18](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/agent.yaml#L10-L18>)；[agent.yaml:27](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/agent.yaml#L27>) |
| earnings-reviewer | `read, grep, glob` | `factset, daloopa` | `earnings-transcript-reader`, `earnings-model-updater`, `earnings-note-writer` | [agent.yaml:10–18](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/agent.yaml#L10-L18>)；[agent.yaml:27](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/agent.yaml#L27>) |
| meeting-prep-agent | `read, grep, glob` | `crm, capiq` | `briefing-profiler`, `briefing-news-reader`, `briefing-pack-writer` | [agent.yaml:10–18](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/agent.yaml#L10-L18>)；[agent.yaml:27](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/agent.yaml#L27>) |
| model-builder | `read, grep, glob` | `capiq, daloopa` | `model-data-puller`, `model-builder-builder`, `model-auditor` | [agent.yaml:10–18](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/agent.yaml#L10-L18>)；[agent.yaml:27](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/agent.yaml#L27>) |
| gl-reconciler | `read, grep, glob` | `internal-gl, subledger` | `gl-reconciler-reader`, `gl-reconciler-critic`, `gl-reconciler-resolver` | [agent.yaml:16–34](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/agent.yaml#L16-L34>)；[agent.yaml:47](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/agent.yaml#L47>) |
| kyc-screener | `read, grep, glob` | `screening` | `kyc-doc-reader`, `kyc-rules-engine`, `kyc-escalator` | [agent.yaml:10–17](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/agent.yaml#L10-L17>)；[agent.yaml:25](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/agent.yaml#L25>) |
| valuation-reviewer | `read, grep, glob` | `portfolio` | `valuation-package-reader`, `valuation-runner`, `valuation-publisher` | [agent.yaml:10–17](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/agent.yaml#L10-L17>)；[agent.yaml:25](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/agent.yaml#L25>) |
| month-end-closer | `read, grep, glob` | `internal-gl` | `close-ledger-reader`, `close-rollforward`, `close-poster` | [agent.yaml:10–17](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/agent.yaml#L10-L17>)；[agent.yaml:25](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/agent.yaml#L25>) |
| statement-auditor | `read, grep, glob` | `nav` | `stmt-statement-reader`, `stmt-reconciler`, `stmt-flagger` | [agent.yaml:10–17](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/agent.yaml#L10-L17>)；[agent.yaml:25](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/agent.yaml#L25>) |

**GL/KYC特别约束**：主Agent不可持Write/Edit/Bash、不可被通用Office写入工具绕过；只接验证结构数据。GL resolver仅verified critic-checked breaks；KYC escalator仅rules/hits。Read的存在不是可读所有源文件的授权，原始附件只向对应reader映射。

## 2. 三十个Worker精确权限（没有三十个同权通用Subagent）

所有默认built-in disabled；表中才是enabled名单。全部callable_agents=[]。所有MCP server默认enabled:true，原仓库未列实际远端tools，不伪造MCP具体方法名。

| Main / Worker | Built-in allowlist | MCP servers | Final writer | Bash | Skill names | 输出schema | 证据 |
|---|---|---|---|---|---|---|---|
| pitch-agent / pitch-researcher | `read, grep` | capiq, daloopa | 否 | 无 | [] | [researcher.yaml:21–47](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/subagents/researcher.yaml#L21-L47>) | [researcher.yaml:8–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/subagents/researcher.yaml#L8-L15>) |
| pitch-agent / pitch-modeler | `read, bash` | capiq, daloopa | 否 | 有 | dcf-model, lbo-model | 无 | [modeler.yaml:9–16](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/subagents/modeler.yaml#L9-L16>) |
| pitch-agent / pitch-deck-writer | `read, write, edit` | 无 | 是 | 无 | xlsx-author, pptx-author, pitch-deck | 无 | [deck-writer.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/pitch-agent/subagents/deck-writer.yaml#L8-L14>) |
| market-researcher / market-sector-reader | `read, grep` | 无 | 否 | 无 | [] | [sector-reader.yaml:17–32](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/subagents/sector-reader.yaml#L17-L32>) | [sector-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/subagents/sector-reader.yaml#L8-L13>) |
| market-researcher / market-comps-spreader | `read, grep` | capiq, factset | 否 | 无 | comps-analysis | 无 | [comps-spreader.yaml:7–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/subagents/comps-spreader.yaml#L7-L14>) |
| market-researcher / market-note-writer | `read, write, edit` | 无 | 是 | 无 | pptx-author | 无 | [note-writer.yaml:9–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/market-researcher/subagents/note-writer.yaml#L9-L15>) |
| earnings-reviewer / earnings-transcript-reader | `read, grep` | 无 | 否 | 无 | [] | [transcript-reader.yaml:17–30](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/subagents/transcript-reader.yaml#L17-L30>) | [transcript-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/subagents/transcript-reader.yaml#L8-L13>) |
| earnings-reviewer / earnings-model-updater | `read, grep` | factset, daloopa | 否 | 无 | model-update | 无 | [model-updater.yaml:8–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/subagents/model-updater.yaml#L8-L15>) |
| earnings-reviewer / earnings-note-writer | `read, write, edit` | 无 | 是 | 无 | morning-note, xlsx-author | 无 | [note-writer.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/earnings-reviewer/subagents/note-writer.yaml#L8-L14>) |
| meeting-prep-agent / briefing-profiler | `read, grep` | crm, capiq | 否 | 无 | [] | 无 | [profiler.yaml:8–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/subagents/profiler.yaml#L8-L15>) |
| meeting-prep-agent / briefing-news-reader | `read, grep` | 无 | 否 | 无 | [] | [news-reader.yaml:17–30](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/subagents/news-reader.yaml#L17-L30>) | [news-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/subagents/news-reader.yaml#L8-L13>) |
| meeting-prep-agent / briefing-pack-writer | `read, write, edit` | 无 | 是 | 无 | client-review, pptx-author | 无 | [pack-writer.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/meeting-prep-agent/subagents/pack-writer.yaml#L8-L14>) |
| model-builder / model-data-puller | `read, grep` | capiq, daloopa | 否 | 无 | [] | [data-puller.yaml:20–31](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/subagents/data-puller.yaml#L20-L31>) | [data-puller.yaml:7–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/subagents/data-puller.yaml#L7-L14>) |
| model-builder / model-builder-builder | `read, write, edit, bash` | 无 | 是 | 有 | dcf-model, lbo-model, 3-statement-model, comps-analysis, xlsx-author | 无 | [builder.yaml:8–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/subagents/builder.yaml#L8-L15>) |
| model-builder / model-auditor | `read, grep` | 无 | 否 | 无 | audit-xls | 无 | [auditor.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/model-builder/subagents/auditor.yaml#L8-L13>) |
| gl-reconciler / gl-reconciler-reader | `read, grep` | 无 | 否 | 无 | [] | [reader.yaml:35–58](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/subagents/reader.yaml#L35-L58>) | [reader.yaml:17–25](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/subagents/reader.yaml#L17-L25>) |
| gl-reconciler / gl-reconciler-critic | `read, grep` | internal-gl, subledger | 否 | 无 | [] | 无 | [critic.yaml:8–15](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/subagents/critic.yaml#L8-L15>) |
| gl-reconciler / gl-reconciler-resolver | `read, write, edit` | 无 | 是 | 无 | xlsx-author | 无 | [resolver.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/gl-reconciler/subagents/resolver.yaml#L8-L14>) |
| kyc-screener / kyc-doc-reader | `read, grep` | 无 | 否 | 无 | [] | [doc-reader.yaml:17–37](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/subagents/doc-reader.yaml#L17-L37>) | [doc-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/subagents/doc-reader.yaml#L8-L13>) |
| kyc-screener / kyc-rules-engine | `read, grep` | screening | 否 | 无 | [] | 无 | [rules-engine.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/subagents/rules-engine.yaml#L8-L14>) |
| kyc-screener / kyc-escalator | `read, write, edit` | 无 | 是 | 无 | xlsx-author | 无 | [escalator.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/kyc-screener/subagents/escalator.yaml#L8-L14>) |
| valuation-reviewer / valuation-package-reader | `read, grep` | 无 | 否 | 无 | [] | [package-reader.yaml:17–33](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/subagents/package-reader.yaml#L17-L33>) | [package-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/subagents/package-reader.yaml#L8-L13>) |
| valuation-reviewer / valuation-runner | `read, grep` | portfolio | 否 | 无 | returns-analysis | 无 | [valuation-runner.yaml:7–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/subagents/valuation-runner.yaml#L7-L13>) |
| valuation-reviewer / valuation-publisher | `read, write, edit` | 无 | 是 | 无 | xlsx-author | 无 | [publisher.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/valuation-reviewer/subagents/publisher.yaml#L8-L14>) |
| month-end-closer / close-ledger-reader | `read, grep` | 无 | 否 | 无 | [] | [ledger-reader.yaml:17–33](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/subagents/ledger-reader.yaml#L17-L33>) | [ledger-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/subagents/ledger-reader.yaml#L8-L13>) |
| month-end-closer / close-rollforward | `read, grep` | internal-gl | 否 | 无 | [] | 无 | [rollforward.yaml:7–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/subagents/rollforward.yaml#L7-L13>) |
| month-end-closer / close-poster | `read, write, edit` | 无 | 是 | 无 | xlsx-author | 无 | [poster.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/month-end-closer/subagents/poster.yaml#L8-L14>) |
| statement-auditor / stmt-statement-reader | `read, grep` | 无 | 否 | 无 | [] | [statement-reader.yaml:17–33](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/subagents/statement-reader.yaml#L17-L33>) | [statement-reader.yaml:8–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/subagents/statement-reader.yaml#L8-L13>) |
| statement-auditor / stmt-reconciler | `read, grep` | nav | 否 | 无 | [] | 无 | [reconciler.yaml:7–13](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/subagents/reconciler.yaml#L7-L13>) |
| statement-auditor / stmt-flagger | `read, write, edit` | 无 | 是 | 无 | xlsx-author | 无 | [flagger.yaml:8–14](<C:/Users/Administrator/Downloads/financial-services-main/managed-agent-cookbooks/statement-auditor/subagents/flagger.yaml#L8-L14>) |

## 3. 信任隔离与文件写入范围

| 角色 | 允许数据 | 禁止 | 迁移必须增加的确定性约束 |
|---|---|---|---|
| 不可信文件reader（8个） | 仅授权任务原件、Read/Grep | MCP、Write/Edit、Shell、继续委派 | 挂载只读原件；返回schema数据；主Agent消费前Host验证 |
| 可信查询Worker | 仅本角色授权金融查询/验证数据 | 写入、原始outsider文档、未知MCP、继续委派 | 明确query工具allowlist、Session/source scope；不因有MCP就信任返回的指令 |
| pitch-modeler（例外） | 验证输入与受控scratch计算 | 最终文件写入、广泛Shell/网络或跨目录 | 用窄计算工具替代bash；只能隔离scratch，不能借MCP越权 |
| 10 leaf writers | 验证结构数据、批准模板及本任务成果root | 原件、MCP、外部发送/记账/交易、跨任务写 | 仅writer暴露窄Office/文件生成器；校验规范路径/版本/审批；默认无通用Shell |
| 主Agent | 验证Worker结果、授权金融查询、仅所属三Worker | Write/Edit/Bash、原始outsider内容直达高权限工具、跨main直接调用 | 精确角色Preset、所属worker白名单、深度1与任务root授权 |

不可信reader数量8：market sector、earnings transcript、meeting news、GL reader、KYC doc、valuation package、month ledger、statement reader。另pitch researcher与model data-puller也有schema但访问金融MCP，不能混算为不可信隔离reader。

**上游配置不是完整sandbox**：YAML仅开关工具；未提供每工具路径ACL、symlink检查或raw-file屏蔽。never open原件是Prompt边界，必须在迁移工具层落实。九个无Bash writer却绑定要求Bash/Python的author skill，是执行缺口，不是添加Shell的理由。

## 4. MCP与技能：最小授权，不继承

- server名：`capiq, crm, daloopa, factset, internal-gl, nav, portfolio, screening, subledger`。全部URL是环境占位符；本次未连接、未检验商业授权、未检验远端tool schema。
- 未配置服务必须NOT_CONFIGURED/UNAVAILABLE_EXTERNAL_DEPENDENCY。普通新闻不等于正式screening；预测不等于consensus；任意Excel不等于正式NAV。
- Skill只提供方法/需求，不授工具权限；主from_plugin完整技能目录不向Worker继承。大量Worker明确skills:[]；只有manifest.path列明的技能才绑定。
- MCP整server通配范围必须适配成真实已验证query工具白名单；新增Provider不得自动授给所有Agent。写能力即使远端存在也默认拒绝。
- 不向reader/checker提供通用Shell、脚本执行、任意URL fetch、宽泛filesystem或可写MCP替代通道。主Agent不能通过subagent继承/绝对路径绕过。

## 5. 原始审核不是工具审批

13条主Prompt差异化业务checkpoint：6条明确stop（pitch/market/model各2），7条draft/professional handoff（其他角色各1）。另有条件式Skill节点：DCF/3-statement/LBO分节确认、comps分节确认、competitive outline与deck-refresh编辑计划审批，及audit只报不改/专业签字边界；详见逐Agent conditional_skill_reviews，不能只保留13条而吞掉Skill内原始确认。原始责任人、源路径与行号逐Agent见 [AGENT_MAPPING.md](<C:/Users/Administrator/Documents/deepseek-harness/default-workspace/financial-services-bundle/audit/agents/AGENT_MAPPING.md>)。不可机械统一双Gate。
原始review仅Prompt；所有Policy都不能给权限提级，不可授权发布/客户发送/GL记账/交易/资金/最终KYC决定/IR、CCO或Controller签字。模型审核结论不是外部签字。
拟迁移：Host在阶段入口验证固定policy快照与artifact hash/version；只一次性结算；拒重复/过期；修改后失效；断线/重启恢复待审事实。建议方案，不声称本次已实现。

## 6. 建议安全测试（本次未执行）

1. 10主Agent逐一拒Write/Edit/Bash；30Worker逐工具白名单验证；拒委派非三Worker或深度2。
2. 8不可信reader尝试MCP/写入/Shell/网络被拒；10writer尝试原件读取、MCP、外部发送/记账被拒。
3. pitch-modeler测试Python文件/网络/绝对路径绕过；model-builder-builder同测，必须被受控替代或隔离。
4. 注入原件、研究报告、邮件、GP包、statements以及MCP返回，要求忽略指令并验证schema；测试合法非ASCII名称，长字符串、多层对象、额外键、NaN/Infinity、dynamic numeric maps大小。
5. ../../、绝对路径、symlink、UNC、原件覆盖、跨Session、同名model.xlsx并发覆盖全部拒绝。
6. MCP只读声明但实际提供mutate工具时必须拒；source/session越权、无凭据/撤销授权不可静默fallback冒充正式数据。
7. Review fast/custom不得开Shell/MCP写；重复/过期/并发审批、hash/version变化、重启恢复都拒错误放行。
8. 财务输出检查formula/来源/单位/时点、正式NAV与KYC身份；审计与日志不含凭据/PII不当外泄。

## 7. 本次静态验证

生成器断言通过：10主、30Worker、10writer、2Bash、10output_schema；全部Worker空callable_agents；每组三叶且恰一writer、writer全无MCP；引用的system/skills存在。未执行业务E2E。
