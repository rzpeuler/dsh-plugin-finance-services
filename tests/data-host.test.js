import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import FinanceData from '../src/data/host.js'

const { roles } = JSON.parse(await readFile(new URL('../assets/runtime-manifest.json', import.meta.url), 'utf8'))
const runtimeModeler = roles.find(role => role.id === 'finance-model-builder-data-puller')
const modeler = { ...runtimeModeler, id: 'finance-test-only-data-reader', allowedMcpServers: ['TEST_ONLY-source'] }
class TestFinanceData extends FinanceData {
  rolesFromManifest(manifest) { return [...manifest.roles, modeler] }
}
const fixedNow = '2025-03-02T00:00:00Z'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const binding = (scopeId, extra = {}) => ({
  adapterId: 'test-source', sourceAllowlistKey: 'TEST_ONLY-source', scopeIds: [scopeId],
  roleIds: [modeler.id], capabilities: ['financial.statements'], markets: ['CN'], purposes: ['research'],
  temporalModes: ['strict', 'date_bounded'], priority: 10, minQuality: 70, enabled: true,
  allowTestOnly: true, ...extra,
})
const request = (expectedRevision, bindings) => ({ expectedRevision, bindingsJson: JSON.stringify(bindings) })
const catalog = service => JSON.parse(service.catalog({}).catalogJson)
const makeQuery = (overrides = {}) => ({
  capability: 'financial.statements', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
  requiredFields: ['net_profit'],
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z', purpose: 'research', temporalMode: 'strict', maxAgeSeconds: 31536000,
  ...overrides,
})
const reference = { uri: 'urn:fixture:source-record', label: 'TEST_ONLY fixture' }
const makeResult = () => ({
  observations: [{
    field: 'net_profit', entity: { scheme: 'ticker', id: '600519.SH' }, value: 100,
    unit: { dimension: 'currency', currency: 'CNY', scale: 'ones' },
    period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
    measurementType: 'actual', accountingBasis: 'CAS', consolidation: 'consolidated',
    availabilityEvidence: { type: 'timestamp', sourcePublishedAt: '2025-02-01T10:00:00+08:00', availableAt: '2025-02-01T10:00:00+08:00' },
    retrievedAt: fixedNow, revision: 'revision-1',
    revisionEvidence: { chainId: 'chain-2024', chainStatus: 'complete', supersedes: [], changeType: 'original',
      sourceRecordId: 'record-2024-original', capturedAt: '2025-02-02T00:00:00Z', evidence: reference },
    reference, licenseClass: 'TEST_ONLY',
  }], corporateActions: [], warnings: [],
})

class AuthorityStub extends Service {
  constructor(ctx, rolesById, grants) { super(ctx, 'financeOperations'); this.rolesById = rolesById; this.grants = grants }
  async roleDefinition(id) { return this.rolesById.get(id) }
  isRoleRuntimeActive(agent, roleId, expected) {
    const grant = this.grants.get(agent)
    return grant?.roleId === roleId && grant.sourceSha256 === expected.sourceSha256 &&
      grant.adaptedPromptSha256 === expected.adaptedPromptSha256
  }
}
class PresetsStub extends Service {
  constructor(ctx, compositions) { super(ctx, 'agentPresets'); this.compositions = compositions }
  composedPreset(context) { return this.compositions.get(context) }
}
class TypertStub extends Service {
  constructor(ctx, state) { super(ctx, 'typert'); this.state = state }
  register(contribution) {
    this.state.contributions.push(contribution)
    this.state.live.add(contribution)
    return async () => { this.state.live.delete(contribution); this.state.disposals++ }
  }
}
class StorageStub extends Service {
  constructor(ctx, state) { super(ctx, 'storageDomain'); this.state = state }
  async open(spec) {
    assert.equal(spec.version, 1)
    assert.deepEqual(Object.keys(spec.tables), ['policy'])
    assert.equal(spec.name, 'financial_data_current', 'FinanceData has one isolated storage domain')
    this.state.specs.set(spec.name, spec)
    const state = this.state.domains.get(spec.name)
    state.opens++
    return {
      table(name) {
        assert.equal(name, 'policy')
        return {
          get(key) { assert.equal(key, 'root'); return state.saved === undefined ? undefined : structuredClone(state.saved) },
          async put(key, value) {
            assert.equal(key, 'root')
            const candidate = spec.tables.policy.valueSchema.parse(value)
            state.events.push('put:begin')
            state.puts.push(structuredClone(candidate))
            await state.beforePut?.(candidate)
            state.saved = structuredClone(candidate)
            state.events.push('put:durable')
          },
        }
      },
      async close() { state.closes++ },
    }
  }
}
class TestAgent {
  constructor(ctx, id) { this.id = id; this.session = { id }; this.ctx = createScope(ctx, this).ctx }
}

async function fixture(t, { initialPolicy, config } = {}) {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const storage = {
    specs: new Map(),
    domains: new Map([
      ['financial_data_current', { saved: initialPolicy, events: [], puts: [], opens: 0, closes: 0 }],
    ]),
  }
  const typert = { contributions: [], live: new Set(), disposals: 0 }
  const grants = new Map(), compositions = new Map(), rolesById = new Map(roles.map(role => [role.id, role]))
  rolesById.set(modeler.id, modeler)
  for (const install of [inner => { new AuthorityStub(inner, rolesById, grants) }, inner => { new PresetsStub(inner, compositions) },
    inner => { new StorageStub(inner, storage) }, inner => { new TypertStub(inner, typert) }]) await ctx.plugin(install)
  const fiber = ctx.plugin(TestFinanceData, config ?? {})
  await fiber
  const service = ctx.get('financeData')
  assert.equal('registry' in service, false, 'the Registry remains private behind the Host policy boundary')
  assert.equal('registry' in service, false, 'the Registry remains private behind the Host policy boundary')
  const agent = (id = 'TEST_ONLY-session', role = modeler, granted = true) => {
    const value = new TestAgent(ctx, id)
    compositions.set(value.ctx, role.id)
    if (granted) grants.set(value, { roleId: role.id, sourceSha256: role.source.sha256,
      adaptedPromptSha256: role.prompt.adaptedSha256 })
    return value
  }
  // The test injects the same trusted exact-Agent context resolver the Host expects from its authority seam.
  service.contextForAgent = async candidate => {
    const roleId = compositions.get(candidate?.ctx)
    const role = rolesById.get(roleId)
    if (!role) throw Object.assign(new Error('ROLE_QUERY_DENIED'), { code: 'ROLE_QUERY_DENIED' })
    const expectedRevision = { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 }
    // The authoritative active-grant check remains in the Registry authorize callback.
    return { agent: candidate, roleId, scopeId: candidate.id, expectedRevision }
  }
  return { ctx, service, fiber, storage, typert, grants, compositions, agent, dispose: () => fiber.dispose() }
}

function provider(service, options = {}) {
  let snapshot = { state: 'READY', verifiedAt: fixedNow }
  const listeners = new Set(), calls = { validate: [], query: [], contexts: [], signals: [] }
  const definition = {
    metadata: {
      id: 'test-source', version: '1.0.0', sourceId: 'test-source', label: 'TEST_ONLY source',
      testOnly: true, licenseClass: 'TEST_ONLY',
      capabilities: [{ id: 'financial.statements', markets: ['CN'], fields: ['net_profit'],
        temporalModes: ['strict', 'date_bounded'], priority: 10, quality: 80 }],
    },
    state: { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) } },
    async validate(query, execution) {
      calls.validate.push(query)
      calls.contexts.push(execution.context)
      return options.validate ? options.validate(query, execution) : { compatible: true }
    },
    async query(query, execution) {
      calls.query.push(query)
      calls.contexts.push(execution.context)
      calls.signals.push(execution.signal)
      return options.query ? options.query(query, execution) : makeResult()
    },
  }
  const dispose = service.registerAdapter(definition)
  return { calls, listeners, dispose, state(value) { snapshot = { ...snapshot, state: value }; for (const listener of listeners) listener() } }
}

async function allow(service, agent) {
  const revision = catalog(service).revision
  return service.setBindings(request(revision, [binding(agent.id)]))
}

test('Host mounts FinanceData and its isolated durable policy domain', async t => {
  const f = await fixture(t)
  const initial = catalog(f.service)
  assert.equal(initial.revision, 0)
  assert.deepEqual(initial.bindings, [])
  assert.deepEqual([...f.storage.specs.keys()], ['financial_data_current'])
  assert.equal(f.storage.specs.get('financial_data_current').version, 1)
  assert.equal(f.storage.domains.get('financial_data_current').puts.length, 0)

  const applied = await f.service.setBindings(request(0, [binding('new-session')]))
  assert.equal(applied.status, 'APPLIED')
  assert.equal(catalog(f.service).revision, 1)
  const persisted = f.storage.domains.get('financial_data_current').saved
  assert.deepEqual(Object.keys(persisted).sort(), ['bindings', 'revision'], 'only policy data is persisted')
  assert.deepEqual(persisted, { revision: 1, bindings: [binding('new-session')] })
  assert.throws(() => f.storage.specs.get('financial_data_current').tables.policy.valueSchema.parse({
    unexpected: true, ...persisted,
  }))
})

test('Host serializes CAS, persists before commit, and save failure preserves grants', async t => {
  const f = await fixture(t), agent = f.agent(), entered = deferred(), release = deferred()
  t.after(() => release.resolve())
  const adapter = provider(f.service)
  const events = f.storage.domains.get('financial_data_current').events
  f.storage.domains.get('financial_data_current').beforePut = async () => { entered.resolve(); await release.promise }

  const abort = new AbortController(), stream = f.service.follow({}, abort.signal)
  t.after(() => abort.abort())
  assert.equal(JSON.parse((await stream.next()).value.catalogJson).revision, 0)
  const changed = stream.next()
  let published = false
  changed.then(() => { published = true })
  const first = f.service.setBindings(request(0, [binding(agent.id)]))
  await entered.promise
  assert.deepEqual(events, ['put:begin'])
  assert.equal(catalog(f.service).revision, 0)
  assert.deepEqual(catalog(f.service).bindings, [])
  assert.equal(published, false)

  const stale = f.service.setBindings(request(0, []))
  release.resolve()
  assert.equal((await first).status, 'APPLIED')
  const conflict = await stale
  assert.equal(conflict.status, 'CONFLICT')
  assert.equal(conflict.error.code, 'POLICY_CONFLICT')
  assert.equal(conflict.revision, 1)
  assert.deepEqual(events, ['put:begin', 'put:durable'])
  assert.equal(f.storage.domains.get('financial_data_current').puts.length, 1)
  assert.equal(JSON.parse((await changed).value.catalogJson).revision, 1)
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'OK')
  assert.equal(adapter.calls.query.length, 1)

  const saved = structuredClone(f.storage.domains.get('financial_data_current').saved)
  f.storage.domains.get('financial_data_current').beforePut = async () => { throw new Error('TEST_ONLY simulated durable failure') }
  const failed = await f.service.setBindings(request(1, []))
  assert.equal(failed.status, 'REJECTED')
  assert.equal(failed.error.code, 'POLICY_SAVE_FAILED')
  assert.equal(failed.revision, 1)
  assert.deepEqual(catalog(f.service).bindings, [binding(agent.id)])
  assert.deepEqual(f.storage.domains.get('financial_data_current').saved, saved)
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'OK', 'failed save retains prior query grant')

  abort.abort()
  assert.equal((await stream.next()).done, true)
})

test('query and describe use only Host-created exact Agent context; shared tracking aborts on agent and Service disposal', async t => {
  const f = await fixture(t, { config: { requestTimeoutMs: 10000, maxConcurrentQueries: 2 } })
  const agent = f.agent()
  let entered = deferred(), providerSignal
  const adapter = provider(f.service, { query: async (_input, execution) => {
    providerSignal = execution.signal
    entered.resolve(execution)
    return new Promise(() => {})
  } })
  await allow(f.service, agent)
  const described = await f.service.describeForAgent(agent, 'financial.statements')
  assert.equal(described.status, 'EXPLICIT_SCOPE_GRANTS_FOUND')
  assert.equal(described.providers[0].adapterId, 'test-source')

  const pending = f.service.queryForAgent(agent, makeQuery())
  const execution = await entered.promise
  assert.deepEqual(execution.context, { scopeId: agent.id, roleId: modeler.id, agentId: agent.id })
  assert.equal(Object.hasOwn(execution.context, 'agent'), false)
  assert.equal(Object.hasOwn(execution.context, 'expectedRevision'), false)
  const ungranted = f.agent('TEST_ONLY-ungranted-agent', modeler, false)
  assert.equal((await f.service.queryForAgent(ungranted, makeQuery())).status, 'ROLE_QUERY_DENIED',
    'same role and payload do not bypass the Host-created exact Agent grant')
  assert.equal(adapter.calls.query.length, 1)
  f.ctx.emit('agent/disposed', { agent })
  assert.equal((await pending).status, 'CANCELLED')
  assert.equal(providerSignal.aborted, true)
  assert.equal(f.service.queries.size, 0)
  assert.equal(adapter.calls.contexts[0].scopeId, agent.id)

  const serviceAgent = f.agent('TEST_ONLY-service-disposal')
  assert.equal((await f.service.setBindings(request(1, [binding(serviceAgent.id)]))).status, 'APPLIED')
  entered = deferred()
  const pendingDisposal = f.service.queryForAgent(serviceAgent, makeQuery())
  await entered.promise
  const disposing = f.dispose()
  const disposedResult = await pendingDisposal
  assert.equal(disposedResult.status, 'REGISTRY_DISPOSED')
  await disposing
  assert.equal(f.service.queries.size, 0)
  assert.equal(adapter.listeners.size, 0)
  assert.equal(f.storage.domains.get('financial_data_current').closes, 1)
})

test('rejects invalid policy before durable put and follow cancellation detaches', async t => {
  const f = await fixture(t), agent = f.agent()
  const invalid = binding(agent.id, { sourceAllowlistKey: 'not-allowed' })
  const rejected = await f.service.setBindings(request(0, [invalid]))
  assert.equal(rejected.status, 'REJECTED')
  assert.equal(rejected.error.code, 'POLICY_INVALID')
  assert.equal(rejected.revision, 0)
  assert.equal(f.storage.domains.get('financial_data_current').puts.length, 0)

  const controller = new AbortController(), stream = f.service.follow({}, controller.signal)
  assert.deepEqual(JSON.parse((await stream.next()).value.catalogJson).bindings, [])
  const pending = stream.next()
  controller.abort()
  assert.equal((await pending).done, true)
  assert.equal((await stream.next()).done, true)
})
