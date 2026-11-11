import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { FinancialDataRegistry } from '../src/data/registry.js'

const fixedNow = '2025-03-02T00:00:00Z'
const role = { id: 'finance-reader', writer: false, allowedMcpServers: ['test-source'] }
const writer = { id: 'finance-writer', writer: true, allowedMcpServers: ['test-source'] }
const context = { roleId: role.id, scopeId: 'session-a', agentId: 'agent-a' }
const writerContext = { roleId: writer.id, scopeId: 'session-a', agentId: 'agent-a' }

const makeQuery = (overrides = {}) => ({
  capability: 'financial.statements',
  entity: { scheme: 'ticker', id: '600519.SH' },
  market: 'CN',
  requiredFields: ['net_profit'],
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z',
  purpose: 'research',
  temporalMode: 'strict',
  maxAgeSeconds: 31536000,
  ...overrides,
})

const reference = (label = 'TEST_ONLY fixture') => ({ uri: 'urn:fixture:source-record', label })
const makeObservation = (field = 'net_profit', overrides = {}) => ({
  field,
  entity: { scheme: 'ticker', id: '600519.SH' },
  value: 100,
  unit: { dimension: 'currency', currency: 'CNY', scale: 'ones' },
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  measurementType: 'actual',
  accountingBasis: 'CAS',
  consolidation: 'consolidated',
  availabilityEvidence: {
    type: 'timestamp',
    sourcePublishedAt: '2025-02-01T10:00:00+08:00',
    availableAt: '2025-02-01T10:00:00+08:00',
  },
  retrievedAt: fixedNow,
  revision: 'revision-1',
  revisionEvidence: {
    chainId: 'chain-2024',
    chainStatus: 'complete',
    supersedes: [],
    changeType: 'original',
    sourceRecordId: 'record-2024-original',
    capturedAt: '2025-02-02T00:00:00Z',
    evidence: reference(),
  },
  reference: reference(),
  licenseClass: 'TEST_ONLY',
  ...overrides,
})
const makeResult = (observations = [makeObservation()], warnings = []) => ({
  observations, corporateActions: [], warnings,
})

function makeMetadata(id, overrides = {}) {
  const metadata = {
    id,
    version: '1.0.0',
    sourceId: 'test-source',
    label: `TEST_ONLY ${id}`,
    testOnly: true,
    licenseClass: 'TEST_ONLY',
    capabilities: [{
      id: 'financial.statements', markets: ['CN'], fields: ['net_profit'],
      temporalModes: ['strict', 'date_bounded', 'current_only'],
      priority: 10, quality: 80,
    }],
    ...overrides,
  }
  return metadata
}

function makeAdapter(id, options = {}) {
  let snapshot = { state: 'READY', verifiedAt: fixedNow }
  const listeners = new Set()
  const calls = { query: 0, validate: 0, signals: [], executions: [] }
  const metadata = options.metadata ?? makeMetadata(id)
  const definition = {
    metadata,
    state: {
      getSnapshot: () => snapshot,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    },
    async validate(query, execution) {
      calls.validate++
      calls.executions.push(execution)
      return options.validate ? options.validate(query, execution) : { compatible: true }
    },
    async query(query, execution) {
      calls.query++
      calls.signals.push(execution.signal)
      calls.executions.push(execution)
      return options.query ? options.query(query, execution) : makeResult()
    },
  }
  return {
    definition, calls, listeners,
    setState(value) {
      snapshot = { ...snapshot, ...value }
      for (const listener of [...listeners]) listener()
    },
  }
}

const binding = (adapterId, overrides = {}) => ({
  adapterId,
  sourceAllowlistKey: 'test-source',
  scopeIds: [context.scopeId],
  roleIds: [role.id],
  capabilities: ['financial.statements'],
  markets: ['CN'],
  purposes: ['research'],
  temporalModes: ['strict', 'date_bounded', 'current_only'],
  priority: 10,
  minQuality: 50,
  enabled: true,
  allowTestOnly: true,
  ...overrides,
})

function makeRegistry(t, options = {}) {
  const value = new FinancialDataRegistry({
    roles: [role, writer],
    authorize: candidate => candidate === context || candidate === writerContext,
    now: () => fixedNow,
    ...options,
  })
  t.after(() => value.dispose())
  return value
}
const grant = (registry, ids, map = binding) => registry.setBindings({
  expectedRevision: registry.policyRevision,
  bindings: ids.map(id => map(id)),
})

function priceAdapter(id, options = {}) {
  const metadata = makeMetadata(id, {
    capabilities: [{ id: 'prices.history', markets: ['CN'], fields: ['close'],
      temporalModes: ['strict', 'date_bounded'], priceAdjustments: ['none'], priority: 10, quality: 80 }],
    ...options.metadata,
  })
  return makeAdapter(id, { ...options, metadata })
}
function priceBinding(id, overrides = {}) {
  return binding(id, { capabilities: ['prices.history'], ...overrides })
}
function actionAdapter(id, options = {}) {
  const metadata = makeMetadata(id, {
    capabilities: [{ id: 'corporate.actions', markets: ['CN'], fields: ['cash_dividend'],
      temporalModes: ['strict', 'date_bounded'], corporateActionDateBases: ['announcement_date'],
      priority: 10, quality: 80 }],
    ...options.metadata,
  })
  return makeAdapter(id, { ...options, metadata })
}
function actionBinding(id, overrides = {}) {
  return binding(id, {
    capabilities: ['corporate.actions'],
    corporateActionDateBases: ['announcement_date'],
    temporalModes: ['strict', 'date_bounded'],
    ...overrides,
  })
}

const nextRequest = overrides => makeQuery({ asOf: fixedNow, temporalMode: 'strict', ...overrides })

test('registration is not entitlement; exact Host scope and original source allowlist are required', async t => {
  const registry = makeRegistry(t)
  const source = makeAdapter('adapter-a')
  registry.registerAdapter(source.definition)
  assert.equal((await registry.query(makeQuery(), context)).status, 'NOT_AUTHORIZED')
  assert.equal(source.calls.query, 0)
  grant(registry, ['adapter-a'])
  assert.equal((await registry.query(makeQuery(), { ...context })).status, 'ROLE_QUERY_DENIED')
  assert.equal((await registry.query(makeQuery(), { ...context, scopeId: 'session-b' })).status, 'ROLE_QUERY_DENIED')
  assert.equal((await registry.query(makeQuery(), writerContext)).status, 'ROLE_QUERY_DENIED')
  assert.equal(source.calls.query, 0)
  assert.throws(() => registry.setBindings({ expectedRevision: 1,
    bindings: [binding('adapter-a', { sourceAllowlistKey: 'not-allowed' })] }), error => error.code === 'POLICY_ROLE_DENIED')
  assert.throws(() => registry.setBindings({ expectedRevision: 1,
    bindings: [binding('adapter-a', { roleIds: [writer.id] })] }), error => error.code === 'POLICY_ROLE_DENIED')
})

test('sourceIds filters candidates but cannot create an authorization grant', async t => {
  const registry = makeRegistry(t)
  const source = makeAdapter('adapter-a')
  registry.registerAdapter(source.definition)
  const result = await registry.query(makeQuery({ sourceIds: ['test-source'] }), context)
  assert.equal(result.status, 'NOT_AUTHORIZED')
  assert.ok(result.trace.some(item => item.code === 'SOURCE_BINDING_REQUIRED'))
  assert.equal(source.calls.query, 0)
})

test('source preference, period, fields, market, purpose and temporal mode prefilter without provider calls', async t => {
  const registry = makeRegistry(t)
  const source = makeAdapter('adapter-a')
  registry.registerAdapter(source.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [binding('adapter-a', { markets: ['CN', 'US'], temporalModes: ['strict'] })] })
  const wrongSource = await registry.query(makeQuery({ sourceIds: ['another-source'] }), context)
  assert.ok(wrongSource.trace.some(item => item.code === 'SOURCE_NOT_SELECTED'))
  const wrongField = await registry.query(makeQuery({ requiredFields: ['assets'] }), context)
  assert.ok(wrongField.trace.some(item => item.code === 'COVERAGE_INCOMPLETE'))
  const wrongMarket = await registry.query(makeQuery({ market: 'US' }), context)
  assert.ok(wrongMarket.trace.some(item => item.code === 'COVERAGE_INCOMPLETE'))
  const wrongPurpose = await registry.query(makeQuery({ purpose: 'valuation' }), context)
  assert.ok(wrongPurpose.trace.some(item => item.code === 'SOURCE_BINDING_REQUIRED'))
  const wrongTemporal = await registry.query(makeQuery({ temporalMode: 'date_bounded' }), context)
  assert.ok(wrongTemporal.trace.some(item => item.code === 'TEMPORAL_MODE_UNSUPPORTED'))
  assert.equal(source.calls.validate, 0)
  assert.equal(source.calls.query, 0)
})

test('normalizer rejects rows for a different financial period', async t => {
  const registry = makeRegistry(t)
  const wrongPeriod = makeObservation('net_profit', {
    period: { kind: 'fiscal_year', start: '2023-01-01', end: '2023-12-31', label: 'FY2023' },
  })
  const source = makeAdapter('adapter-a', { query: () => makeResult([wrongPeriod]) })
  registry.registerAdapter(source.definition)
  grant(registry, ['adapter-a'])
  const result = await registry.query(makeQuery(), context)
  assert.equal(result.status, 'UNAVAILABLE')
  assert.equal(result.trace[0].code, 'PERIOD_MISMATCH')
  assert.equal(source.calls.query, 1)
})

test('price-adjustment policy is checked before validate/query', async t => {
  const registry = makeRegistry(t)
  const source = priceAdapter('price-source')
  registry.registerAdapter(source.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [priceBinding('price-source')] })
  const result = await registry.query(makeQuery({
    capability: 'prices.history', requiredFields: ['close'], priceAdjustment: 'qfq',
    period: { kind: 'range', start: '2025-02-01', end: '2025-02-28' },
  }), context)
  assert.ok(result.trace.some(item => item.code === 'PRICE_ADJUSTMENT_UNSUPPORTED'))
  assert.equal(source.calls.validate, 0)
  assert.equal(source.calls.query, 0)
})

test('corporate-action date basis is checked against metadata and binding before provider calls', async t => {
  const registry = makeRegistry(t)
  const source = actionAdapter('adapter-actions')
  registry.registerAdapter(source.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [actionBinding('adapter-actions')] })
  const result = await registry.query(makeQuery({
    capability: 'corporate.actions', requiredFields: ['cash_dividend'],
    period: { kind: 'range', start: '2025-01-01', end: '2025-02-28' },
    corporateActionDateBasis: 'ex_date',
  }), context)
  assert.ok(result.trace.some(item => item.code === 'CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED'))
  assert.equal(source.calls.validate, 0)
  assert.equal(source.calls.query, 0)
})

test('priority order is deterministic and uses the requested capability and binding', async t => {
  const registry = makeRegistry(t)
  const first = makeAdapter('adapter-a')
  first.definition.metadata.capabilities[0].priority = 100
  const second = makeAdapter('adapter-b')
  second.definition.metadata.capabilities[0].priority = 1
  registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [
    binding('adapter-a', { priority: 1 }), binding('adapter-b', { priority: 20 }),
  ] })
  const result = await registry.query(makeQuery(), context)
  assert.equal(result.status, 'OK')
  assert.equal(result.trace.at(-1).adapterId, 'adapter-b')
  assert.equal(first.calls.query, 0)
  assert.equal(second.calls.query, 1)
})

test('catalog and describe outputs are safe and expose temporal/adjustment/date-basis coverage', t => {
  const registry = new FinancialDataRegistry({
    roles: [role, writer], authorize: candidate => candidate === context, now: () => fixedNow,
  })
  t.after(() => registry.dispose())
  const source = makeAdapter('adapter-a')
  source.definition.metadata.credentialRef = 'TEST_ONLY-secret-reference'
  registry.registerAdapter(source.definition)
  grant(registry, ['adapter-a'])
  const catalog = registry.catalog()
  assert.ok(catalog.capabilities.includes('corporate.actions'))
  assert.equal(catalog.adapters[0].credentialConfigured, true)
  assert.ok(!JSON.stringify(catalog).includes('TEST_ONLY-secret-reference'))
  const described = registry.describeCapability('financial.statements', context)
  assert.deepEqual(described.providers[0].temporalModes, ['strict', 'date_bounded', 'current_only'])
  assert.ok(!Object.hasOwn(described.providers[0], 'priceAdjustments'))

  const prices = priceAdapter('price-source')
  registry.registerAdapter(prices.definition)
  registry.setBindings({ expectedRevision: 1, bindings: [binding('adapter-a'), priceBinding('price-source')] })
  const priceDescription = registry.describeCapability('prices.history', context)
  assert.deepEqual(priceDescription.providers[0].priceAdjustments, ['none'])

  const actions = actionAdapter('adapter-action')
  registry.registerAdapter(actions.definition)
  registry.setBindings({ expectedRevision: 2, bindings: [binding('adapter-a'), priceBinding('price-source'), actionBinding('adapter-action')] })
  const actionDescription = registry.describeCapability('corporate.actions', context)
  assert.deepEqual(actionDescription.providers[0].corporateActionDateBases, ['announcement_date'])
})

test('observable adapter state invalidates catalog and prevents query; state change falls back', async t => {
  const registry = makeRegistry(t)
  let entered
  let finishValidation
  const validationStarted = new Promise(resolve => { entered = resolve })
  const first = makeAdapter('adapter-a', { validate(_query, execution) {
    entered(execution)
    return new Promise(resolve => { finishValidation = resolve })
  } })
  const second = makeAdapter('adapter-b')
  registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  grant(registry, ['adapter-a', 'adapter-b'])
  const before = registry.catalog()
  let notifications = 0
  const unsubscribe = registry.subscribe(() => { notifications++ })
  const pending = registry.query(makeQuery(), context)
  const execution = await validationStarted
  first.setState({ state: 'NOT_AUTHORIZED' })
  finishValidation({ compatible: true })
  const result = await pending
  assert.equal(result.status, 'OK')
  assert.equal(result.trace.at(-1).adapterId, 'adapter-b')
  assert.notEqual(registry.catalog(), before)
  assert.ok(notifications > 0)
  assert.equal(execution.signal.aborted, false)
  unsubscribe()
  assert.equal(first.listeners.size, 1, 'only the registry subscription was retained')
})

test('durable prepare/commit CAS publishes only a validated successor and cancels old-policy work', async t => {
  const registry = makeRegistry(t)
  let entered
  const started = new Promise(resolve => { entered = resolve })
  const source = makeAdapter('adapter-a', { query(_query, execution) {
    entered(execution)
    return new Promise(() => {})
  } })
  registry.registerAdapter(source.definition)
  const candidate = registry.prepareBindings({ expectedRevision: 0, bindings: [binding('adapter-a')] })
  assert.equal(registry.policyRevision, 0)
  const committed = registry.commitBindings(candidate)
  assert.equal(registry.policyRevision, 1)
  assert.throws(() => registry.commitBindings(candidate), error => error.code === 'POLICY_CONFLICT')
  const pending = registry.query(makeQuery(), context)
  const execution = await started
  const successor = registry.prepareBindings({ expectedRevision: 1, bindings: [] })
  registry.commitBindings(successor)
  const result = await pending
  assert.equal(result.status, 'POLICY_CHANGED')
  assert.equal(result.policyRevision, 1, 'result identifies the policy used when the request began')
  assert.equal(execution.signal.aborted, true)
  assert.throws(() => registry.prepareBindings({ expectedRevision: 0, bindings: [] }), error => error.code === 'POLICY_CONFLICT')
})

test('each non-TEST_ONLY license/model/logging permission is independently fail-closed', async t => {
  for (const missing of ['licensePermitted', 'modelProcessingPermitted', 'sessionLoggingPermitted']) {
    await t.test(missing, async subtest => {
      const registry = makeRegistry(subtest)
      const metadata = makeMetadata(`commercial-${missing}`, { testOnly: false, licenseClass: 'COMMERCIAL' })
      const source = makeAdapter(metadata.id, {
        metadata,
        validate() {
          return {
            compatible: true,
            licensePermitted: true,
            modelProcessingPermitted: true,
            sessionLoggingPermitted: true,
            [missing]: false,
          }
        },
      })
      registry.registerAdapter(source.definition)
      registry.setBindings({ expectedRevision: 0,
        bindings: [binding(metadata.id, { allowTestOnly: false })] })
      const result = await registry.query(makeQuery(), context)
      assert.equal(result.status, 'NOT_AUTHORIZED')
      assert.ok(result.trace.some(item => item.code === 'LICENSE_USE_NOT_AUTHORIZED'))
      assert.equal(source.calls.query, 0)
    })
  }
})

test('timeout and concurrency bounds return no synthetic observations', async t => {
  const registry = makeRegistry(t, { requestTimeoutMs: 30, maxConcurrentQueries: 1 })
  let entered
  const started = new Promise(resolve => { entered = resolve })
  const source = makeAdapter('adapter-a', { query(_query, execution) {
    entered(execution)
    return new Promise(() => {})
  } })
  registry.registerAdapter(source.definition)
  grant(registry, ['adapter-a'])
  const pending = registry.query(makeQuery(), context)
  const execution = await started
  assert.equal((await registry.query(makeQuery(), context)).status, 'BUSY')
  const result = await pending
  assert.equal(result.status, 'TIMEOUT')
  assert.equal(result.data, null)
  assert.equal(execution.signal.aborted, true)
})

test('unload aborts only the removed adapter and deterministic fallback may proceed', async t => {
  const registry = makeRegistry(t)
  let entered
  const started = new Promise(resolve => { entered = resolve })
  const first = makeAdapter('adapter-a', { query(_query, execution) {
    entered(execution)
    return new Promise(() => {})
  } })
  const second = makeAdapter('adapter-b')
  const remove = registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [binding('adapter-a', { priority: 20 }), binding('adapter-b', { priority: 10 })] })
  const pending = registry.query(makeQuery(), context)
  const execution = await started
  remove()
  const result = await pending
  assert.equal(result.status, 'OK')
  assert.equal(result.trace.at(-1).adapterId, 'adapter-b')
  assert.equal(execution.signal.aborted, true)
  assert.equal(first.listeners.size, 0)
  assert.equal(registry.catalog().adapters.length, 1)
})

test('providers are never merged to satisfy required fields', async t => {
  const registry = makeRegistry(t)
  const first = makeAdapter('adapter-a', { query: () => makeResult([makeObservation('net_profit')]) })
  const second = makeAdapter('adapter-b', { query: () => makeResult([makeObservation('revenue')]) })
  for (const source of [first, second]) source.definition.metadata.capabilities[0].fields = ['net_profit', 'revenue']
  registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [binding('adapter-a', { priority: 20 }), binding('adapter-b', { priority: 10 })] })
  const query = makeQuery({ requiredFields: ['net_profit', 'revenue'] })
  const result = await registry.query(query, context)
  assert.equal(result.status, 'UNAVAILABLE')
  assert.equal(result.data, null)
  assert.deepEqual(result.trace.map(item => item.code), ['MISSING_FIELDS', 'MISSING_FIELDS'])
  assert.equal(first.calls.query, 1)
  assert.equal(second.calls.query, 1)
})

test('provider errors and error codes are sanitized in traces and catalog', async t => {
  const registry = makeRegistry(t)
  const first = makeAdapter('adapter-a', { query() {
    throw Object.assign(new Error('api_key=DO_NOT_EXPORT'), { code: 'SECRET_PROVIDER_CODE' })
  } })
  first.setState({ code: 'SECRET_PROVIDER_CODE' })
  const second = makeAdapter('adapter-b')
  registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  grant(registry, ['adapter-a', 'adapter-b'])
  const catalog = registry.catalog()
  const result = await registry.query(makeQuery(), context)
  assert.equal(result.status, 'OK')
  assert.equal(result.trace[0].code, 'ADAPTER_ERROR')
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPORT'))
  assert.ok(!JSON.stringify(result).includes('SECRET_PROVIDER_CODE'))
  assert.ok(!JSON.stringify(catalog).includes('SECRET_PROVIDER_CODE'))
})

test('scope revocation after an await stops fallback and discards provider data', async t => {
  let authorized = true
  let entered
  let finish
  const started = new Promise(resolve => { entered = resolve })
  const second = makeAdapter('adapter-b')
  const registry = makeRegistry(t, { authorize: candidate => candidate === context && authorized })
  const first = makeAdapter('adapter-a', { query() {
    entered()
    return new Promise(resolve => { finish = resolve })
  } })
  registry.registerAdapter(first.definition)
  registry.registerAdapter(second.definition)
  grant(registry, ['adapter-a', 'adapter-b'])
  const pending = registry.query(makeQuery(), context)
  await started
  authorized = false
  finish(makeResult())
  const result = await pending
  assert.equal(result.status, 'SCOPE_REVOKED')
  assert.equal(result.data, null)
  assert.equal(second.calls.query, 0)
})

test('dispose cancels pending work, unloads adapters and keeps stable catalog/result boundaries', async t => {
  const registry = makeRegistry(t)
  let entered
  const started = new Promise(resolve => { entered = resolve })
  const source = makeAdapter('adapter-a', { query(_query, execution) {
    entered(execution)
    return new Promise(() => {})
  } })
  registry.registerAdapter(source.definition)
  grant(registry, ['adapter-a'])
  const pending = registry.query(makeQuery(), context)
  const execution = await started
  registry.dispose()
  const result = await pending
  assert.equal(result.status, 'REGISTRY_DISPOSED')
  assert.equal(execution.signal.aborted, true)
  assert.equal(registry.catalog().adapters.length, 0)
  assert.equal(source.listeners.size, 0)
  assert.throws(() => registry.subscribe(() => {}), error => error.code === 'REGISTRY_DISPOSED')
})

test('constructor validates exact authorizer, role catalog, policy, clock and bounds', () => {
  const base = { roles: [role], authorize: () => true, now: () => fixedNow }
  assert.throws(() => new FinancialDataRegistry({ ...base, authorize: null }))
  assert.throws(() => new FinancialDataRegistry({ ...base, roles: [role, role] }))
  assert.throws(() => new FinancialDataRegistry({ ...base, roles: [{ ...role, writer: 'false' }] }))
  assert.throws(() => new FinancialDataRegistry({ ...base, initialPolicy: { revision: -1, bindings: [] } }))
  assert.throws(() => new FinancialDataRegistry({ ...base, requestTimeoutMs: 0 }))
  assert.throws(() => new FinancialDataRegistry({ ...base, maxConcurrentQueries: 129 }))
  assert.throws(() => new FinancialDataRegistry({ ...base, now: () => 'not-a-timestamp' }))
})

test('query outputs carry bounded result fields', async t => {
  const registry = makeRegistry(t)
  const invalid = await registry.query({ nonsense: 'ignored' }, context)
  assert.equal(invalid.status, 'INVALID_QUERY')
  assert.equal(typeof invalid.requestId, 'string')
  assert.equal(invalid.policyRevision, 0)
  assert.equal(invalid.data, null)
  assert.ok(Array.isArray(invalid.trace))
})
