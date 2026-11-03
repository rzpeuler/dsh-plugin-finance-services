# 资产与引用完整性审计

## 完整性和证据边界

- 清点 363 个源文件，全部计算 SHA256 并分类、建议迁移路径/状态；10主Agent、30Worker、50命令（金融41、M365 9）。
- 金融Skill 111实例 / 63名称，脚本8、reference44、asset2文件；这里的分类数按实际路径（含reference/单数），不把未提供模板算作已交付。
- 扫描所有可解码UTF-8文件中的 Markdown 链接、scripts/references/assets 路径、inline code 路径、运行时绝对路径，以及YAML file/path/from_plugin/manifest。
- 扫描未访问任何上游之外业务目录、外部URL或运行时 `/mnt` `/tmp` 文件；动态构造路径和自然语言裸文件名不能由静态正则证明完备，机器清单保留候选供后续人工复核。
- 路径不存在不必然是缺陷：生成模板、教学示例、临时成果和外部运行时依赖单独标记，绝不说这些文件是 ZIP 丢失。
- 全部原始引用、源文件hash、行号、真实原句、解析目标及目标hash见 [asset-references.json](<asset-references.json>)。

## 引用计数

|状态|数量|
|---|---:|
|ANCHOR_NOT_FILE|102|
|DYNAMIC_OR_TEMPLATE_PATH|38|
|EXAMPLE_NOT_REQUIRED_ASSET|22|
|EXTERNAL_ABSOLUTE_PATH_NOT_READ|87|
|EXTERNAL_RUNTIME_PATH_NOT_BUNDLED|88|
|EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED|39|
|EXTERNAL_URL_NOT_FETCHED|29|
|GENERATED_SKILL_OUTPUT_EXAMPLE|4|
|GENERATED_TASK_OUTPUT|65|
|MISSING_LOCAL_REFERENCE|12|
|NON_FILE_SYNTAX_FALSE_POSITIVE|9|
|RESOLVED_DIRECTORY|91|
|RESOLVED_FILE|276|
|UNRESOLVED_CANDIDATE_REVIEW|29|
|USER_SUPPLIED_OR_GENERATED_TEMPLATE|7|

## 待核验/缺失本地引用（逐条保留原句）

人工确认：3种未附二进制示例/模板，分布8个Skill目录、11处引用；另有根README的advisor目录坏链1处。共12处已确认本地缺失引用，不含教学示例或运行时依赖。全树未附任何xlsx/pptx/docx/pdf/png/jpg/zip成品。
缺件不阻断P0清点完成，但P2/P4标准LBO模板路线为BLOCKED；用户自带模板须另行真实验证，不能把缺件改成“已迁移”。
下表来自静态扫描，明确缺失与例示/文档坏链以“复核判断”区分；无需联网或伪造资产即可重现。

|源位置|引用|原句|复核判断|
|---|---|---|---|
|[README.md:113](<C:/Users/Administrator/Downloads/financial-services-main/README.md#L113>)|`./claude-for-financial-advisors`|\| **[claude-for-financial-advisors](./claude-for-financial-advisors)** \| Advisor workflows: meeting prep and follow-up, compliance pre-check, prospect intake, rebalance review, alts and estate briefs, on live data from the advisor's CRM, portfolio, planning, and estate platforms. \||根README文档坏链；该本地目录不存在，不能假称已包含advisor整包|
|[plugins/agent-plugins/market-researcher/skills/comps-analysis/SKILL.md:42](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/market-researcher/skills/comps-analysis/SKILL.md#L42>)|`examples/comps_example.xlsx`|An example comparable company analysis is provided in `examples/comps_example.xlsx`. When using this or other example files in this skill directory, use them intelligently:|源码明确称is provided；4个同名目录均未提供此参考示例，影响示例保真但不等于业务方法缺失|
|[plugins/agent-plugins/model-builder/skills/comps-analysis/SKILL.md:42](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/model-builder/skills/comps-analysis/SKILL.md#L42>)|`examples/comps_example.xlsx`|An example comparable company analysis is provided in `examples/comps_example.xlsx`. When using this or other example files in this skill directory, use them intelligently:|源码明确称is provided；4个同名目录均未提供此参考示例，影响示例保真但不等于业务方法缺失|
|[plugins/agent-plugins/model-builder/skills/lbo-model/SKILL.md:15](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/model-builder/skills/lbo-model/SKILL.md#L15>)|`examples/LBO_Model.xlsx`|3. **If using the standard template**: Copy `examples/LBO_Model.xlsx` as your starting point and populate it with the user's assumptions|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/agent-plugins/model-builder/skills/lbo-model/SKILL.md:41](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/model-builder/skills/lbo-model/SKILL.md#L41>)|`examples/LBO_Model.xlsx`|* **Use the template structure** - Follow the organization in `examples/LBO_Model.xlsx` or the user's provided template. Do not invent your own layout.|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/agent-plugins/pitch-agent/skills/comps-analysis/SKILL.md:42](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/pitch-agent/skills/comps-analysis/SKILL.md#L42>)|`examples/comps_example.xlsx`|An example comparable company analysis is provided in `examples/comps_example.xlsx`. When using this or other example files in this skill directory, use them intelligently:|源码明确称is provided；4个同名目录均未提供此参考示例，影响示例保真但不等于业务方法缺失|
|[plugins/agent-plugins/pitch-agent/skills/lbo-model/SKILL.md:15](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/pitch-agent/skills/lbo-model/SKILL.md#L15>)|`examples/LBO_Model.xlsx`|3. **If using the standard template**: Copy `examples/LBO_Model.xlsx` as your starting point and populate it with the user's assumptions|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/agent-plugins/pitch-agent/skills/lbo-model/SKILL.md:41](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/pitch-agent/skills/lbo-model/SKILL.md#L41>)|`examples/LBO_Model.xlsx`|* **Use the template structure** - Follow the organization in `examples/LBO_Model.xlsx` or the user's provided template. Do not invent your own layout.|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/vertical-plugins/financial-analysis/skills/comps-analysis/SKILL.md:42](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/skills/comps-analysis/SKILL.md#L42>)|`examples/comps_example.xlsx`|An example comparable company analysis is provided in `examples/comps_example.xlsx`. When using this or other example files in this skill directory, use them intelligently:|源码明确称is provided；4个同名目录均未提供此参考示例，影响示例保真但不等于业务方法缺失|
|[plugins/vertical-plugins/financial-analysis/skills/lbo-model/SKILL.md:15](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/skills/lbo-model/SKILL.md#L15>)|`examples/LBO_Model.xlsx`|3. **If using the standard template**: Copy `examples/LBO_Model.xlsx` as your starting point and populate it with the user's assumptions|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/vertical-plugins/financial-analysis/skills/lbo-model/SKILL.md:41](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/skills/lbo-model/SKILL.md#L41>)|`examples/LBO_Model.xlsx`|* **Use the template structure** - Follow the organization in `examples/LBO_Model.xlsx` or the user's provided template. Do not invent your own layout.|源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线|
|[plugins/vertical-plugins/investment-banking/skills/strip-profile/SKILL.md:162](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/investment-banking/skills/strip-profile/SKILL.md#L162>)|`examples/Nike_Strip_Profile_Example.pptx`|See `examples/Nike_Strip_Profile_Example.pptx` for layout inspiration. Adapt colors to each company's brand.|源码要求See的视觉示例未附；不能宣称已有Nike示例成品|

## 平台运行时引用不是仓库资产

- `/mnt/skills/public/...`、`/mnt/data`、`/tmp` 等都是原 Claude/Cowork/容器约定；必须适配 DSH Office/成果目录，不可把“源仓库找不到”冒称全部是丢文件。
- `ppt-template-creator` 描述 `assets/template.pptx` 是生成或用户提供品牌模板。无通用成品 .pptx 被附带；不能将示例文件名作为预置模板能力。
- `skill-creator` 在教学段给出的 rotate_pdf、logo、font、finance/schema、FORMS/DOCX 等例子并非要求随此仓库提供。287–290行引用的两份design guide（workflows.md/output-patterns.md）实际存在且已hash，不属于缺失。
- ib-check-deck 的 extract_numbers.py 与 LSEG CONNECTORS.md 实际存在；不得仅凭有限glob结果或看到相对路径就断言缺失。

## 静态未解析候选（人工归类，不冒充路径已解析）

保留 UNRESOLVED_CANDIDATE_REVIEW 状态，不把候选计作已提供文件。逐条复核归入下列类别；含外部存储/配置/HTTP端点的项未访问、未连接、未验证远端存在性。

|人工复核类别|数量|
|---|---:|
|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|5|
|REVIEWED_DATE_LITERAL_NOT_FILE|1|
|REVIEWED_DYNAMIC_ISSUER_WEBSITE_TEMPLATE|2|
|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|8|
|REVIEWED_OFFICE_ZIP_INTERNAL_MEMBER_TEMPLATE_NOT_REPOSITORY_FILE|2|
|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|11|

|源位置|引用|原句|人工复核类别|
|---|---|---|---|
|[CLAUDE.md:31](<C:/Users/Administrator/Downloads/financial-services-main/CLAUDE.md#L31>)|`vertical-plugins/`|Run `python3 scripts/check.py` before committing — it lints every manifest, verifies all `system.file` / `skills.path` / `callable_agents.manifest` references resolve, fails if any `agent-plugins/<slug>/skills/` copy has drifted from its `vertical-plugins/` source, and rejects non-ASCII bytes in a `.ps1` without a UTF-8 BOM.|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|
|[CLAUDE.md:33](<C:/Users/Administrator/Downloads/financial-services-main/CLAUDE.md#L33>)|`vertical-plugins/`|**Keep `.ps1` files pure ASCII.** Windows PowerShell 5.1 — still the default shell on managed Windows — decodes a BOM-less `.ps1` using the machine's ANSI code page, not UTF-8. An em dash or curly quote becomes mojibake that can contain a literal `"`, which terminates a string and makes the whole script fail to *parse*. Write `--`, not `—`. This is invisible on macOS and fatal on Windows; `check.py` gates it. **Edit skills in `vertical-plugins/`**, then run `python3 scripts/sync-agent-skills.py` to propagate into the agent bundles.|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|
|[CLAUDE.md:35](<C:/Users/Administrator/Downloads/financial-services-main/CLAUDE.md#L35>)|`.claude-plugin/plugin.json`|`check.py` also self-installs a `pre-commit` hook (`git config core.hooksPath .githooks` — no Husky/Node). The hook patch-bumps any plugin's `.claude-plugin/plugin.json` `version` so a branch ends up exactly one patch ahead of `main` (bumped once, not per commit — a plugin's `version` gates update delivery to already-installed users). The `version-bump` GitHub Action enforces the same rule on PRs as a backstop. Bypass a single commit with `git commit --no-verify`; bump logic lives in `scripts/version_bump.py`.|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|
|[README.md:241](<C:/Users/Administrator/Downloads/financial-services-main/README.md#L241>)|`skills/`|- New agent → `plugins/agent-plugins/<slug>/` (with `agents/<slug>.md` + `skills/`) and a matching `managed-agent-cookbooks/<slug>/`.|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|
|[claude-for-msft-365-install/.claude/skills/verify/SKILL.md:62](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/.claude/skills/verify/SKILL.md#L62>)|`Data/Documents/wef`|Manifests live in `Data/Documents/wef`; storage lives in|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/.claude/skills/verify/SKILL.md:63](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/.claude/skills/verify/SKILL.md#L63>)|`Data/Library/WebKit/WebsiteData`|`Data/Library/WebKit/WebsiteData`. Different subtrees — the diff should show|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/access-policies.md:231](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/access-policies.md#L231>)|`"//fileserver/restricted/"`|the same separator in Windows paths (`"//fileserver/restricted/"` and|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/bootstrap.md:125](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/bootstrap.md#L125>)|`claude-excel/1.4.2`|build (e.g. `claude-excel/1.4.2`). Use it to return different skills or MCP|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/debug.md:94](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/debug.md#L94>)|`Documents/wef`|`Documents/wef` folder, alongside every other add-in.|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/debug.md:143](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/debug.md#L143>)|`Data/Documents/wef`|from the manifests (`Data/Library/WebKit/WebsiteData` vs `Data/Documents/wef`);|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/debug.md:143](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/debug.md#L143>)|`Data/Library/WebKit/WebsiteData`|from the manifests (`Data/Library/WebKit/WebsiteData` vs `Data/Documents/wef`);|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/debug.md:217](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/debug.md#L217>)|`Documents/wef`|each app's `Documents/wef`; Windows: a registry value under|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/entra-app.md:33](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/entra-app.md#L33>)|`brk-multihub://pivot.claude.ai`|\| `brk-multihub://pivot.claude.ai` \| [NAA broker](https://learn.microsoft.com/office/dev/add-ins/develop/enable-nested-app-authentication-in-your-add-in) — desktop Office and Outlook web. Missing this → `AADSTS50011` at sign-in. \||REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/entra-app.md:46](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/entra-app.md#L46>)|`entra_scope=https://cognitiveservices.azure.com/.default`|\| **Foundry direct, keyless** (`gateway_auth_source=entra` + `azure_resource_name`) \| *API permissions* → *Azure Cognitive Services* → Delegated → `user_impersonation`. No *Expose an API* step — the token is audienced to Azure's `https://cognitiveservices.azure.com`, not your own app, so set `entra_scope=https://cognitiveservices.azure.com/.default`. Also grant each user the **Cognitive Services User** role on the Foundry resource (Azure Portal → resource → *Access control (IAM)*). \||REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/entra-app.md:94](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/entra-app.md#L94>)|`brk-multihub://pivot.claude.ai`|- **Redirect URIs** are unchanged — `brk-multihub://pivot.claude.ai` and|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/export-data.md:35](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/export-data.md#L35>)|`scheme://host:port`|IndexedDB to the page's **origin** — `scheme://host:port` — exactly as Chrome|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/export-data.md:128](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/export-data.md#L128>)|`local-storage/`|it appears as a `local-storage/` folder inside each origin with nothing extra.|REVIEWED_EXTERNAL_BROWSER_OR_NETWORK_STORAGE_NOT_READ|
|[claude-for-msft-365-install/commands/manifest.md:18](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/manifest.md#L18>)|`pivot.claude.ai/manifest.xml`|\| `office` \| Excel, Word, PowerPoint \| `pivot.claude.ai/manifest.xml` \||REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/manifest.md:19](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/manifest.md#L19>)|`pivot.claude.ai/manifest-outlook-3p.xml`|\| `outlook` \| Outlook (mail + calendar) \| `pivot.claude.ai/manifest-outlook-3p.xml` \||REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/manifest.md:139](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/manifest.md#L139>)|`api://torii/x,api://other/y`|mint a token spanning two APIs (`api://torii/x,api://other/y` will fail or|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/setup.md:45](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/setup.md#L45>)|`entra_scope=https://cognitiveservices.azure.com/.default`|\| `foundry` (keyless) \| Add-in → Azure AI Foundry, per-user Entra sign-in \| Foundry resource + your Entra app \| `azure_resource_name`, `entra_sso=1`, `graph_client_id`, `entra_scope=https://cognitiveservices.azure.com/.default`, `gateway_auth_source=entra` \||REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/setup.md:200](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/setup.md#L200>)|`…/vertex_ai/v1`|`…/vertex_ai/v1`.|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[claude-for-msft-365-install/commands/setup.md:238](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/commands/setup.md#L238>)|`entra_scope=https://cognitiveservices.azure.com/.default`|`entra_scope=https://cognitiveservices.azure.com/.default`, and|REVIEWED_PROTOCOL_ENDPOINT_CONFIGURATION_OR_USER_AGENT_NOT_LOCAL_ASSET|
|[plugins/agent-plugins/earnings-reviewer/skills/earnings-analysis/references/workflow.md:39](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/earnings-reviewer/skills/earnings-analysis/references/workflow.md#L39>)|`[company].com/investors`|- Go to `investor.[company].com` or `[company].com/investors`|REVIEWED_DYNAMIC_ISSUER_WEBSITE_TEMPLATE|
|[plugins/agent-plugins/pitch-agent/skills/pitch-deck/reference/xml-reference.md:409](<C:/Users/Administrator/Downloads/financial-services-main/plugins/agent-plugins/pitch-agent/skills/pitch-deck/reference/xml-reference.md#L409>)|`ppt/slides/_rels/slideN.xml.rels`|In `ppt/slides/_rels/slideN.xml.rels`:|REVIEWED_OFFICE_ZIP_INTERNAL_MEMBER_TEMPLATE_NOT_REPOSITORY_FILE|
|[plugins/vertical-plugins/equity-research/skills/earnings-analysis/references/workflow.md:39](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/equity-research/skills/earnings-analysis/references/workflow.md#L39>)|`[company].com/investors`|- Go to `investor.[company].com` or `[company].com/investors`|REVIEWED_DYNAMIC_ISSUER_WEBSITE_TEMPLATE|
|[plugins/vertical-plugins/financial-analysis/skills/clean-data-xls/SKILL.md:30](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/skills/clean-data-xls/SKILL.md#L30>)|`3/8/26`|\| Dates \| mixed formats in the same column (`3/8/26`, `2026-03-08`, `March 8 2026`) \||REVIEWED_DATE_LITERAL_NOT_FILE|
|[plugins/vertical-plugins/investment-banking/skills/pitch-deck/reference/xml-reference.md:409](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/investment-banking/skills/pitch-deck/reference/xml-reference.md#L409>)|`ppt/slides/_rels/slideN.xml.rels`|In `ppt/slides/_rels/slideN.xml.rels`:|REVIEWED_OFFICE_ZIP_INTERNAL_MEMBER_TEMPLATE_NOT_REPOSITORY_FILE|
|[scripts/version_bump.py:5](<C:/Users/Administrator/Downloads/financial-services-main/scripts/version_bump.py#L5>)|`.claude-plugin/plugin.json`|A plugin's `.claude-plugin/plugin.json` `version` gates update delivery to|REVIEWED_CONTEXTUAL_PATH_SHORTHAND_NOT_A_CONCRETE_SOURCE_RELATIVE_DEPENDENCY|

## 源快照与可重跑

- Source tree SHA256：`1345d96cb71838806b855380bc55666c8ab642430260e8a5e9511c32cd11e18b`，1981638 bytes；无 `.git`，不记录假commit。
- 先执行 [audit_upstream.py](<audit_upstream.py>)，再执行 [render_reports.py](<render_reports.py>)；stdlib-only，不安装依赖、不导入或执行上游脚本。写入仅限脚本所在目录。
- [upstream-sha256.json](<upstream-sha256.json>) 是全文件SHA清单；[upstream-inventory.json](<upstream-inventory.json>) 是总机器清单；[audit-summary.json](<audit-summary.json>) 是计数。
- migrationTarget/status 是迁移建议，不是已实现/测试通过声明。
