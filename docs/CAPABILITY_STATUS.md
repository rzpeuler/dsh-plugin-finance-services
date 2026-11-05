# 能力与角色映射（生成文件，请勿手改）

- 契约版本：`1.0.0`；源树 `1345d96cb71838806b855380bc55666c8ab642430260e8a5e9511c32cd11e18b`
- 主 Agent 10、Worker 30、Skill 63、命令 41、能力 14

## 主 Agent 与 Worker 归属

| 主 Agent | Worker | 写权限 | 允许来源 | 技能数 |
|---|---|---|---|---:|
| `finance-pitch-agent` | `finance-pitch-agent-researcher`<br>`finance-pitch-agent-modeler`<br>`finance-pitch-agent-deck-writer` | no | capiq, daloopa | 44 |
| `finance-market-researcher` | `finance-market-researcher-sector-reader`<br>`finance-market-researcher-comps-spreader`<br>`finance-market-researcher-note-writer` | no | capiq, factset | 43 |
| `finance-earnings-reviewer` | `finance-earnings-reviewer-transcript-reader`<br>`finance-earnings-reviewer-model-updater`<br>`finance-earnings-reviewer-note-writer` | no | factset, daloopa | 33 |
| `finance-meeting-prep-agent` | `finance-meeting-prep-agent-profiler`<br>`finance-meeting-prep-agent-news-reader`<br>`finance-meeting-prep-agent-pack-writer` | no | crm, capiq | 13 |
| `finance-model-builder` | `finance-model-builder-data-puller`<br>`finance-model-builder-builder`<br>`finance-model-builder-auditor` | no | capiq, daloopa | 24 |
| `finance-gl-reconciler` | `finance-gl-reconciler-reader`<br>`finance-gl-reconciler-critic`<br>`finance-gl-reconciler-resolver` | no | internal-gl, subledger | 8 |
| `finance-kyc-screener` | `finance-kyc-screener-doc-reader`<br>`finance-kyc-screener-rules-engine`<br>`finance-kyc-screener-escalator` | no | screening | 9 |
| `finance-valuation-reviewer` | `finance-valuation-reviewer-package-reader`<br>`finance-valuation-reviewer-valuation-runner`<br>`finance-valuation-reviewer-publisher` | no | portfolio | 17 |
| `finance-month-end-closer` | `finance-month-end-closer-ledger-reader`<br>`finance-month-end-closer-rollforward`<br>`finance-month-end-closer-poster` | no | internal-gl | 8 |
| `finance-statement-auditor` | `finance-statement-auditor-statement-reader`<br>`finance-statement-auditor-reconciler`<br>`finance-statement-auditor-flagger` | no | nav | 8 |

## 14 个能力现状

生成时不注册任何 Provider：两个 TEST_ONLY Adapter 在验收后已移除，因此全部为契约层。

| 能力 | 契约 | 生产 Provider | 状态 |
|---|---|---:|---|
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

## Skill 资产状态

| Skill | 资产状态 | 告警数 | 绑定角色数 |
|---|---|---:|---:|
| `3-statement-model` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 3 | 5 |
| `accrual-schedule` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `ai-readiness` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `audit-xls` | PRESERVED_SOURCE_ASSETS | 0 | 8 |
| `bond-futures-basis` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `bond-relative-value` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `break-trace` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `buyer-list` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `catalyst-calendar` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `cim-builder` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `clean-data-xls` | PRESERVED_SOURCE_ASSETS | 1 | 4 |
| `client-report` | PRESERVED_SOURCE_ASSETS | 0 | 1 |
| `client-review` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `competitive-analysis` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `comps-analysis` | BLOCKED | 4 | 6 |
| `datapack-builder` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `dcf-model` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 33 | 6 |
| `dd-checklist` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `dd-meeting-prep` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `deal-screening` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `deal-sourcing` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `deal-tracker` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `deck-refresh` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `earnings-analysis` | PRESERVED_SOURCE_ASSETS | 2 | 2 |
| `earnings-preview` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `earnings-preview-single` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 35 | 4 |
| `equity-research` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `fixed-income-portfolio` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `fsi-strip-profile` | BLOCKED | 1 | 2 |
| `funding-digest` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 8 | 4 |
| `fx-carry-trade` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `gl-recon` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `ib-check-deck` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 2 | 4 |
| `ic-memo` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `idea-generation` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `initiating-coverage` | PRESERVED_SOURCE_ASSETS | 28 | 2 |
| `investment-proposal` | PRESERVED_SOURCE_ASSETS | 0 | 1 |
| `kyc-doc-parse` | PRESERVED_SOURCE_ASSETS | 2 | 1 |
| `kyc-rules` | PRESERVED_SOURCE_ASSETS | 0 | 1 |
| `lbo-model` | BLOCKED | 12 | 6 |
| `macro-rates-monitor` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `merger-model` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `model-update` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `morning-note` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `nav-tieout` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `option-vol-analysis` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `pitch-deck` | PRESERVED_SOURCE_ASSETS | 2 | 3 |
| `portfolio-monitoring` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `ppt-template-creator` | PRESERVED_SOURCE_ASSETS | 4 | 4 |
| `pptx-author` | PRESERVED_SOURCE_ASSETS | 16 | 8 |
| `process-letter` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `returns-analysis` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `roll-forward` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `sector-overview` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `skill-creator` | PRESERVED_SOURCE_ASSETS | 26 | 4 |
| `swap-curve-strategy` | PRESERVED_SOURCE_ASSETS | 0 | 4 |
| `tear-sheet` | EXTERNAL_RUNTIME_ADAPTATION_REQUIRED | 40 | 4 |
| `teaser` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `thesis-tracker` | PRESERVED_SOURCE_ASSETS | 0 | 2 |
| `unit-economics` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `value-creation-plan` | PRESERVED_SOURCE_ASSETS | 0 | 3 |
| `variance-commentary` | PRESERVED_SOURCE_ASSETS | 0 | 5 |
| `xlsx-author` | PRESERVED_SOURCE_ASSETS | 18 | 17 |
