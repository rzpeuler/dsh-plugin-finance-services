import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tieout } from '../src/business/lp-tieout.js'

// Cross-implementation evidence: the expectations were produced by Python's Decimal, not by this kernel.
const dir = 'samples/p4/b07-lp-tieout'
const inputs = readFileSync(`${dir}/inputs.json`, 'utf8')
const committed = JSON.parse(readFileSync(`${dir}/kernel-result.json`, 'utf8'))
const expected = JSON.parse(readFileSync(`${dir}/expected.json`, 'utf8'))
const verification = JSON.parse(readFileSync(`${dir}/verification.json`, 'utf8'))

test('the stored kernel output is exactly what the shipped kernel produces now', () => {
  assert.deepEqual(tieout(inputs), committed, 're-run samples/p4/b07-lp-tieout/run_kernel.mjs')
})

test('the fixture is a technical simulation, never commercial data', () => {
  const parsed = JSON.parse(inputs)
  assert.equal(parsed.statements.source.classification, 'TEST_ONLY')
  assert.equal(parsed.statements.source.input_kind, 'SIMULATED_FIXTURE')
  assert.notEqual(parsed.nav_pack.source.document_id, parsed.statements.source.document_id)
  assert.notEqual(parsed.commitment_register.source.document_id, parsed.nav_pack.source.document_id)
})

test('the Python cross-check agrees with the kernel on every field', () => {
  assert.equal(verification.status, 'PASS', JSON.stringify(verification.checks.filter(check => check.status !== 'PASS')))
  assert.equal(verification.checks.length, 7)
  assert.equal(verification.lps, 3)
})

test('every allocation and ending agrees with the independent Decimal computation', () => {
  const byId = new Map(committed.statements.map(item => [item.lp_id, item]))
  for (const [lpId, want] of Object.entries(expected.lps)) {
    const item = byId.get(lpId)
    assert.ok(item, `${lpId} missing`)
    for (const [field, value] of Object.entries(want)) {
      const check = item.checks.find(entry => entry.field === field)
      assert.ok(check, `${lpId}.${field} not checked`)
      assert.equal(check.recomputed, value, `${lpId}.${field}`)
      assert.equal(check.status, 'PASS', `${lpId}.${field}`)
    }
    assert.equal(item.recommendation, 'PASS', `${lpId} should pass`)
  }
})

test('a one-cent difference stays inside the documented line tolerance', () => {
  // The kernel declares a 0.01 line tolerance with an inclusive comparison, so this must pass.
  const parsed = JSON.parse(inputs)
  parsed.statements.lps[1].ending = '1622500.01'
  const result = tieout(JSON.stringify(parsed))
  const ending = result.statements.find(entry => entry.lp_id === 'LP-BETA').checks.find(check => check.field === 'ending')
  assert.equal(ending.delta, '0.01')
  assert.equal(ending.status, 'PASS')
  assert.equal(ending.cause, 'WITHIN_TOLERANCE')
})

test('a difference above tolerance holds the run instead of passing', () => {
  const parsed = JSON.parse(inputs)
  parsed.statements.lps[1].ending = '1622500.02'
  const result = tieout(JSON.stringify(parsed))
  assert.equal(result.recommendation, 'HOLD')
  const item = result.statements.find(entry => entry.lp_id === 'LP-BETA')
  const ending = item.checks.find(check => check.field === 'ending')
  assert.equal(ending.status, 'HOLD')
  assert.equal(ending.delta, '0.02')
  assert.equal(ending.cause, 'NAV_INPUT_OR_ALLOCATION_MISMATCH')
})

test('no result field claims approval or official status', () => {
  // Wording in the limitations is a disclaimer ("Not an audit opinion"); only fields would be a claim.
  const keys = new Set()
  const walk = value => {
    if (value === null || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(walk); return }
    for (const [key, child] of Object.entries(value)) { keys.add(key); walk(child) }
  }
  walk(committed)
  for (const forbidden of ['approved', 'approvedBy', 'signedOff', 'clearance', 'auditOpinion']) {
    assert.ok(!keys.has(forbidden), `result must not expose ${forbidden}`)
  }
  assert.equal(committed.recommendation, 'PASS')
  assert.equal(committed.status, 'DRAFT_REVIEW_REQUIRED')
  assert.match(committed.limitations.join(' '), /Not an audit opinion/)
})
