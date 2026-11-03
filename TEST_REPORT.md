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
