# 交接说明（2026-11-05）

本文件是当前工作的收尾快照：**哪些已经用真实证据证明、哪些没有、下一步由谁做**。它不替代各阶段验收记录，只做索引与判读。

## 当前交付状态

| 阶段 | 状态 | 是否验收 |
|---|---|---|
| P0 清点与设计 | 通过 | 是 |
| P1 Bundle 骨架 | 通过 | 是 |
| P2 Agent/Worker/Skill 迁移 | 通过 | 是 |
| P3 数据可扩展基础 | `PARTIAL_HOST_INTERFACE_GAP` | 否 |
| P4 业务执行与交付 | `PARTIAL` | 否 |
| P5 审核与恢复 | 内核与原生能力已验，渲染与重启未验 | 否 |
| P6 前端整合 | 界面已构建安装，**未在浏览器验收** | 否 |

安装形态：`@local/dsh-financial-services@0.4.0-alpha.1`，原生 Plugin Manager 链接安装。**DSH 已重启，Bundle 在新进程中加载成功**：三个服务挂载、策略为 `original`、工作簿字节有效、14 个 run 可读（[证据](P6-post-restart-verified-001.json)）。注意：改动仍需重启生效（`unmanaged-plugin`），且 Inspect 的 Service 目录**不收录本 Bundle**，不要用它判断服务是否存在。三行（`financial-services` / `finance-data` / `finance-review`），无测试夹具残留（探针已移除，卸载待下次重启完成）。

## 逐条追溯

任务书 §11 的 7 个阶段门与 §12 的 11 条强制验收已逐条映射到证据与缺口：[TRACEABILITY.md](TRACEABILITY.md)（由 `scripts/check-traceability.mjs` 生成并校验）。

## 已证明（有证据链接）

- **契约与数据层**：14 个稳定能力、显式来源策略、时点/单位/口径规范化；两个独立 TEST_ONLY Adapter 的原生注册/查询/卸载（[26 项](P3-foundation-native-pass-001.json)、[6 项审计](P3-adapter-unload-audit.json)）。
- **原生 MCP transport**：真实 stdio 握手、调用与卸载；金融角色仍看不到 raw MCP（[7 项](P3-native-mcp-pass-003.json)、[2 项](P3-native-mcp-unload-pass-003.json)）。
- **审核内核**：四模式策略、确定性 Gate、自有域持久化、跨会话队列投影、原生问答接管、副作用面为空、禁用/卸载后用户文件与决定保留（P5 各证据，见[阶段记录](P5.md)）。
- **四策略并列实例**：original/fast/strict/custom 同时运行、需求集两两不同、互不串门（[7 项](P5-policy-matrix-native-pass-002.json)）。
- **P6 工作台**：六段只读聚合（工作区/角色明细/数据源/Runs/成果/审核队列），逐段降级；审核面板只读；Settings 走原生配置行；导航键唯一；i18n 静态覆盖；9 项受限场景可执行验证（见[阶段记录](P6.md)）。
- **交付文档**：安装/升级/卸载/首次使用/依赖/能力目录/排障齐全，且所有证据链接可解析（[5 项](P6-docs-completeness.tap)）。
- **构建可复现**：同树两次构建逐字节一致；从 HEAD 干净归档重建的产物与工作区逐字节一致（[1](P1-reproducible-build-001.json)、[2](P1-clean-rebuild-001.json)）。

## 没有证明（不要在汇报中声称）

- 任何界面在**浏览器中的真实显示与交互**；窄屏、主题对比度、键盘可达性。
- 原生 Office 产物（Excel/Word/PPT/PDF）由 Agent 生成；Office 通道被两项宿主事实阻断（受限子进程 `0xC0000142`、无二进制写接口）。
- 十项业务的真实数据运行与商业数据授权；无 Manager 与安全 MCP 金融委派。
- 应用级（OS 进程）重启后的恢复；只验证了 bundle 级卸载重装与禁用启用。
- 成果的"打开/回到会话"入口。

## 下一步（按依赖顺序）

0. **重启一次**：完成两个探针包的卸载（上次卸载为 `restart-required`），并让服务重新挂载；随后确认插件列表里两个探针包已消失。
1. **界面四项验收**：[计划](P6-manual-plan-001.json) 与 [手册](MANUAL_CHECKLIST.md) 的 UI-1…UI-4（工作台七段、审核面板只读、下载工作簿、窄屏与深色）。
1. **界面验收**：按 [MANUAL_CHECKLIST](MANUAL_CHECKLIST.md) 走 A–G，把结果写入新的 `acceptance/P6-manual-<日期>-*.md`，再更新 `P6-results.json` 的 `browserRendered` 与各项状态。
2. **OS 级重启**：记录一次审核 → 重启应用 → 重读队列投影，补 `P5-OS-RESTART`。
3. **宿主接口**：若宿主提供可用的受限子进程或二进制产物写接口，P4 的 Office 与业务交付即可恢复；否则维持 `BLOCKED_HOST_INTERFACE`。
4. **商业数据**：取得授权后再做逐业务 E2E；在此之前不得把 TEST_ONLY 结果当作商业交付。

## 如何继续开发

- 构建：`pnpm run build`；检查：`pnpm run check:package`；测试：`pnpm test`（当前 410 项）。
- 安装：原生 Plugin Manager 重新链接本目录；源码改动后必须重建 `lib/client.js` 才会生效。
- 缺口单一事实源：[gap-ledger.json](gap-ledger.json)；新增证据后同步更新对应阶段的 `*-results.json` 与本表。
- 规则：**只有新的原生或浏览器观察才能关闭缺口**；静态代码、构建成功、安装生效都不算。
