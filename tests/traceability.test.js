import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// The matrix is the audit index for the task's section 11 gates and section 12 bullets.
const data = JSON.parse(readFileSync('acceptance/traceability.json', 'utf8'))
const ledger = JSON.parse(readFileSync('acceptance/gap-ledger.json', 'utf8'))
const gapIds = new Set(ledger.gaps.map(gap => gap.id))
const allowed = new Set(data.statuses)

test('all seven stage gates and all eleven mandatory bullets are present exactly once', () => {
  assert.equal(data.stageGates.length, 7)
  assert.equal(data.mandatoryAcceptance.length, 11)
  for (const group of ['stageGates', 'mandatoryAcceptance']) {
    const ids = data[group].map(item => item.id)
    assert.equal(new Set(ids).size, ids.length, `${group} has duplicate ids`)
  }
  assert.deepEqual(data.stageGates.map(item => item.id), ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
  assert.deepEqual(data.mandatoryAcceptance.map(item => item.id), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11'])
})

test('every entry has a known status, a requirement and resolvable evidence', () => {
  for (const item of [...data.stageGates, ...data.mandatoryAcceptance]) {
    assert.ok(allowed.has(item.status), `${item.id} has unknown status ${item.status}`)
    assert.ok(item.requirement.length > 10, `${item.id} requirement is too thin`)
    assert.ok(item.evidence.length > 0, `${item.id} has no evidence`)
    for (const path of item.evidence) assert.ok(existsSync(path), `${item.id} references missing ${path}`)
  }
})

test('nothing non-passing is left without a named, ledgered gap', () => {
  for (const item of [...data.stageGates, ...data.mandatoryAcceptance]) {
    if (item.status === 'PASS_NATIVE' || item.status === 'PASS_STATIC') continue
    assert.ok(item.gaps?.length, `${item.id} is ${item.status} but names no gap`)
    for (const gap of item.gaps) assert.ok(gapIds.has(gap), `${item.id} names unknown gap ${gap}`)
  }
})

test('no stage is marked accepted through the matrix', () => {
  const notPassing = data.stageGates.filter(item => item.status !== 'PASS_NATIVE' && item.status !== 'PASS_STATIC')
  assert.deepEqual(notPassing.map(item => item.id), ['P3', 'P4', 'P5', 'P6'])
  const results = { P3: 'acceptance/P3-results.json', P4: 'acceptance/P4-results.json', P5: 'acceptance/P5-results.json', P6: 'acceptance/P6-results.json' }
  for (const [stage, path] of Object.entries(results)) {
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).stageAccepted, false, `${stage} must not be accepted`)
  }
})

test('the generated document keeps the counts and the gap column', () => {
  const document = readFileSync('acceptance/TRACEABILITY.md', 'utf8')
  assert.match(document, /逐条追溯矩阵/)
  assert.match(document, /## 阶段门（§11）/)
  assert.match(document, /## 必须实际执行的验收（§12）/)
  for (const marker of ['P3-MCP-MANAGER', 'P4-OFFICE-NATIVE', 'P5-OS-RESTART', 'P6-BROWSER-RENDERING']) {
    assert.ok(document.includes(marker), `matrix must name ${marker}`)
  }
  assert.match(document, /PARTIAL/)
  assert.match(document, /BLOCKED/)
})
