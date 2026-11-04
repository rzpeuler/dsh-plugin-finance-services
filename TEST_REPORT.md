# TEST_REPORT

## P0 源码审计（2026-11-03）

实际命令（在本Bundle根执行）：

```powershell
& 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' scripts/verify_p0.py --generate
```

结果：exit 0，12个unittest全部通过。断言包括363文件完整集合、逐文件字节SHA256/大小、全树SHA、10主Agent/30所属Worker、111金融Skill实例/63名称/类别分解、同名完整资源树相同、6许可文件、逐文件计划目标/依赖/测试非空、三份必需P0报告、当前DSH MCP包集合无Manager。

- 原始终端输出保留于 acceptance/P0-test-output.txt（PowerShell写为UTF-16，非UTF-8阅读器不能直接打开）；最终UTF-8输出为 [P0-verification-final.txt](acceptance/P0-verification-final.txt)，[结构化结果](acceptance/P0-results.json) 记录12/12 PASS。
- 上游独立验证17/17 PASS，见 [audit-validation.json](audit/upstream/audit-validation.json)。初轮有一项审计测试误把GitHub workflow path块当Managed引用，已修正测试扫描范围后通过，上游未改。
- Host离线核对51源文件hash、19行号区间、74文档链接及29安装包exports通过；83个缺失目标全.d.ts，JS缺失0；具体证据见 [Host审计](audit/host/HOST_CONTRACTS.md)。stderr中的unittest进度经PowerShell显示NativeCommandError包装，但程序退出码0且总结果OK；不是业务失败，也不隐藏这条环境记录。
- Agent审计生成器独立记录618项源SHA/行号检查，见 [验证记录](audit/agents/validation.json)。这是审计断言数，不把它加成618个业务测试。
- 已取得DSH同版本只读参照源码，clone exit0。安装包根AGENTS缺失已记录，未修改安装目录。
- 原生Plugin Manager list_bundles已成功，Profile desktop中未有本Bundle；未修改现有插件。
- Host/Client Inspect曾成功返回服务与Slot树；后续一次Client查询超时，不能凭第一次成功推定后续在线状态。具体契约见Host审计。

## 各类证据分开统计

| 层次 | 实际状态 |
|---|---|
| 上游hash/名称/目录树静态测试 | 12/12 PASS |
| Agent Prompt/权限/源位置审计 | 618检查PASS（非运行时测试） |
| Bundle build/typecheck | NOT_RUN |
| 原生Loader安装/生命周期 | NOT_RUN |
| 真实UI点击/视觉/移动端 | NOT_RUN |
| 真实Worker调用/金融业务执行 | NOT_RUN |
| Office文件交付 | NOT_RUN |
| 真实商业数据E2E | NOT_CONFIGURED / 0执行 |
| TEST_ONLY Adapter | NOT_IMPLEMENTED / 不计真实E2E |

## 已知缺口

MCP Manager接口缺失、商业授权未配置、原始标准LBO/comps/Nike示例模板未提供、平台脚本不等价、源Schema未强制等均在 [兼容矩阵](COMPATIBILITY_MATRIX.md) 和 [安全矩阵](SECURITY_MATRIX.md) 保留。P0清点通过不表示这些缺口已经实现或消除。后续阶段每项命令、失败与复测将追加独立记录。

## P1 可安装骨架（2026-11-03）

关键验收通过，详细记录见 [P1](acceptance/P1.md) 与 [结构化结果](acceptance/P1-results.json)。

- 最终单测38/38 PASS，见 [TAP](acceptance/P1-unit-tests-final.tap)。包含事件订阅/清理、路径/权限错误、并发CAS、工具Zod执行校验与非渲染Client注册/回调；注入的服务/权限故障不算真实Host或ACL验证。
- 真实当前Host/原生Loader与Gateway检查20/20 PASS：初始12、重装与清理4、卸载拒绝4。使用合法in-process owner Peer，不是浏览器点击。没有模型金融业务执行。
- 原生Plugin Manager 0.1.2安装、禁用、重启用、卸载、重装全部application=applied；live四Slot注册/撤销验证；原生Workspace/domain重开保留同一path/id/revision。
- 两次安装失败未抹去：0.1.0 Tool schema subset拒绝；0.1.1磁盘新代码但旧schema诊断重复，精确原因未证明。修复schema投影与真实单文件Host发布artifact后0.1.2成功；不能宣称正常DSH HMR不跟踪相对依赖。
- 构建/发布检查：原生lazy Client、单一Host artifact、exports/files闭包、17文件26565字节tarball、SVG XML、安装资源hash与中英元信息均核验。自有项目peer检查无问题；未修改其他插件依赖。
- 三个临时TEST_ONLY验收Bundle已卸载；两个自有测试Workspace注册已撤销，目录与canary文件保留。最终主Bundle启用、默认绑定清空、revision5。
- 仍NOT_VERIFIED：真实视觉/点击/主题/窄屏、Desktop进程重启、模型首轮token比较。仍未实现：P2角色技能、金融执行/交付/审核与数据Adapter。商业数据E2E=0，NOT_CONFIGURED。

## P2 实施中，原生验收失败（2026-11-03–04）

**不验收P2，不进入P3完成声明。** [阶段记录](acceptance/P2.md) / [结构化结果](acceptance/P2-results.json)。

- 整套本地90/90 PASS（资产16、Catalogue6、Client21、角色23、API7、Workspace17），见 [TAP](acceptance/P2-unit-tests-current.tap)。0.2.1后又执行Workspace/真实Service实例注入依赖的17项重点测试，含grant替换、旧撤销不影响新grant、源Hash漂移/卸载拒绝，全部PASS。替身不等于native provider/dispatcher。
- 源实际363文件及SHA未变，40不同persona、63全资源/111来源、41命令、29样例、13主节点和20组44条件Skill节点保留。保留6许可/Kensho；原缺模板三技能BLOCKED，未虚构。
- 构建三个自有Host插件真实导出及原生lazy Client，通过exports/metadata/SVG/源码artifact hash与40原生Preset声明检查。
- 第一次pack遗漏两个.gitignore元数据，已保留 [失败](acceptance/P2-pack-failure-001.json)。确定性完整源ZIP补保363全部原路径及1981638 bytes；[最终payload检查](acceptance/P2-packed-files.json)通过，但不是功能通过。
- 首次真正原生Host检查 **7 PASS / 91 FAIL / 509 NOT_RUN**，见 [不可覆盖记录](acceptance/P2-live-host-failure-001.json)。40声明均broken，scopeOf(ctx)为undefined；live Host仍旧P1接口/catalog不可用，尽管0.2.0安装的manifest/lib字节已验证更新。没有成功创建Session或执行模型/dispatcher。
- 探针同时传workspaceId与cwd违反原生互斥规则，已独立修正；保留旧错误，新身份retry-1 fixture已生成。不能将探针错误或前提失败计为功能通过。
- 原测试默认绑定已恢复null、revision8；只撤销自有Workspace注册，canary/目录/历史保留，原active测试Bundle已卸载。原生移除0.2.0后链接安装0.2.1候选applied，实时仍见旧实现。按宿主开发说明，替换包需要完整进程重启取得fresh JS；不启动替代server或改Scope私有Symbol/WeakMap绕过。
- Desktop重启后还须验证真实scope/63技能/两个业务Session/实际工具拒绝/Worker真实结果、Client RPC与草稿、retained-floor和token预算。视觉/商业数据/Office/审核Gate仍未通过或未实现；整体目标保持active。

### 用户重启后的复测与代理修复

- 第二次真实Host：[349 PASS / 196 FAIL / 0 NOT_RUN](acceptance/P2-live-host-failure-002.json)。40 Preset与实际Agent上下文、63独立原生Skill全文加载、真实Gateway目录和草稿intent等已通过；没有模型调用。测试绑定恢复null、revision11。
- 失败集中于服务facade引用比较错误；已改为每Agent当前grant及source/Prompt SHA证明。真实Cordis Service多facade、root替换/关闭、held executor与漂移新增回归通过；角色26项、[全套93项](acceptance/P2-unit-tests-proxy-fix.tap)通过。新增测试曾直接assert.rejects一个Fiber导致用法错误，已改async await Fiber，未修改生产限制做绿。
- 原生管理器明确返回restart-required/unmanaged-plugin；Preset外部保留的角色代码尚未刷新，修复的真实dispatch仍NOT_RUN，不能把本地绿当原生绿。
- 已准备新版无模型探针：40 persona全文canonical/raw SHA、同main独立Session、作用域/权限实际执行。可选真实Worker改为caller-delivery、能力检查全PASS前不启动、有限时预算与精确activation清理；不冒充正向工具dispatcher或金融E2E。
- 原生Client fixture的7项JS语法及构建检查通过，严格JSON/UTF-8界限与plain-only安全导航门禁已review；尚未安装/执行，没有预写验收通过报告。
- 两main的SystemPrompt/Tool-envelope heuristic已获得，但遗漏pre-step Skill目录，完整首轮、provider usage与缓存收益仍NOT_MEASURED；[模型体验](docs/MODEL_EXPERIENCE.md)明确该区别。

### 本轮实际原生通过与未验收项

- 第二次完整进程重启后，[003原生能力](acceptance/P2-live-host-pass-003.json)587/587 PASS，非模型；代理修复真实生效，40 persona、63技能与逐角色dispatcher/路径/CAS等通过。
- [004追加journal](acceptance/P2-live-host-journal-004.jsonl)证明一次真实Worker模型read/输出/usage、parent无唤醒、exact activation清理及真实started-root锁均PASS。整体安装因收尾共享报告UNKNOWN open而FAILED，见[完整诊断](acceptance/P2-live-host-infrastructure-failure-004.json)；不以子项通过覆盖总失败。未知OS原因不猜Defender。
- 修复仅属TEST_ONLY记录器：append单open、50项checkpoint、仅终态atomic latest，IO错误不逃出清理。真实FS错误反例2项通过，3个清理项仍完成，无mock provider/盲重试；不因此修改产品权限。
- [独立原生恢复](acceptance/P2-live-host-recovery-004.json)46/46 PASS、recoveryStatus COMPLETE；核36自有Agent absent、5原controller live idle、child absent，marker/hash/路径匹配后仅注销owned Workspace。默认null/rev17不倒写，文件/历史保留，原失败仍FAIL。
- [禁用retained-floor](acceptance/P2-live-host-disabled.json)10/10 PASS，5原live Session未cold-resume，服务与Roster撤销后实际调用被拒；随后主Bundle恢复enabled/applied，测试包移除。
- Client原夹具无报告；retry1 Host初始化与strict注册有[checkpoint](acceptance/P2-client-diagnostic.json)，但45秒无Client apply。已确认并修测试Host同步snapshot误用.then；不能据此断言历史无报告原因。公共[Host graph](acceptance/P2-client-graph.json)验证产物路径与全部8依赖存在；Client HMR/本地mount支持实际已读，尚无页面模块队列状态。真实草稿/keep与导航恢复仍NOT_RUN。
- Worker实际provider计数已记录；完整main首轮与因果缓存优化仍未测。P2未验收，P3–P6未启动验收；商业查询、Office与金融业务E2E仍0。
