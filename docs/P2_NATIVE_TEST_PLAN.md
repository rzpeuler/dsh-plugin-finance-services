# P2 原生 Host 验收探针

本探针是一次性 `TEST_ONLY` 本地测试 Bundle，不是第二个产品安装单元。仅本地测试元信息，按 disposable fixture 例外不配产品图标/locale；不声称图标或 GUI 视觉验收。探针不替换、不 stub 任何原生 service，不安装 fakeModel，不修改 Profile 或 DSH 源码。

## 父 Agent 集成

1. 父先构建并原生安装主 Bundle 0.2.0；安装版 0.1.2 不含 P2 Catalog，不能作为通过依据。
2. 在项目目录运行 `node scripts/build-p2-fixtures.mjs`。它只生成 `tests/p2-live/active` 与 `tests/p2-live/disabled`，不会安装、注册 Workspace 或创建 Session。
3. 父使用原生 Plugin Manager 安装 active 目录。默认 `runModelSmoke:false`；本实现阶段只做能力安全烟测。
4. 完成后读 `acceptance/P2-live-host.json`。每项都有 `status`、`timing` 和失败时的真实 `error`；UUID 根下的 `nativeFixture.jsonl` 与 `report.json` 保留每次运行的证据，后续运行不会删除旧失败。
5. 父卸载 active 探针、禁用主 Bundle，再安装 disabled 探针。它读取此前的四个真实 TEST_ONLY controller Session，只对仍 live 的原 Agent 做 retained-floor 检查，不 resume/recreate 来冒充旧 revision。结果另写 `acceptance/P2-live-host-disabled.json`，active 文件不覆盖。
6. 父自行恢复主 Bundle 并移除 disposable 探针；探针从不自己切主插件。不要同时安装两个 phase，也不要在 active 正在清理时禁用主 Bundle。替换已加载 JS 模块受宿主缓存/重启约束，重新安装的应用结果由父核实，不能从文件变化推定 live 更新。可显式传 `--revision=retry-1` 生成独立目录与 package/row identity `active-retry-1` / `disabled-retry-1`，由父移除旧探针后安装，避免复用旧探针模块 URL；这不修复主产品自身的旧模块。

## 精确公共 API 与实际覆盖

- `sessionController.create({workspaceId,agentPreset})` → `{sessionId,agentPreset}`；`workspaceId` 与 `cwd` 在原生创建器中互斥，Workspace 提供规范 cwd，创建后核对真实 header；`resolveAgent(sessionId)` → `{agent}|{error}`；`inspect(sessionId)` 返回原生 `meta/events`。
- 至少两个不同 main、一个 Reader、一个 Writer 经上述 controller 创建，保留 live 供 disabled-phase。其余角色通过 `agents.create({sessionId,meta,setup})` 在公共 setup 中调用 `agentPresets.mount(agentCtx,roleId)`，不提交模型输入；最后只 dispose 自有 handle，不删除历史。总计最多 40 个明确 TEST_ONLY 原生 Session，均记录真实 ID。
- rc.5 的公共 `SessionHeader` 没有 `workspaceId`。探针保存真实 header，核对 `cwd/agentPreset`，另通过 `workspaceRegistry.resolveByPath` 和 controller Session 的 `Workspace.sessionIds` 证明归属，绝不添加伪 header 字段。
- 精确 finance roster 恰 40，逐项 resolve 无 broken；`inspectCompositions(agent.ctx)` 检查 floor、role、skill registry/provider/tool 的模块来源与 `leakedServices`。
- `agentPresets.serviceFor(agent,'skills')` 获取每个角色自己的 registry。当前公共合同无 `serviceForScope`，没有探 private API；每 role 完整 list/get，另累计至少 63 个独立真实 skill 内容 SHA。未知、默认用户技能与未授权金融角色技能均不可 get。
- `tools.schemas(agent)` 核对精确工具集合、所属三 Worker enum、Worker 无委派、Writer 无金融查询及无全功能 shell/global-write。
- 所有执行反例与成功读/创建/edit/CAS 都走 `tools.execute({agent,name,arguments,callId,signal})`，通过 `agents.withInitiator` 保留真实因果归属。无直接调用 RoleFilesystem/helper/ToolDefinition.execute 冒充 dispatcher。
- 原始 TEST_ONLY canary 拒写、穿越、绝对路径、UNC、ADS、跨 TEST_ONLY Session、指向本 UUID 内 outside 目录的 junction、原生只读模式、create-if-absent、正常 edit 和过期 CAS。保留 native error，不把任意无关错误都当预期拒绝。
- Gateway 直接使用原生 `typertGateway.invoke` + 独立 owner Peer；畸形 Catalog/prepareDraft 参数须由 `gateway/input-invalid` 或 `gateway/arguments-invalid` 拒绝。校验真实 10/30/63/41/29 诊断、Worker 拒启动、未 Ready Workspace 拒绝、41 命令逐目标显式选择、29 steering 正确/错误角色。draft intent 不等于真实点击/Client composer 预填。
- `systemPrompt.assemble` + `tokenMeter.estimateMessage/measure` 记录两个 main 的原生首轮提示与 Tool-envelope heuristic token 预算。不是字符计数，不是 provider usage；无 service/route 时记录未测，不宣称真实 usage。

## 安全所有权与恢复

每次根为 `acceptance/tmp/p2-<uuid>`，带 ownership marker。原始 canary 明确是玩具颜色/数量的非金融 TEST_ONLY 文本。注册前保存原 binding 与 Workspace IDs；原生 registry 注册新目录，再通过 financeOperations 单独绑定。测试结束以最新 revision 绑定旧路径（旧 binding 为 null 时 unbind），核对恢复同一 Workspace ID/路径；revision/boundAt 会合法前进，不倒写旧持久状态。如出现并发外部 binding，拒覆盖并记录失败，留给父处理。

只注销 ownership marker、原记录路径、UUID 根和旧 Workspace IDs 排除检查共同确认的自有 Workspace；必须已经不再绑定。文件、junction、canary 与 Session 历史全部保留，不归档任何原用户 Session。测试异常只记 FAIL，不吞真实 error，也不使主 Bundle 关闭。独立检查继续执行，缺必要前置条件单独记 NOT_RUN。

## 模型与未测口径

只有父明确执行 `node scripts/build-p2-fixtures.mjs --run-model-smoke` 或明确把 active config 设置 `runModelSmoke:true` 时，才经同一 native `subagent` dispatcher 从所属三 Worker 白名单中选一个只读 Worker，读取本测试 canary 并返回摘要。等待原生 children 后读取真实 child log，记录 subagent ID、路由、工具调用、模型输出与退出。没有硬编码业务结果；未开启为 `modelSmoke.status:NOT_RUN`，不能当业务 E2E。

active 的总状态仅表示已执行能力检查，不表示 P2 全部完成；`validationScope` 明确为 `NATIVE_CAPABILITY_SMOKE_NOT_FULL_P2_ACCEPTANCE`。禁用/重新启用/卸载生命周期、真实鼠标点击、已开始业务 Session 拒改绑、商业数据、Office 产物与真实业务 E2E，不能从本能力烟测推定通过。模型步可由父后续独立增强。
