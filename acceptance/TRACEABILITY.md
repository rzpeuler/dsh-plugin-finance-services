# 任务书逐条追溯矩阵（生成文件，请勿手改）

- 来源：Financial_Services_DSH_Creator_Prompt_v1.md sections 11 and 12
- 生成日期：2026-11-06
- 阶段门：{"PASS_STATIC":1,"PASS_NATIVE":2,"PARTIAL":3,"BLOCKED":1}
- 强制验收：{"PARTIAL":3,"PASS_NATIVE":5,"PASS_STATIC":2,"PASS_USER_OBSERVED":1}
- 规则：非 PASS 的条目必须写明缺口；证据路径必须可解析。

## 阶段门（§11）

| 阶段 | 要求 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|
| P0 | 清点源码/许可证/目录/运行时接口，输出资产清单与迁移决定，列出原行为与 DSH 机制差异 | PASS_STATIC | [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md) [MIGRATION_MATRIX.md](MIGRATION_MATRIX.md) [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md) | — |
| P1 | 仓库外 Bundle、manifest、Host/Client 装配、全局入口、首次绑定 Workspace、安装/禁用/启用/卸载烟测 | PASS_NATIVE | [P1-clean-rebuild-001.json](acceptance/P1-clean-rebuild-001.json) [P5-persist-phase-b.json](acceptance/P5-persist-phase-b.json) | — |
| P2 | 注册 10 主 Agent、30 Worker 与全部 Skill，验证提示词/来源/路径/受限工具/技能发现/真实 Session | PASS_NATIVE | [P2-live-host-pass-003.json](acceptance/P2-live-host-pass-003.json) [CAPABILITY_MATRIX.json](acceptance/CAPABILITY_MATRIX.json) | — |
| P3 | Capability Registry / Adapter Contract / Source Policy / 财务契约 / MCP 集成 / 诊断界面与外部测试插件 | PARTIAL | [P3-foundation-native-pass-001.json](acceptance/P3-foundation-native-pass-001.json) [P3-native-mcp-pass-003.json](acceptance/P3-native-mcp-pass-003.json) | P3-MCP-MANAGER |
| P4 | 逐 Agent 任务模板、真实 Worker 调用与数据获取、Office 交付及验收，不展示固定假结果 | BLOCKED | [P4-templates-native-001.json](acceptance/P4-templates-native-001.json) [P4-workbook-over-remote-001.json](acceptance/P4-workbook-over-remote-001.json) [P4-gl-boundary-001.json](acceptance/P4-gl-boundary-001.json) | P4-OFFICE-NATIVE, P4-BUSINESS-RUNS |
| P5 | 四种 Review Policy、Host Review Gate、跨会话队列、阶段持久化、审批幂等与重启恢复、错误与来源记录 | PARTIAL | [P5-policy-matrix-native-pass-002.json](acceptance/P5-policy-matrix-native-pass-002.json) [P5-running-recovery-native-001.json](acceptance/P5-running-recovery-native-001.json) [P6-error-lineage-native-pass-001.json](acceptance/P6-error-lineage-native-pass-001.json) | P5-OS-RESTART |
| P6 | 工作台所有页面、检索、状态、预览、移动适配、i18n、权限反馈，安装/升级/重启/禁用/重装/离线案例，保存报告 | PARTIAL | [P6-manual-2026-11-06-001.md](acceptance/P6-manual-2026-11-06-001.md) [P6-post-restart-verified-001.json](acceptance/P6-post-restart-verified-001.json) [P6-live-client-registration-001.json](acceptance/P6-live-client-registration-001.json) [P6-client-scenarios.tap](acceptance/P6-client-scenarios.tap) | P6-SETTINGS-UI, P6-LIFECYCLE-UI, P6-ACCESSIBILITY, P6-DELIVERABLE-OPEN, P6-OFFLINE-CASE |

## 必须实际执行的验收（§12）

| # | 要求 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|
| A1 | Bundle 可由原生 Plugin Manager 安装、启用、禁用、重新启用和卸载，不改 DSH Core | PARTIAL | [P5-persist-phase-b.json](acceptance/P5-persist-phase-b.json) [P6-install-restart-required-001.json](acceptance/P6-install-restart-required-001.json) [P6-post-restart-verified-001.json](acceptance/P6-post-restart-verified-001.json) | P6-LIFECYCLE-UI |
| A2 | 10 个主 Agent 目录可见、详情正确、点击创建指定 Preset 的原生 Session，既有会话不被改绑，重启可见 | PARTIAL | [P2-live-host-pass-003.json](acceptance/P2-live-host-pass-003.json) [P2-live-client-pass-004.json](acceptance/P2-live-client-pass-004.json) | P6-BROWSER-RENDERING |
| A3 | 30 个 Worker 的 persona 与工具权限保真；主 Agent 无法委派非白名单 Worker；只读 Worker 无写权限 | PASS_NATIVE | [P2-client-runtime-readonly-001.json](acceptance/P2-client-runtime-readonly-001.json) [P2-controlled-compute-pass-003.json](acceptance/P2-controlled-compute-pass-003.json) [CAPABILITY_MATRIX.json](acceptance/CAPABILITY_MATRIX.json) | — |
| A4 | 63 个 Skill 名称可从有效来源读取，role 差异保留，缺失脚本/引用/资源可被检测标记 | PASS_STATIC | [CAPABILITY_MATRIX.json](acceptance/CAPABILITY_MATRIX.json) [CAPABILITY_STATUS.md](docs/CAPABILITY_STATUS.md) | — |
| A5 | 真实生成至少一次完整 Excel、一次可打开的 PPT/文档；未授权外部数据时只用上传或公共数据路径 | PARTIAL | [P6-manual-2026-11-06-001.md](acceptance/P6-manual-2026-11-06-001.md) [P4-inprocess-xlsx-001.json](acceptance/P4-inprocess-xlsx-001.json) [P4-workbook-over-remote-001.json](acceptance/P4-workbook-over-remote-001.json) | P4-OFFICE-NATIVE |
| A6 | original/fast/strict/custom 行为正确；业务边界不可更改；待审不需模型自旋；并发审批拒绝过期答复；重启后从已保存阶段接续 | PASS_NATIVE | [P5-policy-matrix-native-pass-002.json](acceptance/P5-policy-matrix-native-pass-002.json) [P5-queue-pass-002.json](acceptance/P5-queue-pass-002.json) [P5-running-recovery-native-001.json](acceptance/P5-running-recovery-native-001.json) [P5-ask-pass-003.json](acceptance/P5-ask-pass-003.json) | — |
| A7 | 复用原生会话、右栏、文件交付与插件页接口，无双重会话历史、假状态或另一套凭据 | PASS_USER_OBSERVED | [P6-manual-2026-11-06-001.md](acceptance/P6-manual-2026-11-06-001.md) [P6-live-client-registration-001.json](acceptance/P6-live-client-registration-001.json) [P6-settings-config-surface-001.json](acceptance/P6-settings-config-surface-001.json) | P6-SETTINGS-UI |
| A8 | 新增第三方 Adapter 不需改主插件；两个测试适配器按能力替换，单位/期间/时点/来源/失败回退得到验证 | PASS_NATIVE | [P3-foundation-native-pass-001.json](acceptance/P3-foundation-native-pass-001.json) [P3-adapter-unload-audit.json](acceptance/P3-adapter-unload-audit.json) | — |
| A9 | 缺商业 MCP 凭据时能力明确受限，其他功能可用；不把模拟数据计入真实 E2E | PASS_STATIC | [gap-ledger.json](acceptance/gap-ledger.json) [P3-foundation-native-pass-001.json](acceptance/P3-foundation-native-pass-001.json) | P3-MCP-MANAGER |
| A10 | 安装/关闭/卸载不删除用户 Workspace、原始文件或 DSH 历史；重装可重新绑定并合理恢复索引 | PASS_NATIVE | [P5-persist-phase-b.json](acceptance/P5-persist-phase-b.json) [P5-boundary-phase-b-003.json](acceptance/P5-boundary-phase-b-003.json) | — |
| A11 | 原业务约束始终有效：不发布、不发客户邮件、不记正式分录、不执行交易、不代替合规签字 | PASS_NATIVE | [P5-boundary-phase-b-003.json](acceptance/P5-boundary-phase-b-003.json) [P6-post-restart-verified-001.json](acceptance/P6-post-restart-verified-001.json) | — |
