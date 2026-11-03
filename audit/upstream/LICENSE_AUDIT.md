# 上游许可证、归属和集成审计

## 范围与结论

- 根 README 声明 Apache-2.0；实际读取全部6个许可证文件，均为 Apache License Version 2.0。
- 全树未发现独立 NOTICE/COPYING 文件；这是本地文件清点结论，不是第三方服务无额外合同的保证。
- S&P Global 的插件及三个 Skill 各带 LICENSE，含 `Copyright 2026-present Kensho Technologies, LLC.`；必须随迁移保留，不能只保留根许可证。
- LSEG manifest author 为 LSEG，本地无单独 LSEG LICENSE；按根仓库 Apache-2.0 证据记录，但不推定其商业数据/API 已获授权。
- 根与 skill-creator 的许可证附录 copyright 是未填占位符 `[yyyy] [name of copyright owner]`；不可把它伪造成人名/年份的正式通知。

## 许可证文件 SHA256

|文件|SPDX|SHA256|
|---|---|---|
|[LICENSE](<C:/Users/Administrator/Downloads/financial-services-main/LICENSE>)|Apache-2.0|`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`|
|[plugins/partner-built/spglobal/LICENSE](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/LICENSE>)|Apache-2.0|`6d52428205148726e444e00abc2138ca3f73a0e7f49202e400c5e8c14269e867`|
|[plugins/partner-built/spglobal/skills/earnings-preview-beta/LICENSE](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/skills/earnings-preview-beta/LICENSE>)|Apache-2.0|`6d52428205148726e444e00abc2138ca3f73a0e7f49202e400c5e8c14269e867`|
|[plugins/partner-built/spglobal/skills/funding-digest/LICENSE](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/skills/funding-digest/LICENSE>)|Apache-2.0|`6d52428205148726e444e00abc2138ca3f73a0e7f49202e400c5e8c14269e867`|
|[plugins/partner-built/spglobal/skills/tear-sheet/LICENSE](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/skills/tear-sheet/LICENSE>)|Apache-2.0|`6d52428205148726e444e00abc2138ca3f73a0e7f49202e400c5e8c14269e867`|
|[plugins/vertical-plugins/financial-analysis/skills/skill-creator/LICENSE.txt](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/skills/skill-creator/LICENSE.txt>)|Apache-2.0|`58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd`|

## 分发义务

1. 分发上游或衍生源码/产物时附 Apache-2.0 完整文本（§4(a)）。
2. 修改过的上游文件必须有醒目变更说明（§4(b)）；保留适用 copyright/patent/trademark/attribution（§4(c)）。
3. 本地无 NOTICE 可复制；建议最终 Bundle 的 attribution/NOTICE 列 Anthropic Financial Services、LSEG、Kensho/S&P 来源及所有本地路径/hash；不要将自行添加 NOTICE 说成上游已有。
4. Apache-2.0 不授予品牌/商标使用许可（§6），也不授予商业金融数据、客户文档、付费 API 或租户凭据的授权。
5. 此为源码证据审计，不是法律意见。第三方库安装许可尚需在实际 Bundle lockfile 形成后另审；本次未安装依赖。

## 商业集成边界与差异

- [README.md:119](<C:/Users/Administrator/Downloads/financial-services-main/README.md#L119>) 声称 all connectors centralized；实际 financial-analysis 有12个 server，另 partner 2配置，总14记录/13独立URL。README表中的“11”已落后于实际文件。
- financial-analysis LSEG URL 以 `/lfa/mcp` 结尾；partner LSEG 以 `/lfa/mcp/server-cl` 结尾。不可按相同名称静默覆盖。
- core S&P 键 `sp-global` 与 partner 键 `spglobal` 指向相同URL，别名可显式映射但需保留来源。
- [plugins/partner-built/spglobal/README.md:14](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/README.md#L14>)、25、32、39明确 subscription；[plugins/partner-built/lseg/README.md:59](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/lseg/README.md#L59>) 要求 credentials 和 data entitlements。
- 所有 MCP 仅记录声明配置：NOT_CONFIGURED；未安装、未连接、未验证授权、未执行数据查询。未读取任何凭据。
- Managed Agents API、Cowork、Claude Office add-in 安装流程并非 DSH 插件格式或 DSH Office 的等价能力。M365 涉 Azure admin consent、Graph 用户属性与云资源，不应自动运行或以文件生成冒充已部署。

|源配置|server key|URL|状态|
|---|---|---|---|
|[plugins/partner-built/lseg/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/lseg/.mcp.json>)|lseg|`https://api.analytics.lseg.com/lfa/mcp/server-cl`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/partner-built/spglobal/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/.mcp.json>)|spglobal|`https://kfinance.kensho.com/integrations/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|daloopa|`https://mcp.daloopa.com/server/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|morningstar|`https://mcp.morningstar.com/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|sp-global|`https://kfinance.kensho.com/integrations/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|factset|`https://mcp.factset.com/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|moodys|`https://api.moodys.com/genai-ready-data/m1/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|mtnewswire|`https://vast-mcp.blueskyapi.com/mtnewswires`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|aiera|`https://mcp-pub.aiera.com`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|lseg|`https://api.analytics.lseg.com/lfa/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|pitchbook|`https://premium.mcp.pitchbook.com/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|chronograph|`https://ai.chronograph.pe/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|egnyte|`https://mcp-server.egnyte.com/mcp`|NOT_CONFIGURED / NOT_VERIFIED|
|[plugins/vertical-plugins/financial-analysis/.mcp.json](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/financial-analysis/.mcp.json>)|box|`https://mcp.box.com`|NOT_CONFIGURED / NOT_VERIFIED|

## 安装文档已核验

- [README.md:48](<C:/Users/Administrator/Downloads/financial-services-main/README.md#L48>)：Cowork URL/ZIP、Claude Code marketplace/install、Managed Agents deploy；这些不是 DSH 安装规范。
- [plugins/vertical-plugins/investment-banking/README.md:11](<C:/Users/Administrator/Downloads/financial-services-main/plugins/vertical-plugins/investment-banking/README.md#L11>)：Claude --plugin-dir；[plugins/partner-built/lseg/README.md:53](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/lseg/README.md#L53>)：claude plugins add；[plugins/partner-built/spglobal/README.md:38](<C:/Users/Administrator/Downloads/financial-services-main/plugins/partner-built/spglobal/README.md#L38>)：订阅、Cowork和个别Skill安装。
- [claude-for-msft-365-install/README.md:6](<C:/Users/Administrator/Downloads/financial-services-main/claude-for-msft-365-install/README.md#L6>)：单独 Claude Code 安装及更新、租户 bootstrap；其脚本中涉及清缓存/Graph/云配置，未执行。
- 上游 [scripts/check.py:26](<C:/Users/Administrator/Downloads/financial-services-main/scripts/check.py#L26>) 会安装 git hooks，[scripts/sync-agent-skills.py:35](<C:/Users/Administrator/Downloads/financial-services-main/scripts/sync-agent-skills.py#L35>) 会删除并重写技能目录；只读审计未执行这两个脚本。
