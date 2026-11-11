import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SourceBinding, SourceBindings, assessSource, compareCandidates,
  explicitPermissionsPermitted,
} from '../src/data/policy.js'

const baseQuery = (overrides = {}) => ({
  capability: 'financial.statements',
  entity: { scheme: 'ticker', id: '600519.SH' },
  market: 'CN',
  requiredFields: ['netProfit'],
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  asOf: '2025-04-05T00:00:00+08:00',
  purpose: 'research',
  temporalMode: 'strict',
  maxAgeSeconds: 31536000,
  ...overrides,
})

const metadata = (overrides = {}) => ({
  id: 'adapter-a',
  version: '1.0.0',
  sourceId: 'source-a',
  label: 'Test source adapter',
  testOnly: false,
  licenseClass: 'USER_PROVIDED',
  capabilities: [{
    id: 'financial.statements',
    markets: ['CN'],
    fields: ['netProfit', 'revenue'],
    temporalModes: ['strict', 'date_bounded'],
    priority: 50,
    quality: 80,
  }],
  ...overrides,
})

const role = (overrides = {}) => ({
  id: 'finance-market-researcher',
  writer: false,
  allowedMcpServers: ['eastmoney'],
  ...overrides,
})

const binding = (overrides = {}) => ({
  adapterId: 'adapter-a',
  sourceAllowlistKey: 'eastmoney',
  scopeIds: ['session-1'],
  roleIds: ['finance-market-researcher'],
  capabilities: ['financial.statements'],
  markets: ['CN'],
  purposes: ['research'],
  temporalModes: ['strict', 'date_bounded'],
  priority: 100,
  minQuality: 50,
  enabled: true,
  allowTestOnly: false,
  ...overrides,
})

const assess = (overrides = {}) => assessSource(
  overrides.metadata ?? metadata(),
  overrides.query ?? baseQuery(),
  overrides.role !== undefined ? overrides.role : role(),
  overrides.bindings ?? [binding()],
  overrides.scopeId ?? 'session-1',
)

const actionMetadata = (overrides = {}) => metadata({
  capabilities: [{
    id: 'corporate.actions',
    markets: ['CN'],
    fields: ['cash_dividend', 'split'],
    temporalModes: ['strict', 'date_bounded'],
    corporateActionDateBases: ['announcement_date', 'ex_date'],
    priority: 60,
    quality: 85,
  }],
  ...overrides,
})

const actionQuery = (overrides = {}) => baseQuery({
  capability: 'corporate.actions',
  requiredFields: ['cash_dividend'],
  period: { kind: 'range', start: '2025-01-01', end: '2025-12-31' },
  corporateActionDateBasis: 'ex_date',
  ...overrides,
})

const actionBinding = (overrides = {}) => binding({
  capabilities: ['corporate.actions'],
  corporateActionDateBases: ['announcement_date', 'ex_date'],
  ...overrides,
})

test('SourceBinding is strict, validates unique lists, and enforces corporate-action bases', () => {
  assert.equal(SourceBinding.safeParse(binding()).success, true)
  assert.equal(SourceBinding.safeParse({ ...binding(), unexpected: true }).success, false)
  assert.equal(SourceBinding.safeParse({ ...binding(), scopeIds: ['session-1', 'session-1'] }).success, false)
  assert.equal(SourceBinding.safeParse({ ...binding(), temporalModes: ['strict', 'strict'] }).success, false)
  assert.equal(SourceBinding.safeParse({ ...binding(), capabilities: ['corporate.actions'] }).success, false)
  assert.equal(SourceBinding.safeParse({
    ...binding(), capabilities: ['corporate.actions'], corporateActionDateBases: ['ex_date'],
  }).success, true)
  assert.equal(SourceBinding.safeParse({
    ...actionBinding(), corporateActionDateBases: undefined,
  }).success, false)
  assert.equal(SourceBinding.safeParse({
    ...binding(), corporateActionDateBases: ['ex_date'],
  }).success, false)
  assert.equal(SourceBinding.safeParse({
    ...binding(), markets: ['CN', 'CN'],
  }).success, false)
})

test('SourceBindings rejects duplicate full bindings independent of array order', () => {
  assert.equal(SourceBindings.safeParse([binding()]).success, true)
  assert.equal(SourceBindings.safeParse([binding(), binding()]).success, false)
  const first = binding({ scopeIds: ['session-1', 'session-2'], temporalModes: ['strict', 'date_bounded'] })
  const sameWithDifferentOrder = binding({ scopeIds: ['session-2', 'session-1'], temporalModes: ['date_bounded', 'strict'] })
  assert.equal(SourceBindings.safeParse([first, sameWithDifferentOrder]).success, false)
})

test('missing, writer, and source-less roles are denied before source selection', () => {
  assert.equal(assess({ role: null }).code, 'ROLE_QUERY_DENIED')
  assert.equal(assess({ role: role({ writer: true }) }).code, 'ROLE_QUERY_DENIED')
  assert.equal(assess({ role: role({ allowedMcpServers: [] }) }).code, 'ROLE_QUERY_DENIED')
  assert.equal(assess({ role: role({ allowedMcpServers: undefined }) }).code, 'ROLE_QUERY_DENIED')
})

test('bindings must match exact adapter, scope, role, original source key, capability, market, and purpose', () => {
  assert.equal(assess().accepted, true)
  assert.equal(assess({ scopeId: 'other-session' }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ role: role({ id: 'finance-model-builder' }) }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ role: role({ allowedMcpServers: ['other-source'] }) }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ bindings: [binding({ adapterId: 'other-adapter' })] }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ bindings: [binding({ capabilities: ['prices.history'] })] }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ bindings: [binding({ markets: ['US'] })] }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ bindings: [binding({ purposes: ['valuation'] })] }).code, 'SOURCE_BINDING_REQUIRED')
  assert.equal(assess({ bindings: [binding({ enabled: false })] }).code, 'SOURCE_BINDING_REQUIRED')
})

test('query.sourceIds only filters after binding authority and cannot grant access', () => {
  assert.equal(assess({ query: baseQuery({ sourceIds: ['source-a'] }) }).accepted, true)
  assert.equal(assess({ query: baseQuery({ sourceIds: ['other-source'] }) }).code, 'SOURCE_NOT_SELECTED')
  assert.equal(assess({
    query: baseQuery({ sourceIds: ['source-a'] }),
    bindings: [binding({ sourceAllowlistKey: 'unallowed-source' })],
  }).code, 'SOURCE_BINDING_REQUIRED')
})

test('capability and requested market/fields must be covered by adapter metadata', () => {
  assert.equal(assess({ metadata: metadata({ capabilities: [{
    id: 'prices.history', markets: ['CN'], fields: ['close'], temporalModes: ['strict'], priceAdjustments: ['none'], priority: 1, quality: 50,
  }] }) }).code, 'CAPABILITY_UNAVAILABLE')
  assert.equal(assess({
    query: baseQuery({ market: 'US' }), bindings: [binding({ markets: ['US'] })],
  }).code, 'COVERAGE_INCOMPLETE')
  assert.equal(assess({
    metadata: metadata({ capabilities: [{
      ...metadata().capabilities[0], markets: ['US'],
    }] }),
  }).code, 'COVERAGE_INCOMPLETE')
  assert.equal(assess({ query: baseQuery({ requiredFields: ['netProfit', 'missingField'] }) }).code, 'COVERAGE_INCOMPLETE')
})

test('temporal mode must be supported by both the selected binding and capability', () => {
  assert.equal(assess({
    query: baseQuery({ temporalMode: 'current_only' }),
    bindings: [binding({ temporalModes: ['strict'] })],
  }).code, 'TEMPORAL_MODE_UNSUPPORTED')
  assert.equal(assess({
    query: baseQuery({ temporalMode: 'date_bounded' }),
    metadata: metadata({ capabilities: [{ ...metadata().capabilities[0], temporalModes: ['strict'] }] }),
  }).code, 'TEMPORAL_MODE_UNSUPPORTED')
  assert.equal(assess({
    query: baseQuery({ temporalMode: 'date_bounded' }),
    bindings: [binding({ temporalModes: ['date_bounded'] })],
  }).accepted, true)
})

test('corporate.actions requires date-basis support from both binding and capability', () => {
  const query = actionQuery({ corporateActionDateBasis: 'ex_date' })
  assert.equal(assess({ metadata: actionMetadata(), query, bindings: [actionBinding()] }).accepted, true)
  assert.equal(assess({
    metadata: actionMetadata(), query,
    bindings: [actionBinding({ corporateActionDateBases: ['announcement_date'] })],
  }).code, 'CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED')
  assert.equal(assess({
    metadata: actionMetadata({ capabilities: [{ ...actionMetadata().capabilities[0], corporateActionDateBases: ['announcement_date'] }] }),
    query,
    bindings: [actionBinding()],
  }).code, 'CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED')
})

test('minimum quality is enforced and the highest-priority eligible binding is selected', () => {
  assert.equal(assess({ bindings: [binding({ minQuality: 90 })] }).code, 'QUALITY_INSUFFICIENT')
  const lowerPriority = binding({ sourceAllowlistKey: 'eastmoney', priority: 10, minQuality: 70 })
  const higherPriority = binding({ sourceAllowlistKey: 'eastmoney', priority: 20, minQuality: 50 })
  const result = assess({ bindings: [lowerPriority, higherPriority] })
  assert.equal(result.accepted, true)
  assert.equal(result.binding.priority, 20)
})

test('TEST_ONLY adapters require an explicitly test-enabled binding', () => {
  const testMetadata = metadata({ testOnly: true, licenseClass: 'TEST_ONLY' })
  assert.equal(assess({ metadata: testMetadata }).code, 'TEST_ONLY_NOT_ALLOWED')
  assert.equal(assess({ metadata: testMetadata, bindings: [binding({ allowTestOnly: true })] }).accepted, true)
})

test('permission helper fails closed unless compatibility and all three permissions are exactly true', () => {
  const permitted = {
    compatible: true, licensePermitted: true,
    modelProcessingPermitted: true, sessionLoggingPermitted: true,
  }
  assert.equal(explicitPermissionsPermitted(permitted), true)
  assert.equal(explicitPermissionsPermitted({ ...permitted, compatible: false }), false)
  for (const field of ['licensePermitted', 'modelProcessingPermitted', 'sessionLoggingPermitted']) {
    assert.equal(explicitPermissionsPermitted({ ...permitted, [field]: false }), false)
    assert.equal(explicitPermissionsPermitted({ ...permitted, [field]: undefined }), false)
  }
  assert.equal(explicitPermissionsPermitted(null), false)
  assert.equal(explicitPermissionsPermitted({ compatible: true }), false)
})

test('candidate comparator ranks binding, capability priority, quality, then adapter ID', () => {
  const candidate = (id, bindingPriority, capabilityPriority, quality) => ({
    record: { metadata: { id } },
    assessment: {
      binding: { priority: bindingPriority },
      capability: { priority: capabilityPriority, quality },
    },
  })
  const byBinding = [candidate('z-adapter', 10, 99, 99), candidate('a-adapter', 20, 1, 1)]
  byBinding.sort(compareCandidates)
  assert.deepEqual(byBinding.map(item => item.record.metadata.id), ['a-adapter', 'z-adapter'])
  const byCapability = [candidate('a-adapter', 10, 1, 99), candidate('z-adapter', 10, 2, 1)]
  byCapability.sort(compareCandidates)
  assert.deepEqual(byCapability.map(item => item.record.metadata.id), ['z-adapter', 'a-adapter'])
  const byQuality = [candidate('a-adapter', 10, 2, 50), candidate('z-adapter', 10, 2, 80)]
  byQuality.sort(compareCandidates)
  assert.deepEqual(byQuality.map(item => item.record.metadata.id), ['z-adapter', 'a-adapter'])
  const byAdapterId = [candidate('z-adapter', 10, 2, 80), candidate('a-adapter', 10, 2, 80)]
  byAdapterId.sort(compareCandidates)
  assert.deepEqual(byAdapterId.map(item => item.record.metadata.id), ['a-adapter', 'z-adapter'])
})

test('policy schema accepts corporate.actions and rejects unknown capabilities', () => {
  assert.equal(SourceBinding.safeParse(actionBinding()).success, true)
  assert.equal(SourceBinding.safeParse(binding({ capabilities: ['not-a-capability'] })).success, false)
})
