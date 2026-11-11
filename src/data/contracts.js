/** FinanceData wire schemas; the factory is self-contained for Client serialization. */
export const CAPABILITIES = Object.freeze([
  'company.identity', 'financial.statements', 'filings', 'earnings.transcript',
  'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
  'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship',
  'compliance.screening', 'corporate.actions',
])

/** No external lexical dependencies: serialize this function with the Client bundle. */
export function createDataSchemas(z) {
  const ids = ['company.identity', 'financial.statements', 'filings', 'earnings.transcript',
    'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
    'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship',
    'compliance.screening', 'corporate.actions']
  const boundedText = max => z.string().min(1).max(max).refine(value =>
    !/[\u0000-\u001f\u007f]/.test(value) &&
      !/(?:Bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*\S+)/i.test(value),
  'Use bounded, credential-free text without control characters')
  const Id = boundedText(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/)
  const Field = boundedText(96).regex(/^[A-Za-z][A-Za-z0-9._-]*$/)
  const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate values are not allowed')
  const Capability = z.enum(ids)
  const TemporalMode = z.enum(['strict', 'date_bounded', 'current_only'])
  const TemporalQuality = z.enum(['STRICT_HISTORICAL', 'CURRENT_OBSERVED', 'RECONSTRUCTED', 'UNVERIFIED'])
  const ResearchIntent = z.enum(['historicalReplay', 'currentResearch'])
  const LicenseClass = z.enum(['TEST_ONLY', 'USER_PROVIDED', 'COMMERCIAL', 'PUBLIC_LICENSED', 'UNASSESSED'])
  const MeasurementType = z.enum(['actual', 'estimate', 'forecast', 'indicative', 'identity', 'record', 'screening_result'])
  const Entity = z.strictObject({ scheme: Id, id: Id })
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  const ISODate = z.string().max(10).refine(validDate, 'Expected an exact ISO calendar date')
  const Timestamp = z.string().max(35).refine(value => {
    const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
    return !!match && validDate(match[1]) && match[5] !== '-00:00' && Number.isFinite(Date.parse(value))
  }, 'Expected a precise RFC3339 timestamp (milliseconds maximum, known offset, no leap seconds)')
  const TimeZone = z.string().min(1).max(128).refine(value => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
      return true
    } catch {
      return false
    }
  }, 'Expected a supported IANA time zone')
  const nextLocalMidnight = (publishedDate, timeZone) => {
    const publishedEpoch = Date.parse(`${publishedDate}T00:00:00.000Z`)
    if (!Number.isFinite(publishedEpoch)) return null
    const nextDate = new Date(publishedEpoch + 86400000).toISOString().slice(0, 10)
    let formatter
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
        minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      })
    } catch {
      return null
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
    let low = publishedEpoch - 36 * 60 * 60 * 1000
    let high = publishedEpoch + 36 * 60 * 60 * 1000
    if (localDateAt(low) >= nextDate || localDateAt(high) < nextDate) return null
    while (high - low > 1) {
      const middle = low + Math.floor((high - low) / 2)
      if (localDateAt(middle) >= nextDate) high = middle
      else low = middle
    }
    return high
  }
  const Period = z.strictObject({
    kind: z.enum(['instant', 'fiscal_year', 'fiscal_quarter', 'range']),
    start: ISODate, end: ISODate, label: boundedText(96).optional(),
  }).refine(value => value.start <= value.end && (value.kind !== 'instant' || value.start === value.end),
    'Invalid period boundaries')
  const Unit = z.strictObject({
    dimension: z.enum(['currency', 'currency_per_share', 'ratio', 'count', 'text']),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    scale: z.enum(['ones', 'thousands', 'millions', 'billions', 'percent', 'basis_points', 'ratio', 'text']),
  }).refine(value => {
    if (['currency', 'currency_per_share'].includes(value.dimension)) {
      return value.currency !== null && ['ones', 'thousands', 'millions', 'billions'].includes(value.scale)
    }
    if (value.currency !== null) return false
    if (value.dimension === 'count') return ['ones', 'thousands', 'millions', 'billions'].includes(value.scale)
    if (value.dimension === 'ratio') return ['percent', 'basis_points', 'ratio'].includes(value.scale)
    return value.scale === 'text'
  }, 'Dimension, currency and scale must agree')
  const validReferenceUri = value => {
    if (/^urn:[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(value)) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.search && !url.hash
    } catch {
      return false
    }
  }
  const Reference = z.strictObject({
    uri: boundedText(2048).refine(validReferenceUri,
      'Use a credential-free HTTPS URI without query/fragment or an opaque URN'),
    label: boundedText(256),
  })
  const LicenseAssessment = z.strictObject({
    version: z.literal(1), sourceId: Id,
    assessmentStatus: z.enum(['UNKNOWN', 'REVIEW_REQUIRED', 'VERIFIED', 'RESTRICTED', 'DENIED']),
    evidenceRefs: z.array(Reference).max(32),
    allowedPurposes: unique(z.array(z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening'])).max(5)),
    capabilityIds: unique(z.array(Capability).min(1).max(ids.length)),
    automatedAccess: z.boolean(), modelProcessing: z.boolean(), sessionLogging: z.boolean(),
    retention: z.enum(['NONE', 'SESSION_ONLY', 'DURATION_LIMITED', 'UNRESTRICTED', 'UNKNOWN']),
    redistribution: z.enum(['PROHIBITED', 'RESTRICTED', 'ALLOWED', 'UNKNOWN']),
    reviewedAt: Timestamp.nullable(), expiresAt: Timestamp.nullable(),
  }).refine(value => value.assessmentStatus !== 'VERIFIED' ||
      (value.evidenceRefs.length > 0 && value.allowedPurposes.length > 0 && value.reviewedAt !== null &&
        value.automatedAccess && value.modelProcessing && value.sessionLogging &&
        value.retention !== 'UNKNOWN' && value.redistribution !== 'UNKNOWN'),
    'Verified license assessment requires evidence, permitted processing, retention, redistribution and review time')
  const Value = z.union([z.number().finite(), boundedText(2048), z.boolean(), z.null()])
  const AvailabilityEvidence = z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('timestamp'), sourcePublishedAt: Timestamp, availableAt: Timestamp,
    }).refine(value => Date.parse(value.sourcePublishedAt) <= Date.parse(value.availableAt),
      'Availability cannot precede the source publication timestamp'),
    z.strictObject({
      type: z.literal('date'), publishedDate: ISODate, timeZone: TimeZone,
      rule: z.literal('next_local_midnight'), availableAt: Timestamp,
    }).refine(value => {
      const boundary = nextLocalMidnight(value.publishedDate, value.timeZone)
      return boundary !== null && Date.parse(value.availableAt) >= boundary
    }, 'Date-bounded availability must be no earlier than the next local midnight'),
    z.strictObject({ type: z.literal('current_snapshot'), capturedAt: Timestamp }),
  ])
  const RevisionEvidence = z.strictObject({
    chainId: Id.nullable(),
    chainStatus: z.enum(['complete', 'single_record', 'partial', 'unknown']),
    supersedes: unique(z.array(Id).max(64)),
    changeType: boundedText(64),
    sourceRecordId: Id.nullable(),
    capturedAt: Timestamp,
    evidence: Reference,
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  }).refine(value => !['complete', 'single_record'].includes(value.chainStatus) ||
    (value.chainId !== null && value.sourceRecordId !== null),
  'Complete or single-record evidence requires source-stable chain and record IDs')
  const CorporateActionDateBasis = z.enum(['announcement_date', 'record_date', 'ex_date', 'payment_date', 'effective_date'])
  const PriceAdjustment = z.enum(['none', 'qfq', 'hfq', 'total_return'])
  const Query = z.strictObject({
    capability: Capability, entity: Entity, market: Id,
    requiredFields: unique(z.array(Field).min(1).max(64)), period: Period.nullable(), asOf: Timestamp,
    purpose: z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening']),
    temporalMode: TemporalMode.default('strict'),
    researchIntent: ResearchIntent.optional(),
    targetUnit: Unit.optional(), maxAgeSeconds: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    sourceIds: unique(z.array(Id).min(1).max(64)).optional(),
    accountingBasis: boundedText(96).optional(), consolidation: boundedText(96).optional(),
    measurementType: MeasurementType.optional(), corporateActionDateBasis: CorporateActionDateBasis.optional(),
    priceAdjustment: PriceAdjustment.default('none'),
  }).refine(value => !['financial.statements', 'filings', 'earnings.consensus', 'prices.history', 'comps',
    'macro.rates', 'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'corporate.actions'].includes(value.capability) ||
    value.period !== null, 'This capability requires an explicit period')
    .refine(value => value.capability !== 'filings' || value.period?.kind === 'range',
      'filings requires a range period over announcementDate')
    .refine(value => value.capability !== 'corporate.actions' || value.period?.kind === 'range',
      'corporate.actions requires a range period')
    .refine(value => value.capability === 'corporate.actions' ? value.corporateActionDateBasis !== undefined :
      value.corporateActionDateBasis === undefined,
    'corporateActionDateBasis is required only for corporate.actions')
    .refine(value => value.researchIntent !== 'historicalReplay' || value.temporalMode !== 'current_only',
      'Current-only data cannot satisfy historical replay')
    .refine(value => value.researchIntent !== 'currentResearch' || value.temporalMode === 'current_only',
      'Current research must explicitly use current_only temporal mode')
    .refine(value => value.capability !== 'corporate.actions' || value.targetUnit === undefined,
      'corporate.actions does not support a single targetUnit for heterogeneous terms')
    .refine(value => value.capability === 'prices.history' || value.priceAdjustment === 'none',
      'Only prices.history may request a non-default priceAdjustment')
  const AdapterCapability = z.strictObject({
    id: Capability, markets: unique(z.array(Id).min(1).max(64)), fields: unique(z.array(Field).min(1).max(64)),
    temporalModes: unique(z.array(TemporalMode).min(1).max(3)),
    pitQualities: unique(z.array(TemporalQuality).min(1).max(4)).optional(),
    corporateActionDateBases: unique(z.array(CorporateActionDateBasis).min(1).max(5)).optional(),
    priceAdjustments: unique(z.array(PriceAdjustment).min(1).max(4)).optional(),
    priority: z.number().int().min(0).max(1000000), quality: z.number().int().min(0).max(100),
  }).refine(value => value.id === 'corporate.actions' ? value.corporateActionDateBases !== undefined :
    value.corporateActionDateBases === undefined,
  'corporateActionDateBases is required only for corporate.actions')
    .refine(value => value.id === 'prices.history' ? value.priceAdjustments !== undefined : value.priceAdjustments === undefined,
      'priceAdjustments is required only for prices.history')
  const AdapterMetadata = z.strictObject({
    id: Id, version: z.string().max(64).regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
    sourceId: Id, label: boundedText(160), testOnly: z.boolean(), licenseClass: LicenseClass,
    authenticationMode: z.enum(['NONE', 'API_KEY', 'OAUTH', 'USER_FILE', 'OTHER']).optional(),
    capabilities: z.array(AdapterCapability).min(1).max(15)
      .refine(values => new Set(values.map(value => value.id)).size === values.length, 'Duplicate capability IDs'),
    credentialRef: Id.optional(),
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'),
    'TEST_ONLY markers must agree')
  const AdapterValidation = z.strictObject({
    compatible: z.boolean(), code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional(),
    licensePermitted: z.boolean().optional(), modelProcessingPermitted: z.boolean().optional(),
    sessionLoggingPermitted: z.boolean().optional(),
  })
  const observationShape = {
    field: Field, entity: Entity, value: Value, unit: Unit, period: Period.nullable(),
    measurementType: MeasurementType, accountingBasis: boundedText(96), consolidation: boundedText(96),
    availabilityEvidence: AvailabilityEvidence, retrievedAt: Timestamp, revision: Id.nullable(),
    revisionEvidence: RevisionEvidence, reference: Reference, licenseClass: LicenseClass,
    pitQuality: TemporalQuality.optional(),
  }
  const checkObservation = value => {
    if (value.revision !== null && value.revisionEvidence.supersedes.includes(value.revision)) return false
    const capturedAt = Date.parse(value.revisionEvidence.capturedAt)
    const retrievedAt = Date.parse(value.retrievedAt)
    if (capturedAt > retrievedAt) return false
    if (['complete', 'single_record'].includes(value.revisionEvidence.chainStatus) && value.revision === null) return false
    const evidence = value.availabilityEvidence
    if (evidence.type === 'current_snapshot') return evidence.capturedAt === value.retrievedAt
    return Date.parse(evidence.availableAt) <= retrievedAt
  }
  const compatibleValue = value => value.value === null ||
    (value.unit.dimension === 'text' ? ['string', 'boolean'].includes(typeof value.value) : typeof value.value === 'number')
  const Observation = z.strictObject(observationShape)
    .refine(compatibleValue, 'Value type must match unit dimension')
    .refine(checkObservation, 'Invalid observation chronology or self-superseding revision')
  const CorporateActionTerm = z.strictObject({
    kind: Field, value: z.number().finite(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    ratio: z.number().finite().nullable(), unit: boundedText(64),
  })
  const CorporateActionRecord = z.strictObject({
    actionId: Id, entity: Entity,
    actionType: z.enum(['cash_dividend', 'stock_dividend', 'bonus_issue', 'capitalization',
      'rights_issue', 'split', 'reverse_split', 'merger', 'other']),
    status: z.enum(['proposed', 'announced', 'pending', 'completed', 'cancelled', 'corrected', 'unknown']),
    terms: z.array(CorporateActionTerm).min(1).max(32),
    announcementDate: ISODate.nullable(), recordDate: ISODate.nullable(), exDate: ISODate.nullable(),
    paymentDate: ISODate.nullable(), effectiveDate: ISODate.nullable(),
    filingReference: Reference.nullable(), availabilityEvidence: AvailabilityEvidence, retrievedAt: Timestamp,
    revision: Id.nullable(), revisionEvidence: RevisionEvidence, licenseClass: LicenseClass,
  }).refine(checkObservation, 'Invalid corporate action chronology or self-superseding revision')
  const filingFieldMap = Object.freeze({
    filing_id: 'filingId', filing_type: 'filingType', title: 'title',
    announcement_date: 'announcementDate', report_period: 'reportPeriod', filing_reference: 'filingReference',
  })
  const FilingRecord = z.strictObject({
    filingId: Id, entity: Entity, filingType: boundedText(96), title: boundedText(512),
    announcementDate: ISODate.nullable(), reportPeriod: Period.nullable(), filingReference: Reference,
    availabilityEvidence: AvailabilityEvidence, retrievedAt: Timestamp,
    revision: Id.nullable(), revisionEvidence: RevisionEvidence, licenseClass: LicenseClass,
  }).refine(value => value.filingId === value.revisionEvidence.sourceRecordId,
    'filingId must match its sourceRecordId')
    .refine(checkObservation, 'Invalid filing chronology or self-superseding revision')
  const Provenance = z.strictObject({
    adapterId: Id, adapterVersion: AdapterMetadata.shape.version, sourceId: Id,
    testOnly: z.boolean(), licenseClass: LicenseClass, originalValue: Value, originalUnit: Unit,
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'),
    'TEST_ONLY markers must agree')
  const CorporateActionProvenance = z.strictObject({
    adapterId: Id, adapterVersion: AdapterMetadata.shape.version, sourceId: Id,
    testOnly: z.boolean(), licenseClass: LicenseClass,
    originalTerms: z.array(CorporateActionTerm).min(1).max(32),
    sourceRecordId: Id.nullable(), sourceEvidence: Reference,
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'),
    'TEST_ONLY markers must agree')
  const FilingProvenance = z.strictObject({
    adapterId: Id, adapterVersion: AdapterMetadata.shape.version, sourceId: Id,
    testOnly: z.boolean(), licenseClass: LicenseClass,
    originalFilingReference: Reference, sourceRecordId: Id, sourceEvidence: Reference,
  }).refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'),
    'TEST_ONLY markers must agree')
  const NormalizedObservation = z.strictObject({
    ...observationShape, observationId: z.string().regex(/^sha256:[0-9a-f]{64}$/), provenance: Provenance,
  }).refine(compatibleValue, 'Value type must match unit dimension')
    .refine(checkObservation, 'Invalid observation chronology or self-superseding revision')
  const NormalizedCorporateActionRecord = z.strictObject({
    ...CorporateActionRecord.shape, provenance: CorporateActionProvenance,
  }).refine(checkObservation, 'Invalid corporate action chronology or self-superseding revision')
  const NormalizedFilingRecord = z.strictObject({
    ...FilingRecord.shape, provenance: FilingProvenance,
  }).refine(value => value.filingId === value.revisionEvidence.sourceRecordId &&
    value.provenance.sourceRecordId === value.filingId &&
    value.provenance.originalFilingReference.uri === value.filingReference.uri &&
    value.provenance.originalFilingReference.label === value.filingReference.label &&
    value.provenance.sourceEvidence.uri === value.revisionEvidence.evidence.uri &&
    value.provenance.sourceEvidence.label === value.revisionEvidence.evidence.label,
  'Filing provenance must match source IDs and references')
    .refine(checkObservation, 'Invalid filing chronology or self-superseding revision')
  const Warning = z.strictObject({
    code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/), message: boundedText(512),
  })
  const AdapterWarnings = z.array(boundedText(512)).max(64)
  const Warnings = z.array(Warning).max(64)
  const AdapterResult = z.strictObject({
    observations: z.array(Observation).max(1000), corporateActions: z.array(CorporateActionRecord).max(1000),
    filings: z.array(FilingRecord).max(1000).default([]), warnings: AdapterWarnings,
  })
  const NormalizedResult = z.strictObject({
    query: Query,
    observations: z.array(NormalizedObservation).max(1000),
    corporateActions: z.array(NormalizedCorporateActionRecord).max(1000),
    filings: z.array(NormalizedFilingRecord).max(1000).default([]), warnings: Warnings,
  }).refine(value => {
    const rows = [...value.observations, ...value.corporateActions, ...value.filings]
    if (value.query.capability === 'filings') {
      if (value.observations.length > 0 || value.corporateActions.length > 0 || value.query.period?.kind !== 'range') return false
      if (value.filings.some(filing => filing.announcementDate === null ||
        filing.announcementDate < value.query.period.start || filing.announcementDate > value.query.period.end)) return false
      for (const field of value.query.requiredFields) {
        const property = filingFieldMap[field]
        if (!property || !value.filings.some(filing => filing[property] !== null)) return false
      }
    } else if (value.filings.length > 0) return false
    if (value.query.capability === 'corporate.actions' && value.observations.length > 0) return false
    if (value.query.capability !== 'corporate.actions' && value.corporateActions.length > 0) return false
    let needsDateWarning = false
    const needsCurrentWarning = value.query.temporalMode === 'current_only' && rows.length > 0
    for (const row of rows) {
      const evidence = row.availabilityEvidence
      const chainStatus = row.revisionEvidence.chainStatus
      if (value.query.temporalMode === 'strict') {
        if (evidence.type !== 'timestamp' || !['complete', 'single_record'].includes(chainStatus) ||
          row.revision === null || row.revisionEvidence.chainId === null || row.revisionEvidence.sourceRecordId === null ||
          Date.parse(evidence.availableAt) > Date.parse(value.query.asOf)) return false
      } else if (value.query.temporalMode === 'date_bounded') {
        if (!['timestamp', 'date'].includes(evidence.type) || !['complete', 'single_record'].includes(chainStatus) ||
          row.revision === null || row.revisionEvidence.chainId === null || row.revisionEvidence.sourceRecordId === null ||
          Date.parse(evidence.availableAt) > Date.parse(value.query.asOf)) return false
        if (evidence.type === 'date') needsDateWarning = true
      } else if (evidence.type !== 'current_snapshot' || evidence.capturedAt !== row.retrievedAt) return false
    }
    const warningCodes = new Set(value.warnings.map(warning => warning.code))
    return (!needsDateWarning || warningCodes.has('DATE_BOUNDED_AVAILABILITY')) &&
      (!needsCurrentWarning || warningCodes.has('CURRENT_ONLY_SNAPSHOT'))
  }, 'Result evidence must satisfy its temporal mode and disclose date/current-only degradation')
  const ErrorInfo = z.strictObject({
    code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/),
    message: boundedText(512), details: z.array(boundedText(128)).max(64).optional(),
  })
  return {
    Capability, TemporalMode, TemporalQuality, ResearchIntent, LicenseClass, LicenseAssessment, MeasurementType, Entity, ISODate, Timestamp, TimeZone,
    Period, Unit, Reference, Value, AvailabilityEvidence, RevisionEvidence, Query, AdapterCapability,
    AdapterMetadata, AdapterValidation, CorporateActionDateBasis, PriceAdjustment, Observation, CorporateActionTerm,
    CorporateActionRecord, FilingRecord, AdapterResult, Provenance, NormalizedObservation, CorporateActionProvenance,
    NormalizedCorporateActionRecord, FilingProvenance, NormalizedFilingRecord, NormalizedResult, ErrorInfo, Warning,
    Warnings, AdapterWarnings,
  }
}
