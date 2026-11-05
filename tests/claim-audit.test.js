import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Same rule as scripts/audit-claims.mjs, enforced in the regression suite.
const data = JSON.parse(readFileSync('acceptance/traceability.json', 'utf8'))
const PASSING = new Set(['PASS_NATIVE', 'PASS_STATIC', 'PASS_USER_OBSERVED'])
const MANUAL = /acceptance\/P6-manual-\d{4}-\d{2}-\d{2}-\d{3}\.md$/

const inspect = path => {
  if (!existsSync(path)) return { path, verdict: 'MISSING' }
  if (path.endsWith('.json')) {
    const body = JSON.parse(readFileSync(path, 'utf8'))
    const checks = Array.isArray(body.checks) ? body.checks : null
    if (checks) {
      const failed = checks.filter(check => check.status !== 'PASS')
      return { path, verdict: checks.length > 0 && failed.length === 0 ? 'MACHINE_CHECKED' : 'FAILED_CHECKS', checks: checks.length }
    }
    const status = typeof body.status === 'string' ? body.status : ''
    return { path, verdict: /^PASS/.test(status) ? 'STATUS_ONLY' : 'NO_VERDICT', status }
  }
  if (path.endsWith('.tap')) {
    const text = readFileSync(path, 'utf8')
    const clean = /# fail 0\b/.test(text) && /# pass [1-9]/.test(text)
    return { path, verdict: clean ? 'MACHINE_CHECKED' : 'FAILED_CHECKS' }
  }
  return { path, verdict: 'DOCUMENT' }
}

test('every passing claim cites at least one machine-checked result', () => {
  const offenders = []
  for (const group of ['stageGates', 'mandatoryAcceptance']) {
    for (const item of data[group]) {
      if (!PASSING.has(item.status)) continue
      const entries = item.evidence.map(inspect)
      if (entries.some(entry => entry.verdict === 'FAILED_CHECKS' || entry.verdict === 'MISSING')) {
        offenders.push({ id: item.id, entries })
        continue
      }
      const machine = entries.filter(entry => entry.verdict === 'MACHINE_CHECKED').length
      if (item.status === 'PASS_NATIVE' && machine === 0) offenders.push({ id: item.id, reason: 'no machine-checked evidence', entries })
      if (item.status === 'PASS_USER_OBSERVED' && !item.evidence.some(path => MANUAL.test(path))) {
        offenders.push({ id: item.id, reason: 'user-observed claim without a manual record' })
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('the audit report matches the current state', () => {
  const report = JSON.parse(readFileSync('acceptance/P6-claim-audit-001.json', 'utf8'))
  assert.equal(report.status, 'PASS_CLAIMS_BACKED')
  assert.equal(report.problems.length, 0)
  assert.equal(report.audited, 11)
  const native = report.results.filter(entry => entry.status === 'PASS_NATIVE')
  assert.ok(native.length >= 5)
  for (const entry of native) assert.ok(entry.machineChecked >= 1, `${entry.id} lacks machine-checked evidence`)
  const observed = report.results.filter(entry => entry.status === 'PASS_USER_OBSERVED')
  assert.ok(observed.length >= 1, 'the user-observed claim must appear in the audit')
})

test('a static claim says so instead of borrowing native strength', () => {
  const report = JSON.parse(readFileSync('acceptance/P6-claim-audit-001.json', 'utf8'))
  for (const entry of report.results.filter(item => item.status === 'PASS_STATIC')) {
    for (const evidence of entry.entries) {
      assert.notEqual(evidence.verdict, 'FAILED_CHECKS', `${entry.id} cites failing evidence`)
    }
  }
  for (const entry of report.results.filter(item => item.status === 'PASS_NATIVE')) {
    assert.ok(entry.entries.every(item => item.verdict !== 'DOCUMENT' || entry.machineChecked >= 1))
  }
})
