import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reconcileGl } from '../src/business/gl-reconciliation.js'

// Expectations come from an independent Python model of the documented bucket rules.
const suite = JSON.parse(readFileSync('samples/p4/b06-recon/gl-boundary-cases.json', 'utf8'))

test('the suite covers every bucket and both tolerance edges', () => {
  const buckets = new Set(suite.cases.map(entry => entry.expectedBucket))
  for (const bucket of ['MATCHED', 'AMOUNT_BREAK', 'QUANTITY_BREAK', 'TIMING_BREAK', 'GL_ONLY', 'SUBLEDGER_ONLY']) {
    assert.ok(buckets.has(bucket), `missing a ${bucket} case`)
  }
  const ids = suite.cases.map(entry => entry.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const required of ['amount-at-tolerance', 'amount-over-tolerance', 'zero-tolerance-exact',
    'zero-tolerance-one-cent', 'quantity-at-tolerance', 'quantity-over-tolerance',
    'quantity-outranks-amount', 'fx-differs-amounts-equal', 'timing-only', 'gl-only', 'subledger-only', 'sign-flip']) {
    assert.ok(ids.includes(required), `missing ${required}`)
  }
})

for (const entry of suite.cases) {
  test(`case ${entry.id}: bucket ${entry.expectedBucket} as the independent model predicts`, () => {
    const result = reconcileGl(JSON.stringify(entry.inputs))
    assert.equal(result.rows.length, 1, 'each case is a single joined key')
    assert.equal(result.rows[0].bucket, entry.expectedBucket)
    const counted = result.summary.counts[entry.expectedBucket]
    assert.equal(counted, 1, `${entry.expectedBucket} must be counted once`)
    assert.equal(result.summary.joinedRows, 1)
  })
}

test('a tolerance comparison is inclusive at the boundary and exclusive just above it', () => {
  const byId = Object.fromEntries(suite.cases.map(entry => [entry.id, entry]))
  const at = reconcileGl(JSON.stringify(byId['amount-at-tolerance'].inputs)).rows[0]
  const over = reconcileGl(JSON.stringify(byId['amount-over-tolerance'].inputs)).rows[0]
  // The delta is GL minus subledger, so a higher subledger amount reads negative.
  assert.equal(at.delta.localAmount, '-0.01')
  assert.equal(at.differences.localAmount, false)
  assert.equal(over.delta.localAmount, '-0.02')
  assert.equal(over.differences.localAmount, true)
})

test('a sign flip is an amount break with a doubled delta, not a quantity break', () => {
  const entry = suite.cases.find(candidate => candidate.id === 'sign-flip')
  const row = reconcileGl(JSON.stringify(entry.inputs)).rows[0]
  assert.equal(row.bucket, 'AMOUNT_BREAK')
  assert.equal(row.delta.localAmount, '200')
  assert.equal(row.delta.quantity, '0')
  assert.equal(row.differences.quantity, false)
})

test('an FX difference breaks the amount bucket even when every amount matches', () => {
  const entry = suite.cases.find(candidate => candidate.id === 'fx-differs-amounts-equal')
  const row = reconcileGl(JSON.stringify(entry.inputs)).rows[0]
  assert.equal(row.bucket, 'AMOUNT_BREAK')
  assert.equal(row.differences.fxRate, true)
  assert.equal(row.delta.localAmount, '0')
})
