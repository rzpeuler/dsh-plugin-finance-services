import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { z } from 'zod'
import { createDataSchemas, CAPABILITIES } from '../src/data/contracts.js'
import { normalizeObservations } from '../src/data/normalization.js'
import { fixedNow, makeQuery, makeMetadata, makeResult } from './data-fixtures.js'
const schemas = createDataSchemas(z)
const normalize = (query = makeQuery(), result = makeResult(), metadata = makeMetadata(), now = fixedNow) => normalizeObservations(query, result, metadata, now)
const rejected = (code, change) => { const q = makeQuery(), r = makeResult(), m = makeMetadata(); change(q, r, m); assert.throws(() => normalize(q, r, m), error => error.code === code) }

test('fourteen stable capabilities and self-contained Client schema factory', () => {
  assert.equal(CAPABILITIES.length, 14)
  assert.equal(new Set(CAPABILITIES).size, 14)
  const factory = vm.runInNewContext(`(${createDataSchemas.toString()})`, { URL, Date })
  assert.equal(factory(z).Query.safeParse(makeQuery()).success, true)
  assert.equal(schemas.Query.safeParse({ ...makeQuery(), roleId: 'finance-pitch-agent' }).success, false)
  assert.equal(schemas.AdapterMetadata.safeParse({ ...makeMetadata(), apiKey: 'NOT_A_REAL_KEY' }).success, false)
})

test('dates, known offsets, dimensions and strict nested envelopes are validated', () => {
  for (const date of ['2025-02-29', '2024-02-30', '0000-01-01', '2025-1-01']) assert.equal(schemas.ISODate.safeParse(date).success, false)
  assert.equal(schemas.ISODate.safeParse('2024-02-29').success, true)
  for (const stamp of ['2025-02-30T00:00:00Z', '2025-01-01T24:00:00Z', '2025-01-01T00:00:00-00:00', '2025-01-01']) assert.equal(schemas.Timestamp.safeParse(stamp).success, false)
  assert.equal(schemas.Unit.safeParse({ dimension: 'ratio', currency: 'USD', scale: 'percent' }).success, false)
  assert.equal(schemas.Query.safeParse({ ...makeQuery(), entity: { scheme: 'ticker', id: 'TEST', code: 'ignored' } }).success, false)
})

test('unit conversion is deterministic and retains original supplier/version/license provenance', () => {
  const result = normalize()
  assert.equal(result.observations[0].value, 2000000)
  assert.equal(result.observations[0].provenance.originalValue, 2)
  assert.equal(result.observations[0].provenance.originalUnit.scale, 'millions')
  assert.equal(result.observations[0].provenance.testOnly, true)
  assert.equal(result.observations[0].provenance.adapterVersion, '1.0.0')
  assert.match(result.observations[0].observationId, /^sha256:[a-f0-9]{64}$/)
  assert.equal(result.observations[0].observationId, normalize().observations[0].observationId)
})

test('sources and revisions are separate observations, never averaged or deduplicated', () => {
  const raw = makeResult()
  raw.observations.push({ ...structuredClone(raw.observations[0]), revision: 'r2', value: 3 })
  const result = normalize(makeQuery(), raw)
  assert.deepEqual(result.observations.map(item => item.value), [2000000, 3000000])
  assert.notEqual(result.observations[0].observationId, result.observations[1].observationId)
  assert.notEqual(result.observations[0].observationId, normalize(makeQuery(), makeResult(), makeMetadata('other-source')).observations[0].observationId)
})

test('PIT uses original availability, not the later historical retrieval time', () => {
  assert.equal(normalize().observations[0].retrievedAt, fixedNow)
  rejected('PIT_VIOLATION', (_q, r) => { r.observations[0].availableAt = '2025-03-01T12:00:00Z' })
  rejected('PIT_VIOLATION', (_q, r) => { r.observations[0].sourceAsOf = '2025-03-01T01:00:00Z'; r.observations[0].availableAt = '2025-03-01T02:00:00Z' })
  rejected('PIT_VIOLATION', (_q, _r, m) => { m.capabilities[0].pointInTime = false })
  rejected('CHRONOLOGY_INVALID', (_q, r) => { r.observations[0].retrievedAt = '2025-03-03T00:00:00Z' })
  rejected('STALE_DATA', q => { q.maxAgeSeconds = 1 })
})

test('currency, dimension, entity, period and accounting incompatibilities are not silently repaired', () => {
  rejected('CURRENCY_INCOMPATIBLE', q => { q.targetUnit.currency = 'EUR' })
  rejected('UNIT_INCOMPATIBLE', q => { q.targetUnit = { dimension: 'count', currency: null, scale: 'ones' } })
  rejected('ENTITY_MISMATCH', (_q, r) => { r.observations[0].entity.id = 'OTHER' })
  rejected('PERIOD_MISMATCH', (_q, r) => { r.observations[0].period.end = '2024-12-30' })
  rejected('ACCOUNTING_BASIS_INCOMPATIBLE', q => { q.accountingBasis = 'IFRS' })
  rejected('CONSOLIDATION_INCOMPATIBLE', q => { q.consolidation = 'parent_only' })
})

test('required fields are not guessed or replaced with zero', () => {
  rejected('MISSING_FIELDS', (_q, r) => { r.observations[0].value = null })
  rejected('MISSING_FIELDS', (_q, r) => { r.observations = [] })
  rejected('COVERAGE_MISMATCH', q => { q.requiredFields = ['unavailable'] })
  rejected('LICENSE_MISMATCH', (_q, r) => { r.observations[0].licenseClass = 'COMMERCIAL' })
  rejected('INVALID_RESULT', (_q, r) => { r.observations[0].value = Infinity })
  rejected('INVALID_RESULT', (_q, r) => { r.observations[0].reference.uri = 'https://example.invalid/file?api_key=secret' })
})

test('ratios scale explicitly and conversion overflow is rejected', () => {
  const q = makeQuery(), r = makeResult()
  q.targetUnit = { dimension: 'ratio', currency: null, scale: 'basis_points' }
  r.observations[0].unit = { dimension: 'ratio', currency: null, scale: 'percent' }
  r.observations[0].value = 2
  assert.equal(normalize(q, r).observations[0].value, 200)
  rejected('NUMERIC_PRECISION_UNSUPPORTED', (_q, raw) => { raw.observations[0].value = 10000000000000000 })
})

test('range periods may contain individual observations without erasing their original periods', () => {
  const q = makeQuery(), r = makeResult()
  q.period = { kind: 'range', start: '2024-01-01', end: '2024-12-31' }
  r.observations[0].period = { kind: 'instant', start: '2024-06-01', end: '2024-06-01' }
  assert.equal(normalize(q, r).observations[0].period.kind, 'instant')
})

test('estimates never masquerade as historical statements or actuals from an unfinished period', () => {
  rejected('MEASUREMENT_INCOMPATIBLE', (_q, raw) => { raw.observations[0].measurementType = 'forecast' })
  rejected('MEASUREMENT_INCOMPATIBLE', q => { q.measurementType = 'estimate' })
  rejected('PERIOD_NOT_AVAILABLE', (q, raw) => {
    q.period.end = '2025-12-31'; raw.observations[0].period.end = '2025-12-31'
  })
  const q = makeQuery(), m = makeMetadata(), r = makeResult()
  q.capability = 'earnings.consensus'; q.period.end = '2025-12-31'
  m.capabilities[0].id = 'earnings.consensus'
  r.observations[0].period.end = '2025-12-31'; r.observations[0].measurementType = 'estimate'
  assert.equal(normalize(q, r, m).observations[0].measurementType, 'estimate')
})
