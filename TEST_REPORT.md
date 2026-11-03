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
