import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { assessSource, SourceBinding } from '../src/data/policy.js'
import { createDataSchemas } from '../src/data/contracts.js'

const schemas = createDataSchemas(z)
const metadata = {
  id: 'ashare-em-price', version: '1.0.0', sourceId: 'eastmoney', label: 'Eastmoney daily price',
  testOnly: false, licenseClass: 'COMMERCIAL', authenticationMode: 'NONE',
  capabilities: [{ id: 'prices.history', markets: ['CN'], fields: ['close'], temporalModes: ['strict', 'current_only'],
    pitQualities: ['STRICT_HISTORICAL', 'CURRENT_OBSERVED'], priceAdjustments: ['none'], priority: 20, quality: 80 }],
}
const query = overrides => ({ capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
  requiredFields: ['close'], period: { kind: 'range', start: '2026-11-10', end: '2026-11-10' },
  asOf: '2026-11-11T10:00:00+08:00', purpose: 'research', temporalMode: 'strict',
  maxAgeSeconds: 86400, priceAdjustment: 'none', ...overrides })
const assessment = overrides => ({
  version: 1, sourceId: 'eastmoney', assessmentStatus: 'VERIFIED',
  evidenceRefs: [{ uri: 'https://example.com/terms', label: 'Reviewed terms fixture' }],
  allowedPurposes: ['research'], capabilityIds: ['prices.history'],
  automatedAccess: true, modelProcessing: true, sessionLogging: true,
  retention: 'SESSION_ONLY', redistribution: 'PROHIBITED',
  reviewedAt: '2026-11-11T00:00:00Z', expiresAt: null, ...overrides,
})
const grant = overrides => ({
  adapterId: metadata.id, sourceId: metadata.sourceId,
  licenseAssessment: assessment(), scopeIds: ['agent-session-1'], roleIds: ['finance-market-researcher'],
  capabilities: ['prices.history'], markets: ['CN'], purposes: ['research'], temporalModes: ['strict'],
  priority: 1, minQuality: 0, enabled: true, allowTestOnly: false, ...overrides,
})
const role = { id: 'finance-market-researcher', writer: false, allowedMcpServers: [] }
const assess = (binding, request = query(), source = metadata, at = '2026-11-11T01:00:00Z') =>
  assessSource(source, request, role, [binding], 'agent-session-1', at)

test('direct financial-source grants are independent from legacy MCP allowlists', () => {
  const parsed = SourceBinding.safeParse(grant())
  assert.equal(parsed.success, true)
  const result = assess(parsed.data)
  assert.equal(result.accepted, true)
  assert.equal(result.directSourceGrant, true)
  assert.equal(result.binding.sourceId, 'eastmoney')
  assert.equal(assess(grant({ sourceId: 'ths' })).code, 'SOURCE_BINDING_REQUIRED')

  const oldMcp = { ...grant(), sourceId: undefined, licenseAssessment: undefined, sourceAllowlistKey: 'eastmoney' }
  assert.equal(assess(oldMcp).code, 'ROLE_QUERY_DENIED')
  assert.equal(assess(oldMcp, query(), metadata, '2026-11-11T01:00:00Z').code, 'ROLE_QUERY_DENIED')
  assert.equal(assess({ ...oldMcp }, query(), metadata, '2026-11-11T01:00:00Z').code, 'ROLE_QUERY_DENIED')
  assert.equal(assess({ ...oldMcp }, query(), metadata, '2026-11-11T01:00:00Z').code, 'ROLE_QUERY_DENIED')
})

test('missing, unknown, restricted and expired assessments fail closed', () => {
  assert.equal(assess(grant({ licenseAssessment: assessment({ assessmentStatus: 'REVIEW_REQUIRED', evidenceRefs: [],
    automatedAccess: false, modelProcessing: false, sessionLogging: false }) })).code, 'LICENSE_REVIEW_REQUIRED')
  assert.equal(assess(grant({ licenseAssessment: assessment({ assessmentStatus: 'RESTRICTED' }) })).code, 'LICENSE_USE_NOT_AUTHORIZED')
  assert.equal(assess(grant({ licenseAssessment: assessment({ expiresAt: '2026-11-10T23:59:59Z' }) })).code, 'LICENSE_ASSESSMENT_EXPIRED')
  assert.equal(assess(grant({ licenseAssessment: undefined })).code, 'INVALID_POLICY_INPUT')
})

test('license evidence must cover exact source, capability, purpose and all processing actions', () => {
  assert.equal(assess(grant({ licenseAssessment: assessment({ assessmentStatus: 'RESTRICTED', modelProcessing: false }) })).code, 'LICENSE_USE_NOT_AUTHORIZED')
  assert.equal(assess(grant({ licenseAssessment: assessment({ assessmentStatus: 'RESTRICTED', sessionLogging: false }) })).code, 'LICENSE_USE_NOT_AUTHORIZED')
  assert.equal(assess(grant({ licenseAssessment: assessment({ capabilityIds: ['financial.statements'] }) })).code,
    'LICENSE_USE_NOT_AUTHORIZED')
  assert.equal(assess(grant(), query({ purpose: 'valuation' })).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess(grant(), query(), { ...metadata, sourceId: 'other' }).code, 'SOURCE_BINDING_REQUIRED')
})

test('explicit research intent never permits current snapshots as historical replay', () => {
  assert.equal(schemas.Query.safeParse(query({ temporalMode: 'current_only', researchIntent: 'historicalReplay' })).success, false)
  assert.equal(schemas.Query.safeParse(query({ temporalMode: 'strict', researchIntent: 'currentResearch' })).success, false)
  assert.equal(schemas.Query.safeParse(query({ temporalMode: 'current_only', researchIntent: 'currentResearch' })).success, true)
  assert.deepEqual(schemas.TemporalQuality.options,
    ['STRICT_HISTORICAL', 'CURRENT_OBSERVED', 'RECONSTRUCTED', 'UNVERIFIED'])
})

test('verified assessments require evidence, positive processing grants and bounded disclosure terms', () => {
  assert.equal(schemas.LicenseAssessment.safeParse(assessment()).success, true)
  assert.equal(schemas.LicenseAssessment.safeParse(assessment({ evidenceRefs: [] })).success, false)
  assert.equal(schemas.LicenseAssessment.safeParse(assessment({ redistribution: 'UNKNOWN' })).success, false)
  assert.equal(schemas.Unit.safeParse({ dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' }).success, true)
})
