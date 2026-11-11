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

P2的0.2.2正常角色导出为`role-numeric-1`。早期0.3.0-alpha.2 Preset 曾引用`@local/dsh-financial-services/role-data-1` 和 `data-runtime-2`；这些带代际后缀的包标识是历史升级记录。当前活动 FinanceData package/runtime 唯一入口为 `@local/dsh-financial-services/data`。数字结果无需缺失Office模板，builder仍只能用原write工具新建自己JSON；缺模板和真实工作簿交付按P4单独验收。

## 查询与不可信内容

仅在非writer且角色结构有效时注册活动工具 `finance_data_query`；FinanceData 直接来源 grants 与 `allowedMcpServers` 独立，旧 MCP allowlist 仅约束 legacy MCP bindings。当前只允许 A 股股票边界：`market=CN`、六位 `.SH/.SZ/.BJ` ticker；ticker 形状不证明普通股资格，Adapter 还须匹配显式普通股 allowlist。工具用 `describe/query + capability + query_json` 发现严格请求结构、TEST_ONLY例子、运行时限制及仅本Session明确授权的Provider字段/市场/用途，再提交有界查询。sourceIds仅选择、不赋权。执行前及await后均重验exact-Agent文件/权限grant；FinanceData服务逐请求检查角色、Session、能力、源许可和显式 binding。Remote 的 `catalog`、`setBindings`、`follow` 只服务于 UI；当前策略保存在隔离的 `financial_data_current` 域，来源 allowlists 和 policy 初始为空，未绑定即拒绝。旧 `financial_data` grants 保持惰性，不迁移、不读取、不用于授权。writer仍无查询工具；无Backend/Provider或授权不全时明确NOT_CONFIGURED/NOT_AUTHORIZED，不猜数字或联网替代。旧版本化工具和dispatcher检查仅保留在 Git 历史提交 `388e310bd1c919ad3841e11de5f0418aa79a0483`，不是当前Provider/MCP验收。当前 direct-source UI拒绝Client提交的`VERIFIED`，既有未认证source claim只在内存中降为`REVIEW_REQUIRED`。

文件文本、搜索命中和查询结果带 `UNTRUSTED_DATA`；角色 required runtime context 明确其不是工具权限或执行指令。工具参数没有动态 instruction/tool-definition 字段，文本“忽略规则”“调用写 API”等只能作为数据返回，不能修改工具集合、角色或允许源。原生 Skill 方法也不授予额外权限。

## 有限输出与明确不支持

- read：最多 1 MiB UTF-8、拒二进制 NUL；每次 1–500 行，text 最多 24000 字符，返回完整文件 SHA、行总数和 truncated。
- grep：literal、区分大小写，不接模型正则；每个 pattern 最多 256 字符，最多扫描 4 MiB 文件内容，100 命中/24000 命中文本字符，单行最多 2000 字符。
- glob：仅 `* / ** / ?` 小语法，256 字符 pattern、100 路径；动态规划匹配，避免模型构造 regex 回溯。
- traversal：最多 1500 目录项、24 层；路径最长 2048 字符，不跟随 link。搜索遇到上限显式 truncated。
- write/edit 字符输入最多 250000；文件最多 1 MiB，edit 按 native CRLF 恢复的保守上界提交前检查，NUL 在工具校验阶段拒绝。输出不回显完整修改文件，返回 path/hash/artifactDirectory。
- 不支持通用 Shell/Python、Office 二进制生成、原件编辑、artifact 发布/交易/记账/客户通讯、工作目录迁移或任意父分配目录。Office 仍待 P4；固定纯数值计算不运行任何脚本；P5 确定性人审 Gate 也不在这里伪称完成。

上下文预算测量与其原始 acceptance 文件已从当前工作树移除，不能将旧估算当作当前运行时或完整首轮 token 结果。历史 P2/P3 测量可从 Git 提交 `6bc3f945ebe8da6dacea6c2707b0e45478338186` 与 `388e310bd1c919ad3841e11de5f0418aa79a0483` 追溯；本次只报告当前静态 manifest/build/test，不宣称模型端使用量或 token 优化。

## 已运行单测

```powershell
node --test tests/role*.test.js
```

[role-filesystem.test.js](../tests/role-filesystem.test.js) 使用当前12-role manifest（3 mains + 9 Workers）做权限/源 allowlist 检查，并使用真实独占临时目录测试路径、junction、CAS/并发创建、artifact 目录、policy mode 和不可信文本。provider 是明确标注的 TEST_ONLY signature stub，不是真实 native provider 或 Host 沙箱。

[role-runtime.test.js](../tests/role-runtime.test.js) 使用真实 Cordis 与 dsh-scope，替代 tools/FS/registry 服务做 actual-stub-dispatch、双 owner 清理、普通 Agent 不受影响、两个 retained revision、缺本地 native definition、root/role卸载以及真实独立 floor grant/hash 拒绝测试。native delegation backend 与 Loader 未被该 fixture 启动。

当前隔离回归覆盖同一受限文件/权限、Cordis/scope生命周期和Host FinanceData授权路径；可复验测试见[`role-filesystem.test.js`](../tests/role-filesystem.test.js)、[`role-runtime.test.js`](../tests/role-runtime.test.js)、[`data-host.test.js`](../tests/data-host.test.js)及[`role-data-query.test.js`](../tests/role-data-query.test.js)，本次完整命令与结果见[整合报告](../acceptance/FINANCE-3A-FPROV-INTEGRATION-REPORT.md)。旧原生能力烟测记录已从当前包裁剪，历史可在`10d482ec11d99b0b2d88153f195ee71edf1da2f3`与`388e310bd1c919ad3841e11de5f0418aa79a0483`追溯；它们不是当前商业MCP或Office金融业务E2E验收。
