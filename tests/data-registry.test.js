import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { FinancialDataRegistry } from '../src/data/registry.js'
import { fixedNow, makeQuery, makeMetadata, makeResult } from './data-fixtures.js'
const role = { id: 'finance-test-reader', writer: false, allowedMcpServers: ['capiq'] }
const writer = { id: 'finance-test-writer', writer: true, allowedMcpServers: [] }
const context = { roleId: role.id, scopeId: 'TEST_ONLY-session-a' }
const binding = id => ({ adapterId: id, sourceAllowlistKey: 'capiq', scopeIds: [context.scopeId], roleIds: [role.id], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'], priority: 0, minQuality: 50, enabled: true, allowTestOnly: true })
function adapter(id, options = {}) {
  let snapshot = { state: 'READY', verifiedAt: fixedNow }
  const listeners = new Set()
  const calls = { query: 0, validate: 0, signals: [] }
  const metadata = options.metadata ?? makeMetadata(id)
  return {
    definition: { metadata,
      state: { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } },
      async validate(query, execution) { calls.validate++; return options.validate ? options.validate(query, execution) : { compatible: true } },
      async query(query, execution) { calls.query++; calls.signals.push(execution.signal); return options.query ? options.query(query, execution) : makeResult() },
    }, calls, listeners,
    setState(value) { snapshot = { ...snapshot, ...value }; for (const listener of listeners) listener() },
  }
}
function registry(t, options = {}) {
  const value = new FinancialDataRegistry({ roles: [role, writer], authorize: candidate => candidate === context, now: () => fixedNow, ...options })
  t.after(() => value.dispose())
  return value
}
const grant = (value, ids) => value.setBindings({ expectedRevision: value.policyRevision, bindings: ids.map(binding) })

test('registration is not entitlement; explicit exact Session/role/source/capability bindings are required', async t => {
  const value = registry(t), a = adapter('test-mcp')
  value.registerAdapter(a.definition)
  assert.equal((await value.query(makeQuery(), context)).status, 'NOT_AUTHORIZED')
  assert.equal(a.calls.query, 0)
  grant(value, ['test-mcp'])
  const result = await value.query(makeQuery(), context)
  assert.equal(result.status, 'OK')
  assert.equal(result.data.observations[0].provenance.sourceId, 'test-mcp')
  assert.equal(result.data.observations[0].provenance.testOnly, true)
  assert.equal(result.data.observations[0].value, 2000000)
  assert.equal((await value.query(makeQuery(), { ...context })).status, 'ROLE_QUERY_DENIED', 'Scope authorizer must not accept a model-supplied lookalike')
})

test('the same role in another Session receives no automatic grant; writers and original-source escalation are denied', async t => {
  const other = { roleId: role.id, scopeId: 'TEST_ONLY-session-b' }
  const value = registry(t, { authorize: candidate => candidate === context || candidate === other })
  value.registerAdapter(adapter('test-mcp').definition)
  grant(value, ['test-mcp'])
  assert.equal((await value.query(makeQuery(), other)).status, 'NOT_AUTHORIZED')
  assert.throws(() => value.setBindings({ expectedRevision: 1, bindings: [{ ...binding('test-mcp'), sourceAllowlistKey: 'ungranted' }] }), error => error.code === 'POLICY_ROLE_DENIED')
  assert.throws(() => value.setBindings({ expectedRevision: 1, bindings: [{ ...binding('test-mcp'), roleIds: [writer.id] }] }), error => error.code === 'POLICY_ROLE_DENIED')
  assert.throws(() => value.setBindings({ expectedRevision: 0, bindings: [] }), error => error.code === 'POLICY_CONFLICT')
})

test('selection ranks the requested capability, not another capability or a vendor-global preference', async t => {
  const value = registry(t)
  const first = adapter('test-a'), second = adapter('test-b')
  first.definition.metadata.capabilities[0].priority = 1
  first.definition.metadata.capabilities.push({ ...structuredClone(first.definition.metadata.capabilities[0]), id: 'company.identity', priority: 999999 })
  second.definition.metadata.capabilities[0].priority = 2
  value.registerAdapter(first.definition); value.registerAdapter(second.definition)
  grant(value, ['test-a', 'test-b'])
  assert.equal((await value.query(makeQuery(), context)).trace.at(-1).adapterId, 'test-b')
  assert.equal(first.calls.query, 0)
  assert.equal((await value.query({ ...makeQuery(), sourceIds: ['test-a'] }, context)).trace.at(-1).adapterId, 'test-a')
})

test('status comes from the Adapter source, not credential configuration or registration; failed status falls back', async t => {
  const value = registry(t), a = adapter('test-a'), b = adapter('test-b')
  a.definition.metadata.credentialRef = 'TEST_ONLY-reference-not-a-secret'
  a.setState({ state: 'NOT_AUTHORIZED', code: 'CREDENTIAL_UNAVAILABLE' })
  value.registerAdapter(a.definition); value.registerAdapter(b.definition)
  grant(value, ['test-a', 'test-b'])
  const catalog = value.catalog()
  assert.equal(catalog.adapters[0].credentialConfigured, true)
  assert.equal(catalog.adapters[0].status.state, 'NOT_AUTHORIZED')
  assert.ok(!JSON.stringify(catalog).includes('TEST_ONLY-reference-not-a-secret'))
  const result = await value.query(makeQuery(), context)
  assert.equal(result.status, 'OK')
  assert.equal(a.calls.query, 0)
  assert.ok(result.trace.some(item => item.code === 'NOT_AUTHORIZED'))
  a.setState({ state: 'READY' })
  assert.notEqual(value.catalog(), catalog)
  assert.equal(value.catalog().adapters[0].status.state, 'READY')
})

test('fallback records validation, normalization and safe provider errors without exposing response credentials', async t => {
  const value = registry(t)
  const a = adapter('test-a', { query() { throw Object.assign(new Error('api_key=DO_NOT_EXPORT'), { code: 'NETWORK_UNAVAILABLE' }) } })
  const b = adapter('test-b', { query() { const raw = makeResult(); raw.observations[0].availableAt = '2025-03-01T12:00:00Z'; return raw } })
  const c = adapter('test-c')
  for (const source of [a, b, c]) value.registerAdapter(source.definition)
  grant(value, ['test-a', 'test-b', 'test-c'])
  const result = await value.query(makeQuery(), context)
  assert.equal(result.status, 'OK')
  assert.deepEqual(result.trace.map(item => item.code), ['NETWORK_UNAVAILABLE', 'PIT_VIOLATION', 'SELECTED'])
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPORT'))
})

test('market, fields, quality, purposes and TEST_ONLY acceptance are explicit intersecting filters', async t => {
  const value = registry(t), source = adapter('test-a')
  value.registerAdapter(source.definition)
  grant(value, ['test-a'])
  assert.equal((await value.query({ ...makeQuery(), market: 'EU' }, context)).status, 'NOT_AUTHORIZED')
  assert.equal((await value.query({ ...makeQuery(), purpose: 'screening' }, context)).status, 'NOT_AUTHORIZED')
  value.setBindings({ expectedRevision: 1, bindings: [{ ...binding('test-a'), allowTestOnly: false }] })
  assert.equal((await value.query(makeQuery(), context)).status, 'NOT_AUTHORIZED')
  value.setBindings({ expectedRevision: 2, bindings: [{ ...binding('test-a'), minQuality: 90 }] })
  assert.equal((await value.query(makeQuery(), context)).trace[0].code, 'QUALITY_INSUFFICIENT')
  assert.equal(source.calls.query, 0)
})

test('unregistration cancels only the removed Adapter and permits a compatible fallback; late results are discarded', async t => {
  const value = registry(t)
  let started, resolveLate
  const entered = new Promise(resolve => { started = resolve })
  const a = adapter('test-a', { query() { started(); return new Promise(resolve => { resolveLate = resolve }) } })
  const b = adapter('test-b')
  const remove = value.registerAdapter(a.definition); value.registerAdapter(b.definition)
  grant(value, ['test-a', 'test-b'])
  const pending = value.query(makeQuery(), context)
  await entered
  remove()
  const result = await pending
  assert.equal(result.status, 'OK')
  assert.equal(result.trace.at(-1).adapterId, 'test-b')
  assert.equal(a.calls.signals[0].aborted, true)
  assert.equal(a.listeners.size, 0)
  resolveLate(makeResult())
  assert.equal(value.catalog().adapters.length, 1)
})

test('policy CAS changes abort in-flight work and forbid a late result under the old policy', async t => {
  const value = registry(t)
  let started
  const entered = new Promise(resolve => { started = resolve })
  const a = adapter('test-a', { query() { started(); return new Promise(() => {}) } })
  value.registerAdapter(a.definition); grant(value, ['test-a'])
  const pending = value.query(makeQuery(), context)
  await entered
  value.setBindings({ expectedRevision: 1, bindings: [] })
  assert.equal((await pending).status, 'POLICY_CHANGED')
  assert.equal(a.calls.signals[0].aborted, true)
})

test('exact-scope revocation after an await discards otherwise valid observations', async t => {
  let authorized = true, started, finish
  const value = registry(t, { authorize: candidate => candidate === context && authorized })
  const entered = new Promise(resolve => { started = resolve })
  const a = adapter('test-a', { query() { started(); return new Promise(resolve => { finish = resolve }) } })
  value.registerAdapter(a.definition); grant(value, ['test-a'])
  const pending = value.query(makeQuery(), context)
  await entered
  authorized = false
  finish(makeResult())
  const result = await pending
  assert.equal(result.status, 'SCOPE_REVOKED')
  assert.equal(result.data, null)
})

test('explicit cancellation, deadlines and concurrency bounds do not synthesize financial observations', async t => {
  const value = registry(t, { requestTimeoutMs: 10, maxConcurrentQueries: 1 })
  let started
  const entered = new Promise(resolve => { started = resolve })
  const a = adapter('test-a', { query() { started(); return new Promise(() => {}) } })
  value.registerAdapter(a.definition); grant(value, ['test-a'])
  const pending = value.query(makeQuery(), context)
  await entered
  assert.equal((await value.query(makeQuery(), context)).status, 'BUSY')
  const [result] = await Promise.all([pending, delay(30)])
  assert.equal(result.status, 'TIMEOUT')
  assert.equal(result.data, null)
  const controller = new AbortController(); controller.abort()
  assert.equal((await value.query(makeQuery(), context, controller.signal)).status, 'CANCELLED')
})

test('disposed registries revoke subscriptions, hide adapters and reject new queries', async t => {
  const value = registry(t), a = adapter('test-a')
  value.registerAdapter(a.definition)
  value.dispose()
  assert.equal(a.listeners.size, 0)
  assert.equal(value.catalog().adapters.length, 0)
  await assert.rejects(value.query(makeQuery(), context), error => error.code === 'REGISTRY_DISPOSED')
})

test('non-test sources require explicit license, model-processing and logged-session permission per request', async t => {
  const value = registry(t)
  const metadata = makeMetadata('licensed-fixture')
  metadata.testOnly = false; metadata.licenseClass = 'COMMERCIAL'
  const source = adapter('licensed-fixture', { metadata })
  value.registerAdapter(source.definition); grant(value, ['licensed-fixture'])
  const result = await value.query(makeQuery(), context)
  assert.equal(result.status, 'NOT_AUTHORIZED')
  assert.equal(result.trace.at(-1).code, 'LICENSE_USE_NOT_AUTHORIZED')
  assert.equal(source.calls.query, 0)
})

test('arbitrary provider diagnostics cannot export credential-bearing exception codes', async t => {
  const value = registry(t)
  const source = adapter('test-a', { query() { throw Object.assign(new Error('DO_NOT_EXPORT'), { code: 'SECRET_API_KEY_DO_NOT_EXPORT' }) } })
  source.setState({ code: 'SECRET_API_KEY_DO_NOT_EXPORT' })
  value.registerAdapter(source.definition); grant(value, ['test-a'])
  assert.equal(value.catalog().adapters[0].status.code, 'ADAPTER_ERROR')
  const result = await value.query(makeQuery(), context)
  assert.equal(result.trace.at(-1).code, 'ADAPTER_ERROR')
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPORT'))
})

test('distinct Session grants coexist while exact duplicate grants are rejected', async t => {
  const other = { roleId: role.id, scopeId: 'TEST_ONLY-session-b' }
  const value = registry(t, { authorize: candidate => candidate === context || candidate === other })
  value.registerAdapter(adapter('test-a').definition)
  const first = binding('test-a'), second = { ...binding('test-a'), scopeIds: [other.scopeId] }
  value.setBindings({ expectedRevision: 0, bindings: [first, second] })
  assert.equal((await value.query(makeQuery(), context)).status, 'OK')
  assert.equal((await value.query(makeQuery(), other)).status, 'OK')
  assert.throws(() => value.setBindings({ expectedRevision: 1, bindings: [first, structuredClone(first)] }))
  assert.equal(value.policyRevision, 1)
})
