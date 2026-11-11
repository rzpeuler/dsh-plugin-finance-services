import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { z } from 'zod'
import { CAPABILITIES, createDataSchemas } from '../src/data/contracts.js'

const schemas = createDataSchemas(z)
const reference = { uri: 'https://example.com/filings/2025-annual-report', label: 'Source record evidence' }
const filingReference = { uri: 'https://example.com/filings/2024-annual-report-document', label: '2024 Annual Report file' }
const baseQuery = () => ({
  capability: 'financial.statements', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
  requiredFields: ['netProfit'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  asOf: '2025-04-05T00:00:00+08:00', purpose: 'research', maxAgeSeconds: 31536000,
})
const timestampEvidence = () => ({
  type: 'timestamp', sourcePublishedAt: '2025-04-03T10:00:00+08:00',
  availableAt: '2025-04-03T10:00:00+08:00',
})
const revisionEvidence = (overrides = {}) => ({
  chainId: 'cninfo-600519-fy2024', chainStatus: 'single_record', supersedes: [], changeType: 'original',
  sourceRecordId: 'cninfo-record-2025-04-03', capturedAt: '2025-04-03T11:00:00+08:00',
  evidence: reference, ...overrides,
})
const observation = (overrides = {}) => ({
  field: 'netProfit', entity: { scheme: 'ticker', id: '600519.SH' }, value: 86228146421.62,
  unit: { dimension: 'currency', currency: 'CNY', scale: 'ones' },
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  measurementType: 'actual', accountingBasis: 'PRC_GAAP', consolidation: 'consolidated',
  availabilityEvidence: timestampEvidence(), retrievedAt: '2025-04-03T11:00:00+08:00',
  revision: 'cninfo-record-2025-04-03', revisionEvidence: revisionEvidence(),
  reference, licenseClass: 'TEST_ONLY', ...overrides,
})
const metadata = () => ({
  id: 'cninfo-test', version: '1.0.0', sourceId: 'cninfo', label: 'CNINFO test adapter',
  testOnly: true, licenseClass: 'TEST_ONLY', capabilities: [{
    id: 'financial.statements', markets: ['CN'], fields: ['netProfit'],
    temporalModes: ['strict', 'date_bounded'], priority: 1, quality: 50,
  }],
})
const provenance = () => ({
  adapterId: 'cninfo-test', adapterVersion: '1.0.0', sourceId: 'cninfo', testOnly: true,
  licenseClass: 'TEST_ONLY', originalValue: 86228146421.62,
  originalUnit: { dimension: 'currency', currency: 'CNY', scale: 'ones' },
})
const actionProvenance = action => ({
  adapterId: 'cninfo-test', adapterVersion: '1.0.0', sourceId: 'cninfo', testOnly: true,
  licenseClass: 'TEST_ONLY', originalTerms: action.terms,
  sourceRecordId: action.revisionEvidence.sourceRecordId, sourceEvidence: action.revisionEvidence.evidence,
})
const normalizedAction = action => ({ ...action, provenance: actionProvenance(action) })
const filingProvenance = filing => ({
  adapterId: 'cninfo-test', adapterVersion: '1.0.0', sourceId: 'cninfo', testOnly: true,
  licenseClass: 'TEST_ONLY', originalFilingReference: filing.filingReference,
  sourceRecordId: filing.revisionEvidence.sourceRecordId, sourceEvidence: filing.revisionEvidence.evidence,
})
const normalizedFiling = filing => ({ ...filing, provenance: filingProvenance(filing) })
const normalizedResult = (query = baseQuery(), row = observation(), warnings = []) => ({
  query, observations: [{
    ...row, observationId: `sha256:${'a'.repeat(64)}`, provenance: provenance(),
  }], corporateActions: [], warnings,
})

function actionRecord(overrides = {}) {
  return {
    actionId: 'cninfo-action-600519-2024', entity: { scheme: 'ticker', id: '600519.SH' },
    actionType: 'cash_dividend', status: 'proposed',
    terms: [{ kind: 'cash_per_share', value: 2.76, currency: 'CNY', ratio: null, unit: 'CNY/share' }],
    announcementDate: '2025-04-03', recordDate: '2025-06-26', exDate: '2025-06-27',
    paymentDate: null, effectiveDate: null, filingReference: reference,
    availabilityEvidence: timestampEvidence(), retrievedAt: '2025-04-03T11:00:00+08:00',
    revision: 'cninfo-action-record-1', revisionEvidence: revisionEvidence({
      chainId: 'cninfo-action-chain-1', sourceRecordId: 'cninfo-action-record-1',
    }), licenseClass: 'TEST_ONLY', ...overrides,
  }
}
function filingRecord(overrides = {}) {
  return {
    filingId: 'cninfo-filing-record-2025-04-03', entity: { scheme: 'ticker', id: '600519.SH' },
    filingType: 'annual_report', title: '2024 Annual Report', announcementDate: '2025-04-03',
    reportPeriod: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
    filingReference, availabilityEvidence: timestampEvidence(),
    retrievedAt: '2025-04-03T11:00:00+08:00', revision: 'cninfo-filing-revision-1',
    revisionEvidence: revisionEvidence({
      chainId: 'cninfo-filing-chain-1', sourceRecordId: 'cninfo-filing-record-2025-04-03',
    }), licenseClass: 'TEST_ONLY', ...overrides,
  }
}

test('FinanceData exposes fifteen unique capabilities', () => {
  assert.equal(CAPABILITIES.length, 15)
  assert.equal(new Set(CAPABILITIES).size, 15)
  assert.equal(CAPABILITIES[14], 'corporate.actions')
})

test('factory serializes without module lexical dependencies and Query defaults to strict', () => {
  const factory = vm.runInNewContext(`(${createDataSchemas.toString()})`, { Date, Intl, URL })
  const serializedSchemas = factory(z)
  const parsed = serializedSchemas.Query.parse(baseQuery())
  assert.equal(parsed.temporalMode, 'strict')
  assert.equal(parsed.priceAdjustment, 'none')
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), temporalMode: 'date_bounded' }).success, true)
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), timeZone: 'Asia/Shanghai' }).success, false)
  assert.equal(schemas.Capability.safeParse('corporate.actions').success, true)
  assert.equal(schemas.TemporalMode.safeParse('current_only').success, true)
  assert.equal(schemas.Reference.safeParse(reference).success, true)
  assert.equal(schemas.Reference.safeParse({ uri: 'https://user:secret@example.com/file', label: 'Credential URI' }).success, false)
  assert.equal(schemas.Reference.safeParse({ uri: 'https://example.com:bad/file', label: 'Invalid port' }).success, false)
})

test('per-share units and price-adjustment semantics are explicit and capability-scoped', () => {
  assert.deepEqual(['none', 'qfq', 'hfq', 'total_return'].map(value => schemas.PriceAdjustment.safeParse(value).success),
    [true, true, true, true])
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' }).success, true)
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency_per_share', currency: 'CNY', scale: 'thousands' }).success, true)
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency_per_share', currency: null, scale: 'ones' }).success, false)
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency_per_share', currency: 'CNY', scale: 'percent' }).success, false)
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency', currency: 'CNY', scale: 'text' }).success, false)
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), priceAdjustment: 'qfq' }).success, false)
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), capability: 'prices.history', priceAdjustment: 'qfq' }).success, true)
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), capability: 'prices.history', priceAdjustment: 'split_adjusted' }).success, false)
  const priceCapability = {
    id: 'prices.history', markets: ['CN'], fields: ['close'], temporalModes: ['strict'],
    priceAdjustments: ['none', 'qfq'], priority: 1, quality: 50,
  }
  assert.equal(schemas.AdapterCapability.safeParse(priceCapability).success, true)
  assert.equal(schemas.AdapterCapability.safeParse({ ...priceCapability, priceAdjustments: undefined }).success, false)
  assert.equal(schemas.AdapterCapability.safeParse({ ...priceCapability, priceAdjustments: ['total_return'] }).success, true)
  assert.equal(schemas.AdapterCapability.safeParse({
    ...priceCapability, id: 'financial.statements', priceAdjustments: ['none'],
  }).success, false)
})

test('availability evidence is discriminated and date evidence validates IANA zone and conservative boundary', () => {
  const dateEvidence = {
    type: 'date', publishedDate: '2025-04-03', timeZone: 'Asia/Shanghai',
    rule: 'next_local_midnight', availableAt: '2025-04-04T00:00:00+08:00',
  }
  assert.equal(schemas.AvailabilityEvidence.safeParse(timestampEvidence()).success, true)
  assert.equal(schemas.AvailabilityEvidence.safeParse({
    type: 'current_snapshot', capturedAt: '2025-04-03T11:00:00+08:00',
  }).success, true)
  assert.equal(schemas.AvailabilityEvidence.safeParse(dateEvidence).success, true)
  assert.equal(schemas.AvailabilityEvidence.safeParse({ ...dateEvidence, timeZone: 'Mars/Olympus' }).success, false)
  assert.equal(schemas.AvailabilityEvidence.safeParse({ ...dateEvidence, rule: 'midnight_guess' }).success, false)
  assert.equal(schemas.AvailabilityEvidence.safeParse({
    ...dateEvidence, availableAt: '2025-04-03T23:59:59+08:00',
  }).success, false)
  assert.equal(schemas.AvailabilityEvidence.safeParse({
    ...dateEvidence, publishedDate: '2025-02-30',
  }).success, false)
  assert.equal(schemas.AvailabilityEvidence.safeParse({
    type: 'timestamp', sourcePublishedAt: '2025-04-03', availableAt: '2025-04-03T10:00:00+08:00',
  }).success, false)
})

test('revision evidence requires source-stable chain details and validates optional sha256 digest', () => {
  const row = observation({ revisionEvidence: revisionEvidence({ digest: `sha256:${'b'.repeat(64)}` }) })
  assert.equal(schemas.Observation.safeParse(row).success, true)
  assert.equal(schemas.RevisionEvidence.safeParse(revisionEvidence({
    chainStatus: 'complete', supersedes: ['source-revision-0'], changeType: 'correction',
  })).success, true)
  assert.equal(schemas.RevisionEvidence.safeParse(revisionEvidence({ digest: 'sha256:xyz' })).success, false)
  assert.equal(schemas.RevisionEvidence.safeParse(revisionEvidence({ chainStatus: 'reconstructed' })).success, false)
  const unknownEvidence = revisionEvidence({ chainStatus: 'unknown', chainId: null, sourceRecordId: null, changeType: 'unknown' })
  assert.equal(schemas.RevisionEvidence.safeParse(unknownEvidence).success, true)
  assert.equal(schemas.RevisionEvidence.safeParse(revisionEvidence({
    chainStatus: 'complete', chainId: null, sourceRecordId: null,
  })).success, false)
  assert.equal(schemas.RevisionEvidence.safeParse(revisionEvidence({ evidence: null })).success, false)
  assert.equal(schemas.Observation.safeParse(observation({
    revisionEvidence: revisionEvidence({ supersedes: ['cninfo-record-2025-04-03'] }),
  })).success, false)
  assert.equal(schemas.Observation.safeParse(observation({
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-03T12:00:00+08:00' }),
  })).success, false)
})

test('normalized results keep temporal modes distinct and reject incomplete historical evidence', () => {
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult()).success, true)
  const dateEvidence = {
    type: 'date', publishedDate: '2025-04-03', timeZone: 'Asia/Shanghai',
    rule: 'next_local_midnight', availableAt: '2025-04-04T00:00:00+08:00',
  }
  const dateQuery = { ...baseQuery(), temporalMode: 'date_bounded', asOf: '2025-04-05T00:00:00+08:00' }
  const dateRow = observation({
    availabilityEvidence: dateEvidence, retrievedAt: '2025-04-04T01:00:00+08:00',
    revisionEvidence: revisionEvidence({ capturedAt: '2025-04-04T01:00:00+08:00', chainStatus: 'complete' }),
  })
  const dateWarning = { code: 'DATE_BOUNDED_AVAILABILITY', message: 'Date-only publication; available at next local midnight.' }
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, dateRow, [dateWarning])).success, true)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, dateRow)).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, dateRow, [
    { code: 'OTHER_WARNING', message: 'Date precision was handled.' },
  ])).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(baseQuery(), dateRow, [dateWarning])).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, observation({
    revisionEvidence: revisionEvidence({ chainStatus: 'partial' }),
  }), [dateWarning])).success, false)
  const unknownRevisionRow = observation({
    revision: null,
    revisionEvidence: revisionEvidence({ chainStatus: 'unknown', chainId: null, sourceRecordId: null, changeType: 'unknown' }),
  })
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(baseQuery(), unknownRevisionRow)).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, unknownRevisionRow, [dateWarning])).success, false)
  const currentQuery = {
    ...baseQuery(), temporalMode: 'current_only', asOf: '2025-04-05T12:00:00+08:00',
  }
  const capturedAt = '2025-04-05T12:01:00+08:00'
  const currentRow = observation({
    availabilityEvidence: { type: 'current_snapshot', capturedAt }, retrievedAt: capturedAt,
    revision: null,
    revisionEvidence: revisionEvidence({
      chainStatus: 'unknown', chainId: null, sourceRecordId: null, changeType: 'unknown', capturedAt,
    }),
  })
  const currentWarning = {
    code: 'CURRENT_ONLY_SNAPSHOT',
    message: `Current snapshot read at ${capturedAt}; source row captured at ${capturedAt}. This is not a historical asOf guarantee.`,
  }
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(currentQuery, currentRow, [currentWarning])).success, true)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(currentQuery, currentRow)).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(dateQuery, currentRow, [currentWarning])).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult(currentQuery, {
    ...currentRow, retrievedAt: '2025-04-05T12:02:00+08:00',
  }, [currentWarning])).success, false)
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResult({
    ...currentQuery, asOf: '2025-04-05T10:00:00+08:00',
  }, currentRow, [currentWarning])).success, true)
})

test('corporate.actions requires range and event-date basis and preserves raw/normalized action records', () => {
  const action = actionRecord()
  const query = {
    ...baseQuery(), capability: 'corporate.actions', requiredFields: ['cash_dividend'],
    period: { kind: 'range', start: '2025-01-01', end: '2025-12-31' },
    corporateActionDateBasis: 'ex_date',
  }
  assert.equal(schemas.Query.safeParse({ ...query, period: null }).success, false)
  assert.equal(schemas.Query.safeParse({ ...query, period: { kind: 'fiscal_year', start: '2025-01-01', end: '2025-12-31' } }).success, false)
  assert.equal(schemas.Query.safeParse({ ...query, corporateActionDateBasis: undefined }).success, false)
  assert.equal(schemas.Query.safeParse({ ...query, corporateActionDateBasis: 'unknown' }).success, false)
  assert.equal(schemas.Query.safeParse({ ...baseQuery(), corporateActionDateBasis: 'ex_date' }).success, false)
  assert.equal(schemas.Query.safeParse(query).success, true)
  assert.equal(schemas.Query.safeParse({ ...query, targetUnit: { dimension: 'currency', currency: 'CNY', scale: 'ones' } }).success, false)
  assert.equal(schemas.CorporateActionRecord.safeParse(action).success, true)
  assert.equal(schemas.CorporateActionRecord.safeParse(actionRecord({ filingReference: null })).success, true)
  assert.equal(schemas.CorporateActionRecord.safeParse(actionRecord({ status: 'active' })).success, false)
  assert.equal(action.announcementDate, '2025-04-03')
  assert.equal(action.recordDate, '2025-06-26')
  assert.equal(action.exDate, '2025-06-27')
  assert.equal(action.paymentDate, null)
  assert.equal(action.effectiveDate, null)
  const adapterResult = { observations: [], corporateActions: [action], warnings: [] }
  assert.equal(schemas.AdapterResult.safeParse(adapterResult).success, true)
  assert.equal(schemas.AdapterResult.safeParse({ ...adapterResult, warnings: ['raw adapter warning'] }).success, true)
  const actionCapability = {
    id: 'corporate.actions', markets: ['CN'], fields: ['cash_dividend'], temporalModes: ['strict'],
    corporateActionDateBases: ['ex_date'], priority: 1, quality: 50,
  }
  assert.equal(schemas.AdapterCapability.safeParse(actionCapability).success, true)
  assert.equal(schemas.AdapterCapability.safeParse({ ...actionCapability, corporateActionDateBases: undefined }).success, false)
  assert.equal(schemas.AdapterCapability.safeParse({
    ...actionCapability, id: 'financial.statements', corporateActionDateBases: ['ex_date'],
  }).success, false)
  assert.equal(schemas.AdapterCapability.safeParse({ ...actionCapability, corporateActionDateBases: ['announcement_date', 'ex_date'] }).success, true)
  const normalized = normalizedAction(action)
  assert.equal(schemas.NormalizedCorporateActionRecord.safeParse(normalized).success, true)
  assert.deepEqual(normalized.provenance.originalTerms, action.terms)
  assert.deepEqual(normalized.provenance.sourceEvidence, action.revisionEvidence.evidence)
  assert.equal(schemas.NormalizedResult.safeParse({
    query, observations: [], corporateActions: [normalized], warnings: [],
  }).success, true)
  assert.equal(schemas.NormalizedResult.safeParse({
    query, observations: [], corporateActions: [action], warnings: [],
  }).success, false)
  assert.equal(schemas.NormalizedCorporateActionRecord.safeParse({
    ...normalized, provenance: { ...normalized.provenance, testOnly: false },
  }).success, false)
  assert.equal(schemas.NormalizedCorporateActionRecord.safeParse({
    ...normalized, provenance: { ...normalized.provenance, sourceEvidence: null },
  }).success, false)
  assert.equal(schemas.CorporateActionRecord.safeParse(actionRecord({ exDate: '2025-02-30' })).success, false)
  assert.equal(schemas.CorporateActionRecord.safeParse(actionRecord({
    revisionEvidence: revisionEvidence({ supersedes: ['cninfo-action-record-1'] }),
  })).success, false)
})

test('filings use separate announcement-date records and additive result arrays', () => {
  const filing = filingRecord()
  const query = {
    ...baseQuery(), capability: 'filings', requiredFields: [
      'filing_id', 'filing_type', 'title', 'announcement_date', 'report_period', 'filing_reference',
    ], period: { kind: 'range', start: '2025-01-01', end: '2025-12-31' },
  }
  assert.equal(schemas.Query.safeParse(query).success, true)
  assert.equal(schemas.Query.safeParse({ ...query, period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' } }).success, false)
  assert.equal(schemas.Query.safeParse({ ...query, corporateActionDateBasis: 'ex_date' }).success, false)
  assert.equal(schemas.FilingRecord.safeParse(filing).success, true)
  assert.equal(schemas.FilingRecord.safeParse(filingRecord({ filingType: '年度报告' })).success, true)
  assert.equal(schemas.FilingRecord.safeParse(filingRecord({ filingType: 'Bearer secret-value' })).success, false)
  assert.equal(schemas.FilingRecord.safeParse(filingRecord({ filingType: '中'.repeat(97) })).success, false)
  assert.equal(schemas.FilingRecord.safeParse(filingRecord({
    revisionEvidence: revisionEvidence({ sourceRecordId: 'different-source-row' }),
  })).success, false)
  assert.equal(schemas.FilingRecord.safeParse(filingRecord({ announcementDate: null })).success, true)
  const parsedAdapter = schemas.AdapterResult.parse({ observations: [], corporateActions: [], warnings: [] })
  assert.deepEqual(parsedAdapter.filings, [])
  const normalized = normalizedFiling(filing)
  assert.equal(schemas.NormalizedFilingRecord.safeParse(normalized).success, true)
  assert.deepEqual(normalized.provenance.originalFilingReference, filingReference)
  assert.deepEqual(normalized.provenance.sourceEvidence, reference)
  assert.equal(schemas.NormalizedFilingRecord.safeParse({
    ...normalized, provenance: { ...normalized.provenance, sourceRecordId: 'different-source-row' },
  }).success, false)
  assert.equal(schemas.NormalizedFilingRecord.safeParse({
    ...normalized, provenance: { ...normalized.provenance, originalFilingReference: reference },
  }).success, false)
  const normalizedResultWithFiling = {
    query, observations: [], corporateActions: [], filings: [normalized], warnings: [],
  }
  assert.equal(schemas.NormalizedResult.safeParse(normalizedResultWithFiling).success, true)
  assert.deepEqual(schemas.NormalizedResult.parse({
    query: baseQuery(), observations: [], corporateActions: [], warnings: [],
  }).filings, [])
  assert.equal(schemas.NormalizedResult.safeParse({
    query, observations: [], corporateActions: [], warnings: [],
  }).success, false)
  assert.equal(schemas.NormalizedResult.safeParse({
    ...normalizedResultWithFiling, filings: [{ ...normalized, announcementDate: '2026-01-01' }],
  }).success, false)
  assert.equal(schemas.NormalizedResult.safeParse({
    ...normalizedResultWithFiling, filings: [{ ...normalized, announcementDate: null }],
  }).success, false)
  assert.equal(schemas.NormalizedResult.safeParse({
    ...normalizedResultWithFiling, filings: [{ ...normalized, reportPeriod: null }],
  }).success, false)
  assert.equal(schemas.NormalizedResult.safeParse({
    ...normalizedResultWithFiling, observations: [normalizedResult().observations[0]],
  }).success, false)
  assert.equal(schemas.NormalizedResult.safeParse({
    ...normalizedResult(baseQuery()), filings: [normalized],
  }).success, false)
})

test('license gate fields are retained and TEST_ONLY markers must agree', () => {
  assert.equal(schemas.AdapterValidation.safeParse({
    compatible: true, licensePermitted: true, modelProcessingPermitted: true, sessionLoggingPermitted: true,
  }).success, true)
  assert.equal(schemas.AdapterMetadata.safeParse(metadata()).success, true)
  assert.equal(schemas.AdapterMetadata.safeParse({ ...metadata(), testOnly: false }).success, false)
  assert.equal(schemas.Provenance.safeParse(provenance()).success, true)
  assert.equal(schemas.Provenance.safeParse({ ...provenance(), licenseClass: 'PUBLIC_LICENSED' }).success, false)
})
