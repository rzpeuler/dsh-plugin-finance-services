# 能力与角色映射（生成文件，请勿手改）

- 唯一 FinanceData 契约；源树 `9e7552e0ec447868932a68fa3a3b30c8416b55956e765c4272ad43df2bd802ce`
- 主 Agent 3、Worker 9、Skill 22、命令 16、数据能力 15

## 主 Agent 与 Worker 归属

| 主 Agent | Worker | 写权限 | 允许来源 | 技能数 |
|---|---|---|---|---:|
| `finance-market-researcher` | `finance-market-researcher-sector-reader`<br>`finance-market-researcher-comps-spreader`<br>`finance-market-researcher-note-writer` | no | — | 22 |
| `finance-earnings-reviewer` | `finance-earnings-reviewer-transcript-reader`<br>`finance-earnings-reviewer-model-updater`<br>`finance-earnings-reviewer-note-writer` | no | — | 22 |
| `finance-model-builder` | `finance-model-builder-data-puller`<br>`finance-model-builder-builder`<br>`finance-model-builder-auditor` | no | — | 13 |

## 唯一 FinanceData 能力现状

当前只有一套 FinanceData 能力契约。CNEquity Reader 有 3 个本地 TEST_ONLY 候选 Adapter factory；当前没有注册或授权，默认 A 股代码 allowlist 为空且三项权限均关闭。

| FinanceData 能力 | 已有契约 | 已注册 Provider | 状态 |
|---|---:|---:|---|
| `company.identity` | yes | 0 | CONTRACT_ONLY |
| `financial.statements` | yes | 0 | CONTRACT_ONLY |
| `filings` | yes | 0 | CONTRACT_ONLY |
| `earnings.transcript` | yes | 0 | CONTRACT_ONLY |
| `earnings.consensus` | yes | 0 | CONTRACT_ONLY |
| `prices.history` | yes | 0 | CONTRACT_ONLY |
| `comps` | yes | 0 | CONTRACT_ONLY |
| `transactions` | yes | 0 | CONTRACT_ONLY |
| `macro.rates` | yes | 0 | CONTRACT_ONLY |
| `portfolio.nav` | yes | 0 | CONTRACT_ONLY |
| `accounting.gl` | yes | 0 | CONTRACT_ONLY |
| `accounting.subledger` | yes | 0 | CONTRACT_ONLY |
| `crm.relationship` | yes | 0 | CONTRACT_ONLY |
| `compliance.screening` | yes | 0 | CONTRACT_ONLY |
| `corporate.actions` | yes | 0 | CONTRACT_ONLY |

## CNEquity Reader 候选状态

| 候选定义 | 已注册 | 已授权 | 默认符号 allowlist | 默认开启权限标志 |
|---:|---:|---:|---:|---:|
| 3 | 0 | 0 | 0 | 0 |

## Skill 资产状态

| Skill | 资产状态 | 告警数 | 绑定角色数 |
|---|---|---:|---:|
| `3-statement-model` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 3 | 4 |
| `audit-xls` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `catalyst-calendar` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `clean-data-xls` | PRESERVED_SOURCE_ASSETS | 1 | 3 |
| `competitive-analysis` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `comps-analysis` | BLOCKED | 4 | 5 |
| `dcf-model` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 33 | 4 |
| `deck-refresh` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `earnings-analysis` | PRESERVED_SOURCE_ASSETS | 2 | 2 |
| `earnings-preview` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `ib-check-deck` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 2 | 3 |
| `idea-generation` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `initiating-coverage` | PRESERVED_SOURCE_ASSETS | 28 | 2 |
| `lbo-model` | BLOCKED | 12 | 4 |
| `model-update` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `morning-note` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `ppt-template-creator` | PRESERVED_SOURCE_ASSETS | 4 | 3 |
| `pptx-author` | PRESERVED_SOURCE_ASSETS | 16 | 4 |
| `sector-overview` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `skill-creator` | PRESERVED_SOURCE_ASSETS | 26 | 3 |
| `thesis-tracker` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `xlsx-author` | PRESERVED_SOURCE_ASSETS | 18 | 5 |
