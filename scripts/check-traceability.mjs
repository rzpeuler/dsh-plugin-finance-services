/**
 * Render and check the acceptance traceability matrix.
 * Every mandatory bullet and stage gate must carry a status and resolvable evidence.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(await readFile(join(root, 'acceptance/traceability.json'), 'utf8'))
const allowed = new Set(data.statuses)
const problems = []

const audit = (group, items, expectedCount) => {
  if (items.length !== expectedCount) problems.push(`${group}: expected ${expectedCount} entries, found ${items.length}`)
  for (const item of items) {
    if (!allowed.has(item.status)) problems.push(`${item.id}: unknown status ${item.status}`)
    if (!item.requirement) problems.push(`${item.id}: missing requirement`)
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) problems.push(`${item.id}: no evidence`)
    for (const path of item.evidence) if (!existsSync(join(root, path))) problems.push(`${item.id}: missing evidence ${path}`)
    if (item.status !== 'PASS_NATIVE' && item.status !== 'PASS_STATIC' && !(item.gaps?.length)) {
      problems.push(`${item.id}: a non-passing entry must name at least one gap`)
    }
  }
}

audit('stageGates', data.stageGates, 7)
audit('mandatoryAcceptance', data.mandatoryAcceptance, 11)

const gapIds = new Set(JSON.parse(await readFile(join(root, 'acceptance/gap-ledger.json'), 'utf8')).gaps.map(gap => gap.id))
for (const item of data.mandatoryAcceptance) {
  for (const gap of item.gaps ?? []) if (!gapIds.has(gap)) problems.push(`${item.id}: unknown gap ${gap}`)
}

const tally = list => list.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {})
const rows = list => list.map(item =>
  `| ${item.id} | ${item.requirement} | ${item.status} | ${item.evidence.map(path => `[${path.split('/').pop()}](${path})`).join(' ')} | ${(item.gaps ?? []).join(', ') || '—'} |`).join('\n')

const document = `# 任务书逐条追溯矩阵（生成文件，请勿手改）

- 来源：${data.source}
- 生成日期：${data.observedDate}
- 阶段门：${JSON.stringify(tally(data.stageGates))}
- 强制验收：${JSON.stringify(tally(data.mandatoryAcceptance))}
- 规则：非 PASS 的条目必须写明缺口；证据路径必须可解析。

## 阶段门（§11）

| 阶段 | 要求 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|
${rows(data.stageGates)}

## 必须实际执行的验收（§12）

| # | 要求 | 状态 | 证据 | 缺口 |
|---|---|---|---|---|
${rows(data.mandatoryAcceptance)}
`

const target = join(root, 'acceptance/TRACEABILITY.md')
const previous = existsSync(target) ? await readFile(target, 'utf8') : ''
if (previous !== document) await writeFile(target, document, 'utf8')

if (problems.length) {
  console.error(JSON.stringify({ status: 'FAIL', problems }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ status: 'PASS', gates: tally(data.stageGates), acceptance: tally(data.mandatoryAcceptance) }))
}
