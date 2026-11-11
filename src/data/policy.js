import { z } from 'zod'
import { CAPABILITIES, createDataSchemas } from './contracts.js'

const schemas = createDataSchemas(z)
const Id = schemas.Entity.shape.scheme
const RoleId = z.string().min(1).max(128).regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)
const Purpose = z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening'])
const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate values are not allowed')
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0

const LicenseAssessment = schemas.LicenseAssessment
const SourceBindingSchema = z.strictObject({
  adapterId: Id,
  // Legacy MCP grants retain their original key; direct financial-source grants
  // use sourceId and must carry a trusted, Host-persisted license assessment.
  sourceAllowlistKey: Id.optional(),
  sourceId: Id.optional(),
  licenseAssessment: LicenseAssessment.optional(),
  scopeIds: unique(z.array(Id).min(1).max(128)),

  roleIds: unique(z.array(RoleId).min(1).max(40)),
  capabilities: unique(z.array(z.enum(CAPABILITIES)).min(1).max(CAPABILITIES.length)),
  markets: unique(z.array(Id).min(1).max(64)),
  purposes: unique(z.array(Purpose).min(1).max(5)),
  temporalModes: unique(z.array(schemas.TemporalMode).min(1).max(3)),
  corporateActionDateBases: unique(z.array(schemas.CorporateActionDateBasis).min(1).max(5)).optional(),
  priority: z.number().int().min(0).max(1000000),
  minQuality: z.number().int().min(0).max(100),
  enabled: z.boolean(),
  allowTestOnly: z.boolean(),
}).refine(binding => (binding.sourceAllowlistKey !== undefined) !== (binding.sourceId !== undefined),
'Exactly one of legacy sourceAllowlistKey or direct sourceId is required')
  .refine(binding => binding.sourceId === undefined || binding.licenseAssessment !== undefined,
'direct financial-source grants require a Host license assessment')
  .refine(binding => binding.capabilities.includes('corporate.actions')
    ? binding.corporateActionDateBases !== undefined
    : binding.corporateActionDateBases === undefined,
  'corporateActionDateBases is required only when corporate.actions is bound')

export const SourceBinding = SourceBindingSchema

function canonicalBinding(binding) {
  const sorted = values => [...values].sort(compareText)
  return JSON.stringify({
    adapterId: binding.adapterId,
    sourceAllowlistKey: binding.sourceAllowlistKey ?? null,
    sourceId: binding.sourceId ?? null,
    licenseAssessment: binding.licenseAssessment ?? null,
    scopeIds: sorted(binding.scopeIds),
    roleIds: sorted(binding.roleIds),
    capabilities: sorted(binding.capabilities),
    markets: sorted(binding.markets),
    purposes: sorted(binding.purposes),
    temporalModes: sorted(binding.temporalModes),
    corporateActionDateBases: binding.corporateActionDateBases
      ? sorted(binding.corporateActionDateBases)
      : null,
    priority: binding.priority,
    minQuality: binding.minQuality,
    enabled: binding.enabled,
    allowTestOnly: binding.allowTestOnly,
  })
}

export const SourceBindings = z.array(SourceBinding).max(256).refine(bindings =>
  new Set(bindings.map(canonicalBinding)).size === bindings.length,
'Duplicate source binding')

const denied = code => ({ accepted: false, code })

/**
 * Intersect an adapter candidate with explicit source policy and the role's original
 * source allowlist. This helper selects only; it never creates authority.
 */
export function assessSource(metadata, query, role, bindings, scopeId, now = new Date().toISOString()) {
  if (!role || role.writer === true || typeof role.id !== 'string' ||
    !Array.isArray(role.allowedMcpServers)) {
    return denied('ROLE_QUERY_DENIED')
  }

  const parsedMetadata = schemas.AdapterMetadata.safeParse(metadata)
  const parsedQuery = schemas.Query.safeParse(query)
  const parsedBindings = SourceBindings.safeParse(bindings)
  const parsedScope = Id.safeParse(scopeId)
  const parsedNow = schemas.Timestamp.safeParse(now)
  if (!parsedMetadata.success || !parsedQuery.success || !parsedBindings.success || !parsedScope.success || !parsedNow.success) {
    return denied('INVALID_POLICY_INPUT')
  }

  const adapter = parsedMetadata.data
  const request = parsedQuery.data
  const capability = adapter.capabilities.find(item => item.id === request.capability)
  if (!capability) return denied('CAPABILITY_UNAVAILABLE')

  const hasDirectSourceGrant = parsedBindings.data.some(binding => binding.enabled && binding.sourceId !== undefined &&
    binding.roleIds.includes(role.id))
  if (role.allowedMcpServers.length === 0 && !hasDirectSourceGrant) return denied('ROLE_QUERY_DENIED')

  const scopedBindings = parsedBindings.data.filter(binding => binding.enabled &&
    binding.adapterId === adapter.id &&
    binding.scopeIds.includes(parsedScope.data) &&
    binding.roleIds.includes(role.id) &&
    (binding.sourceId !== undefined
      ? binding.sourceId === adapter.sourceId
      : binding.sourceAllowlistKey !== undefined && role.allowedMcpServers.includes(binding.sourceAllowlistKey)) &&
    binding.capabilities.includes(request.capability) &&
    binding.markets.includes(request.market) &&
    binding.purposes.includes(request.purpose))
  if (scopedBindings.length === 0) return denied('SOURCE_BINDING_REQUIRED')

  const directBinding = scopedBindings.find(binding => binding.sourceId !== undefined)
  if (directBinding && !adapter.testOnly) {
    const assessment = directBinding.licenseAssessment
    if (!assessment || ['UNKNOWN', 'REVIEW_REQUIRED'].includes(assessment.assessmentStatus)) {
      return denied('LICENSE_REVIEW_REQUIRED')
    }
    if (['RESTRICTED', 'DENIED'].includes(assessment.assessmentStatus)) return denied('LICENSE_USE_NOT_AUTHORIZED')
    const nowEpoch = Date.parse(parsedNow.data)
    const expires = assessment.expiresAt === null ? null : Date.parse(assessment.expiresAt)
    const reviewed = assessment.reviewedAt === null ? null : Date.parse(assessment.reviewedAt)
    if (assessment.sourceId !== adapter.sourceId ||
      !assessment.capabilityIds.includes(request.capability) ||
      !assessment.allowedPurposes.includes(request.purpose) || !assessment.automatedAccess ||
      !assessment.modelProcessing || !assessment.sessionLogging ||
      (reviewed !== null && reviewed > nowEpoch) || (expires !== null && expires <= nowEpoch)) {
      return denied(expires !== null && expires <= nowEpoch ? 'LICENSE_ASSESSMENT_EXPIRED' : 'LICENSE_USE_NOT_AUTHORIZED')
    }
  }

  // sourceIds is a post-authorization preference/filter; it can never authorize a source.
  if (request.sourceIds && !request.sourceIds.includes(adapter.sourceId)) return denied('SOURCE_NOT_SELECTED')

  if (!capability.markets.includes(request.market) ||
    request.requiredFields.some(field => !capability.fields.includes(field))) {
    return denied('COVERAGE_INCOMPLETE')
  }

  if (request.capability === 'prices.history' &&
    !capability.priceAdjustments?.includes(request.priceAdjustment)) {
    return denied('PRICE_ADJUSTMENT_UNSUPPORTED')
  }

  if (!capability.temporalModes.includes(request.temporalMode)) {
    return denied('TEMPORAL_MODE_UNSUPPORTED')
  }
  const historicalIntent = request.researchIntent === 'historicalReplay' ||
    (request.researchIntent === undefined && request.temporalMode !== 'current_only')
  const declaredPitQualities = capability.pitQualities ?? capability.temporalModes.map(mode =>
    mode === 'current_only' ? 'CURRENT_OBSERVED' : 'STRICT_HISTORICAL')
  if (historicalIntent && !declaredPitQualities.includes('STRICT_HISTORICAL')) {
    return denied('TEMPORAL_QUALITY_UNSUPPORTED')
  }
  const temporalBindings = scopedBindings.filter(binding => binding.temporalModes.includes(request.temporalMode))
  if (temporalBindings.length === 0) return denied('TEMPORAL_MODE_UNSUPPORTED')

  let eligibleBindings = temporalBindings
  if (request.capability === 'corporate.actions') {
    const dateBasis = request.corporateActionDateBasis
    if (!capability.corporateActionDateBases?.includes(dateBasis)) {
      return denied('CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED')
    }
    eligibleBindings = temporalBindings.filter(binding => binding.corporateActionDateBases?.includes(dateBasis))
    if (eligibleBindings.length === 0) return denied('CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED')
  }

  const testOnlyEligible = eligibleBindings.filter(binding => !adapter.testOnly || binding.allowTestOnly)
  if (testOnlyEligible.length === 0) return denied('TEST_ONLY_NOT_ALLOWED')

  const qualityEligible = testOnlyEligible.filter(binding => capability.quality >= binding.minQuality)
  if (qualityEligible.length === 0) return denied('QUALITY_INSUFFICIENT')

  qualityEligible.sort((left, right) => right.priority - left.priority ||
    compareText(left.sourceAllowlistKey, right.sourceAllowlistKey) ||
    compareText(canonicalBinding(left), canonicalBinding(right)))

  return {
    accepted: true,
    binding: qualityEligible[0],
    capability,
    directSourceGrant: qualityEligible[0].sourceId !== undefined,
    licenseAssessment: qualityEligible[0].licenseAssessment ?? null,
  }
}

/** Fail-closed permission check for every non-TEST_ONLY provider validation. */
export function explicitPermissionsPermitted(validation) {
  return validation?.compatible === true &&
    validation?.licensePermitted === true &&
    validation?.modelProcessingPermitted === true &&
    validation?.sessionLoggingPermitted === true
}

/** Deterministic rank: explicit binding priority, capability priority/quality, adapter ID. */
export function compareCandidates(left, right) {
  return right.assessment.binding.priority - left.assessment.binding.priority ||
    right.assessment.capability.priority - left.assessment.capability.priority ||
    right.assessment.capability.quality - left.assessment.capability.quality ||
    compareText(left.record.metadata.id, right.record.metadata.id)
}
