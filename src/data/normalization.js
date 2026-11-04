import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createDataSchemas } from './contracts.js'

const schemas = createDataSchemas(z)
const factors = Object.freeze({ ones: 1, thousands: 1000, millions: 1000000, billions: 1000000000, ratio: 1, percent: 0.01, basis_points: 0.0001 })
const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item
})

/** Safe structural errors never echo an Adapter's arbitrary request/response or credentials. */
export class DataContractError extends Error {
  constructor(code, message, details = []) {
    super(message)
    this.name = 'DataContractError'
    this.code = code
    this.details = details.slice(0, 64).map(value => String(value).slice(0, 128))
  }
}
const fail = (code, message, details) => { throw new DataContractError(code, message, details) }
const parse = (schema, value, code) => {
  const result = schema.safeParse(value)
  if (!result.success) fail(code, 'Financial data did not satisfy the versioned contract', result.error.issues.map(issue => issue.path.join('.') || '(root)'))
  return result.data
}
const sameEntity = (left, right) => left.scheme === right.scheme && left.id === right.id
function samePeriod(requested, observed) {
  if (requested === null) return true
  if (observed === null) return false
  if (requested.kind === 'range') return observed.start >= requested.start && observed.end <= requested.end
  return requested.kind === observed.kind && requested.start === observed.start && requested.end === observed.end
}
function normalizedValue(observation, target) {
  const original = observation.unit
  if (typeof observation.value === 'number' && Number.isInteger(observation.value) && !Number.isSafeInteger(observation.value)) fail('NUMERIC_PRECISION_UNSUPPORTED', 'Unsafe integer observations require a precision-preserving Adapter contract', [observation.field])
  if (!target) return { value: observation.value, unit: original }
  if (target.dimension !== original.dimension) fail('UNIT_INCOMPATIBLE', 'Unit dimensions are not equivalent', [observation.field])
  if (target.currency !== original.currency) fail('CURRENCY_INCOMPATIBLE', 'No evidenced FX conversion was supplied', [observation.field])
  if (observation.value === null || original.dimension === 'text') return { value: observation.value, unit: target }
  if (Number.isInteger(observation.value) && !Number.isSafeInteger(observation.value)) fail('NUMERIC_PRECISION_UNSUPPORTED', 'Unsafe integer observations require a precision-preserving Adapter contract', [observation.field])
  const value = observation.value * factors[original.scale] / factors[target.scale]
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('NUMERIC_PRECISION_UNSUPPORTED', 'Unit conversion exceeded supported finite numeric precision', [observation.field])
  return { value, unit: target }
}

/** Normalize one atomic Adapter result; never merge suppliers, periods or revisions. */
export function normalizeObservations(queryValue, resultValue, metadataValue, nowISO) {
  const query = parse(schemas.Query, queryValue, 'INVALID_QUERY')
  const metadata = parse(schemas.AdapterMetadata, metadataValue, 'INVALID_METADATA')
  const result = parse(schemas.AdapterResult, resultValue, 'INVALID_RESULT')
  const now = Date.parse(parse(schemas.Timestamp, nowISO, 'INVALID_NOW'))
  const asOf = Date.parse(query.asOf)
  if (asOf > now) fail('PIT_VIOLATION', 'Query asOf is in the future')
  const coverage = metadata.capabilities.find(capability => capability.id === query.capability)
  if (!coverage) fail('CAPABILITY_MISMATCH', 'Adapter does not declare this capability')
  if (!coverage.markets.includes(query.market) || query.requiredFields.some(field => !coverage.fields.includes(field))) fail('COVERAGE_MISMATCH', 'Adapter does not cover the requested market and fields')
  if (!coverage.pointInTime) fail('PIT_VIOLATION', 'Adapter cannot demonstrate point-in-time availability')
  const observations = result.observations.map(observation => {
    const details = [observation.field]
    if (!sameEntity(query.entity, observation.entity)) fail('ENTITY_MISMATCH', 'Adapter returned a different entity', details)
    if (!samePeriod(query.period, observation.period)) fail('PERIOD_MISMATCH', 'Financial periods cannot be proved equivalent', details)
    if (query.measurementType && query.measurementType !== observation.measurementType) fail('MEASUREMENT_INCOMPATIBLE', 'Actuals, estimates and other observation types are not equivalent', details)
    const requiredMeasurement = { 'financial.statements': ['actual'], 'earnings.consensus': ['estimate'], 'prices.history': ['actual'], 'company.identity': ['identity'], 'compliance.screening': ['screening_result'], 'portfolio.nav': ['actual', 'indicative'] }[query.capability]
    if (requiredMeasurement && !requiredMeasurement.includes(observation.measurementType)) fail('MEASUREMENT_INCOMPATIBLE', 'Observation type is incompatible with this capability', details)
    if (observation.measurementType === 'actual' && observation.period && observation.period.end > observation.sourceAsOf.slice(0, 10)) fail('PERIOD_NOT_AVAILABLE', 'Actual observations cannot describe a period not yet ended at sourceAsOf', details)
    if (!coverage.fields.includes(observation.field)) fail('COVERAGE_MISMATCH', 'Adapter returned an undeclared field', details)
    if (query.accountingBasis && observation.accountingBasis !== query.accountingBasis) fail('ACCOUNTING_BASIS_INCOMPATIBLE', 'Accounting bases cannot be proved equivalent', details)
    if (query.consolidation && observation.consolidation !== query.consolidation) fail('CONSOLIDATION_INCOMPATIBLE', 'Consolidation scopes cannot be proved equivalent', details)
    if (observation.licenseClass !== metadata.licenseClass) fail('LICENSE_MISMATCH', 'Observation and Adapter license classes differ', details)
    const sourceAt = Date.parse(observation.sourceAsOf)
    const availableAt = Date.parse(observation.availableAt)
    const retrievedAt = Date.parse(observation.retrievedAt)
    if (sourceAt > availableAt || availableAt > retrievedAt || retrievedAt > now) fail('CHRONOLOGY_INVALID', 'Observation chronology is inconsistent', details)
    if (availableAt > asOf || sourceAt > asOf) fail('PIT_VIOLATION', 'Observation was not available at the requested asOf', details)
    if ((asOf - sourceAt) / 1000 > query.maxAgeSeconds) fail('STALE_DATA', 'Observation exceeds the requested freshness limit', details)
    const normalized = normalizedValue(observation, query.targetUnit)
    const observationId = `sha256:${createHash('sha256').update(canonical({ adapterId: metadata.id, adapterVersion: metadata.version, sourceId: metadata.sourceId, observation })).digest('hex')}`
    return { ...observation, ...normalized, observationId,
      provenance: { adapterId: metadata.id, adapterVersion: metadata.version, sourceId: metadata.sourceId,
        testOnly: metadata.testOnly, licenseClass: metadata.licenseClass, originalValue: observation.value, originalUnit: observation.unit } }
  })
  const missing = query.requiredFields.filter(field => !observations.some(observation => observation.field === field && observation.value !== null))
  if (missing.length) fail('MISSING_FIELDS', 'Required observations are absent or null', missing)
  return parse(schemas.NormalizedResult, { contractVersion: '1.0.0', query, observations, warnings: result.warnings }, 'INVALID_RESULT')
}
