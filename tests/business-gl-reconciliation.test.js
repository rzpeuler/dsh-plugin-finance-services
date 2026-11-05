import test from 'node:test'
import assert from 'node:assert/strict'
import { glReconciliationInputSchema, reconcileGl } from '../src/business/gl-reconciliation.js'

// Synthetic business cases only: never an actual internal-gl/subledger/custodian result.
const record = (commonKey, patch = {}) => ({ entity: 'TEST_FUND', tradeDate: '2026-11-04', assetClass: 'EQUITY', currency: 'USD', commonKey,
  postingDate: '2026-11-04', localAmount: '10', baseAmount: '10', baseCurrency: 'USD', amountScale: 'ONES',
  quantity: '1', quantityScale: 'ONES', quantityUnit: 'SHARES', fxRate: '1', ...patch })
const fixture = (gl = [], subledger = []) => ({ classification: 'TEST_ONLY',
  scope: { entity: 'TEST_FUND', tradeDate: '2026-11-04', asOf: '2026-11-05', assetClasses: ['EQUITY'] },
  gl: { asOf: '2026-11-05', records: gl }, subledger: { asOf: '2026-11-05', records: subledger } })
const run = value => reconcileGl(JSON.stringify(value))
const rejects = (mutate, expected) => {
  const value = fixture([record('A')], [record('A')]); mutate(value)
  assert.throws(() => run(value), expected)
}
const moneyTotal = (result, kind, currency) => result.summary.totals.money.find(t => t.key[0] === kind && t.key[1] === currency)

test('source full outer join: six buckets, differences, counts, totals and exact matched percentage', () => {
  const a = ['MATCH', 'AMOUNT', 'QUANTITY', 'TIMING', 'GL_ONLY'].map(k => record(k))
  const b = [record('MATCH'), record('AMOUNT', { localAmount: '9', baseAmount: '9' }), record('QUANTITY', { quantity: '2' }),
    record('TIMING', { postingDate: '2026-11-05' }), record('SUB_ONLY')]
  const r = run(fixture(a, b))
  assert.deepEqual(r.summary.counts, { MATCHED: 1, AMOUNT_BREAK: 1, QUANTITY_BREAK: 1, TIMING_BREAK: 1, GL_ONLY: 1, SUBLEDGER_ONLY: 1 })
  assert.equal(r.summary.glRows, 5); assert.equal(r.summary.subledgerRows, 5); assert.equal(r.summary.joinedRows, 6)
  assert.deepEqual(r.summary.matchedPercentage, { numerator: '100', denominator: '6' })
  assert.deepEqual(moneyTotal(r, 'LOCAL', 'USD'), { key: ['LOCAL', 'USD'], gl: '50', subledger: '49', delta: '1' })
  assert.equal(r.summary.byBucket.find(b => b.bucket === 'GL_ONLY').totals.money[0].delta, '10')
  assert.equal(r.summary.byCause[0].cause, 'unknown'); assert.equal(r.summary.byCause[0].count, 5)
  assert.equal(r.breaks.length, 5)
})

test('source amount tolerance is inclusive 0.01, not hidden epsilon, and applies to both monetary columns', () => {
  for (const sign of ['10.01', '9.99']) {
    const r = run(fixture([record('A', { localAmount: sign, baseAmount: sign })], [record('A')]))
    assert.equal(r.rows[0].bucket, 'MATCHED')
  }
  assert.equal(run(fixture([record('A', { baseAmount: '10.02' })], [record('A')])).rows[0].bucket, 'AMOUNT_BREAK')
  const input = fixture([record('A', { localAmount: '10.01' })], [record('A')]); input.tolerances = { amount: '0', quantity: '0' }
  assert.equal(run(input).rows[0].bucket, 'AMOUNT_BREAK')
})

test('firm tolerances are explicit and inclusive; quantity default zero is exact to 18 decimals', () => {
  const input = fixture([record('A', { quantity: '1.000000000000000001', baseAmount: '10.02' })], [record('A')])
  assert.equal(run(input).rows[0].bucket, 'QUANTITY_BREAK')
  input.tolerances = { amount: '0.02', quantity: '0.000000000000000001' }
  assert.equal(run(input).rows[0].bucket, 'MATCHED')
})

test('overlapping mismatches retain all flags with quantity then amount then timing precedence', () => {
  const r = run(fixture([record('A', { quantity: '2', baseAmount: '20', postingDate: '2026-11-05', fxRate: '2' })], [record('A')]))
  assert.equal(r.rows[0].bucket, 'QUANTITY_BREAK')
  assert.deepEqual(r.rows[0].differences, { localAmount: false, baseAmount: true, quantity: true, postingDate: true, fxRate: true })
  assert.equal(run(fixture([record('A', { baseAmount: '20', postingDate: '2026-11-05' })], [record('A')])).rows[0].bucket, 'AMOUNT_BREAK')
})

test('explicit FX difference is a monetary comparison exception, never an inferred FX root cause', () => {
  const row = run(fixture([record('A', { fxRate: '1.000000000000000001' })], [record('A')])).rows[0]
  assert.equal(row.bucket, 'AMOUNT_BREAK'); assert.equal(row.rootCause, 'unknown')
})

test('normalizes identifiers and explicit multipliers without FX conversion or decimal rounding', () => {
  const input = fixture([record('  abc  ', { entity: ' test_fund ', assetClass: ' equity ', currency: ' usd ',
    quantity: '0.001', quantityScale: 'THOUSANDS', localAmount: '0.01', baseAmount: '0.01', amountScale: 'THOUSANDS' })], [record('ABC')])
  const r = run(input)
  assert.equal(r.rows[0].bucket, 'MATCHED'); assert.equal(r.rows[0].gl.amountScale, 'ONES')
  assert.equal(r.rows[0].gl.quantity, '1'); assert.equal(r.inputData.gl.records[0].commonKey, '  abc  ')
  assert.equal(r.dataTrust, 'UNTRUSTED_DATA')
})

test('huge balances, signed money and exact quantity arithmetic remain JSON-safe', () => {
  const huge = '999999999999999999999999999999999999.99'
  const r = run(fixture([record('A', { localAmount: huge, baseAmount: huge, quantity: '-999999999999999999999999999999999999.000000000000000001' })],
    [record('A', { localAmount: '999999999999999999999999999999999999.97', baseAmount: '999999999999999999999999999999999999.97', quantity: '-999999999999999999999999999999999999' })]))
  assert.equal(r.rows[0].delta.baseAmount, '0.02'); assert.equal(r.rows[0].delta.quantity, '-0.000000000000000001')
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r)
  const negative = run(fixture([record('N', { localAmount: '-10', baseAmount: '-10', quantity: '-1' })], [record('N')]))
  assert.equal(negative.rows[0].delta.baseAmount, '-20'); assert.equal(negative.rows[0].delta.quantity, '-2')
})

test('negative zero is canonical zero, never missing, and quantities are not rounded', () => {
  const r = run(fixture([record('A', { localAmount: '-0.00', baseAmount: '0', quantity: '-0.000' })],
    [record('A', { localAmount: '0', baseAmount: '0.00', quantity: '0' })]))
  assert.equal(r.rows[0].bucket, 'MATCHED'); assert.equal(r.rows[0].delta.quantity, '0'); assert.equal(r.rows[0].gl.localAmount, '0')
})

test('net-zero totals cannot conceal offsetting record breaks', () => {
  const r = run(fixture([record('A', { baseAmount: '20' }), record('B', { baseAmount: '0' })], [record('A'), record('B')]))
  assert.equal(moneyTotal(r, 'BASE', 'USD').delta, '0')
  assert.equal(r.summary.counts.AMOUNT_BREAK, 2); assert.equal(r.summary.counts.MATCHED, 0)
})

test('per-currency totals never offset currencies; currency belongs to the join key', () => {
  const r = run(fixture([record('A', { localAmount: '30', baseAmount: '30' })],
    [record('A', { currency: 'EUR', baseCurrency: 'EUR', localAmount: '30', baseAmount: '30' })]))
  assert.equal(r.summary.counts.GL_ONLY, 1); assert.equal(r.summary.counts.SUBLEDGER_ONLY, 1)
  assert.equal(moneyTotal(r, 'LOCAL', 'USD').delta, '30'); assert.equal(moneyTotal(r, 'LOCAL', 'EUR').delta, '-30')
  assert.deepEqual(r.summary.totals.quantities.map(q => q.key), [['EQUITY', 'EUR', 'SHARES'], ['EQUITY', 'USD', 'SHARES']])
})

test('different classes or composite key components do not collide', () => {
  const input = fixture([record('A'), record('A', { assetClass: 'BOND', quantityUnit: 'UNITS' })], [record('A')])
  input.scope.assetClasses.push('BOND')
  const r = run(input); assert.equal(r.summary.counts.MATCHED, 1); assert.equal(r.summary.counts.GL_ONLY, 1)
})

test('breaks sorted by absolute base delta within currency, with deterministic key ties', () => {
  const r = run(fixture([record('SMALL', { baseAmount: '-2' }), record('LARGE', { baseAmount: '100' }), record('TIE', { baseAmount: '-100' })]))
  assert.deepEqual(r.breaks.map(b => b.key[4]), ['LARGE', 'TIE', 'SMALL'])
})

test('empty inputs have zero counts, no totals, null percentage, and still no signoff', () => {
  const r = run(fixture())
  assert.equal(r.summary.joinedRows, 0); assert.equal(r.summary.matchedPercentage, null)
  assert.ok(Object.values(r.summary.counts).every(v => v === 0)); assert.deepEqual(r.summary.totals, { money: [], quantities: [] })
  assert.equal(r.controllerSignoff, 'PENDING')
})

test('matching never establishes trusted evidence, licensing, approval, publishing, or a journal plug', () => {
  for (const classification of ['TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED']) {
    const input = fixture([record('A')], [record('A')]); input.classification = classification
    const r = run(input)
    assert.equal(r.classification, classification); assert.equal(r.status, 'DRAFT_REVIEW_REQUIRED')
    assert.equal(r.rows[0].rootCause, 'unknown'); assert.equal(r.rows[0].evidenceStatus, 'NEEDS_EVIDENCE')
    assert.equal(r.rows[0].criticStatus, 'NOT_PERFORMED'); assert.equal(r.checks.independentTrustedCritic, 'NOT_PERFORMED')
    assert.equal(r.checks.authorization, 'NOT_EVALUATED'); assert.equal(r.publish, false); assert.equal(r.posting, false)
    assert.deepEqual(r.journalEntries, { status: 'DRAFT_ONLY', entries: [] })
    assert.equal(r.rows[0].owner, null); assert.equal(r.rows[0].action, null); assert.equal(r.rows[0].expectedClearDate, null)
  }
})

test('repeated and independent calls cannot alter data, defaults or other results', () => {
  const input = fixture([record('B'), record('A')], [record('A')]), before = structuredClone(input)
  const first = run(input); run(fixture([record('X', { baseAmount: '1000' })]))
  assert.deepEqual(run(input), first); assert.deepEqual(input, before)
  input.gl.records.reverse(); assert.deepEqual(run(input).summary, first.summary); assert.deepEqual(run(input).rows, first.rows)
})

test('duplicate normalized common keys on either side reject instead of aggregation', () => {
  for (const side of ['gl', 'subledger']) rejects(v => v[side].records.push(record(' a ')), /DUPLICATE_COMMON_KEY/)
})

test('asOf mismatches, scope date/entity/class mismatches, and duplicate normalized scope reject', () => {
  for (const side of ['gl', 'subledger']) rejects(v => { v[side].asOf = '2026-11-04' }, /ASOF_MISMATCH/)
  rejects(v => { v.scope.asOf = v.gl.asOf = v.subledger.asOf = '2026-11-03' }, /ASOF_MISMATCH/)
  for (const [field, value] of [['entity', 'OTHER'], ['tradeDate', '2026-11-03'], ['assetClass', 'BOND']])
    rejects(v => { v.gl.records[0][field] = value }, /SCOPE_MISMATCH/)
  rejects(v => v.scope.assetClasses.push(' equity '), /DUPLICATE_ASSET_CLASS/)
})

test('incompatible semantic quantity units and base currencies reject; no FX guess or implicit units', () => {
  rejects(v => { v.gl.records[0].quantityUnit = 'CONTRACTS' }, /QUANTITY_UNIT_MISMATCH/)
  rejects(v => { v.gl.records[0].baseCurrency = 'EUR' }, /BASE_CURRENCY_MISMATCH/)
  rejects(v => { delete v.gl.records[0].amountScale })
  rejects(v => { v.gl.records[0].amountScale = 'BILLIONS' })
})

test('finite typed decimals only: reject null, numeric JSON, exponents, overprecision and missing values', () => {
  for (const field of ['localAmount', 'baseAmount', 'quantity', 'fxRate']) {
    for (const value of [null, 0, 1.2, true, {}, [], 'NaN', 'Infinity', '-Infinity', '1e3', '01', ' 1 ', '1.', '+1'])
      rejects(v => { v.gl.records[0][field] = value })
    rejects(v => { delete v.gl.records[0][field] })
  }
  rejects(v => { v.gl.records[0].localAmount = '0.001' })
  rejects(v => { v.gl.records[0].quantity = '0.0000000000000000001' })
  rejects(v => { v.gl.records[0].baseAmount = '1'.repeat(37) })
  for (const value of ['0', '-1']) rejects(v => { v.gl.records[0].fxRate = value })
  for (const field of ['amount', 'quantity']) rejects(v => { v.tolerances = { amount: '0.01', quantity: '0', [field]: '-0.01' } })
})

test('ISO dates must exist in calendar; no coercion of timestamps or ambiguous dates', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-11-00', '11/04/2026', '2026-11-4', '2026-11-04T00:00:00Z'])
    rejects(v => { v.gl.records[0].postingDate = value })
  const value = fixture([record('A', { postingDate: '2024-02-29' })], [record('A')])
  assert.equal(run(value).rows[0].bucket, 'TIMING_BREAK')
})

test('strict nested schemas reject authority, credentials, commands, paths, endpoints and provider claims', () => {
  const forbidden = { role: 'admin', identity: 'finance-gl-reconciler-critic', credentials: 'secret', command: 'post', endpoint: 'https://example.com',
    path: '../ledger', sourceMcp: 'internal-gl', source_mcp: 'subledger', verified: true, approved: true, rootCause: 'proven', evidence: {} }
  for (const [key, value] of Object.entries(forbidden)) {
    rejects(v => { v[key] = value }); rejects(v => { v.gl.records[0][key] = value })
  }
  rejects(v => { v.classification = 'AUTHORIZED_PROVIDER' })
  for (const value of ['internal-gl', 'subledger', 'mcp__internal-gl', 'https://example.com', '../path', 'A/B', 'Bearer token=secret', '=SUM(A1)'])
    rejects(v => { v.gl.records[0].commonKey = value })
})

test('object, getter, proxy and cycle arguments are rejected without inspection or serialization', () => {
  let touched = 0
  const getter = Object.defineProperty({}, 'classification', { get() { touched++; throw new Error('getter invoked') } })
  const proxy = new Proxy({}, { get() { touched++; throw new Error('proxy invoked') }, ownKeys() { touched++; throw new Error('keys invoked') } })
  const cycle = {}; cycle.self = cycle
  for (const value of [getter, proxy, cycle, null, 123, [], new String('{}')]) assert.throws(() => reconcileGl(value), /JSON_STRING_REQUIRED/)
  assert.equal(touched, 0)
})

test('prototype keys, malformed JSON and nonfinite tokens reject without pollution', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const text = JSON.stringify(fixture()).replace('"gl":{', `"gl":{"${key}":{},`)
    assert.throws(() => reconcileGl(text), /INVALID_JSON_OR_PROTOTYPE_KEY/)
  }
  for (const text of ['{', 'null', '[]', '{}', 'NaN', 'Infinity']) assert.throws(() => reconcileGl(text))
  assert.equal({}.polluted, undefined)
})

test('64 KiB UTF-8 and 256-per-side limits apply before expensive row validation', () => {
  const text = JSON.stringify(fixture()), exact = text + ' '.repeat(65536 - Buffer.byteLength(text, 'utf8'))
  assert.equal(reconcileGl(exact).summary.joinedRows, 0)
  assert.throws(() => reconcileGl(exact + ' '))
  assert.throws(() => reconcileGl('"' + 'é'.repeat(33000) + '"'), /MAX_UTF8_BYTES_65536/)
  for (const side of ['gl', 'subledger']) {
    const v = fixture(); v[side].records = Array.from({ length: 257 }, () => ({}))
    assert.throws(() => run(v), /MAX_ROWS_PER_SIDE_256/)
  }
  const parsed = glReconciliationInputSchema.safeParse(JSON.stringify(fixture()))
  assert.equal(parsed.success, true); assert.deepEqual(parsed.data.tolerances, { amount: '0.01', quantity: '0' })
})
