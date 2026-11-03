#!/usr/bin/env python3
"""Render reports from audit_upstream.py machine output; writes only beside itself."""
import json
from pathlib import Path
from collections import Counter
BASE = Path(__file__).resolve().parent
inv = json.loads((BASE / 'upstream-inventory.json').read_text(encoding='utf-8'))
s = inv['summary']
source = Path(inv['sourceRoot'])

def link(path, line=None):
    suffix = f'#L{line}' if line else ''
    return f'[{path}' + (f':{line}' if line else '') + f'](<{(source / path).as_posix()}{suffix}>)'

def write(name, lines):
    assert name in {'SKILL_VARIANTS.md', 'LICENSE_AUDIT.md', 'ASSET_AUDIT.md'}
    (BASE / name).write_text('\n'.join(lines) + '\n', encoding='utf-8')

lines = ['# Skill 全目录变体审计', '',
         '## 结论', '',
         f'- 金融范围：**{s["skillInstanceCountFinancial"]} 个实例 / {s["distinctSkillNamesFinancial"]} 个独立 frontmatter name**。',
         f'- 分解：6 个 vertical 包的 {s["verticalDistinctNames"]} 名称 + Agent-only 3 名称（client-review、client-report、investment-proposal）+ LSEG 8 / S&P Global 3 = 63。',
         '- M365 内部 verify 另计：全树 112 实例 / 64 名称；不是第64个金融业务 Skill。',
         '- 同名实例的 SKILL.md hash 和完整目录 hash 均完全一致；此源码快照未发现角色定向内容差异。',
         '- 迁移仍须保存全部 origin、Agent 归属和权限作用域。可以共享已证明字节相同的资产，但不能将可发现范围或权限合并为全角色通用。',
         '- 每个目录逐文件 path/hash、所有同名实例成对比较结果见 [skill-variants.json](<skill-variants.json>)；全文件及迁移建议见 [upstream-inventory.json](<upstream-inventory.json>)。',
         '', '## 可复验方法', '',
         '完整目录 hash = SHA256(每个目录内相对 POSIX 路径 + NUL + 文件 SHA256 + LF，按路径 ordinal 排序并拼接后的 UTF-8)。包括全部后代文件，不仅比较 SKILL.md，也不依赖 filecmp 的浅层/mtime 比较。',
         f'上游全树 hash：`{s["sourceTreeSha256"]}`。该值不是 Git commit；无 .git，commit 未知。',
         '', '## 全部名称和来源', '', '|name|实例|SKILL.md 版本|完整目录版本|来源/角色|', '|---|---:|---:|---:|---|']
for g in inv['skillGroups']:
    origins = '<br>'.join(f'{v["family"]}/{v["owner"]}: ' + link(v['path']) + f' (SKILL.md SHA256=`{v["skillSha256"]}`; 完整目录 treeSHA256=`{v["treeSha256"]}`)' for v in g['variants'])
    lines.append(f'|{g["name"]}|{g["occurrences"]}|{g["skillMdVariantCount"]}|{g["fullDirectoryVariantCount"]}|{origins}|')
write('SKILL_VARIANTS.md', lines)

lines = ['# 上游许可证、归属和集成审计', '',
         '## 范围与结论', '',
         '- 根 README 声明 Apache-2.0；实际读取全部6个许可证文件，均为 Apache License Version 2.0。',
         '- 全树未发现独立 NOTICE/COPYING 文件；这是本地文件清点结论，不是第三方服务无额外合同的保证。',
         '- S&P Global 的插件及三个 Skill 各带 LICENSE，含 `Copyright 2026-present Kensho Technologies, LLC.`；必须随迁移保留，不能只保留根许可证。',
         '- LSEG manifest author 为 LSEG，本地无单独 LSEG LICENSE；按根仓库 Apache-2.0 证据记录，但不推定其商业数据/API 已获授权。',
         '- 根与 skill-creator 的许可证附录 copyright 是未填占位符 `[yyyy] [name of copyright owner]`；不可把它伪造成人名/年份的正式通知。',
         '', '## 许可证文件 SHA256', '', '|文件|SPDX|SHA256|', '|---|---|---|']
for lic in inv['licenseFiles']:
    lines.append(f'|{link(lic["path"])}|{lic["spdx"]}|`{lic["sha256"]}`|')
lines += ['', '## 分发义务', '',
          '1. 分发上游或衍生源码/产物时附 Apache-2.0 完整文本（§4(a)）。',
          '2. 修改过的上游文件必须有醒目变更说明（§4(b)）；保留适用 copyright/patent/trademark/attribution（§4(c)）。',
          '3. 本地无 NOTICE 可复制；建议最终 Bundle 的 attribution/NOTICE 列 Anthropic Financial Services、LSEG、Kensho/S&P 来源及所有本地路径/hash；不要将自行添加 NOTICE 说成上游已有。',
          '4. Apache-2.0 不授予品牌/商标使用许可（§6），也不授予商业金融数据、客户文档、付费 API 或租户凭据的授权。',
          '5. 此为源码证据审计，不是法律意见。第三方库安装许可尚需在实际 Bundle lockfile 形成后另审；本次未安装依赖。',
          '', '## 商业集成边界与差异', '',
          '- ' + link('README.md', 119) + ' 声称 all connectors centralized；实际 financial-analysis 有12个 server，另 partner 2配置，总14记录/13独立URL。README表中的“11”已落后于实际文件。',
          '- financial-analysis LSEG URL 以 `/lfa/mcp` 结尾；partner LSEG 以 `/lfa/mcp/server-cl` 结尾。不可按相同名称静默覆盖。',
          '- core S&P 键 `sp-global` 与 partner 键 `spglobal` 指向相同URL，别名可显式映射但需保留来源。',
          '- ' + link('plugins/partner-built/spglobal/README.md', 14) + '、25、32、39明确 subscription；' + link('plugins/partner-built/lseg/README.md', 59) + ' 要求 credentials 和 data entitlements。',
          '- 所有 MCP 仅记录声明配置：NOT_CONFIGURED；未安装、未连接、未验证授权、未执行数据查询。未读取任何凭据。',
          '- Managed Agents API、Cowork、Claude Office add-in 安装流程并非 DSH 插件格式或 DSH Office 的等价能力。M365 涉 Azure admin consent、Graph 用户属性与云资源，不应自动运行或以文件生成冒充已部署。',
          '', '|源配置|server key|URL|状态|', '|---|---|---|---|']
for m in inv['mcpIntegrations']:
    lines.append(f'|{link(m["path"])}|{m["name"]}|`{m["configuration"].get("url", "")}`|NOT_CONFIGURED / NOT_VERIFIED|')
lines += ['', '## 安装文档已核验', '',
          '- ' + link('README.md', 48) + '：Cowork URL/ZIP、Claude Code marketplace/install、Managed Agents deploy；这些不是 DSH 安装规范。',
          '- ' + link('plugins/vertical-plugins/investment-banking/README.md', 11) + '：Claude --plugin-dir；' + link('plugins/partner-built/lseg/README.md', 53) + '：claude plugins add；' + link('plugins/partner-built/spglobal/README.md', 38) + '：订阅、Cowork和个别Skill安装。',
          '- ' + link('claude-for-msft-365-install/README.md', 6) + '：单独 Claude Code 安装及更新、租户 bootstrap；其脚本中涉及清缓存/Graph/云配置，未执行。',
          '- 上游 ' + link('scripts/check.py', 26) + ' 会安装 git hooks，' + link('scripts/sync-agent-skills.py', 35) + ' 会删除并重写技能目录；只读审计未执行这两个脚本。']
write('LICENSE_AUDIT.md', lines)

refs = inv['assetReferences']
missing = [r for r in refs if r['status'] == 'MISSING_LOCAL_REFERENCE']
lines = ['# 资产与引用完整性审计', '',
         '## 完整性和证据边界', '',
         f'- 清点 {s["fileCount"]} 个源文件，全部计算 SHA256 并分类、建议迁移路径/状态；10主Agent、30Worker、50命令（金融41、M365 9）。',
         f'- 金融Skill {s["skillInstanceCountFinancial"]}实例 / {s["distinctSkillNamesFinancial"]}名称，脚本{s["classificationCounts"]["skill-script"]}、reference{s["classificationCounts"]["skill-reference"]}、asset{s["classificationCounts"]["skill-asset"]}文件；这里的分类数按实际路径（含reference/单数），不把未提供模板算作已交付。',
         '- 扫描所有可解码UTF-8文件中的 Markdown 链接、scripts/references/assets 路径、inline code 路径、运行时绝对路径，以及YAML file/path/from_plugin/manifest。',
         '- 扫描未访问任何上游之外业务目录、外部URL或运行时 `/mnt` `/tmp` 文件；动态构造路径和自然语言裸文件名不能由静态正则证明完备，机器清单保留候选供后续人工复核。',
         '- 路径不存在不必然是缺陷：生成模板、教学示例、临时成果和外部运行时依赖单独标记，绝不说这些文件是 ZIP 丢失。',
         '- 全部原始引用、源文件hash、行号、真实原句、解析目标及目标hash见 [asset-references.json](<asset-references.json>)。',
         '', '## 引用计数', '', '|状态|数量|', '|---|---:|']
for status, count in s['referenceCounts'].items(): lines.append(f'|{status}|{count}|')
lines += ['', '## 待核验/缺失本地引用（逐条保留原句）', '',
          '人工确认：3种未附二进制示例/模板，分布8个Skill目录、11处引用；另有根README的advisor目录坏链1处。共12处已确认本地缺失引用，不含教学示例或运行时依赖。全树未附任何xlsx/pptx/docx/pdf/png/jpg/zip成品。',
          '缺件不阻断P0清点完成，但P2/P4标准LBO模板路线为BLOCKED；用户自带模板须另行真实验证，不能把缺件改成“已迁移”。',
          '下表来自静态扫描，明确缺失与例示/文档坏链以“复核判断”区分；无需联网或伪造资产即可重现。', '',
          '|源位置|引用|原句|复核判断|', '|---|---|---|---|']
for r in missing:
    excerpt = r['excerpt'].replace('|', '\\|')
    judgement = '本地未解析，需按源码上下文复核'
    if r['rawReference'] == './claude-for-financial-advisors': judgement = '根README文档坏链；该本地目录不存在，不能假称已包含advisor整包'
    if r['rawReference'] == 'examples/comps_example.xlsx': judgement = '源码明确称is provided；4个同名目录均未提供此参考示例，影响示例保真但不等于业务方法缺失'
    if r['rawReference'] == 'examples/LBO_Model.xlsx': judgement = '源码要求复制的标准模板未附；3目录共6处引用，标准模板路径BLOCKED，用户提供模板是独立可行路线'
    if r['rawReference'] == 'examples/Nike_Strip_Profile_Example.pptx': judgement = '源码要求See的视觉示例未附；不能宣称已有Nike示例成品'
    lines.append(f'|{link(r["sourcePath"], r["line"])}|`{r["rawReference"]}`|{excerpt}|{judgement}|')
lines += ['', '## 平台运行时引用不是仓库资产', '',
          '- `/mnt/skills/public/...`、`/mnt/data`、`/tmp` 等都是原 Claude/Cowork/容器约定；必须适配 DSH Office/成果目录，不可把“源仓库找不到”冒称全部是丢文件。',
          '- `ppt-template-creator` 描述 `assets/template.pptx` 是生成或用户提供品牌模板。无通用成品 .pptx 被附带；不能将示例文件名作为预置模板能力。',
          '- `skill-creator` 在教学段给出的 rotate_pdf、logo、font、finance/schema、FORMS/DOCX 等例子并非要求随此仓库提供。287–290行引用的两份design guide（workflows.md/output-patterns.md）实际存在且已hash，不属于缺失。',
          '- ib-check-deck 的 extract_numbers.py 与 LSEG CONNECTORS.md 实际存在；不得仅凭有限glob结果或看到相对路径就断言缺失。',
          '', '## 静态未解析候选（人工归类，不冒充路径已解析）', '',
          '保留 UNRESOLVED_CANDIDATE_REVIEW 状态，不把候选计作已提供文件。逐条复核归入下列类别；含外部存储/配置/HTTP端点的项未访问、未连接、未验证远端存在性。', '', '|人工复核类别|数量|', '|---|---:|']
for disposition, count in sorted(Counter(r['reviewDisposition'] for r in refs if r['status'] == 'UNRESOLVED_CANDIDATE_REVIEW').items()):
    lines.append(f'|{disposition}|{count}|')
lines += ['', '|源位置|引用|原句|人工复核类别|', '|---|---|---|---|']
for r in refs:
    if r['status'] == 'UNRESOLVED_CANDIDATE_REVIEW':
        lines.append(f'|{link(r["sourcePath"], r["line"])}|`{r["rawReference"]}`|' + r['excerpt'].replace('|', '\\|') + f'|{r["reviewDisposition"]}|')
lines += [
          '', '## 源快照与可重跑', '',
          f'- Source tree SHA256：`{s["sourceTreeSha256"]}`，{s["totalBytes"]} bytes；无 `.git`，不记录假commit。',
          '- 先执行 [audit_upstream.py](<audit_upstream.py>)，再执行 [render_reports.py](<render_reports.py>)；stdlib-only，不安装依赖、不导入或执行上游脚本。写入仅限脚本所在目录。',
          '- [upstream-sha256.json](<upstream-sha256.json>) 是全文件SHA清单；[upstream-inventory.json](<upstream-inventory.json>) 是总机器清单；[audit-summary.json](<audit-summary.json>) 是计数。',
          '- migrationTarget/status 是迁移建议，不是已实现/测试通过声明。']
write('ASSET_AUDIT.md', lines)
print('Rendered SKILL_VARIANTS.md, LICENSE_AUDIT.md, ASSET_AUDIT.md')
