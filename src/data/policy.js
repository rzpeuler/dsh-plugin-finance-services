import { z } from 'zod'
import { createDataSchemas } from './contracts.js'
const schemas = createDataSchemas(z)
const Id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/)
const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate grant values')
export const SourceBinding = z.strictObject({
  adapterId: Id, sourceAllowlistKey: Id, scopeIds: unique(z.array(Id).min(1).max(128)),
  roleIds: unique(z.array(z.string().regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(40)),
  capabilities: unique(z.array(schemas.Capability).min(1).max(14)),
  markets: unique(z.array(Id).min(1).max(64)),
  purposes: unique(z.array(z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening'])).min(1).max(5)),
  priority: z.number().int().min(0).max(1000000), minQuality: z.number().int().min(0).max(100),
  enabled: z.boolean(), allowTestOnly: z.boolean(),
})
export const SourceBindings = z.array(SourceBinding).max(256).refine(values => new Set(values.map(value => JSON.stringify({ ...value,
  scopeIds: [...value.scopeIds].sort(), roleIds: [...value.roleIds].sort(), capabilities: [...value.capabilities].sort(),
  markets: [...value.markets].sort(), purposes: [...value.purposes].sort(),
}))).size === values.length, 'Duplicate source binding')

/** Selection cannot grant access: explicit bindings intersect the source role's original allowlist. */
export function assessSource(metadata, query, role, bindings, scopeId) {
  if (!role || role.writer || !role.allowedMcpServers?.length) return { accepted: false, code: 'ROLE_QUERY_DENIED' }
  const binding = bindings.filter(item => item.enabled && item.adapterId === metadata.id && item.scopeIds.includes(scopeId) && item.roleIds.includes(role.id)
    && role.allowedMcpServers.includes(item.sourceAllowlistKey) && item.capabilities.includes(query.capability)
    && item.markets.includes(query.market) && item.purposes.includes(query.purpose) && (!metadata.testOnly || item.allowTestOnly))
    .sort((a, b) => b.priority - a.priority || a.sourceAllowlistKey.localeCompare(b.sourceAllowlistKey, 'en'))[0]
  if (!binding) return { accepted: false, code: 'SOURCE_BINDING_REQUIRED' }
  if (query.sourceIds && !query.sourceIds.includes(metadata.sourceId)) return { accepted: false, code: 'SOURCE_NOT_SELECTED' }
  const capability = metadata.capabilities.find(item => item.id === query.capability)
  if (!capability) return { accepted: false, code: 'CAPABILITY_UNAVAILABLE' }
  if (!capability.markets.includes(query.market) || query.requiredFields.some(field => !capability.fields.includes(field))) return { accepted: false, code: 'COVERAGE_INCOMPLETE' }
  if (!capability.pointInTime) return { accepted: false, code: 'PIT_UNAVAILABLE' }
  if (capability.quality < binding.minQuality) return { accepted: false, code: 'QUALITY_INSUFFICIENT' }
  return { accepted: true, binding, capability }
}

/** Deterministic, capability-specific rank; never a global vendor preference. */
export function compareCandidates(left, right) {
  return right.assessment.binding.priority - left.assessment.binding.priority
    || right.assessment.capability.priority - left.assessment.capability.priority
    || right.assessment.capability.quality - left.assessment.capability.quality
    || left.record.metadata.id.localeCompare(right.record.metadata.id, 'en')
}
