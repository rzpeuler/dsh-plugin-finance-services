# P2 受限角色运行时

## 状态与装配要求

角色运行时已实现；本文的单测证据不是实际 Host、Loader、模型调用或金融业务 E2E。真实 40 Preset/独立技能 registry/provider/loader/native spawn 验证由父任务整合执行，不以这里的替代服务测试冒充。

入口为 [role.js](../src/role.js)，仅命名导出 `name/inject/Config/apply`，没有 default export。唯一配置为必填合法 `finance-...` 的 `roleId`，Schemastery 与执行入口严格 Zod 双重校验；模型不能提供替代 roleId、Workspace root、owner 或权限参数。依赖已有 `zod`、`@deepseek-ai/schemastery` 及保持宿主实例身份的 `@deepseek-ai/dsh-scope`。无 Node filesystem、Shell、Profile 或上游修改。

Host 提供以下同进程可信接口；manifest 与技能根由 Host 从受信安装资产读取，不由模型提交：

```js
financeOperations.roleDefinition(roleId) // Promise<Role & { skillRoots: absolute[] }>
financeOperations.skillRoot(roleId)     // 一个绝对 assets/role-skills/<id> 根
financeOperations.registerRoleRuntime(agent, roleId) // 返回同步、幂等 revoke
financeOperations.isRoleRuntimeActive(agent, roleId, { sourceSha256, adaptedPromptSha256 }) // boolean
```

角色定义校验、工具生成与 FS 执行分别在 [policy.js](../src/role/policy.js)、[tools.js](../src/role/tools.js)、[filesystem.js](../src/role/filesystem.js)。main 必须只读且所属恰三 Worker；Worker 不可再委派；writer 必须无 MCP。每个角色的 read/grep/glob/write/edit 精确保留源 builtinTools 差异，不统一添加 Read；源两个 Bash 例外不提供通用 Shell，仅这两者获得固定 `finance_model_calculate` 数值剖面；modeler只允许DCF/LBO且不可写，builder另允许三表/Comps并只能用已有工具写自己JSON成果。Office交付仍属P4。

## 原生机制与实际执行约束

安装版源码已核验：`tools.restrict({ allow: [] })` 合法，`restrict({})` 不合法；allow[] 遮罩所有祖先层，而不仅是全局层。exact Agent own-layer 注册不受该 mask 影响。因此 runtime 在 standing preset 与每个匹配的真实 Agent scope 安装 mask，自有窄工具重新注册到 Agent own 层；guard 也在对应 `agent.ctx` 注册，并以 exact Agent 比较防串扰。一个 preset revision 被多个 Agent 复用，必须通过真实 composition scope chain 与 composedPreset 两者匹配，不能仅按 role ID 广播到全进程。

只重挂本 composition 明确声明且已激活的原生 definition：所有角色为 `skill`；main 另有 `ask_user_question/send_message/list_agents/interrupt_agent`。缺模块或缺定义直接创建失败，绝不从 global 借用同名工具。重挂保持原对象身份，保留 native skill catalog 的 identity 检查。原生 list 工具须单独挂载 `@deepseek-ai/dsh-tool-subagent-control/list-agents`。

main 的 native `subagent` 使用 spawn provider、所属三 Preset allowlist、maxDepth=1，由父负责原生插件 Config；role 不造 backend 或总控。实际 dispatch guard 再确定性要求显式 `agent_preset` 为所属 Worker、`max(header.delegationDepth, options.subagentDepth) < 1`、不是已有子 Session、cwd 只能省略或等于 Session header 中的精确 Workspace 根。relative cwd `.` 也不接受。fork、workflow、通用 subagent aliases、run_code、任意 own-layer 新增工具和 Shell 都不在运行时允许集合内。main 控制/通信仍交给原生 backend 验证父子权限；Worker 不重挂问人/控制工具。

每个注册同时由 Agent effect 与 role plugin 的 effect 负责清理。每次 guard/自有 executor 都向当前 global `financeOperations` 重新验证 exact Agent、role ID、source SHA 与 adapted Prompt SHA 对应的 runtime grant；Cordis 的 context-bound Service facade 不使用代理引用相等来判断授权。创建完成后最后注册 runtime grant；卸载先撤销 grant，再移除 prompt/guard/tools/mask，旧持有的 executor 也不能继续访问。

独立 [floor.js](../src/floor.js) 是父任务实现的必要装配项：它不硬依赖 financeOperations，随 retained preset revision 保留 allow[] 与单调拒绝 guard。floor 要求 exact Agent runtime grant 与 source/prompt SHA 都仍有效。这样 role 自身禁用、根服务消失或替换后，旧 Agent 既不能重新继承 ambient 工具，也不能借仍属于 native plugin 的 own-layer subagent 发起调用。底层 native tool schema 此时可能仍可见，但 actual dispatch 被 floor 拒绝；不可把“schema 可见”误写成“获授权”。

## 文件能力与路径

Workspace 根只来自 `agent.session.header.cwd`；每次访问核对 `workingDirectory.get(agent.session)` 未变化，不接受模型传 root，不改 Worker cwd 到成果目录。读文件仅接受 Workspace-relative 路径；另外允许直接读取此角色 `skillRoots` 内的绝对资源路径。grep/glob 的目录范围有意更窄，仅支持 Workspace-relative 目录；技能 references/assets 使用 read，不枚举其他安装/用户目录。

写入仅支持 `financial-services/artifacts/<native agent.id>/...`，各 Worker/Session 独立，不支持模型选择其他 Session 或 task owner。write 调用 native `createIfAbsent`，禁止覆盖；native local provider 本身使用 wx staging + no-replace hardlink publication，而不是声称直接 target open(O_EXCL)。edit 仅自身成果，要求模型给出 read/write/edit 返回的 lowercase SHA-256，同时提供 native `FsVersion` CAS；native provider per-key 串行化竞争。所有父目录缺失创建交给 native provider，不用 Node mkdir 绕过 provider。

路径执行器拒绝 traversal、绝对写路径、UNC、drive-relative、ADS、NUL/控制字符、Windows 保留设备名/尾部点或空格、既有 symlink/junction/特殊文件。逐级 native lstat 后再 resolve + contains 校验 canonical root；edit 在读 hash 后重查路径身份，再交 native version CAS。模型无法请求覆盖原件、技能文件或其他 Session 成果。

真实 FS 调用签名：

```js
fs.resolve(path, { cwd, signal })
fs.lstat(path, { cwd }, signal)
fs.contains(rootTarget, candidateTarget)
fs.readBytes(target, signal, maxBytes)
fs.stat(target, signal)
fs.listDir(target, signal)
fs.writeText(target, text, { kind: 'createIfAbsent' }, signal, sandboxPolicy)
fs.editText(target, { oldString, newString, replaceAll: false }, { version }, signal, sandboxPolicy)
```

mutation 先调用 `sandboxPolicy.resolve({ session })`，原生 read-only 一律拒绝；即使用户 Session 是 danger-full-access，角色仍向 provider 传更窄 workspace-write policy 和原生 Workspace root，且额外执行自身 artifact containment。没有 escalation 参数、Host FS fallback 或安装路径写权限。

**威胁模型限制：**与 native fs-sandbox 的 trusted-tool 模型一致，不声称抵御拥有本地 OS 权限的恶意进程在最后检查与 syscall 之间交换 ancestor 的 TOCTOU。原生 public FS seam 自身也声明该残留；这里未改 Core/kernel。已有 symlink/junction、模型工具可发起的跨目录请求和通过 native 调用竞争覆盖都会拒绝，不能把这个明确限制写成内核级沙箱保证。

## 两源Bash例外的固定数值替代

纯数值核心为[calculation.js](../src/role/calculation.js)，不访问文件/网络/进程。恰两个源角色按ID、原始Bash授权与assigned skills联合获得`finance_model_calculate`；调用先走相同exact-Agent/grant检查。先用`{action:'describe',model:'dcf'}`取完整严格schema/example，再以`calculate`和匹配model的`input_json`计算；输入最多50000 UTF-8 bytes、结果100000 bytes，未知字段/代码/路径参数拒绝。源脚本从未因这个替代而获执行权限。

DCF遵循源net-debt权重与midyear约定；LBO限定无PIK/分红/复杂再融资的债务水瀑；三表限定无SBC/NOL/递延税的明确年度剖面；Comps仅同币种/单位/期间/asOf观察，NM返回null且不计入分位。支持范围在describe中明示，超范围不静默简化。所有结果标记TEST_ONLY或UNSOURCED、commercialReady=false、reviewRequired=true、NUMERIC_RESULT_NOT_OFFICE；这不是P5强制Gate。

新Preset正常引用`@local/dsh-financial-services/role-numeric-1`；构建保留原role artifact给既有引用，不改宿主缓存或私有符号。0.2.2已原生applied。数字结果无需缺失Office模板，builder仍只能用原write工具新建自己JSON；缺模板和真实工作簿交付按P4单独验收。

## 查询与不可信内容

仅 allowedMcpServers 非空且非 writer 才注册 `finance_data_query`；executor 再验证 exact source 属于本角色源 allowlist。P2 没有查询 adapter，所有获准请求确定性返回 `NOT_CONFIGURED`，不提供 data 字段、不调用 MCP、不推测金融数字、不联网 fallback。源 server enabled/通配配置不是写 API 授权，后续 P3 必须另实现窄 capability/source/session 执行约束。

文件文本、搜索命中和查询结果带 `UNTRUSTED_DATA`；角色 required runtime context 明确其不是工具权限或执行指令。工具参数没有动态 instruction/tool-definition 字段，文本“忽略规则”“调用写 API”等只能作为数据返回，不能修改工具集合、角色或允许源。原生 Skill 方法也不授予额外权限。

## 有限输出与明确不支持

- read：最多 1 MiB UTF-8、拒二进制 NUL；每次 1–500 行，text 最多 24000 字符，返回完整文件 SHA、行总数和 truncated。
- grep：literal、区分大小写，不接模型正则；每个 pattern 最多 256 字符，最多扫描 4 MiB 文件内容，100 命中/24000 命中文本字符，单行最多 2000 字符。
- glob：仅 `* / ** / ?` 小语法，256 字符 pattern、100 路径；动态规划匹配，避免模型构造 regex 回溯。
- traversal：最多 1500 目录项、24 层；路径最长 2048 字符，不跟随 link。搜索遇到上限显式 truncated。
- write/edit 字符输入最多 250000；文件最多 1 MiB，edit 按 native CRLF 恢复的保守上界提交前检查，NUL 在工具校验阶段拒绝。输出不回显完整修改文件，返回 path/hash/artifactDirectory。
- 不支持通用 Shell/Python、Office 二进制生成、原件编辑、artifact 发布/交易/记账/客户通讯、工作目录迁移或任意父分配目录。Office 仍待 P4；固定纯数值计算不运行任何脚本；P5 确定性人审 Gate 也不在这里伪称完成。

模型预算：新增每角色最多四个自有工具（main 三文件工具+查询，writer 三文件工具，reader按源更少），另复用原生技能/控制定义及一段 required runtime context。两计算角色以原生tokenMeter在相同范围测了前后SystemPrompt/header-tools：modeler增加61/214、builder增加68/221 tokens（总计275/289）。只属启发式header预算，不含pre-step Skill目录，不是完整首轮或provider usage；见[token对照](../acceptance/P2-controlled-compute-token-comparison.json)。

## 已运行单测

```powershell
node --test tests/role*.test.js
```

[role-filesystem.test.js](../tests/role-filesystem.test.js) 使用实际 40-role manifest 做权限/源 allowlist 检查，并使用真实独占临时目录测试路径、真实 junction、CAS/并发创建、artifact 目录、policy mode 和不可信文本。provider 是明确标注的 TEST_ONLY signature stub，不是真实 native provider 或 Host 沙箱。

[role-runtime.test.js](../tests/role-runtime.test.js) 使用真实 Cordis 与 dsh-scope，替代 tools/FS/registry 服务做 actual-stub-dispatch、双 owner 清理、普通 Agent 不受影响、两个 retained revision、缺本地 native definition、root/role卸载以及真实独立 floor grant/hash 拒绝测试。native delegation backend 与 Loader 未被该 fixture 启动。

原受限运行时局部 26 项均通过（13 文件/权限测试 + 13 Cordis/scope 生命周期测试）；Service facade 回归使用真实 Cordis Service，确认两个不同 facade 共享有效 grant 时允许执行，同时直接持有 executor 绕开 floor 仍会重验 grant/版本，root 关闭、替换或 source/prompt 漂移继续拒绝。另有[587原生能力](../acceptance/P2-live-host-pass-003.json)、[141原生计算补验](../acceptance/P2-controlled-compute-pass-003.json)、[12原生Client检查](../acceptance/P2-live-client-pass-004.json)及真实只读Worker模型的独立证据；004总IO失败仍保留。商业 MCP和Office金融业务E2E未运行，不将能力烟测记为业务交付。
