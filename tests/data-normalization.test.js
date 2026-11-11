import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createDataSchemas } from '../src/data/contracts.js'
import { DataContractError, normalizeObservations } from '../src/data/normalization.js'

const schemas = createDataSchemas(z)
const NOW = '2025-04-05T12:00:00+08:00'
const reference = { uri: 'https://example.com/filings/600519-2024', label: 'Source record evidence' }
const filingReference = { uri: 'https://example.com/filings/600519-annual-report', label: '2024 Annual Report filing' }
const baseQuery = () => ({
  capability: 'financial.statements', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
  requiredFields: ['netProfit'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  asOf: '2025-04-05T00:00:00+08:00', purpose: 'research', maxAgeSeconds: 31536000,
})
const timestampEvidence = (overrides = {}) => ({
  type: 'timestamp', sourcePublishedAt: '2025-04-03T10:00:00+08:00',
  availableAt: '2025-04-03T10:00:00+08:00', ...overrides,
})
const dateEvidence = (overrides = {}) => ({
  type: 'date', publishedDate: '2025-04-03', timeZone: 'Asia/Shanghai',
  rule: 'next_local_midnight', availableAt: '2025-04-04T00:00:00+08:00', ...overrides,
})
const revisionEvidence = (overrides = {}) => ({
  chainId: 'cninfo-600519-fy2024', chainStatus: 'single_record', supersedes: [], changeType: 'original',
  sourceRecordId: 'cninfo-record-2025-04-03', capturedAt: '2025-04-03T11:00:00+08:00',
  evidence: reference, ...overrides,
})
const observation = (overrides = {}) => ({
  field: 'netProfit', entity: { scheme: 'ticker', id: '600519.SH' }, value: 2,
  unit: { dimension: 'currency', currency: 'CNY', scale: 'millions' },
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  measurementType: 'actual', accountingBasis: 'PRC_GAAP', consolidation: 'consolidated',
  availabilityEvidence: timestampEvidence(), retrievedAt: '2025-04-05T11:00:00+08:00',
  revision: 'cninfo-revision-1', revisionEvidence: revisionEvidence(), reference, licenseClass: 'TEST_ONLY',
  ...overrides,
})
const metadata = (overrides = {}) => ({
  id: 'cninfo-test', version: '1.0.0', sourceId: 'cninfo', label: 'CNINFO test adapter',
  testOnly: true, licenseClass: 'TEST_ONLY', capabilities: [{
    id: 'financial.statements', markets: ['CN'], fields: ['netProfit', 'revenue'],
    temporalModes: ['strict', 'date_bounded', 'current_only'], priority: 1, quality: 50,
  }],
  ...overrides,
})
const adapterResult = (rows = [observation()], overrides = {}) => ({
  observations: rows, corporateActions: [], warnings: [], ...overrides,
})
function priceQuery(overrides = {}) {
  return {
    ...baseQuery(), capability: 'prices.history', requiredFields: ['close'],
    period: { kind: 'instant', start: '2025-04-04', end: '2025-04-04' }, ...overrides,
  }
}
function priceObservation(overrides = {}) {
  return observation({
    field: 'close', value: 12.5,
    unit: { dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' },
    period: { kind: 'instant', start: '2025-04-04', end: '2025-04-04' },
    availabilityEvidence: timestampEvidence({
      sourcePublishedAt: '2025-04-04T10:00:00+08:00', availableAt: '2025-04-04T10:00:00+08:00',
    }),
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T11:00:00+08:00' }),
    ...overrides,
  })
}
function priceMetadata(priceAdjustments = ['none']) {
  return {
    ...metadata(), capabilities: [{
      id: 'prices.history', markets: ['CN'], fields: ['close'], temporalModes: ['strict'],
      priceAdjustments, priority: 1, quality: 50,
    }],
  }
}
const filingFields = ['filing_id', 'filing_type', 'title', 'announcement_date', 'report_period', 'filing_reference']
function filingQuery(overrides = {}) {
  return {
    ...baseQuery(), capability: 'filings', requiredFields: [...filingFields],
    period: { kind: 'range', start: '2025-01-01', end: '2025-12-31' }, ...overrides,
  }
}
function filingRecord(overrides = {}) {
  const filingId = 'cninfo-filing-record-2025-04-03'
  return {
    filingId, entity: { scheme: 'ticker', id: '600519.SH' }, filingType: 'annual_report',
    title: '2024 Annual Report', announcementDate: '2025-04-03',
    reportPeriod: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
    filingReference, availabilityEvidence: timestampEvidence(),
    retrievedAt: '2025-04-05T11:00:00+08:00', revision: 'cninfo-filing-revision-1',
    revisionEvidence: revisionEvidence({
      chainId: 'cninfo-filing-chain-1', sourceRecordId: filingId,
    }), licenseClass: 'TEST_ONLY', ...overrides,
  }
}
function filingMetadata(overrides = {}) {
  return {
    ...metadata(), capabilities: [{
      id: 'filings', markets: ['CN'], fields: [...filingFields],
      temporalModes: ['strict', 'date_bounded', 'current_only'], priority: 1, quality: 50,
    }], ...overrides,
  }
}
function filingResult(filings = [filingRecord()], overrides = {}) {
  return { observations: [], corporateActions: [], filings, warnings: [], ...overrides }
}
const normalize = (query = baseQuery(), result = adapterResult(), meta = metadata(), now = NOW) =>
  normalizeObservations(query, result, meta, now)
const rejected = (code, query, result, meta, now = NOW) => {
  assert.throws(() => normalize(query, result, meta, now), error => error.code === code)
}
function actionRecord(overrides = {}) {
  return {
    actionId: 'cninfo-action-600519-2024', entity: { scheme: 'ticker', id: '600519.SH' },
    actionType: 'cash_dividend', status: 'announced',
    terms: [{ kind: 'cash_per_share', value: 2.76, currency: 'CNY', ratio: null, unit: 'CNY/share' }],
    announcementDate: '2025-04-03', recordDate: '2025-06-26', exDate: '2025-06-27',
    paymentDate: '2025-07-02', effectiveDate: null, filingReference: reference,
    availabilityEvidence: timestampEvidence(), retrievedAt: '2025-07-01T11:00:00+08:00',
    revision: 'cninfo-action-rev-1', revisionEvidence: revisionEvidence({
      chainId: 'cninfo-action-chain', sourceRecordId: 'cninfo-action-record-1',
    }), licenseClass: 'TEST_ONLY', ...overrides,
  }
}
function actionQuery(overrides = {}) {
  return {
    ...baseQuery(), capability: 'corporate.actions', requiredFields: ['cash_dividend', 'cash_per_share'],
    period: { kind: 'range', start: '2025-01-01', end: '2025-12-31' },
    asOf: '2025-07-01T00:00:00+08:00', corporateActionDateBasis: 'ex_date', ...overrides,
  }
}
function actionMetadata(overrides = {}) {
  return {
    ...metadata(), capabilities: [{
      id: 'corporate.actions', markets: ['CN'], fields: ['cash_dividend', 'cash_per_share', 'ex_date'],
      temporalModes: ['strict', 'date_bounded'], corporateActionDateBases: ['ex_date', 'announcement_date'],
      priority: 1, quality: 50,
    }], ...overrides,
  }
}
function actionResult(actions = [actionRecord()], overrides = {}) {
  return { observations: [], corporateActions: actions, warnings: [], ...overrides }
}

test('strict mode accepts timestamp evidence with a complete or single-record source revision chain', () => {
  const output = normalize({ ...baseQuery(), targetUnit: { dimension: 'currency', currency: 'CNY', scale: 'ones' } })

  assert.equal(output.observations[0].value, 2000000)
  assert.equal(output.observations[0].provenance.originalValue, 2)
  assert.equal(output.observations[0].provenance.originalUnit.scale, 'millions')
  assert.match(output.observations[0].observationId, /^sha256:[a-f0-9]{64}$/)
  assert.equal(output.observations[0].observationId, normalize().observations[0].observationId)
  assert.deepEqual(output.corporateActions, [])
})

test('date_bounded mode accepts timestamp/date evidence and emits a structured warning for date evidence', () => {
  const query = { ...baseQuery(), temporalMode: 'date_bounded' }
  const row = observation({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00' }),
  })
  const output = normalize(query, adapterResult([row]))
  assert.deepEqual(output.warnings, [{
    code: 'DATE_BOUNDED_AVAILABILITY',
    message: 'Date-only publication evidence uses its declared next-local-midnight availability boundary.',
  }])
  assert.deepEqual(normalize(query).warnings, [])
})

test('current_only accepts a recent request before capture, warns with capture time, and rejects stale requests', () => {
  const now = '2025-04-05T12:02:00+08:00'
  const query = { ...baseQuery(), temporalMode: 'current_only', asOf: '2025-04-05T11:57:00+08:00', maxAgeSeconds: 3600 }
  const capturedAt = '2025-04-05T12:01:00+08:00'
  const row = observation({
    availabilityEvidence: { type: 'current_snapshot', capturedAt }, retrievedAt: capturedAt,
    revision: null,
    revisionEvidence: revisionEvidence({
      chainId: null, chainStatus: 'unknown', sourceRecordId: null, changeType: 'unknown', capturedAt,
    }),
  })
  const output = normalize(query, adapterResult([row]), metadata(), now)
  assert.deepEqual(output.warnings.find(warning => warning.code === 'CURRENT_ONLY_SNAPSHOT'), {
    code: 'CURRENT_ONLY_SNAPSHOT',
    message: `Current snapshot read at ${capturedAt}; source row captured at ${capturedAt}. This is not a historical asOf guarantee.`,
  })
  const staleSourceRow = observation({
    availabilityEvidence: { type: 'current_snapshot', capturedAt }, retrievedAt: capturedAt,
    revision: null,
    revisionEvidence: revisionEvidence({ chainId: null, chainStatus: 'unknown', sourceRecordId: null,
      changeType: 'unknown', capturedAt: '2025-04-05T10:00:00+08:00' }),
  })
  const agedOutput = normalize({ ...query, maxAgeSeconds: 10000 }, adapterResult([staleSourceRow]), metadata(), now)
  assert.equal(agedOutput.warnings[0].message.includes('Current snapshot read at 2025-04-05T12:01:00+08:00; source row captured at 2025-04-05T10:00:00+08:00.'), true)
  rejected('STALE_DATA', query, adapterResult([staleSourceRow]), metadata(), now)
  const oldAsOf = '2025-04-05T11:56:59+08:00'
  const oldCapture = '2025-04-05T11:56:00+08:00'
  const olderRow = observation({
    availabilityEvidence: { type: 'current_snapshot', capturedAt: oldCapture }, retrievedAt: oldCapture,
    revision: null,
    revisionEvidence: revisionEvidence({ chainId: null, chainStatus: 'unknown', sourceRecordId: null,
      changeType: 'unknown', capturedAt: oldCapture }),
  })
  rejected('CURRENT_ONLY_REQUEST_STALE', { ...query, asOf: oldAsOf, maxAgeSeconds: 86400 }, adapterResult([olderRow]), metadata(), now)
  const strictQuery = { ...query, temporalMode: 'strict', asOf: now }
  rejected('TEMPORAL_MODE_UNSUPPORTED', strictQuery, adapterResult([row]), metadata(), now)
})

test('strict and date_bounded still reject evidence captured or available after asOf', () => {
  const strictRow = observation({
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-05T00:30:00+08:00' }),
  })
  rejected('PIT_VIOLATION', baseQuery(), adapterResult([strictRow]), metadata())
  const dateQuery = {
    ...baseQuery(), temporalMode: 'date_bounded', asOf: '2025-04-03T23:59:00+08:00',
  }
  const dateRow = observation({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-03T11:00:00+08:00' }),
  })
  rejected('PIT_VIOLATION', dateQuery, adapterResult([dateRow]), metadata())
})

test('date-only freshness uses the earliest instant on its publication date', () => {
  const query = {
    ...baseQuery(), temporalMode: 'date_bounded', asOf: '2025-04-04T01:00:00+08:00', maxAgeSeconds: 3600,
  }
  const row = observation({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00' }),
  })
  rejected('STALE_DATA', query, adapterResult([row]), metadata())
})

test('historical modes reject missing or reconstructed revision provenance', () => {
  const query = baseQuery()
  rejected('INVALID_RESULT', query, adapterResult([observation({ revision: null })]), metadata())
  rejected('REVISION_EVIDENCE_INCOMPLETE', query, adapterResult([observation({
    revisionEvidence: revisionEvidence({ chainStatus: 'partial' }),
  })]), metadata())
  rejected('REVISION_EVIDENCE_INCOMPLETE', query, adapterResult([observation({
    revisionEvidence: revisionEvidence({ chainStatus: 'unknown', chainId: null, sourceRecordId: null }),
  })]), metadata())
  rejected('REVISION_EVIDENCE_INCOMPLETE', query, adapterResult([observation({
    revisionEvidence: revisionEvidence({ changeType: 'reconstructed_backfill' }),
  })]), metadata())
  rejected('REVISION_EVIDENCE_INCOMPLETE', { ...query, temporalMode: 'date_bounded' }, adapterResult([observation({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00', chainStatus: 'unknown', chainId: null, sourceRecordId: null }),
  })]), metadata())
})

test('capability, market, source, field, entity, period, measurement and accounting scopes are enforced', () => {
  rejected('CAPABILITY_MISMATCH', { ...baseQuery(), capability: 'prices.history' }, adapterResult(), metadata())
  rejected('COVERAGE_MISMATCH', { ...baseQuery(), market: 'US' }, adapterResult(), metadata())
  rejected('COVERAGE_MISMATCH', { ...baseQuery(), sourceIds: ['another-source'] }, adapterResult(), metadata())
  rejected('COVERAGE_MISMATCH', { ...baseQuery(), requiredFields: ['missingField'] }, adapterResult(), metadata())
  rejected('COVERAGE_MISMATCH', baseQuery(), adapterResult([observation({ field: 'undeclared' })]), metadata())
  rejected('ENTITY_MISMATCH', baseQuery(), adapterResult([observation({ entity: { scheme: 'ticker', id: '000001.SZ' } })]), metadata())
  rejected('PERIOD_MISMATCH', baseQuery(), adapterResult([observation({
    period: { kind: 'fiscal_year', start: '2023-01-01', end: '2023-12-31' },
  })]), metadata())
  rejected('MEASUREMENT_INCOMPATIBLE', baseQuery(), adapterResult([observation({ measurementType: 'forecast' })]), metadata())
  rejected('MEASUREMENT_INCOMPATIBLE', { ...baseQuery(), measurementType: 'estimate' }, adapterResult(), metadata())
  rejected('ACCOUNTING_BASIS_INCOMPATIBLE', { ...baseQuery(), accountingBasis: 'IFRS' }, adapterResult(), metadata())
  rejected('CONSOLIDATION_INCOMPATIBLE', { ...baseQuery(), consolidation: 'parent_only' }, adapterResult(), metadata())
})

test('temporal mode must be declared and adapter license must match every row', () => {
  const noMode = metadata({ capabilities: [{
    id: 'financial.statements', markets: ['CN'], fields: ['netProfit'], temporalModes: ['date_bounded'], priority: 1, quality: 50,
  }] })
  rejected('TEMPORAL_MODE_UNSUPPORTED', baseQuery(), adapterResult(), noMode)
  rejected('LICENSE_MISMATCH', baseQuery(), adapterResult([observation({ licenseClass: 'PUBLIC_LICENSED' })]), metadata())
})

test('required observations cannot be null or missing and values are not synthesized', () => {
  rejected('MISSING_FIELDS', baseQuery(), adapterResult([observation({ value: null })]), metadata())
  rejected('MISSING_FIELDS', baseQuery(), adapterResult([]), metadata())
})

test('query asOf, publication, availability, capture and retrieval chronology are checked', () => {
  rejected('PIT_VIOLATION', { ...baseQuery(), asOf: '2025-04-05T13:00:00+08:00' }, adapterResult(), metadata())
  rejected('PIT_VIOLATION', baseQuery(), adapterResult([observation({
    availabilityEvidence: timestampEvidence({ sourcePublishedAt: '2025-04-05T01:00:00+08:00', availableAt: '2025-04-05T01:00:00+08:00' }),
  })]), metadata())
  rejected('PIT_VIOLATION', baseQuery(), adapterResult([observation({
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-05T01:00:00+08:00' }),
  })]), metadata())
  rejected('CHRONOLOGY_INVALID', baseQuery(), adapterResult([observation({ retrievedAt: '2025-04-05T13:00:00+08:00' })]), metadata())
  rejected('INVALID_RESULT', baseQuery(), adapterResult([observation({
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-05T12:00:00+08:00' }),
  })]), metadata())
  rejected('STALE_DATA', { ...baseQuery(), maxAgeSeconds: 0 }, adapterResult(), metadata())
})

test('actual observation periods cannot extend beyond timestamp, date, or capture evidence date', () => {
  const period = { kind: 'fiscal_year', start: '2025-01-01', end: '2025-12-31' }
  const query = { ...baseQuery(), period }
  rejected('PERIOD_NOT_AVAILABLE', query, adapterResult([observation({ period })]), metadata())
  const dateQuery = { ...query, temporalMode: 'date_bounded' }
  rejected('PERIOD_NOT_AVAILABLE', dateQuery, adapterResult([observation({
    period, availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00' }),
  })]), metadata())
  const pricePeriod = { kind: 'instant', start: '2025-04-05', end: '2025-04-05' }
  rejected('PERIOD_NOT_AVAILABLE', priceQuery({ period: pricePeriod }),
    adapterResult([priceObservation({ period: pricePeriod })]), priceMetadata())
  const readAt = '2025-04-05T12:01:00+08:00'
  const currentPriceQuery = priceQuery({
    period: pricePeriod, temporalMode: 'current_only', asOf: '2025-04-05T12:00:00+08:00', maxAgeSeconds: 31536000,
  })
  const currentPriceRow = priceObservation({
    period: pricePeriod,
    availabilityEvidence: { type: 'current_snapshot', capturedAt: readAt }, retrievedAt: readAt,
    revision: null,
    revisionEvidence: revisionEvidence({
      chainId: null, chainStatus: 'unknown', sourceRecordId: null, changeType: 'unknown',
      capturedAt: '2025-04-04T10:00:00+08:00',
    }),
  })
  const currentPriceMetadata = priceMetadata()
  currentPriceMetadata.capabilities[0].temporalModes = ['current_only']
  rejected('PERIOD_NOT_AVAILABLE', currentPriceQuery, adapterResult([currentPriceRow]), currentPriceMetadata,
    '2025-04-05T12:02:00+08:00')
})

test('unit conversion is explicit, deterministic and rejects FX or incompatible dimensions', () => {
  const query = { ...baseQuery(), targetUnit: { dimension: 'currency', currency: 'CNY', scale: 'ones' } }
  assert.equal(normalize(query).observations[0].value, 2000000)
  rejected('CURRENCY_INCOMPATIBLE', { ...query, targetUnit: { dimension: 'currency', currency: 'USD', scale: 'ones' } }, adapterResult(), metadata())
  rejected('UNIT_INCOMPATIBLE', { ...query, targetUnit: { dimension: 'count', currency: null, scale: 'ones' } }, adapterResult(), metadata())
  rejected('NUMERIC_PRECISION_UNSUPPORTED', baseQuery(), adapterResult([observation({ value: 10000000000000000 })]), metadata())
})

test('prices.history keeps adjustment semantics and converts currency-per-share units explicitly', () => {
  const unit = { dimension: 'currency_per_share', currency: 'CNY', scale: 'thousands' }
  const query = priceQuery({ targetUnit: unit })
  const noneOnly = priceMetadata()
  assert.deepEqual(noneOnly.capabilities[0].priceAdjustments, ['none'])
  const converted = normalize(query, adapterResult([priceObservation()]), noneOnly)
  assert.equal(converted.observations[0].value, 0.0125)
  assert.deepEqual(converted.observations[0].unit, unit)
  rejected('CURRENCY_INCOMPATIBLE', priceQuery({
    targetUnit: { dimension: 'currency_per_share', currency: 'USD', scale: 'ones' },
  }), adapterResult([priceObservation()]), noneOnly)
  rejected('UNIT_INCOMPATIBLE', priceQuery({
    targetUnit: { dimension: 'currency', currency: 'CNY', scale: 'ones' },
  }), adapterResult([priceObservation()]), noneOnly)
  rejected('PRICE_ADJUSTMENT_UNSUPPORTED', priceQuery({ priceAdjustment: 'qfq' }),
    adapterResult([priceObservation()]), noneOnly)
  rejected('PRICE_ADJUSTMENT_UNSUPPORTED', priceQuery({ priceAdjustment: 'total_return' }),
    adapterResult([priceObservation()]), noneOnly)
  const declared = priceMetadata(['none', 'qfq'])
  const rawId = normalize(priceQuery(), adapterResult([priceObservation()]), declared).observations[0].observationId
  const qfqId = normalize(priceQuery({ priceAdjustment: 'qfq' }), adapterResult([priceObservation()]), declared).observations[0].observationId
  assert.notEqual(rawId, qfqId)
})

test('adapter warning text is never echoed; normalized warnings use a safe structured code', () => {
  const output = normalize(baseQuery(), adapterResult([observation()], { warnings: ['source timeout; please retry'] }))
  assert.deepEqual(output.warnings, [{
    code: 'ADAPTER_WARNING', message: 'The adapter reported one or more warnings; provider details were omitted.',
  }])
  const secretWarning = 'authorization: Bearer test-secret-value'
  assert.throws(() => normalize(baseQuery(), adapterResult([observation()], { warnings: [secretWarning] })), error => {
    assert.equal(error.code, 'INVALID_RESULT')
    assert.doesNotMatch(`${error.message} ${error.details.join(' ')}`, /test-secret-value/)
    return true
  })
})

test('filings normalize as typed records with announcement-range semantics and provenance', () => {
  const query = filingQuery()
  const raw = filingRecord({ filingType: '年度报告' })
  const output = normalize(query, filingResult([raw]), filingMetadata())
  assert.deepEqual(output.observations, [])
  assert.deepEqual(output.corporateActions, [])
  assert.equal(output.filings.length, 1)
  assert.equal(output.filings[0].filingId, raw.filingId)
  assert.equal(output.filings[0].filingType, '年度报告')
  assert.equal(output.filings[0].announcementDate, '2025-04-03')
  assert.deepEqual(output.filings[0].reportPeriod, { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' })
  assert.deepEqual(output.filings[0].filingReference, filingReference)
  assert.equal(output.filings[0].provenance.sourceRecordId, raw.filingId)
  assert.deepEqual(output.filings[0].provenance.originalFilingReference, filingReference)
  assert.deepEqual(output.filings[0].provenance.sourceEvidence, reference)
  assert.equal('observationId' in output.filings[0], false)
  assert.equal(schemas.NormalizedFilingRecord.safeParse(output.filings[0]).success, true)
  assert.deepEqual(normalize().filings, [])
})

test('filings require canonical fields and a populated announcement date within the range', () => {
  const query = filingQuery()
  rejected('FILING_ANNOUNCEMENT_DATE_MISSING', query,
    filingResult([filingRecord({ announcementDate: null })]), filingMetadata())
  rejected('FILING_ANNOUNCEMENT_DATE_OUT_OF_RANGE', query,
    filingResult([filingRecord({ announcementDate: '2026-01-01' })]), filingMetadata())
  rejected('MISSING_FIELDS', query,
    filingResult([filingRecord({ reportPeriod: null })]), filingMetadata())
  rejected('FILING_ANNOUNCEMENT_EVIDENCE_MISMATCH', { ...query, temporalMode: 'date_bounded' },
    filingResult([filingRecord({
      availabilityEvidence: dateEvidence({ publishedDate: '2025-04-02' }),
      retrievedAt: '2025-04-04T01:00:00+08:00',
      revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00', sourceRecordId: filingRecord().filingId }),
    })]), filingMetadata())
})

test('filings preserve strict/date/current evidence, source provenance, entity, license, and freshness safeguards', () => {
  const query = filingQuery()
  const raw = filingRecord()
  assert.equal(normalize(query, filingResult([raw]), filingMetadata()).warnings.length, 0)
  const dateQuery = { ...query, temporalMode: 'date_bounded' }
  const dateRow = filingRecord({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00', sourceRecordId: filingRecord().filingId }),
  })
  const dateOutput = normalize(dateQuery, filingResult([dateRow]), filingMetadata())
  assert.equal(dateOutput.warnings.some(warning => warning.code === 'DATE_BOUNDED_AVAILABILITY'), true)
  rejected('TEMPORAL_MODE_UNSUPPORTED', query, filingResult([dateRow]), filingMetadata())
  rejected('REVISION_EVIDENCE_INCOMPLETE', query, filingResult([filingRecord({
    revision: null,
    revisionEvidence: revisionEvidence({ chainStatus: 'unknown', chainId: null, sourceRecordId: filingRecord().filingId }),
  })]), filingMetadata())
  rejected('ENTITY_MISMATCH', query, filingResult([filingRecord({ entity: { scheme: 'ticker', id: 'OTHER' } })]), filingMetadata())
  rejected('LICENSE_MISMATCH', query, filingResult([filingRecord({ licenseClass: 'PUBLIC_LICENSED' })]), filingMetadata())
  rejected('STALE_DATA', { ...query, maxAgeSeconds: 0 }, filingResult([raw]), filingMetadata())

  const now = '2025-04-05T12:02:00+08:00'
  const localReadAt = '2025-04-05T12:01:00+08:00'
  const currentQuery = {
    ...query, temporalMode: 'current_only', asOf: '2025-04-05T12:00:00+08:00', maxAgeSeconds: 3600,
  }
  const currentRow = filingRecord({
    availabilityEvidence: { type: 'current_snapshot', capturedAt: localReadAt }, retrievedAt: localReadAt,
    revision: null,
    revisionEvidence: revisionEvidence({
      chainId: null, chainStatus: 'unknown', sourceRecordId: filingRecord().filingId, changeType: 'unknown',
      capturedAt: '2025-04-05T12:00:00+08:00',
    }),
  })
  const currentOutput = normalize(currentQuery, filingResult([currentRow]), filingMetadata(), now)
  const currentWarning = currentOutput.warnings.find(warning => warning.code === 'CURRENT_ONLY_SNAPSHOT')
  assert.equal(currentWarning.message.includes('Current snapshot read at 2025-04-05T12:01:00+08:00'), true)
  assert.equal(currentWarning.message.includes('source row captured at 2025-04-05T12:00:00+08:00'), true)
})

test('filings cannot mix with generic observations or corporate actions', () => {
  const query = filingQuery()
  rejected('INVALID_FILING_RESULT', query,
    filingResult([filingRecord()], { observations: [observation()] }), filingMetadata())
  rejected('INVALID_FILING_RESULT', baseQuery(),
    adapterResult([observation()], { filings: [filingRecord()] }), metadata())
  rejected('INVALID_CORPORATE_ACTION_RESULT', actionQuery(),
    actionResult([actionRecord()], { filings: [filingRecord()] }), actionMetadata(), '2025-07-01T12:00:00+08:00')
})

test('corporate.actions requires declared date basis and only CorporateActionRecord values', () => {
  const query = actionQuery()
  const output = normalize(query, actionResult(), actionMetadata(), '2025-07-01T12:00:00+08:00')
  assert.equal(output.observations.length, 0)
  assert.equal(output.corporateActions.length, 1)
  assert.equal(output.corporateActions[0].actionId, 'cninfo-action-600519-2024')
  assert.equal(output.corporateActions[0].announcementDate, '2025-04-03')
  assert.equal(output.corporateActions[0].recordDate, '2025-06-26')
  assert.equal(output.corporateActions[0].exDate, '2025-06-27')
  assert.deepEqual(output.corporateActions[0].provenance.originalTerms, output.corporateActions[0].terms)
  assert.equal(output.corporateActions[0].provenance.sourceRecordId, 'cninfo-action-record-1')
  assert.deepEqual(output.corporateActions[0].provenance.sourceEvidence, reference)
  assert.equal(schemas.NormalizedCorporateActionRecord.safeParse(output.corporateActions[0]).success, true)
  rejected('CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED', query, actionResult(), actionMetadata({ capabilities: [{
    ...actionMetadata().capabilities[0], corporateActionDateBases: ['announcement_date'],
  }] }), '2025-07-01T12:00:00+08:00')
  rejected('INVALID_CORPORATE_ACTION_RESULT', query, actionResult([actionRecord()], { observations: [observation()] }), actionMetadata(), '2025-07-01T12:00:00+08:00')
  rejected('INVALID_CORPORATE_ACTION_RESULT', baseQuery(), adapterResult([observation()], { corporateActions: [actionRecord()] }), metadata())
})

test('corporate-action required fields, selected date population/range and term declarations are enforced', () => {
  const now = '2025-07-01T12:00:00+08:00'
  rejected('MISSING_FIELDS', actionQuery({ requiredFields: ['cash_dividend'] }), actionResult([actionRecord({ actionType: 'stock_dividend' })]), actionMetadata(), now)
  rejected('CORPORATE_ACTION_DATE_MISSING', actionQuery(), actionResult([actionRecord({ exDate: null })]), actionMetadata(), now)
  rejected('CORPORATE_ACTION_DATE_OUT_OF_RANGE', actionQuery({ period: { kind: 'range', start: '2025-07-01', end: '2025-12-31' } }), actionResult(), actionMetadata(), now)
  rejected('COVERAGE_MISMATCH', actionQuery(), actionResult([actionRecord({ terms: [{
    kind: 'unsupported_term', value: 1, currency: 'CNY', ratio: null, unit: 'CNY',
  }] })]), actionMetadata(), now)
  rejected('COVERAGE_MISMATCH', actionQuery({ requiredFields: ['unlisted_field'] }), actionResult(), actionMetadata(), now)
})

test('corporate actions preserve separate records, revisions, and date values without merging', () => {
  const second = actionRecord({
    actionId: 'cninfo-action-600519-2025', announcementDate: '2025-04-04', recordDate: '2025-06-28',
    exDate: '2025-06-30', paymentDate: null,
    revision: 'cninfo-action-rev-2',
    revisionEvidence: revisionEvidence({ chainId: 'cninfo-action-chain-2', sourceRecordId: 'cninfo-action-record-2' }),
  })
  const output = normalize(actionQuery(), actionResult([actionRecord(), second]), actionMetadata(), '2025-07-01T12:00:00+08:00')
  assert.equal(output.corporateActions.length, 2)
  assert.deepEqual(output.corporateActions.map(action => action.exDate), ['2025-06-27', '2025-06-30'])
  assert.deepEqual(output.corporateActions.map(action => action.revision), ['cninfo-action-rev-1', 'cninfo-action-rev-2'])
})

test('date-bounded corporate actions emit a structured warning and retain selected-date filtering', () => {
  const now = '2025-07-01T12:00:00+08:00'
  const query = actionQuery({ temporalMode: 'date_bounded' })
  const action = actionRecord({
    availabilityEvidence: dateEvidence(), retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00' }),
  })
  const output = normalize(query, actionResult([action]), actionMetadata(), now)
  assert.equal(output.warnings.some(warning => warning.code === 'DATE_BOUNDED_AVAILABILITY'), true)
})

test('safe DataContractError contains only generic messages and bounded structural paths', () => {
  const secret = 'Bearer never-echo-this'
  assert.throws(() => normalize(baseQuery(), { observations: [], corporateActions: [], warnings: [], secret }, metadata()), error => {
    assert.ok(error instanceof DataContractError)
    assert.equal(error.code, 'INVALID_RESULT')
    assert.equal(error.message, 'Financial data did not satisfy the data contract')
    assert.doesNotMatch(`${error.message} ${error.details.join(' ')}`, /never-echo-this/)
    return true
  })
})
