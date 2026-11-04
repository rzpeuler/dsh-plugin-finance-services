# P2 资产适配与整合契约

## 范围与证据

本子任务只生成资产，不安装 Bundle、不修改 Profile、不实现角色执行器或原生 Loader。真实 Loader、Session、Subagent、权限执行由父任务验证；这里的静态测试不是金融业务 E2E，也不是原生技能发现的模拟。

上游源树 SHA-256：`1345d96cb71838806b855380bc55666c8ab642430260e8a5e9511c32cd11e18b`。完整 363 件公开源文件逐字节保留为只读归档；没有执行上游脚本、下载商业数据或引入凭据。

- [统一 manifest](../assets/agent-manifest.json)：40 个角色、63 个技能、111 个技能来源、41 条完整命令、29 个 steering 样例。
- [适配生成器](../scripts/migrate_assets.py)：stdlib Python，读取 P0 JSON 证据和只读上游源树。
- [16 项静态测试](../tests/assets.test.js)：重算整树、每件资源与 Prompt SHA、来源、权限基线、审核坐标和每角色直接技能目录。
- [机器验收记录](../acceptance/P2-assets.json)：真实测试时间、测试文件 SHA、通过数以及尚未进行的真实 Loader / 业务验收。
- [来源引用清单](../assets/asset-references.json)：全部 P0 引用位置、原文、行号、原件和可解析目标 SHA。
- [归属与修改声明](../assets/NOTICE.md)：六份原始许可及 Kensho 声明全部保留；S&P 技能目录也保留其自身 LICENSE。

## Manifest 读取约定

`schemaVersion: 1`。所有目标 `prompt.adaptedPath`、`skillRoot`、`skills[].directory`、`commands[].promptPath`、`licenses[].archivePath` 均相对 assets 根，不带 `assets/` 前缀。`source.path` 和 `prompt.originalPath` 则相对上游根；可在 source-archive 的相同相对路径找到其未改原件。

主角色 ID 为 `finance-<mainSlug>`；Worker ID 为 `finance-<mainSlug>-<原YAML文件stem>`，而 `name` 保留原 Worker 名字。例如主 `finance-pitch-agent`，Worker `finance-pitch-agent-researcher` 的原名为 `pitch-researcher`。

`builtinTools`、`allowedMcpServers` 精确来自 Managed YAML，不从 Cowork Markdown frontmatter 提权。只有 10 个指定叶角色为 writer，writer 的 MCP 列表为空。`shellRestricted:true` 只标记两个源 Bash 例外；它不是开放 shell 的许可。`exposedFileTools` 是源列表与 read/grep/glob/write/edit 的交集，运行时不得把 `builtinTools` 中的 bash 直接装配为 shell。

Worker 的 `skillNames` 恰等于源 YAML，不继承主角色。主角色保留 `originalSkillNames`，并以 `addedSkillScope` 明示相同业务域的额外发现范围，合计覆盖全部 63 名称；扩展技能绝不扩大 MCP、写、shell 或委派权限。每个角色有真实的直接技能根，零技能角色也有根目录及 .scope 元数据。所有目录均为可分发常规文件，不使用 symlink/junction。

## Prompt 与技能改动

主 Prompt 移除 Markdown frontmatter，保留全部业务正文。Worker 原文保留；其 `originalPath` 指向包含完整原 Prompt 的 YAML，`originalSha256` 是该原件 SHA，额外的 `originalTextSha256` 对应抽取出的原系统正文。

适配 Prompt 在正文前加入醒目平台、低权限、Worker 原名到 preset ID 和工具映射说明。平台调用只能按实际可见 schema 使用原生委派或 `finance_data_query`，不得伪造 CMA API。商业源 P3 尚未配置，Office/脚本执行 P4 尚待适配。源 `./out` 约定改为运行时分配的财务成果目录，而不更改 Session 初始 cwd。

技能保留第一行起的完整原 frontmatter；其后插入 DSH 修改标记、原 SHA、限制及缺失资源引用。所有参考、脚本、assets、LICENSE 等完整文件均复制，不只复制 SKILL.md。原始方法完整保留，只有旧输出目录引用做平台替换。全部 40 个角色 Prompt 已检查，不含会触发 nativePersona 严格插值的未知双花括号变量。

保留 13 个主审核节点和 20 组 / 44 个条件步骤的原文、行号及 SHA；本阶段不声称 P5 确定性 Gate 已实现。条件技能审核仅在使用该方法时适用；Worker 的审核请求需交给主角色/Host。

## 命令与 steering

命令正文逐字节保留。按原命令所属业务域、正文明确涉及技能和原 Agent 技能关联给出目标；不使用新增发现范围冒充源授权。无法唯一判定时 `targetPresetId:null`，`targetPresetIds/targetPresetChoices` 给出明确选择，`selectionRequired:true`，必须用户先选角色再创建原生草稿。没有自动提交或自动执行入口。

41 条源金融命令中实际没有 fund-admin 命令组；fund-admin 技能仍对应 GL/KYC/valuation/close/statement 角色。29 个 steering 条目均有 `id/title/prompt/targetPresetId/source`，只是可选草稿样例，不代表执行记录或真实客户数据。

## 真实限制

- `lbo-model`：源缺 `LBO_Model.xlsx`，原标准模板路线 **BLOCKED**。
- `comps-analysis`：源缺 `comps_example.xlsx`，原示例模板路线 **BLOCKED**。
- `fsi-strip-profile`：源缺 Nike PowerPoint 示例，相关路线 **BLOCKED**。
- 缺件均保留精确来源与 SHA，不生成假模板；用户提供真实模板后只能另走经授权的适配路线。
- `/mnt/...`、`recalc.py` 等未随源提供的执行环境标记为 **EXTERNAL_RUNTIME_ADAPTATION_REQUIRED**；P2 不声称可直接运行。
- source-archive 只是只读溯源，不可注册为技能根、插件、安装入口或可执行脚本目录；角色只应得到自身 role-skills 根的读取范围。

## 重跑与验收

运行生成器后执行 `node --test tests/assets.test.js`。如需更新机器验收证据，在 PowerShell 先设置 `$env:DSH_RECORD_ASSET_ACCEPTANCE='1'` 再运行测试；只有全部测试通过才更新记录。

生成器只写其资产和验收记录，不删除文件，不动上游/用户数据。所有产物有内容 SHA 所有权账本；如用户修改过某个产物，重跑会拒绝覆盖。只有 manifest 与测试文件 SHA 都不变时，重跑才保留已通过的测试证据。已实际验证重复生成后 16/16 测试仍通过。
