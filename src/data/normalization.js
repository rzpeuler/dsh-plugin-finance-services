import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createDataSchemas } from './contracts.js'

const schemas = createDataSchemas(z)
const factors = Object.freeze({
  ones: 1,
  thousands: 1000,
  millions: 1000000,
  billions: 1000000000,
  ratio: 1,
  percent: 0.01,
  basis_points: 0.0001,
  text: 1,
})
const ACTION_TYPES = new Set([
  'cash_dividend', 'stock_dividend', 'bonus_issue', 'capitalization', 'rights_issue',
  'split', 'reverse_split', 'merger', 'other',
])
const ACTION_DATE_FIELDS = Object.freeze({
  announcement_date: 'announcementDate',
  announcementDate: 'announcementDate',
  record_date: 'recordDate',
  recordDate: 'recordDate',
  ex_date: 'exDate',
  exDate: 'exDate',
  payment_date: 'paymentDate',
  paymentDate: 'paymentDate',
  effective_date: 'effectiveDate',
  effectiveDate: 'effectiveDate',
})
const FILING_FIELD_MAP = Object.freeze({
  filing_id: 'filingId',
  filing_type: 'filingType',
  title: 'title',
  announcement_date: 'announcementDate',
  report_period: 'reportPeriod',
  filing_reference: 'filingReference',
})
const DATE_BOUNDED_WARNING = Object.freeze({
  code: 'DATE_BOUNDED_AVAILABILITY',
  message: 'Date-only publication evidence uses its declared next-local-midnight availability boundary.',
})
const CURRENT_ONLY_REQUEST_WINDOW_SECONDS = 300
const currentOnlyWarning = rows => {
  const orderedUniqueTimes = values => [...new Set(values)]
    .sort((left, right) => timestampEpoch(left) - timestampEpoch(right))
  const readTimes = orderedUniqueTimes(rows.map(row => row.availabilityEvidence.capturedAt))
  const sourceTimes = orderedUniqueTimes(rows.map(row => row.revisionEvidence.capturedAt))
  const describe = times => times.length === 1 ? `at ${times[0]}` : `between ${times[0]} and ${times[times.length - 1]}`
  const message = readTimes.length === 0
    ? 'Current-only query returned no rows; no historical asOf availability is asserted.'
    : `Current snapshot read ${describe(readTimes)}; source row captured ${describe(sourceTimes)}. This is not a historical asOf guarantee.`
  return { code: 'CURRENT_ONLY_SNAPSHOT', message }
}
const ADAPTER_WARNING = Object.freeze({
  code: 'ADAPTER_WARNING',
  message: 'The adapter reported one or more warnings; provider details were omitted.',
})

/** Safe structural errors never echo arbitrary provider values or credentials. */
export class DataContractError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DataContractError'
    this.code = code
    this.details = []
  }
}

const fail = (code, message) => { throw new DataContractError(code, message) }
const parse = (schema, value, code) => {
  const result = schema.safeParse(value)
  if (!result.success) fail(code, 'Financial data did not satisfy the data contract')
  return result.data
}
const sameEntity = (left, right) => left.scheme === right.scheme && left.id === right.id
function samePeriod(requested, observed) {
  if (requested === null) return true
  if (observed === null) return false
  if (requested.kind === 'range') return observed.start >= requested.start && observed.end <= requested.end
  return requested.kind === observed.kind && requested.start === observed.start && requested.end === observed.end
}
const timestampEpoch = value => Date.parse(value)
function localDateStartEpoch(date, timeZone) {
  const approximate = Date.parse(`${date}T00:00:00.000Z`)
  let formatter
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23',
    })
  } catch {
    return Number.NaN
  }
  const localDateAt = epoch => {
    const parts = formatter.formatToParts(new Date(epoch))
    let year = '', month = '', day = ''
    for (const part of parts) {
      if (part.type === 'year') year = part.value.padStart(4, '0')
      if (part.type === 'month') month = part.value.padStart(2, '0')
      if (part.type === 'day') day = part.value.padStart(2, '0')
    }
    return `${year}-${month}-${day}`
  }
  let low = approximate - 36 * 60 * 60 * 1000
  let high = approximate + 36 * 60 * 60 * 1000
  if (localDateAt(low) >= date || localDateAt(high) < date) return Number.NaN
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2)
    if (localDateAt(middle) >= date) high = middle
    else low = middle
  }
  return localDateAt(high) === date ? high : Number.NaN
}
const hasStableRevision = row => {
  const evidence = row.revisionEvidence
  return ['complete', 'single_record'].includes(evidence.chainStatus) && row.revision !== null &&
    evidence.chainId !== null && evidence.sourceRecordId !== null && !/reconstruct/i.test(evidence.changeType)
}
function inferredPitQuality(row) {
  if (row.pitQuality) return row.pitQuality
  if (row.availabilityEvidence.type === 'current_snapshot') {
    return /reconstruct/i.test(row.revisionEvidence.changeType) ? 'RECONSTRUCTED' : 'CURRENT_OBSERVED'
  }
  return hasStableRevision(row) ? 'STRICT_HISTORICAL' : 'UNVERIFIED'
}
function availabilityReferenceEpoch(evidence) {
  if (evidence.type === 'timestamp') return timestampEpoch(evidence.sourcePublishedAt)
  if (evidence.type === 'date') return localDateStartEpoch(evidence.publishedDate, evidence.timeZone)
  return timestampEpoch(evidence.capturedAt)
}
function evidenceDate(evidence) {
  if (evidence.type === 'timestamp') return evidence.sourcePublishedAt.slice(0, 10)
  if (evidence.type === 'date') return evidence.publishedDate
  return evidence.capturedAt.slice(0, 10)
}
function canonical(value) {
  return JSON.stringify(value, function (_key, item) {
    return item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
      : item
  })
}
function normalizedValue(observation, target) {
  const original = observation.unit
  if (typeof observation.value === 'number' && Number.isInteger(observation.value) && !Number.isSafeInteger(observation.value)) {
    fail('NUMERIC_PRECISION_UNSUPPORTED', 'Unsafe integer observations require a precision-preserving adapter contract', [observation.field])
  }
  if (!target) return { value: observation.value, unit: original }
  if (target.dimension !== original.dimension) fail('UNIT_INCOMPATIBLE', 'Unit dimensions are not equivalent', [observation.field])
  if (target.currency !== original.currency) fail('CURRENCY_INCOMPATIBLE', 'No evidenced FX conversion was supplied', [observation.field])
  if (observation.value === null || original.dimension === 'text') return { value: observation.value, unit: target }
  const value = observation.value * factors[original.scale] / factors[target.scale]
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
    fail('NUMERIC_PRECISION_UNSUPPORTED', 'Unit conversion exceeded supported finite numeric precision', [observation.field])
  }
  return { value, unit: target }
}
function checkTemporalRow(row, query, now) {
  const evidence = row.availabilityEvidence
  const retrievedAt = timestampEpoch(row.retrievedAt)
  const capturedAt = timestampEpoch(row.revisionEvidence.capturedAt)
  const asOf = timestampEpoch(query.asOf)

  if (retrievedAt > now) fail('CHRONOLOGY_INVALID', 'Observation retrieval is later than the current query time')
  if (capturedAt > retrievedAt) fail('CHRONOLOGY_INVALID', 'Revision evidence was captured after retrieval')
  if (query.temporalMode !== 'current_only' && capturedAt > asOf) {
    fail('PIT_VIOLATION', 'Revision evidence was not captured by the requested asOf')
  }

  if (query.temporalMode === 'strict') {
    if (evidence.type !== 'timestamp') fail('TEMPORAL_MODE_UNSUPPORTED', 'Strict mode requires timestamp availability evidence')
    if (!hasStableRevision(row)) fail('REVISION_EVIDENCE_INCOMPLETE', 'Strict mode requires a source-stable complete revision chain')
  } else if (query.temporalMode === 'date_bounded') {
    if (!['timestamp', 'date'].includes(evidence.type)) fail('TEMPORAL_MODE_UNSUPPORTED', 'Date-bounded mode requires timestamp or date evidence')
    if (!hasStableRevision(row)) fail('REVISION_EVIDENCE_INCOMPLETE', 'Date-bounded mode requires a source-stable complete revision chain')
  } else {
    if (evidence.type !== 'current_snapshot') fail('TEMPORAL_MODE_UNSUPPORTED', 'Current-only mode requires current-snapshot evidence')
    if (timestampEpoch(evidence.capturedAt) > now) fail('CHRONOLOGY_INVALID', 'Current snapshot was captured after the current query time')
  }

  if (evidence.type === 'timestamp') {
    const sourceAt = timestampEpoch(evidence.sourcePublishedAt)
    const availableAt = timestampEpoch(evidence.availableAt)
    if (sourceAt > availableAt || availableAt > retrievedAt) fail('CHRONOLOGY_INVALID', 'Publication, availability and retrieval timestamps are inconsistent')
    if (sourceAt > asOf || availableAt > asOf) fail('PIT_VIOLATION', 'Observation was not available at the requested asOf')
  } else if (evidence.type === 'date') {
    const availableAt = timestampEpoch(evidence.availableAt)
    if (availableAt > retrievedAt) fail('CHRONOLOGY_INVALID', 'Date-bounded availability is later than retrieval')
    if (availableAt > asOf) fail('PIT_VIOLATION', 'Date-bounded observation was not available at the requested asOf')
  } else {
    const captured = timestampEpoch(evidence.capturedAt)
    if (query.temporalMode !== 'current_only' && captured > asOf) {
      fail('PIT_VIOLATION', 'Current snapshot was captured after the requested asOf')
    }
  }

  if (/reconstruct/i.test(row.revisionEvidence.changeType) && query.temporalMode !== 'current_only') {
    fail('REVISION_EVIDENCE_INCOMPLETE', 'Reconstructed values cannot establish historical availability')
  }
  const ageReference = query.temporalMode === 'current_only' ? now : asOf
  const ageSource = query.temporalMode === 'current_only'
    ? timestampEpoch(row.revisionEvidence.capturedAt)
    : availabilityReferenceEpoch(evidence)
  const ageSeconds = (ageReference - ageSource) / 1000
  if (!Number.isFinite(ageSeconds)) fail('TEMPORAL_EVIDENCE_INVALID', 'Availability evidence has no resolvable source date')
  if (ageSeconds < 0) fail('PIT_VIOLATION', 'Observation evidence is later than the requested asOf')
  if (ageSeconds > query.maxAgeSeconds) fail('STALE_DATA', 'Observation exceeds the requested maximum age')
}
function actionFieldPresent(action, field) {
  if (action.terms.some(term => term.kind === field)) return true
  if (ACTION_TYPES.has(field)) return action.actionType === field
  const mappedDate = ACTION_DATE_FIELDS[field]
  if (mappedDate) return action[mappedDate] !== null
  if (field === 'action_id' || field === 'actionId') return action.actionId.length > 0
  if (field === 'action_type' || field === 'actionType') return action.actionType.length > 0
  if (field === 'status' || field === 'action_status' || field === 'actionStatus') return action.status.length > 0
  return false
}
function normalizeAction(action, metadata) {
  return {
    ...action,
    provenance: {
      adapterId: metadata.id,
      adapterVersion: metadata.version,
      sourceId: metadata.sourceId,
      testOnly: metadata.testOnly,
      licenseClass: metadata.licenseClass,
      originalTerms: action.terms,
      sourceRecordId: action.revisionEvidence.sourceRecordId,
      sourceEvidence: action.revisionEvidence.evidence,
    },
  }
}
function normalizeFiling(filing, metadata) {
  return {
    ...filing,
    provenance: {
      adapterId: metadata.id,
      adapterVersion: metadata.version,
      sourceId: metadata.sourceId,
      testOnly: metadata.testOnly,
      licenseClass: metadata.licenseClass,
      originalFilingReference: filing.filingReference,
      sourceRecordId: filing.revisionEvidence.sourceRecordId,
      sourceEvidence: filing.revisionEvidence.evidence,
    },
  }
}
function actionDateValue(action, basis) {
  const property = {
    announcement_date: 'announcementDate',
    record_date: 'recordDate',
    ex_date: 'exDate',
    payment_date: 'paymentDate',
    effective_date: 'effectiveDate',
  }[basis]
  return property ? action[property] : null
}

/** Normalize one atomic FinanceData 2.0 Adapter result without merging sources or revisions. */
export function normalizeObservations(queryValue, resultValue, metadataValue, nowISO) {
  const query = parse(schemas.Query, queryValue, 'INVALID_QUERY')
  const metadata = parse(schemas.AdapterMetadata, metadataValue, 'INVALID_METADATA')
  const result = parse(schemas.AdapterResult, resultValue, 'INVALID_RESULT')
  const now = timestampEpoch(parse(schemas.Timestamp, nowISO, 'INVALID_NOW'))
  const asOf = timestampEpoch(query.asOf)
  if (asOf > now) fail('PIT_VIOLATION', 'Query asOf is in the future')
  if (query.temporalMode === 'current_only' && now - asOf > CURRENT_ONLY_REQUEST_WINDOW_SECONDS * 1000) {
    fail('CURRENT_ONLY_REQUEST_STALE', 'Current-only request timestamp is outside the 300-second request window')
  }

  const coverage = metadata.capabilities.find(capability => capability.id === query.capability)
  if (!coverage) fail('CAPABILITY_MISMATCH', 'Adapter does not declare the requested capability')
  if (!coverage.markets.includes(query.market) || query.requiredFields.some(field => !coverage.fields.includes(field)) ||
    (query.sourceIds && !query.sourceIds.includes(metadata.sourceId))) {
    fail('COVERAGE_MISMATCH', 'Adapter does not cover the requested market, source or fields')
  }
  if (!coverage.temporalModes.includes(query.temporalMode)) {
    fail('TEMPORAL_MODE_UNSUPPORTED', 'Adapter has not declared the requested temporal mode')
  }
  const declaredPitQualities = coverage.pitQualities ?? coverage.temporalModes.map(mode =>
    mode === 'current_only' ? 'CURRENT_OBSERVED' : 'STRICT_HISTORICAL')
  const historicalIntent = query.researchIntent === 'historicalReplay' ||
    (query.researchIntent === undefined && query.temporalMode !== 'current_only')
  if (historicalIntent && !declaredPitQualities.includes('STRICT_HISTORICAL')) {
    fail('PIT_VIOLATION', 'Adapter has no declared strict historical evidence level')
  }
  if (query.capability === 'prices.history' && !coverage.priceAdjustments.includes(query.priceAdjustment)) {
    fail('PRICE_ADJUSTMENT_UNSUPPORTED', 'Adapter has not declared the requested price adjustment semantics')
  }
  if (query.capability === 'corporate.actions') {
    if (!coverage.corporateActionDateBases?.includes(query.corporateActionDateBasis)) {
      fail('CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED', 'Adapter has not declared the requested corporate-action date basis')
    }
    if (result.observations.length !== 0 || result.filings.length !== 0) {
      fail('INVALID_CORPORATE_ACTION_RESULT', 'Corporate actions must use CorporateActionRecord values only')
    }
  } else if (query.capability === 'filings') {
    if (result.observations.length !== 0 || result.corporateActions.length !== 0) {
      fail('INVALID_FILING_RESULT', 'Filings must use FilingRecord values only')
    }
  } else {
    if (result.corporateActions.length !== 0) {
      fail('INVALID_CORPORATE_ACTION_RESULT', 'Only corporate.actions may return CorporateActionRecord values')
    }
    if (result.filings.length !== 0) fail('INVALID_FILING_RESULT', 'Only filings may return FilingRecord values')
  }

  const rows = query.capability === 'corporate.actions' ? result.corporateActions
    : query.capability === 'filings' ? result.filings : result.observations
  const warnings = []
  let hasDateEvidence = false
  for (const row of rows) {
    if (!sameEntity(query.entity, row.entity)) fail('ENTITY_MISMATCH', 'Adapter returned a different entity')
    if (row.licenseClass !== metadata.licenseClass) fail('LICENSE_MISMATCH', 'Row and Adapter license classes differ')
    if (query.capability === 'filings') {
      if (row.announcementDate === null) fail('FILING_ANNOUNCEMENT_DATE_MISSING', 'Filing announcement date is required for range selection')
      if (row.availabilityEvidence.type === 'date' && row.availabilityEvidence.publishedDate !== row.announcementDate) {
        fail('FILING_ANNOUNCEMENT_EVIDENCE_MISMATCH', 'Date availability evidence must use the filing announcement date')
      }
      if (row.announcementDate < query.period.start || row.announcementDate > query.period.end) {
        fail('FILING_ANNOUNCEMENT_DATE_OUT_OF_RANGE', 'Filing announcement date is outside the requested range')
      }
    } else if (query.capability === 'corporate.actions') {
      for (const term of row.terms) {
        if (!coverage.fields.includes(term.kind)) fail('COVERAGE_MISMATCH', 'Adapter returned an undeclared corporate-action term', [term.kind])
      }
      const selectedDate = actionDateValue(row, query.corporateActionDateBasis)
      if (selectedDate === null) fail('CORPORATE_ACTION_DATE_MISSING', 'Selected corporate-action date basis is not populated')
      if (selectedDate < query.period.start || selectedDate > query.period.end) {
        fail('CORPORATE_ACTION_DATE_OUT_OF_RANGE', 'Selected corporate-action date is outside the requested range')
      }
    } else {
      if (!coverage.fields.includes(row.field)) fail('COVERAGE_MISMATCH', 'Adapter returned an undeclared field', [row.field])
      if (!samePeriod(query.period, row.period)) fail('PERIOD_MISMATCH', 'Financial periods cannot be proved equivalent', [row.field])
      if (query.measurementType && query.measurementType !== row.measurementType) {
        fail('MEASUREMENT_INCOMPATIBLE', 'Requested and returned measurement types differ', [row.field])
      }
      const requiredMeasurement = {
        'financial.statements': ['actual'], 'earnings.consensus': ['estimate'], 'prices.history': ['actual'],
        'company.identity': ['identity'], 'compliance.screening': ['screening_result'],
        'portfolio.nav': ['actual', 'indicative'],
      }[query.capability]
      if (requiredMeasurement && !requiredMeasurement.includes(row.measurementType)) {
        fail('MEASUREMENT_INCOMPATIBLE', 'Measurement type is incompatible with the requested capability', [row.field])
      }
      if (query.accountingBasis && row.accountingBasis !== query.accountingBasis) {
        fail('ACCOUNTING_BASIS_INCOMPATIBLE', 'Accounting bases cannot be proved equivalent', [row.field])
      }
      if (query.consolidation && row.consolidation !== query.consolidation) {
        fail('CONSOLIDATION_INCOMPATIBLE', 'Consolidation scopes cannot be proved equivalent', [row.field])
      }
    }

    checkTemporalRow(row, query, now)
    const actualPitQuality = inferredPitQuality(row)
    if (!declaredPitQualities.includes(actualPitQuality)) {
      fail('PIT_VIOLATION', 'Observation quality is not covered by the Adapter temporal declaration', [row.field])
    }
    if (historicalIntent && actualPitQuality !== 'STRICT_HISTORICAL') {
      fail('PIT_VIOLATION', 'Current, reconstructed or unverified observations cannot satisfy historical replay', [row.field])
    }
    if (row.pitQuality === undefined && query.capability !== 'filings' && query.capability !== 'corporate.actions') {
      row.pitQuality = actualPitQuality
    }
    if (row.availabilityEvidence.type === 'date') hasDateEvidence = true
    const actualEvidenceDate = query.temporalMode === 'current_only'
      ? row.revisionEvidence.capturedAt.slice(0, 10)
      : evidenceDate(row.availabilityEvidence)
    if (query.capability !== 'corporate.actions' && row.measurementType === 'actual' && row.period &&
      row.period.end > actualEvidenceDate) {
      fail('PERIOD_NOT_AVAILABLE', 'Actual observation period ends after the evidenced source or capture date', [row.field])
    }
  }

  if (query.capability === 'corporate.actions') {
    for (const field of query.requiredFields) {
      if (!rows.some(action => actionFieldPresent(action, field))) {
        fail('MISSING_FIELDS', 'Required corporate-action fields are absent', [field])
      }
    }
  } else if (query.capability === 'filings') {
    for (const field of query.requiredFields) {
      const property = FILING_FIELD_MAP[field]
      if (!property || !rows.some(filing => filing[property] !== null)) {
        fail('MISSING_FIELDS', 'Required filing fields are absent', [field])
      }
    }
  } else {
    for (const field of query.requiredFields) {
      if (!rows.some(row => row.field === field && row.value !== null)) {
        fail('MISSING_FIELDS', 'Required observations are absent or null', [field])
      }
    }
  }

  if (result.warnings.length > 0) warnings.push(ADAPTER_WARNING)
  if (hasDateEvidence) warnings.push(DATE_BOUNDED_WARNING)
  if (query.temporalMode === 'current_only') warnings.push(currentOnlyWarning(rows))

  let observations = []
  let corporateActions = []
  let filings = []
  if (query.capability === 'corporate.actions') {
    corporateActions = result.corporateActions.map(action => normalizeAction(action, metadata))
  } else if (query.capability === 'filings') {
    filings = result.filings.map(filing => normalizeFiling(filing, metadata))
  } else {
    observations = result.observations.map(observation => {
      const normalized = normalizedValue(observation, query.targetUnit)
      const observationId = `sha256:${createHash('sha256').update(canonical({
        adapterId: metadata.id,
        adapterVersion: metadata.version,
        sourceId: metadata.sourceId,
        priceAdjustment: query.capability === 'prices.history' ? query.priceAdjustment : null,
        observation,
      })).digest('hex')}`
      return {
        ...observation,
        ...normalized,
        observationId,
        provenance: {
          adapterId: metadata.id,
          adapterVersion: metadata.version,
          sourceId: metadata.sourceId,
          testOnly: metadata.testOnly,
          licenseClass: metadata.licenseClass,
          originalValue: observation.value,
          originalUnit: observation.unit,
        },
      }
    })
  }

  return parse(schemas.NormalizedResult, {
    query,
    observations,
    corporateActions,
    filings,
    warnings,
  }, 'INVALID_NORMALIZED_RESULT')
}
