/** Versioned, bounded wire contracts; the factory is also serialized into the Client. */
export const DATA_CONTRACT_VERSION = '1.0.0'
export const CAPABILITIES = Object.freeze([
  'company.identity', 'financial.statements', 'filings', 'earnings.transcript',
  'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
  'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship', 'compliance.screening',
])

/** Deliberately no external lexical dependencies, including exported constants. */
export function createDataSchemas(z) {
  const ids = ['company.identity', 'financial.statements', 'filings', 'earnings.transcript',
    'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
    'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship', 'compliance.screening']
  const boundedText = max => z.string().min(1).max(max).refine(value =>
    !/[\u0000-\u001f\u007f]/.test(value) && !/(?:Bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*\S+)/i.test(value),
  'Use bounded, credential-free text without control characters')
  const Id = boundedText(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/)
  const Field = boundedText(96).regex(/^[A-Za-z][A-Za-z0-9._-]*$/)
  const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate values are not allowed')
  const Capability = z.enum(ids)
  const LicenseClass = z.enum(['TEST_ONLY', 'USER_PROVIDED', 'COMMERCIAL', 'PUBLIC_LICENSED'])
  const MeasurementType = z.enum(['actual', 'estimate', 'forecast', 'indicative', 'identity', 'record', 'screening_result'])
  const Entity = z.strictObject({ scheme: Id, id: Id })
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  const ISODate = z.string().max(10).refine(validDate, 'Expected an exact ISO calendar date')
  const Timestamp = z.string().max(35).refine(value => {
    const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
    return !!match && validDate(match[1]) && match[5] !== '-00:00' && Number.isFinite(Date.parse(value))
  }, 'Expected a precise RFC3339 timestamp (milliseconds maximum, known offset, no leap seconds)')
  const Period = z.strictObject({
    kind: z.enum(['instant', 'fiscal_year', 'fiscal_quarter', 'range']),
    start: ISODate, end: ISODate, label: boundedText(96).optional(),
  }).refine(value => value.start <= value.end && (value.kind !== 'instant' || value.start === value.end), 'Invalid period boundaries')
  const Unit = z.strictObject({
    dimension: z.enum(['currency', 'ratio', 'count', 'text']),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    scale: z.enum(['ones', 'thousands', 'millions', 'billions', 'percent', 'basis_points', 'ratio', 'text']),
  }).refine(value => {
    if (value.dimension === 'currency') return value.currency !== null && ['ones', 'thousands', 'millions', 'billions'].includes(value.scale)
    if (value.currency !== null) return false
    if (value.dimension === 'count') return ['ones', 'thousands', 'millions', 'billions'].includes(value.scale)
    if (value.dimension === 'ratio') return ['percent', 'basis_points', 'ratio'].includes(value.scale)
    return value.scale === 'text'
  }, 'Dimension, currency and scale must agree')
  const Query = z.strictObject({
    capability: Capability, entity: Entity, market: Id,
    requiredFields: unique(z.array(Field).min(1).max(64)), period: Period.nullable(), asOf: Timestamp,
    purpose: z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening']),
    targetUnit: Unit.optional(), maxAgeSeconds: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    sourceIds: unique(z.array(Id).min(1).max(64)).optional(),
    accountingBasis: boundedText(96).optional(), consolidation: boundedText(96).optional(), measurementType: MeasurementType.optional(),
  }).refine(value => !['financial.statements', 'earnings.consensus', 'prices.history', 'comps', 'macro.rates',
    'portfolio.nav', 'accounting.gl', 'accounting.subledger'].includes(value.capability) || value.period !== null,
  'This financial metric capability requires an explicit period')
  const AdapterCapability = z.strictObject({
    id: Capability, markets: unique(z.array(Id).min(1).max(64)), fields: unique(z.array(Field).min(1).max(64)),
    priority: z.number().int().min(0).max(1000000), quality: z.number().int().min(0).max(100), pointInTime: z.boolean(),
  })
  const AdapterMetadata = z.strictObject({
    id: Id, version: z.string().max(64).regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
    sourceId: Id, label: boundedText(160), testOnly: z.boolean(), licenseClass: LicenseClass,
    capabilities: z.array(AdapterCapability).min(1).max(14).refine(values => new Set(values.map(value => value.id)).size === values.length, 'Duplicate capability IDs'),
    credentialRef: Id.optional(),
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'), 'TEST_ONLY markers must agree')
  const Reference = z.strictObject({
    uri: boundedText(2048).refine(value => {
      if (/^urn:[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(value)) return true
      try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      } catch { return false }
    }, 'Use a canonical credential-free HTTPS URI (no query/fragment) or opaque URN'),
    label: boundedText(256),
  })
  const Value = z.union([z.number().finite(), boundedText(2048), z.boolean(), z.null()])
  const observationShape = {
    field: Field, entity: Entity, value: Value, unit: Unit, period: Period.nullable(), measurementType: MeasurementType,
    accountingBasis: boundedText(96), consolidation: boundedText(96),
    sourceAsOf: Timestamp, availableAt: Timestamp, retrievedAt: Timestamp, revision: Id,
    reference: Reference, licenseClass: LicenseClass,
  }
  const compatibleValue = value => value.value === null || (value.unit.dimension === 'text'
    ? ['string', 'boolean'].includes(typeof value.value) : typeof value.value === 'number')
  const Observation = z.strictObject(observationShape).refine(compatibleValue, 'Value type must match unit dimension')
  const Warnings = z.array(boundedText(512)).max(64)
  const AdapterResult = z.strictObject({ observations: z.array(Observation).max(1000), warnings: Warnings })
  const Provenance = z.strictObject({ adapterId: Id, adapterVersion: AdapterMetadata.shape.version,
    sourceId: Id, testOnly: z.boolean(), licenseClass: LicenseClass, originalValue: Value, originalUnit: Unit,
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'), 'TEST_ONLY markers must agree')
  const NormalizedObservation = z.strictObject({ ...observationShape,
    observationId: z.string().regex(/^sha256:[0-9a-f]{64}$/), provenance: Provenance,
  }).refine(compatibleValue, 'Value type must match unit dimension')
  const NormalizedResult = z.strictObject({ contractVersion: z.literal('1.0.0'), query: Query,
    observations: z.array(NormalizedObservation).max(1000), warnings: Warnings })
  const ErrorInfo = z.strictObject({ code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/),
    message: boundedText(512), details: z.array(boundedText(128)).max(64).optional() })
  return { Capability, Entity, ISODate, Timestamp, Period, Unit, MeasurementType, Query, AdapterMetadata, Observation,
    AdapterResult, Provenance, NormalizedObservation, NormalizedResult, ErrorInfo }
}
