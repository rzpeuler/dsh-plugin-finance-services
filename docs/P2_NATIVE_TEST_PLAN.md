# P2 原生 Host 验收探针

本探针是一次性 `TEST_ONLY` 本地测试 Bundle，不是第二个产品安装单元。仅本地测试元信息，按 disposable fixture 例外不配产品图标/locale；不声称图标或 GUI 视觉验收。探针不替换、不 stub 任何原生 service，不安装 fakeModel，不修改 Profile 或 DSH 源码。

## 父 Agent 集成

1. 父先构建并原生安装主 Bundle 0.2.0；安装版 0.1.2 不含 P2 Catalog，不能作为通过依据。
2. 在项目目录运行 `node scripts/build-p2-fixtures.mjs`。它只生成 `tests/p2-live/active` 与 `tests/p2-live/disabled`，不会安装、注册 Workspace 或创建 Session。
3. 父使用原生 Plugin Manager 安装 active 目录。默认 `runModelSmoke:false`；本实现阶段只做能力安全烟测。
4. 完成后读 `acceptance/P2-live-host.json`。每项都有 `status`、`timing` 和失败时的真实 `error`；UUID 根下的 `nativeFixture.jsonl` 与 `report.json` 保留每次运行的证据，后续运行不会删除旧失败。
5. 父卸载 active 探针、禁用主 Bundle，再安装 disabled 探针。它读取此前的五个真实 TEST_ONLY controller Session，只对仍 live 的原 Agent 做 retained-floor 检查，不 resume/recreate 来冒充旧 revision。结果另写 `acceptance/P2-live-host-disabled.json`，active 文件不覆盖。
6. 父自行恢复主 Bundle 并移除 disposable 探针；探针从不自己切主插件。不要同时安装两个 phase，也不要在 active 正在清理时禁用主 Bundle。替换已加载 JS 模块受宿主缓存/重启约束，重新安装的应用结果由父核实，不能从文件变化推定 live 更新。可显式传 `--revision=retry-1` 生成独立目录与 package/row identity `active-retry-1` / `disabled-retry-1`，由父移除旧探针后安装，避免复用旧探针模块 URL；这不修复主产品自身的旧模块。

## 精确公共 API 与实际覆盖

- `sessionController.create({workspaceId,agentPreset})` → `{sessionId,agentPreset}`；`workspaceId` 与 `cwd` 在原生创建器中互斥，Workspace 提供规范 cwd，创建后核对真实 header；`resolveAgent(sessionId)` → `{agent}|{error}`；`inspect(sessionId)` 返回原生 `meta/events`。
- 至少两个不同 main、一个 Reader、一个 Writer 经上述 controller 创建，另为首个 main 再创建同 Workspace/同 Preset 的独立 Session，核对 ID 不同与真实 header/registry 归属，不把新 Session 覆盖进第一个 main 的 live lookup。五个 controller Agent 保留 live 供 disabled-phase。其余角色通过 `agents.create({sessionId,meta,setup})` 在公共 setup 中调用 `agentPresets.mount(agentCtx,roleId)`，不提交模型输入；最后只 dispose 自有 handle，不删除历史。能力阶段共 41 个明确 TEST_ONLY 原生 Session，显式开启模型时另增加一个真实 child，均记录真实 ID。
- rc.5 的公共 `SessionHeader` 没有 `workspaceId`。探针保存真实 header，核对 `cwd/agentPreset`，另通过 `workspaceRegistry.resolveByPath` 和 controller Session 的 `Workspace.sessionIds` 证明归属，绝不添加伪 header 字段。
- 精确 finance roster 恰 40，逐项 resolve 无 broken；`inspectCompositions(agent.ctx)` 检查 floor、role、skill registry/provider/tool 的模块来源与 `leakedServices`。
- 每个真实 role Agent 创建后调用公开 `systemPrompt.assemble({scope:agent,agent,signal})`，要求恰一个 `deployment:persona-prefix` section，与 `assets/<role.prompt.adaptedPath>` 完整正文仅作 CRLF→LF、trim 首尾后的文本逐字比较。Native Persona 公共实现将 `config.prefix` 原文注册为该 section，不添加可剥除 wrapper；不做包含一句话等宽松匹配。保存 expected/native 两个 canonical SHA，但不 dump prompt；另核对 raw asset SHA 等于 manifest adaptedSha256，canonical 证据不替代原始 SHA 审计。40 项及 distinct 汇总均在模型启动前的能力门禁内。
- `agentPresets.serviceFor(agent,'skills')` 获取每个角色自己的 registry。当前公共合同无 `serviceForScope`，没有探 private API；每 role 完整 list/get，另累计至少 63 个独立真实 skill 内容 SHA。未知、默认用户技能与未授权金融角色技能均不可 get。
- `tools.schemas(agent)` 核对精确工具集合、所属三 Worker enum、Worker 无委派、Writer 无金融查询及无全功能 shell/global-write。
- 所有执行反例与成功读/创建/edit/CAS 都走 `tools.execute({agent,name,arguments,callId,signal})`，通过 `agents.withInitiator` 保留真实因果归属。无直接调用 RoleFilesystem/helper/ToolDefinition.execute 冒充 dispatcher。
- 原始 TEST_ONLY canary 拒写、穿越、绝对路径、UNC、ADS、跨 TEST_ONLY Session、指向本 UUID 内 outside 目录的 junction、原生只读模式、create-if-absent、正常 edit 和过期 CAS。保留 native error，不把任意无关错误都当预期拒绝。
- Gateway 直接使用原生 `typertGateway.invoke` + 独立 owner Peer；畸形 Catalog/prepareDraft 参数须由 `gateway/input-invalid` 或 `gateway/arguments-invalid` 拒绝。校验真实 10/30/63/41/29 诊断、Worker 拒启动、未 Ready Workspace 拒绝、41 命令逐目标显式选择、29 steering 正确/错误角色。draft intent 不等于真实点击/Client composer 预填。
- `systemPrompt.assemble` + `tokenMeter.estimateMessage/measure` 记录两个 main 的原生 SystemPrompt sections/contexts 与 header Tool-envelope heuristic token 估计，明确 `completeFirstTurn:false`。这不包含 `agent/pre-step` skill catalogue、用户输入或其他 pre-step 贡献，不能叫完整首轮预算，也不是 provider usage；无 service/route 时记录未测。

## 安全所有权与恢复

每次根为 `acceptance/tmp/p2-<uuid>`，带 ownership marker。原始 canary 明确是玩具颜色/数量的非金融 TEST_ONLY 文本。注册前保存原 binding 与 Workspace IDs；原生 registry 注册新目录，再通过 financeOperations 单独绑定。测试结束以最新 revision 绑定旧路径（旧 binding 为 null 时 unbind），核对恢复同一 Workspace ID/路径；revision/boundAt 会合法前进，不倒写旧持久状态。如出现并发外部 binding，拒覆盖并记录失败，留给父处理。

只注销 ownership marker、原记录路径、UUID 根和旧 Workspace IDs 排除检查共同确认的自有 Workspace；必须已经不再绑定。文件、junction、canary 与 Session 历史全部保留，不归档任何原用户 Session。测试异常只记 FAIL，不吞真实 error，也不使主 Bundle 关闭。独立检查继续执行，缺必要前置条件单独记 NOT_RUN。

## 模型与未测口径

默认 `runModelSmoke:false`。只有父明确传 `--run-model-smoke` 或明确设置 active config `runModelSmoke:true`，且本次此前全部能力/安全检查（包括工具 dispatcher 反例和 canary 完整性）均为 PASS，才允许模型启动；存在 FAIL/NOT_RUN 时模型项记录 NOT_RUN 与具体 prerequisite，绝不在权限尚未通过时执行模型。

模型启动使用公开 `subagents.startActivation({provider:'spawn',delivery:'caller',signal,request:{parent,agentPreset,maxDepth:1,cwd,prompt}})`，显式断言 source-owned Reader 在 main 所属三 Worker 白名单中，并使用独立原生低权限 Preset。`invocationPath` 明确为 `native-Service-caller-delivery`，`nativeToolDispatcherPositive:false`：这不是 native tool-subagent 正向 dispatcher 验收。工具白名单、跨角色、深度及 alternate-call 拒绝由先前真实 dispatcher 检查另证。使用 caller delivery 是为了不向 blank 测试 parent 投递完成通知、不唤醒额外 parent 模型，不绕过 child 的实际角色工具层。

探针等待真实 `activation.result`，finally 必须 `await activation.dispose()` 精确收回该次激活及其自有后代，不 cancel/drain 其他 Agent 或之后的 resume。`modelTimeoutMs` 默认 120000，必须为正安全整数且不超过 300000；builder 支持 `--model-timeout-ms=120000`。使用 `AbortSignal.any` 合并探针取消与超时，startup/result 均受 abort race 约束；超时后仍 drain startup 并 await exact dispose，不能因 race 返回就遗留模型后台。宿主若无法完成 cancellation/teardown，记录真实错误而不声称模型完成。

只从真实 child history 投影 subagent ID、角色/cwd/depth、实际 canary read 的调用与成功结果、allowlisted provider/model、assistant usage、有限 toy 输出及退出原因，不保存完整 request header、provider replayState 或凭据。检查真实结果包含文件中的玩具颜色与数量，但 prompt 不提供这些预期答案；没有硬编码模型结果。运行前后检查测试 parent 仍 idle/blank、无 user/turn/step/request/assistant/inbox 活动，并在 exact disposal 后读取 child 历史而非 resume。未调用模型始终为 `modelSmoke.status:NOT_RUN`，即使能力检查通过，也不能算金融业务 E2E。

已开始 root Session 的改绑反例使用公开 `agentPresets.select(agent,preset)`，不用调用者自负责 blank 检查的 `recompose`。仅在 `runModelSmoke:true` 且 caller-model 及前置能力安全检查 PASS 后，对第二个自有 main root 注册单调 deny-all 工具 guard，提交一个真实非金融 toy prompt，立即 `sessionController.cancel` 并 await `whenIdle`，从 native history 确认真实 `turn/start` 后，再断言切换至另一个有效 main 被 `agent-preset/locked` / `already started` 拒绝。不能因未知目标、缺依赖等其他错误算 PASS；不改 header、不 append 伪事件。取消只作用于该新增测试 root，guard 保留到 quiescent（若失败则保留至该 Agent disposal）；没有显式开启模型时 `startedRootPresetRebind.status:NOT_RUN`。

active 的总状态仅表示已执行能力检查，不表示 P2 全部完成；`validationScope` 明确为 `NATIVE_CAPABILITY_SMOKE_NOT_FULL_P2_ACCEPTANCE`。禁用/重新启用/卸载生命周期、真实鼠标点击、商业数据、Office 产物与真实业务 E2E，不能从本能力烟测推定通过。
