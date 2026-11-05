# P4 Task Templates v1 — intake only

状态：PURE_UNIT_IMPLEMENTED / NATIVE_INTEGRATION_NOT_RUN / P4_NOT_ACCEPTED。范围仅含[纯函数模块](<../src/business/task-templates.js>)、[单元测试](<../tests/business-task-templates.test.js>)及本地TAP证据；没有Root/Remote/工具注册、Profile、模型调用、商业数据请求或Office生成。源业务依据[十业务映射](<P4_BUSINESS_MAP.md#L1-L156>)，不改[P4验收标准](<../acceptance/P4.md#L1-L49>)或P3 PARTIAL。

## API

```js
import { createBusinessTaskTemplates } from './src/business/task-templates.js'
const templates = createBusinessTaskTemplates(z) // existing Zod 4; factory has no external lexical dependencies
const headers = templates.list()               // { templateVersion, constraints, templates: [ten short headers] }
const detail = templates.describe(presetId)     // deferred inputSchema, workers, sources, checkpoints, outputs, gaps
const result = templates.validate(presetId, input)
```

- `presetId`只能为10个现有main exact IDs；Worker、alias或未知ID抛`BUSINESS_PRESET_UNKNOWN`。输入不能自行传role/Agent/Session/凭据/endpoint/命令/code/approval字段。
- `validate`成功仅为`VALID_INTAKE_DECLARATION`及独立copy的`declaration`；不是来源、许可、财务结果或可执行状态。失败为`INVALID_INPUT`，最多12项`{path,code}`，不回显凭据/错误输入。无自动填充成功样例。
- 两种结果均保留`verification`：`fileRead/sha256/authorization/source=NOT_DONE`，`office/nativeWorkers=NOT_RUN`。`describe`同样标`P3_MANAGER_GAP`、DRAFT_REVIEW_REQUIRED。本模块不能授权或恢复MCP连接。

## 十种有区别的输入范围

| exact main preset ID | 业务专属输入，不是通用report payload |
|---|---|
| `finance-pitch-agent` | target、situation/sector、5–8 peers、5–10 precedents、financials/assumptions、银行PPT模板；保留四方法及缺LBO/comps原件 |
| `finance-market-researcher` | sector/angle/universe、8–15 peers、dated facts、screen criteria、3–5 ideas、是否slides |
| `finance-earnings-reviewer` | ticker/quarter、已有coverage.xlsx、actual/consensus/prior、完整transcript/release refs、release/consensus dates、guidance缺省声明、wrapper/full-analysis分支 |
| `finance-meeting-prep-agent` | client/event/meeting date、relationship、holdings、IPS/benchmarks、communications和market context |
| `finance-model-builder` | **direct dcf-model子集**，3–5 historical FY、5 forecast FY、financials/assumptions、terminal g/WACC/diluted shares；不是先comps的完整`/dcf`命令，也未覆盖所有原model types |
| `finance-gl-reconciler` | entity/trade-date/asset-class、GL/subledger/transaction证据、金额与数量tolerance；无posting |
| `finance-kyc-screener` | applicant/packet/review date、所有named-party refs、documents、firm rules grid/version、screening snapshot；无clearance |
| `finance-valuation-reviewer` | fund/quarter、GP packages、firm policy、portfolio/prior/budget、waterfall terms与LP allocations；不是deal DCF |
| `finance-month-end-closer` | entity/YYYY-MM、整月TB/prior/budget、accrual policy、support/activity/materiality；仅JE草稿 |
| `finance-statement-auditor` | fund/quarter/LP statement batch、独立NAV pack、commitment register、prior/可选next-period、0.01 tolerance；不是generic财报审计 |

## 输入与校验边界

- 所有对象strict，所有字符串/数组/数值有界；总JSON最多65,536 UTF-8 bytes、12,000节点、深度10。拒非JSON、循环、稀疏数组、accessors及不可序列化结构；读取声明之前不会执行getter。路径最多512字符、canonical workspace-relative forward-slash，拒absolute/UNC/backslash/traversal/ADS/设备名/百分号编码；这是**声明语法检查**，不是真实filesystem containment或symlink验证。
- 每个`inputFileRefs`有ref、path、lowercase SHA-256、fileType、entityRefs、periodRefs、sourceRef；type允许json/txt/csv/xlsx/docx/pptx/pdf。后缀相符、引用唯一可解析、文件业务scope交集存在，但不读取文件、校验实际SHA、识别Office内容或证明文件存在。技术提取和Office支持仍NOT_RUN。
- `classification`显式TEST_ONLY/USER_PROVIDED/UNSOURCED，sourceIndex每项必须一致；sourceAsOf≤availableAt≤asOf；actual/record期间不得晚于asOf。实体、期间、币种/scale、会计/合并口径与来源索引是**P4版本化intake adaptation**，不是伪称原Worker output schema已有；原schema未改。
- 另做业务cross-check：ticker/client/fund/internal scheme、quarter/month/instant类型、earnings chronology与90日current-event停止/replay区分、DCF g<WACC/正shares/有序年度、GL/review dates、完整close month、PPT/XLSX指定输入。更深的财务计算、文件内容、期间匹配、来源许可及用户选择必须在实际运行另行验证；JSON Schema不能完整表达这些refinement，`describe.crossFieldRules`明示差异。
- `sourceCheckpoints`保存角色原review与方法原节点：DCF五分节和build/audit-before-sensitivity分别存在，另保留pitch的三表/LBO/comps及market outline节点。Main/Host问人、Workers仅relay；没有可由输入自报已审批字段。P5强制Gate未实现。

## 发现成本与测试证据

2026-11-05实际命令：bundled Node `--test --test-reporter=tap --test-reporter-destination=acceptance/P4-task-template-tests.tap tests/business-task-templates.test.js`，**17/17纯单测通过**，完整本地证据见[TAP归档](<../acceptance/P4-task-template-tests.tap>)。覆盖10个不同最小TEST_ONLY声明及逐业务stopcase，strict/credential/identity/code/endpoint/approval拒绝，路径/byte/structure/date/index边界、deferred JSON Schema序列化、VM内factory自包含和真实manifest 10×3 Worker归属/来源坐标。源码复审复现并修复了伪造null-root prototype可执行继承toJSON getter的问题：现以descriptor-only native Object/Array prototype检查拒绝伪造prototype和Array子类，回归确认getter不执行，正常null-prototype及cross-realm plain JSON仍有效；API frozen及exact三方法也明确断言。测试只有虚构引用，未创建任何所指输入文件，也未声称真实MCP或Office结果。

未增加任何模型工具header。仅测同口径JSON序列化UTF-8大小：list 2,842 bytes；单项describe 7,540–12,362 bytes，详细schema不在list首包。此为字节数，不冒充token或provider usage，也不是首轮Prompt成本验收。

后续Parent可把纯函数接到自己认可的窄原生入口，但须另行schema/permission/生命周期/实际Worker/数据及Office验收；本模块不提供执行pipeline、原件写入、通用代码或任何正式业务动作。
