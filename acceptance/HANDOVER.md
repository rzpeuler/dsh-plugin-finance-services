# 交接说明（2026-11-06）

本文件是当前工作的收尾快照：**哪些已经用真实证据证明、哪些没有、下一步由谁做**。它不替代各阶段验收记录，只做索引与判读。

## 报告

阶段完成情况、证据索引与未闭合缺口见 [阶段完成报告](COMPLETION_REPORT.md)。

## 当前交付状态

| 阶段 | 状态 | 是否验收 |
|---|---|---|
| P0 清点与设计 | 通过 | 是 |
| P1 Bundle 骨架 | 通过 | 是 |
| P2 Agent/Worker/Skill 迁移 | 通过 | 是 |
| P3 数据可扩展基础 | `PARTIAL_HOST_INTERFACE_GAP` | 否 |
| P4 业务执行与交付 | `PARTIAL` | 否 |
| P5 审核与恢复 | 内核与原生能力已验，渲染与重启未验 | 否 |
| P6 前端整合 | 字段/保存/策略快照切换与决定历史经用户确认；其他 UI 与宿主缺口仍开 | 否 |

安装形态：`@local/dsh-financial-services@0.4.0-alpha.1`，原生 Plugin Manager 链接安装。策略快照修复后的首次安装曾因 `financial_review` domain 已打开而失败；用户随后重启当前 Harness 并完成策略切换/保存/恢复测试，确认新策略生效且旧决定按历史保留、不自动授权。重启后 live Client Slots 的两个 Row Config key active、Host Config schemas 与 Config Editor 可见（[用户验收证据](P6-settings-row-config-007.json)）。没有单独获取重启后的 Plugin Manager 操作结果，但用户确认功能正常。先前 OS 重启后，三个服务挂载、策略为 `original`、工作簿字节有效、14 个 run 可读（[旧证据](P6-post-restart-verified-001.json)）。Inspect 的 Service 目录**不收录本 Bundle**，不要用它判断服务是否存在。三行（`financial-services` / `finance-data` / `finance-review`）。

## 逐条追溯

任务书 §11 的 7 个阶段门与 §12 的 11 条强制验收已逐条映射到证据与缺口：[TRACEABILITY.md](TRACEABILITY.md)（由 `scripts/check-traceability.mjs` 生成并校验）。

## 已证明（有证据链接）

- **契约与数据层**：14 个稳定能力、显式来源策略、时点/单位/口径规范化；两个独立 TEST_ONLY Adapter 的原生注册/查询/卸载（[26 项](P3-foundation-native-pass-001.json)、[6 项审计](P3-adapter-unload-audit.json)）。
- **原生 MCP transport**：真实 stdio 握手、调用与卸载；金融角色仍看不到 raw MCP（[7 项](P3-native-mcp-pass-003.json)、[2 项](P3-native-mcp-unload-pass-003.json)）。
- **审核内核**：四模式策略、确定性 Gate、自有域持久化、跨会话队列投影、原生问答接管、副作用面为空、禁用/卸载后用户文件与决定保留（P5 各证据，见[阶段记录](P5.md)）。
- **四策略并列实例**：original/fast/strict/custom 同时运行、需求集两两不同、互不串门（[7 项](P5-policy-matrix-native-pass-002.json)）。
- **P6 工作台**：六段只读聚合（工作区/角色明细/数据源/Runs/成果/审核队列），逐段降级；审核面板只读；Settings 通过两个 `plugins.row.config` 页面与 Host Config Editor 桥接，并解包 RemoteResult。用户重启 Harness 后确认字段、保存、policyId 新生命周期及旧决定快照隔离；用户也确认 Plugin Manager UI 禁用/重新启用及卸载/本地重装通过（见[设置证据](P6-settings-row-config-007.json)、[证据 001](P6-lifecycle-ui-001.json)、[证据 002](P6-lifecycle-ui-002.json)）。导航键唯一；i18n 静态覆盖；9 项受限场景可执行验证。
- **交付文档**：安装/升级/卸载/首次使用/依赖/能力目录/排障齐全，且所有证据链接可解析（[5 项](P6-docs-completeness.tap)）。
- **构建可复现**：同树两次构建逐字节一致；从 HEAD 干净归档重建的产物与工作区逐字节一致（[1](P1-reproducible-build-001.json)、[2](P1-clean-rebuild-001.json)）。

## 没有证明（不要在汇报中声称）

- Settings Row Config 字段/保存/策略快照历史、约 520px 窄屏/主题/键盘、disable/re-enable、uninstall/local reinstall 与最新CSS重启后可读性复验均由用户确认；源Token比值已静态测量并修正；本地Bundle无 Plugin Manager installTarget，通用 Official 包升级 UI 未测；读屏与浏览器实测对比度仍未完成。
- 原生 Office 产物（Excel/Word/PPT/PDF）由 Agent 生成；Office 通道被两项宿主事实阻断（受限子进程 `0xC0000142`、无二进制写接口）。
- 十项业务的真实数据运行与商业数据授权；无 Manager 与安全 MCP 金融委派。
- 应用级（OS 进程）重启后的逐字节恢复；Bundle 级 UI 禁用/启用与卸载/重装已有用户验收。当前 local Bundle 无 update target；通用 Official 包升级 UI 仍未测试。
- 成果的"打开/回到会话"入口。

## 下一步（按依赖顺序）

0. ~~重启 DSH~~：已完成。探针包已移除，服务重新挂载。
1. ~~界面四项验收~~：已完成，四项全部由用户确认通过（[记录](P6-manual-2026-11-06-001.md)）。`browserRendered` 现为真，范围仅限这四项。
2. **Settings、disable/re-enable、uninstall/local reinstall 与最新CSS重启后视觉复验均已验收；两主题源Token对比度测量及修正已完成**。若要验证通用 Plugin Manager upgrade UI，需先选择/授权一个可更新的 Official 包；当前本地 Financial Services 包无升级 target，且无已安装的候选包。
1. **界面验收**：按 [MANUAL_CHECKLIST](MANUAL_CHECKLIST.md) 走 A–G，把结果写入新的 `acceptance/P6-manual-<日期>-*.md`，再更新 `P6-results.json` 的 `browserRendered` 与各项状态。
2. **OS 级重启**：记录一次审核 → 重启应用 → 重读队列投影，补 `P5-OS-RESTART`。
3. **宿主接口**：若宿主提供可用的受限子进程或二进制产物写接口，P4 的 Office 与业务交付即可恢复；否则维持 `BLOCKED_HOST_INTERFACE`。
4. **商业数据**：取得授权后再做逐业务 E2E；在此之前不得把 TEST_ONLY 结果当作商业交付。

## 如何继续开发

- 构建：`pnpm run build`；检查：`scripts/check-package.mjs` 与 `scripts/audit-claims.mjs` 通过；测试：本轮完整回归 512/512 通过（证据 `P6-theme-contrast-static-001.tap`）。
- 安装：原生 Plugin Manager 重新链接本目录；源码改动后必须重建 `lib/client.js` 才会生效。
- 缺口单一事实源：[gap-ledger.json](gap-ledger.json)；新增证据后同步更新对应阶段的 `*-results.json` 与本表。
- 规则：**只有新的原生或浏览器观察才能关闭缺口**；静态代码、构建成功、安装生效都不算。
