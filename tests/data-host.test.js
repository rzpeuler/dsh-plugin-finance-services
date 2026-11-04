import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import FinanceData from '../src/data/host.js'
import { FinancialDataRegistry } from '../src/data/registry.js'
import { fixedNow, makeQuery, makeMetadata, makeResult } from './data-fixtures.js'

const { roles } = JSON.parse(await readFile(new URL('../assets/agent-manifest.json', import.meta.url), 'utf8'))
const modeler = roles.find(role => role.id === 'finance-pitch-agent-modeler')
const writer = roles.find(role => role.writer)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const binding = (agent, extra = {}) => ({ adapterId: 'test-rest', sourceAllowlistKey: 'capiq', scopeIds: [agent.id],
  roleIds: [modeler.id], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'],
  priority: 10, minQuality: 70, enabled: true, allowTestOnly: true, ...extra })
const policyRequest = (expectedRevision, bindings) => ({ expectedRevision, bindingsJson: JSON.stringify(bindings) })
const catalog = service => JSON.parse(service.catalog({}).catalogJson)

// TEST_ONLY Service doubles around real Cordis lifecycle and the actual registry/normalizer.
// No NativeHost, Gateway, real storage backend, entitlement or commercial provider is simulated as verified.
class AuthorityStub extends Service {
  constructor(ctx, rolesById, grants) { super(ctx, 'financeOperations'); this.rolesById = rolesById; this.grants = grants }
  async roleDefinition(id) { return this.rolesById.get(id) }
  isRoleRuntimeActive(agent, roleId, expected) {
    const grant = this.grants.get(agent)
    return grant?.roleId === roleId && grant.sourceSha256 === expected.sourceSha256 && grant.adaptedPromptSha256 === expected.adaptedPromptSha256
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
    assert.equal(spec.name, 'financial_data')
    assert.equal(spec.version, 1)
    assert.deepEqual(Object.keys(spec.tables), ['policy'])
    this.state.spec = spec
    this.state.opens++
    const state = this.state
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
  const storage = { saved: initialPolicy, events: [], puts: [], opens: 0, closes: 0 }
  const typert = { contributions: [], live: new Set(), disposals: 0 }
  const grants = new Map(), compositions = new Map(), rolesById = new Map(roles.map(role => [role.id, role]))
  for (const install of [inner => { new AuthorityStub(inner, rolesById, grants) }, inner => { new PresetsStub(inner, compositions) },
    inner => { new StorageStub(inner, storage) }, inner => { new TypertStub(inner, typert) }]) await ctx.plugin(install)
  let fiber = ctx.plugin(FinanceData, config ?? {})
  await fiber
  const service = () => ctx.get('financeData')
  assert.ok(service().registry instanceof FinancialDataRegistry)
  const agent = (id = 'TEST_ONLY-session-modeler', role = modeler, grant = true) => {
    const value = new TestAgent(ctx, id)
    compositions.set(value.ctx, role.id)
    if (grant) grants.set(value, { roleId: role.id, sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 })
    return value
  }
  const reload = async () => { await fiber.dispose(); fiber = ctx.plugin(FinanceData, config ?? {}); await fiber; return service() }
  return { ctx, service: service(), storage, typert, grants, compositions, rolesById, agent, reload, dispose: () => fiber.dispose() }
}

function provider(service, query = async () => makeResult()) {
  let snapshot = { state: 'READY', verifiedAt: fixedNow }
  const listeners = new Set(), calls = []
  const dispose = service.registerAdapter({ metadata: { ...makeMetadata(), credentialRef: 'TEST_ONLY:credential-reference' },
    state: { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) } },
    validate: async input => { assert.deepEqual(input, makeQuery()); return { compatible: true } },
    query: async (input, options) => { calls.push({ input, options }); return query(input, options) },
  })
  return { calls, listeners, dispose, state(value) { snapshot = { ...snapshot, state: value }; for (const listener of listeners) listener() } }
}

async function allow(f, agent) {
  const revision = catalog(f.service).revision
  assert.deepEqual(await f.service.setBindings(policyRequest(revision, [binding(agent)])), { status: 'APPLIED', revision: revision + 1, error: null })
}

test('real Cordis mounts FinanceData, registers only four control-plane schemas, and owns disposers', async t => {
  const f = await fixture(t, { config: { requestTimeoutMs: 1234, maxConcurrentQueries: 2 } })
  assert.equal(f.service.registry.requestTimeoutMs, 1234)
  assert.equal(f.service.registry.maxConcurrentQueries, 2)
  const contribution = f.typert.contributions[0]
  assert.deepEqual(contribution.schemas.map(item => item.name).sort(), ['Catalog', 'Empty', 'PolicyRequest', 'PolicyResult'])
  assert.deepEqual(contribution.invocations.map(item => item.method), ['catalog', 'setBindings', 'follow'])
  assert.equal(contribution.invocations.some(item => /query|agent/i.test(item.method)), false)
  assert.deepEqual(catalog(f.service).bindings, [])
  assert.equal(catalog(f.service).commercialExecutionVerified, false)
  assert.throws(() => f.service.catalog({ agent: 'TEST_ONLY' }))
  assert.throws(() => f.service.setBindings({ expectedRevision: 0, bindingsJson: 'not-json' }))
  assert.throws(() => f.service.setBindings({ ...policyRequest(0, []), agent: 'TEST_ONLY' }))
  await f.dispose()
  assert.equal(f.typert.live.size, 0)
  assert.equal(f.typert.disposals, 1)
  assert.equal(f.storage.closes, 1)
  assert.throws(() => f.service.catalog({}), error => error.code === 'DATA_SERVICE_UNAVAILABLE')
})

test('Config rejects out-of-range, fractional and undeclared tunables before service initialization', async t => {
  for (const config of [{ requestTimeoutMs: 0 }, { requestTimeoutMs: 300001 }, { requestTimeoutMs: 1.5 },
    { maxConcurrentQueries: 0 }, { maxConcurrentQueries: 129 }, { maxConcurrentQueries: 1.5 }, { apiKey: 'TEST_ONLY' }]) {
    await assert.rejects(fixture(t, { config }))
  }
})

test('durable policy ordering is prepare -> table.put -> commit; no catalogue publication before save', async t => {
  const f = await fixture(t), agent = f.agent()
  const entered = deferred(), release = deferred()
  t.after(() => release.resolve())
  const originalPrepare = f.service.registry.prepareBindings.bind(f.service.registry)
  const originalCommit = f.service.registry.commitBindings.bind(f.service.registry)
  f.service.registry.prepareBindings = input => { f.storage.events.push('prepare'); return originalPrepare(input) }
  f.service.registry.commitBindings = input => { f.storage.events.push('commit'); return originalCommit(input) }
  f.storage.beforePut = async () => { entered.resolve(); await release.promise }
  const streamAbort = new AbortController(), stream = f.service.follow({}, streamAbort.signal)
  t.after(() => streamAbort.abort())
  assert.equal(JSON.parse((await stream.next()).value.catalogJson).revision, 0)
  const changed = stream.next()
  let published = false
  changed.then(() => { published = true })
  const pending = f.service.setBindings(policyRequest(0, [binding(agent)]))
  await entered.promise
  assert.deepEqual(f.storage.events, ['prepare', 'put:begin'])
  assert.deepEqual(catalog(f.service).bindings, [])
  assert.equal(catalog(f.service).revision, 0)
  assert.equal(published, false)
  release.resolve()
  assert.deepEqual(await pending, { status: 'APPLIED', revision: 1, error: null })
  assert.deepEqual(f.storage.events, ['prepare', 'put:begin', 'put:durable', 'commit'])
  assert.equal(JSON.parse((await changed).value.catalogJson).revision, 1)
  assert.deepEqual(f.storage.saved, { revision: 1, bindings: [binding(agent)] })
  streamAbort.abort()
  assert.equal((await stream.next()).done, true)
})

test('concurrent revision-CAS requests serialize and stale request never reaches durable put', async t => {
  const f = await fixture(t), agent = f.agent(), entered = deferred(), release = deferred()
  t.after(() => release.resolve())
  f.storage.beforePut = async () => { entered.resolve(); await release.promise }
  const first = f.service.setBindings(policyRequest(0, [binding(agent)]))
  await entered.promise
  const second = f.service.setBindings(policyRequest(0, []))
  release.resolve()
  assert.equal((await first).status, 'APPLIED')
  const conflict = await second
  assert.equal(conflict.status, 'CONFLICT')
  assert.equal(conflict.error.code, 'POLICY_CONFLICT')
  assert.equal(conflict.revision, 1)
  assert.equal(f.storage.puts.length, 1)
  assert.deepEqual(catalog(f.service).bindings, [binding(agent)])
})

test('failed durable save preserves prior revision and query grants; write queue recovers', async t => {
  const f = await fixture(t), agent = f.agent()
  provider(f.service)
  await allow(f, agent)
  const before = catalog(f.service)
  f.storage.beforePut = async () => { throw new Error('TEST_ONLY simulated storage I/O failure') }
  const rejected = await f.service.setBindings(policyRequest(1, []))
  assert.equal(rejected.status, 'REJECTED')
  assert.equal(rejected.error.code, 'POLICY_SAVE_FAILED')
  assert.equal(rejected.revision, 1)
  assert.deepEqual(catalog(f.service), before)
  assert.deepEqual(f.storage.saved.bindings, [binding(agent)])
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'OK')
  f.storage.beforePut = undefined
  assert.equal((await f.service.setBindings(policyRequest(1, []))).status, 'APPLIED')
  assert.equal(catalog(f.service).revision, 2)
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'NOT_AUTHORIZED')
})

test('initial durable policy and nonzero revision survive service unmount and reload', async t => {
  const id = 'TEST_ONLY-reloaded-session'
  const f = await fixture(t, { initialPolicy: { revision: 7, bindings: [binding({ id })] } })
  const agent = f.agent(id)
  assert.equal(catalog(f.service).revision, 7)
  assert.deepEqual(catalog(f.service).bindings, [binding(agent)])
  provider(f.service)
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'OK')
  assert.equal((await f.service.setBindings(policyRequest(7, [binding(agent, { priority: 42 })]))).revision, 8)
  const reloaded = await f.reload()
  assert.equal(catalog(reloaded).revision, 8)
  assert.equal(catalog(reloaded).bindings[0].priority, 42)
  assert.equal(catalog(reloaded).adapters.length, 0, 'Adapter registrations are not invented from persisted policy')
  assert.equal(f.storage.opens, 2)
  assert.equal(f.storage.closes, 1)
  assert.equal((await reloaded.setBindings(policyRequest(7, []))).status, 'CONFLICT')
})

test('policy JSON cannot introduce unknown roles, disallowed sources, writers or extra authority fields', async t => {
  const f = await fixture(t), agent = f.agent()
  const invalid = [
    [binding(agent, { roleIds: ['finance-unknown-worker'] })],
    [binding(agent, { sourceAllowlistKey: 'TEST_ONLY-unknown-source' })],
    [binding(agent, { roleIds: [writer.id] })],
    [binding(agent, { write: true })],
    [binding(agent, { scopeIds: [] })],
    [binding(agent, { capabilities: ['TEST_ONLY-unknown-capability'] })],
    [binding(agent, { roleIds: [modeler.id, modeler.id] })],
    { bindings: [] },
  ]
  for (const bindings of invalid) {
    const result = await f.service.setBindings(policyRequest(0, bindings))
    assert.equal(result.status, 'REJECTED')
    assert.equal(result.error.code, 'POLICY_INVALID')
    assert.equal(result.revision, 0)
  }
  assert.equal(f.storage.puts.length, 0)
  assert.deepEqual(catalog(f.service).bindings, [])
})

test('exact Agent authority, real role revisions and Session policy scope guard actual normalization', async t => {
  const f = await fixture(t), agent = f.agent(), adapter = provider(f.service)
  await allow(f, agent)
  const success = await f.service.queryForAgent(agent, makeQuery())
  assert.equal(success.status, 'OK')
  assert.equal(success.data.observations[0].value, 2000000)
  assert.equal(success.data.observations[0].provenance.testOnly, true)
  assert.equal(success.data.observations[0].provenance.originalValue, 2)
  assert.match(success.data.observations[0].observationId, /^sha256:[a-f0-9]{64}$/)
  assert.equal(adapter.calls.length, 1)
  const otherSession = f.agent('TEST_ONLY-other-session')
  assert.equal((await f.service.queryForAgent(otherSession, makeQuery())).status, 'NOT_AUTHORIZED')
  const forgedSameId = f.agent(agent.id, modeler, false)
  assert.equal((await f.service.queryForAgent(forgedSameId, makeQuery())).status, 'ROLE_QUERY_DENIED')
  assert.equal((await f.service.queryForAgent(f.agent('TEST_ONLY-writer', writer), makeQuery())).status, 'ROLE_QUERY_DENIED')
  f.rolesById.set(modeler.id, { ...modeler, source: { ...modeler.source, sha256: '0'.repeat(64) } })
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'ROLE_QUERY_DENIED')
  f.rolesById.set(modeler.id, { ...modeler, prompt: { ...modeler.prompt, adaptedSha256: '0'.repeat(64) } })
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'ROLE_QUERY_DENIED')
  f.rolesById.set(modeler.id, modeler)
  f.grants.delete(agent)
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'ROLE_QUERY_DENIED')
  await assert.rejects(f.service.queryForAgent(otherSession, { ...makeQuery(), roleId: modeler.id }))
  assert.equal(adapter.calls.length, 1, 'denied scopes never dispatch provider calls')
  const publicCatalog = f.service.catalog({}).catalogJson
  assert.equal(publicCatalog.includes('TEST_ONLY:credential-reference'), false)
  assert.equal(publicCatalog.includes('credentialRef'), false)
  assert.equal(catalog(f.service).adapters[0].credentialConfigured, true)
})

test('caller cancellation and exact Agent disposal abort real registry queries and release concurrency', async t => {
  const f = await fixture(t, { config: { requestTimeoutMs: 10000, maxConcurrentQueries: 1 } }), agent = f.agent()
  let entered = deferred(), providerSignal
  provider(f.service, async (_input, { signal }) => { providerSignal = signal; entered.resolve(); return new Promise(() => {}) })
  await allow(f, agent)
  const abort = new AbortController()
  const pending = f.service.queryForAgent(agent, makeQuery(), abort.signal)
  await entered.promise
  assert.equal((await f.service.queryForAgent(agent, makeQuery())).status, 'BUSY')
  abort.abort(new Error('TEST_ONLY caller cancelled'))
  assert.equal((await pending).status, 'CANCELLED')
  assert.equal(providerSignal.aborted, true)
  assert.equal(f.service.registry.activeQueries, 0)
  assert.equal(f.service.queries.size, 0)
  entered = deferred()
  const disposed = f.service.queryForAgent(agent, makeQuery())
  await entered.promise
  f.ctx.emit('agent/disposed', { agent: f.agent('TEST_ONLY-independent-session') })
  assert.equal(providerSignal.aborted, false)
  f.ctx.emit('agent/disposed', { agent })
  assert.equal((await disposed).status, 'CANCELLED')
  assert.equal(providerSignal.aborted, true)
  assert.equal(f.service.queries.size, 0)
})

test('follow streams initial plain catalog and real adapter state changes, then cancellation unsubscribes', async t => {
  const f = await fixture(t), abort = new AbortController()
  t.after(() => abort.abort())
  const stream = f.service.follow({}, abort.signal)
  assert.deepEqual(JSON.parse((await stream.next()).value.catalogJson).adapters, [])
  const adapter = provider(f.service)
  assert.equal(JSON.parse((await stream.next()).value.catalogJson).adapters[0].status.state, 'READY')
  const changed = stream.next()
  adapter.state('NOT_AUTHORIZED')
  assert.equal(JSON.parse((await changed).value.catalogJson).adapters[0].status.state, 'NOT_AUTHORIZED')
  const pending = stream.next()
  abort.abort()
  assert.equal((await pending).done, true)
  assert.equal(f.service.registry.listeners.size, 0)
  adapter.dispose()
  assert.equal(adapter.listeners.size, 0)
})
