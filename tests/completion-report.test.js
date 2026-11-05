import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// The completion report is the human entry point; it must agree with the machine records.
const report = readFileSync('acceptance/COMPLETION_REPORT.md', 'utf8')
const ledger = JSON.parse(readFileSync('acceptance/gap-ledger.json', 'utf8'))
const matrix = JSON.parse(readFileSync('acceptance/traceability.json', 'utf8'))
const results = {
  P3: JSON.parse(readFileSync('acceptance/P3-results.json', 'utf8')),
  P4: JSON.parse(readFileSync('acceptance/P4-results.json', 'utf8')),
  P5: JSON.parse(readFileSync('acceptance/P5-results.json', 'utf8')),
  P6: JSON.parse(readFileSync('acceptance/P6-results.json', 'utf8')),
}

const open = ledger.gaps.filter(gap => !String(gap.status).startsWith('CLOSED_'))
const closed = ledger.gaps.filter(gap => String(gap.status).startsWith('CLOSED_'))

test('the report states the version, the installation shape and no false completion', () => {
  assert.match(report, /0\.4\.0-alpha\.1/)
  assert.match(report, /P0–P2 已按任务书验收完成/)
  assert.match(report, /整体尚未达到"全部阶段完成"/)
  for (const stage of ['P3', 'P4', 'P5', 'P6']) assert.ok(report.includes(stage))
})

test('the reported gap counts match the ledger', () => {
  assert.equal(open.length, 9)
  assert.equal(closed.length, 2)
  assert.ok(report.includes(`未闭合缺口（${open.length}）`), 'the report heading must carry the real count')
  for (const gap of open) assert.ok(report.includes(gap.id), `report must list ${gap.id}`)
})

test('the report does not accept a stage the records leave open', () => {
  for (const [stage, record] of Object.entries(results)) assert.equal(record.stageAccepted, false, `${stage} must stay unaccepted`)
  for (const gate of matrix.stageGates.filter(item => ['P3', 'P4', 'P5', 'P6'].includes(item.id))) {
    assert.notEqual(gate.status, 'PASS_NATIVE', `${gate.id} must not read as accepted`)
  }
})

test('the report names what is explicitly not claimed', () => {
  assert.match(report, /明确不声称/)
  for (const phrase of ['商业数据可用', 'Office 交付已完成', 'MCP Manager 存在', 'WCAG']) {
    assert.ok(report.includes(phrase), `the report must disclaim ${phrase}`)
  }
})

test('every evidence link in the report resolves', () => {
  const base = 'acceptance'
  for (const match of report.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^(https?:|#)/.test(target)) continue
    const path = target.startsWith('..') ? target.replace('../', '') : `${base}/${target}`
    assert.ok(existsSync(path), `broken report link ${target} -> ${path}`)
  }
})
