import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The UI acceptance plan must stay concrete: four checks, each with an expectation and a report shape.
const plan = JSON.parse(readFileSync('acceptance/P6-manual-plan-001.json', 'utf8'))

test('the plan covers the four checks the user agreed to perform', () => {
  assert.equal(plan.checks.length, 4)
  assert.deepEqual(plan.checks.map(check => check.id), ['UI-1', 'UI-2', 'UI-3', 'UI-4'])
  for (const check of plan.checks) {
    assert.ok(check.title && check.open && check.expect, `${check.id} needs title, open and expect`)
    assert.ok(check.expect.length > 20, `${check.id} expectation is too vague`)
    assert.ok(check.records.length >= 2, `${check.id} must say what to report`)
    assert.ok(check.covers.length >= 1, `${check.id} must name the criteria it covers`)
    for (const criterion of check.covers) assert.match(criterion, /^P6-/)
  }
})

test('the plan names the pending restart and the probe packages it must clear', () => {
  assert.equal(plan.restartPending.packages.length, 2)
  for (const name of plan.restartPending.packages) assert.match(name, /^@local\/dsh-finance-p6-post-restart/)
  assert.match(plan.restartPending.afterRestart, /absent/)
})

test('the report format forces specifics rather than a general "looks fine"', () => {
  for (const field of ['逐项 PASS/FAIL/BLOCKED', '实际看到的文字或数值', '与预期的具体差异']) {
    assert.ok(plan.reportFormat.required.some(item => item.includes(field.split(' ')[0]) || item === field), `missing ${field}`)
  }
  assert.match(plan.reportFormat.file, /P6-manual-<date>-<seq>\.md/)
  assert.ok(plan.notClaimed.length >= 3)
  assert.ok(plan.notClaimed.some(item => /settings/i.test(item)))
  assert.ok(plan.notClaimed.some(item => /offline/i.test(item)))
})

test('the manual checklist carries the same four checks and keeps the no-claim sentence', () => {
  const checklist = readFileSync('acceptance/MANUAL_CHECKLIST.md', 'utf8')
  assert.ok(checklist.includes('## 本轮验收单（2026-11-06，四项）'))
  for (const marker of ['UI-1', 'UI-2', 'UI-3', 'UI-4']) assert.ok(checklist.includes(marker), `checklist missing ${marker}`)
  assert.match(checklist, /在你回报之前，P6 的渲染类判据保持未验证/)
})
