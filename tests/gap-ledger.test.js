import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

// The gap ledger is the single source of truth for what still blocks a stage.
// These checks keep it honest and keep the manual checklist pointing at it.
const ledger = JSON.parse(readFileSync('acceptance/gap-ledger.json', 'utf8'))
const stageResults = JSON.parse(readFileSync('acceptance/P6-results.json', 'utf8'))
const STATUSES = new Set(['BLOCKED_HOST_INTERFACE', 'NOT_RUN', 'NOT_IMPLEMENTED', 'PARTIAL'])

test('the ledger is unique, well-formed and every gap names an existing evidence file', () => {
  assert.ok(Array.isArray(ledger.gaps) && ledger.gaps.length >= 6)
  const ids = new Set()
  for (const gap of ledger.gaps) {
    assert.match(gap.id, /^P[3-6]-[A-Z0-9-]+$/)
    assert.ok(!ids.has(gap.id), `duplicate gap id ${gap.id}`)
    ids.add(gap.id)
    assert.ok(STATUSES.has(gap.status), `unexpected status ${gap.status} for ${gap.id}`)
    assert.ok(gap.title && gap.blockedBy && gap.notClaimed && gap.nextStep, `${gap.id} must be fully described`)
    assert.ok(Array.isArray(gap.evidence) && gap.evidence.length >= 1, `${gap.id} needs evidence`)
    for (const entry of gap.evidence) {
      const path = normalize(join(dirname('acceptance/gap-ledger.json'), '../', entry))
      assert.ok(existsSync(path), `${gap.id} references missing evidence ${entry}`)
    }
  }
})

test('every stage that is not accepted has at least one open gap', () => {
  const open = new Set(ledger.gaps.map(gap => gap.stage))
  for (const [stage, result] of Object.entries(ledger.stages)) {
    if (result.stageAccepted) assert.ok(!open.has(stage), `${stage} is accepted but still lists gaps`)
    else assert.ok(open.has(stage), `${stage} is not accepted but lists no gap`)
  }
  assert.equal(ledger.stages.P6.stageAccepted, false)
  assert.equal(stageResults.browserRendered, false, 'no browser rendering is claimed yet')
})

test('the manual checklist covers rendering, lifecycle and accessibility gaps', () => {
  const checklist = readFileSync('acceptance/MANUAL_CHECKLIST.md', 'utf8')
  for (const marker of ['## A. 打开与定位', '## B. 工作台六段', '## C. 审核面板（只读）', '## D. 数据源与策略',
    '## E. 设置与依赖', '## F. 窄屏、主题、键盘', '## G. 生命周期']) {
    assert.ok(checklist.includes(marker), `checklist is missing ${marker}`)
  }
  assert.match(checklist, /PASS.*FAIL.*BLOCKED/s, 'the checklist must define how to record a failure')
  assert.match(checklist, /在完成之前，P6 不标通过/, 'the checklist must restate that rendering is not yet accepted')
  const ledgerIds = new Set(ledger.gaps.map(gap => gap.id))
  for (const id of ['P6-BROWSER-RENDERING', 'P6-LIFECYCLE-UI', 'P6-ACCESSIBILITY']) {
    assert.ok(ledgerIds.has(id), `ledger must track ${id}`)
  }
})

test('the ledger never contradicts the stage records', () => {
  const p3 = JSON.parse(readFileSync('acceptance/P3-results.json', 'utf8'))
  const p4 = JSON.parse(readFileSync('acceptance/P4-results.json', 'utf8'))
  const p5 = JSON.parse(readFileSync('acceptance/P5-results.json', 'utf8'))
  assert.equal(p3.stageAccepted, false)
  assert.equal(p4.stageAccepted, false)
  assert.equal(p5.stageAccepted, false)
  assert.equal(stageResults.stageAccepted, false)
  const byStage = stage => ledger.gaps.filter(gap => gap.stage === stage).map(gap => gap.status)
  assert.ok(byStage('P3').includes('BLOCKED_HOST_INTERFACE'))
  assert.ok(byStage('P4').includes('BLOCKED_HOST_INTERFACE'))
  // P5 moved from NOT_RUN to PARTIAL once the application restart was observed, but a gap must remain.
  assert.ok(byStage('P5').some(status => ['NOT_RUN', 'PARTIAL'].includes(status)))
  assert.ok(byStage('P6').includes('NOT_RUN'))
})
