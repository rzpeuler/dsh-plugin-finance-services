import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tieout } from '../src/business/lp-tieout.js'

// Every expectation in boundary-cases.json was produced by Python's Decimal implementation.
const suite = JSON.parse(readFileSync('samples/p4/b07-lp-tieout/boundary-cases.json', 'utf8'))
const FIELDS = ['realized', 'unrealized', 'management_fee', 'expenses', 'allocated_net_income', 'ending']

test('the boundary suite covers the rounding and scale hazards it claims', () => {
  const ids = suite.cases.map(entry => entry.id)
  for (const required of ['half-even-tie-down-to-even', 'half-even-tie-up-to-even', 'thirds-with-exact-ownership-sum',
    'full-ownership-single-lp', 'zero-ownership', 'negative-carry', 'distributions-above-contributions',
    'large-amounts-near-scale-limit']) {
    assert.ok(ids.includes(required), `missing case ${required}`)
  }
  assert.equal(new Set(ids).size, ids.length)
})

for (const entry of suite.cases) {
  test(`case ${entry.id}: the kernel agrees with the Decimal expectation`, () => {
    const result = tieout(JSON.stringify(entry.inputs))
    assert.deepEqual(result.flags, [], `unexpected flags: ${JSON.stringify(result.flags)}`)
    assert.equal(result.fund.status, 'PASS', `fund status ${result.fund.status}`)
    assert.equal(result.recommendation, 'PASS', `recommendation ${result.recommendation}`)
    const byId = new Map(result.statements.map(item => [item.lp_id, item]))
    for (const [lpId, want] of Object.entries(entry.expected.lps)) {
      const item = byId.get(lpId)
      assert.ok(item, `${lpId} missing`)
      for (const field of FIELDS) {
        const check = item.checks.find(candidate => candidate.field === field)
        assert.ok(check, `${lpId}.${field} not checked`)
        assert.equal(check.recomputed, want[field], `${entry.id} ${lpId}.${field}`)
        assert.equal(check.status, 'PASS', `${entry.id} ${lpId}.${field} status`)
      }
      assert.equal(item.recommendation, 'PASS', `${entry.id} ${lpId} recommendation`)
    }
    const fund = result.fund.checks.find(check => check.field === 'recomputed_lp_sum_vs_nav')
    assert.equal(fund.recomputed, entry.expected.fund_nav, `${entry.id} fund sum`)
  })
}

test('an exact half-cent tie is resolved to the even cent in both directions', () => {
  const cases = Object.fromEntries(suite.cases.map(entry => [entry.id, entry]))
  // 100.01 / 2 = 50.005 -> 50.00 (even) and 100.03 / 2 = 50.015 -> 50.02 (even).
  assert.equal(cases['half-even-tie-down-to-even'].expected.lps['LP-1'].allocated_net_income, '50.00')
  assert.equal(cases['half-even-tie-up-to-even'].expected.lps['LP-1'].allocated_net_income, '50.02')
  const result = tieout(JSON.stringify(cases['half-even-tie-down-to-even'].inputs))
  const allocated = result.statements.find(item => item.lp_id === 'LP-1').checks.find(check => check.field === 'allocated_net_income')
  assert.equal(allocated.recomputed, '50.00')
  assert.equal(allocated.status, 'PASS')
})
