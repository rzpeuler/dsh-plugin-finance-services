# A 股数据接入：FinanceData 当前契约设计

> 当前唯一活动契约与服务入口均使用无版本后缀的 canonical 名称。FPROV-01 的补充合同见 [Adapter/授权/PIT 合同](FPROV01-ADAPTER-CONTRACT.md) 与 [来源矩阵](FPROV01-SOURCE-MATRIX.md)，优先于下文旧许可表述。A-share-only model Data Query、Client Data Sources UI、三个 `TEST_ONLY` CNEquity Reader factories，以及独立 Eastmoney/THS/TDX source Adapter package 已实现。数据源适配器仍未安装或真实查询；来源条款、模型处理/会话日志许可及当前 DSH Profile 接入未完成。不宣称 GUI 验证。旧 `financial_data` grants 不迁移、不读取、保持惰性。

## 目标与决策

- 继续用 `financeData` 做唯一面向 Agent 的只读查询边界；Adapter 在 Host 内映射数据，不把 raw MCP、SQL 或通用网络工具交给 Agent。
- 唯一 FinanceData package/runtime entry 为 `@local/dsh-financial-services/data`；Schema 文档子路径为 `@local/dsh-financial-services/data-contracts`。Host 服务为 `financeData`，Remote 只提供 `catalog`、`setBindings`、`follow`。当前 Registry/Policy 使用独立 `financial_data_current` durable domain。旧 `financial_data` grants 保留但惰性，不迁移、不读取、不继承。带 V1/V2 或数值后缀的早期 API 标识仅作为历史迁移材料，不属于当前服务。
- 新 capability `corporate.actions` 专门表达分红、送转、配股、拆并股等事件；`filings` 仍表示公告/原始披露记录，两者通过文件/公告证据关联，不相互冒充。活动模型查询仅开放已列明的 A 股股票能力，要求 `market=CN` 与六位 `.SH/.SZ/.BJ` ticker；代码形状不证明普通股资格，Adapter 必须执行显式、默认空的普通股 allowlist。
- Adapter 每个实例只代表一个底层来源；不得把 EastMoney、TDX、CNINFO、Baostock 等混合行统称成单一上游。CNEquity Reader 若从一个 Lake 读多源数据，必须按 `source` 将结果隔离到 source-specific Adapter，或在用户授权模型中显式声明 aggregate source；默认不聚合。

## 时间与 PIT 语义

`Query.temporalMode` 必填或默认 `strict`，可选值：

- `strict`：需要源提供精确可验证的 timestamp availability，且修订证据满足完整/单记录约束；历史回填当前值不合格。
- `date_bounded`：仅在调用方显式选择时接受 date-only 公告/发布日；保存原始日期和 IANA 时区，`availableAt` 按下一当地午夜作保守界限并返回醒目 warning。仍禁止把回填/重述当前值映射到原公告日。
- `current_only`：只用于当前状态/当前快照；Observation 记录真实本地 `capturedAt/retrievedAt`，不声称在用户请求时刻已经可得。Query.asOf 只作为请求时点的近期性闸门（与 Host 查询时钟相差不超过 300 秒），本地读取捕获时间可以晚于请求时刻；`maxAgeSeconds` 仍以 `revisionEvidence.capturedAt` 的源/行抓取时间评估，不能通过重读 Lake 重置过期数据的年龄。结果必须带 `CURRENT_ONLY_SNAPSHOT` 并禁止用于历史回测/历史 as-of。

每条 Observation 使用 discriminated `availabilityEvidence`，不再用人为午夜时间伪装源 timestamp：

- `timestamp` 分支：源发布时间、可得时间均有可验证 offset；
- `date` 分支：源发布日期、时区、保守 `availableAt` 与 `next_local_midnight` 规则；
- `current_snapshot` 分支：仅实际捕获时间，不声明历史发布时间。

Normalized warnings 使用稳定代码；含 date evidence 的结果必须带 `DATE_BOUNDED_AVAILABILITY`，含 current snapshot 的结果必须带 `CURRENT_ONLY_SNAPSHOT`，并明确实际 capture/retrieval 时点且不保证请求时点的可得性或任何历史 as-of。空泛的非空文本不作为降级披露证据。

`maxAgeSeconds` 必须用保守数据年龄：timestamp 模式从 `sourcePublishedAt` 计算；date 模式按源日期在声明时区内最早可能时点计算（不得用较晚的 next-midnight 边界让数据显得更新）；current_only 使用 `revisionEvidence.capturedAt` 的源/行抓取时间，而本次本地 `capturedAt` 仅证明刚刚读取过。

`actual/estimate/forecast` 与 PIT 质量是正交维度。`actual + reconstructed` 不等于 strict PIT。缺失/未知时间不从 retrievedAt、报告期或日期午夜推断。符合 strict/date_bounded 的 availableAt 必须不晚于 query.asOf。

`prices.history` 必须显式标明 `priceAdjustment`（`none|qfq|hfq|total_return`），AdapterCapability 只声明实际支持的模式；初始默认只允许已验证的 `none`。OHLC 的单位是 CNY/share（`currency_per_share`），成交额是 CNY，成交量是 shares；不同维度或币种不得互转，`total_return` 在 corporate-action/factor 证据未验证前禁用。

## 修订链与来源

- 每个 Observation 保留源稳定 `revision`，并新增 `revisionEvidence`：`chainId`、链状态（`complete|single_record|partial|unknown`）、`supersedes`、`changeType`、源记录/公告 ID、实际 `capturedAt`、证据 Reference；允许按许可保存的 raw digest 可选，但不强制保留原始载荷。
- strict 查询只接受链状态 `complete` 或有来源证据支持的 `single_record`；缺失、循环、矛盾或不完整链一律拒绝 strict，而不是用 adapter/content hash 冒充来源 revision。
- Adapter metadata `sourceId` 是实际来源；Provenance 同时保存 Adapter/mapper 版本、原值/单位、源记录证据。引用必须无凭据、稳定且 credential-free；行版本与 Adapter 版本不得混同。

## 公司行为事件

`corporate.actions` 的 AdapterResult/NormalizedResult 使用单独的 `CorporateActionRecord[]`，而非把事件塞进通用 `filings` 字段。记录至少包含 `actionId`、A 股实体、`actionType`、状态/撤销或修订、派息/配股/送转等 terms（数值、币种/比例及单位）、公告日、股权登记日、除权除息日、支付/生效日（各自可空且不可合并）、source-record Reference、可空的关联 filing Reference、availabilityEvidence 和 revisionEvidence。日期缺失要保留 null，禁止推算。`corporate.actions` Query 必须声明 `corporateActionDateBasis`，由公告/登记/除权/支付/生效日中明确选一，`period` 仅作用于所选日期；不得混用不同日期语义。

`filings` 使用独立的 `FilingRecord[]`，至少保留 source-stable filing ID、entity、filing type/title、announcement date、独立可空的 report period、filing Reference 和同一套 availability/revision evidence；初始 Query 的 `period` 必须为 range，且只按 `announcementDate` 过滤（固定日期基准，不提供可选 filing-date basis）；不暴露 report-period 日期轴；`reportPeriod` 只作为记录字段保留，绝不推断或与公告日期范围混同。

## 权限与源状态

- FPROV direct financial-source grants require a Host-persisted v1 `LicenseAssessment` on exact source/capability/purpose and positive automated-access, model-processing and session-logging rights; missing/unknown/expired/restricted evidence blocks before Adapter validation or source I/O. Legacy MCP source bindings preserve the old request-time `licensePermitted` compatibility booleans and original role allowlist. An Adapter cannot self-upgrade a direct grant.
- binding 的创建/更新是用户授权操作，只能从 Data Sources UI 调用 durable Host `setBindings`；模型工具不得创建或放宽授权，仅可 describe/query 已明确授予的 source。
- 不因端点公开、匿名 `NONE` 认证、local Lake 存在、Adapter `READY` 或凭证配置而自动赋权。Data Sources UI 可记录用户审核的 LicenseAssessment；仅有状态勾选不构成外部法律意见。Eastmoney/THS/TDX 当前均为 `UNASSESSED`，真实权限未核实。
- 旧 `financial_data` grants 不复制、不读取、不用于当前授权；它们留存在原域并保持惰性。只有 `financial_data_current` 中由可信用户显式创建的 binding 可授权查询，策略 revision 由该域独立持久 CAS 管理。

## 首选 CNEquity Reader 形态

现有 CNEquity `cne serve --read-only` 有 loopback GET `/api/read/{dataset}`，窗口受限并返回 `rows + receipt`，见 [A 股来源迁移记录](../poc/A_SHARE_SOURCE_MIGRATION.md) 的限量验证。Bundle 中已实现三个 source-specific Reader factory（daily bars / annual financial statements / announcement index）；它们不是已注册 Provider，仍标记 `TEST_ONLY` 且默认拒绝授权。实现与候选使用硬边界：

- 只允许 loopback（127.0.0.1/::1），HTTPS/远端 host 不接受；HTTP redirect 必须拒绝；只做 GET；只开放明确数据集 allowlist 和字段/日期/单证券约束；响应行数、时间窗和字节数设上限。
- CNE HTTP `/api/read` 对没有 `query_date_col` 的 `instruments` 返回 422，不能靠此接口动态验证普通股类别；Reader 默认普通股 ticker allowlist 为空，用户必须先明确配置小型普通股名单（建议最多 20 个），Reader 在发请求前拒绝名单外/格式不符标的，不做全市场枚举，也不推断 ETF/LOF 为普通股。
- 不启动 CNE、不发起更新/回填、不调用 `/ops`、不查询原始 MCP；用户另行运行只读服务并配置端口。
- 对每个 dataset 读取 receipt 的来源、数据版本、PIT quality、fetched_at 和覆盖；要求 receipt 与 rows 一致。Receipt 的 `revision_id/content_digest/data_version` 是本地 Lake 版本/摘要/映射标签，不得直接填入 source `revision` 或宣称来源修订链；`replayable=true` 仅表示可复放读取，不代表 source permission、严格 PIT 或完整 revision chain。
- `daily_bars` 的历史回填不得用于早于 DSH 本地实际读取/捕获时间的 `asOf`；若只证明当前 Lake 快照，则只能走 `current_only`，`availabilityEvidence.capturedAt` 记本次本地读取时间，`revisionEvidence.capturedAt` 保留行级 `fetched_at` 并用于 `maxAgeSeconds`，二者不得混同。`financial_statement_items` 的 CNE strict exact 输出只是历史模式必要条件，仍需 source-stable 完整 revision chain；当前 `eastmoney_backfill` 被 receipt 标为 reconstructed，strict 返回零，且未证明修订链，不能冒充历史财报。若用户显式查询当前状态，可将当次 best-effort 读取标为 `current_snapshot`，不得回填到历史 asOf。日期级公告只有在完整 source-stable revision chain 另获证明后，才能显式 `date_bounded` 返回并带 `DATE_BOUNDED_AVAILABILITY` 警示；目前索引的修订链未证明。
- `corporate_actions` 的来源优先级尚不可用作 Adapter 路由：中文数据文档称 EastMoney 主源、TDX 备源，而当前 `DatasetSpec` 代码称 TDX primary、EastMoney backup，并列有 Baostock/THS 补充和 CNINFO/交易所修复；先核实哪一方代表运行配置，再做来源绑定和 quality 选择。该 DatasetSpec 的分区列是 `ex_date`；Reader 暂只可声明 `ex_date` 范围查询，除非 API/覆盖测试证明其他事件日期能完整检索；不可把除权日当公告日。

## 版本化实现面与剩余边界

已实现并测试：

- 当前运行路径使用 unversioned schemas、normalizer、fail-closed source policy/registry、独立 durable `financial_data_current` Host domain/CAS 与 canonical Remote API。可运行的旧数据源码、测试和 Adapter fixtures 已移除；仅保留明确标记为历史的 acceptance 与审计文档，不构成另一条活动数据面。
- 活动只读查询工具为 `finance_data_query`（CN ticker scope、bounded JSON、UNTRUSTED_DATA、无 source grants 时返回显式拒绝）；writers 不获数据工具。
- 当前 Client Data Sources 面板通过统一 FinanceData Remote mount；未安装到当前 Profile，未做视觉运行验证。
- 保留三个 source-specific CNEquity Reader factories 与 receipt/row consistency tests（`TEST_ONLY`）。另增加 `examples/ashare-adapters/` 独立 Host plugin，分别注册 Eastmoney daily OHLC、THS annual consensus EPS、TDX local dated-package OHLC；它们 `UNASSESSED`、空默认证券 allowlist、只声明 `CURRENT_OBSERVED`，没有自动下载、严格 PIT 或 live E2E 声明。
- 所有活动 Skills、role Prompts 与 market-facing commands 改为 mainland A-share 普通股边界；未知来源 allowlists 清空。当前能力矩阵显示 0 个注册 Provider；所有历史版本化矩阵仅作审计对照，不能理解为活动契约或迁移来源。

剩余：逐源确认 Eastmoney/THS/TDX 的 LicenseAssessment 证据；只有在 Host 允许且普通股 allowlist/数据源 grant 已核实后才可真实查询。候选包的 offline fixture/parser tests 与真实来源访问分开记录，尚未安装/启用 Adapter 或执行 Agent UI、宿主重启、真实在线查询。CNINFO/CNE Reader 仍为 TEST_ONLY 且未注册；corporate actions 暂不支持。当前 `@local/dsh-financial-services` 在 DSH Profile 的状态仍为 `absent`；本轮不修改 Profile。
