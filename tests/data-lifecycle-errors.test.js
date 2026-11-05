import test from 'node:test'
import assert from 'node:assert/strict'
import { FinancialDataRegistry } from '../src/data/registry.js'
import { fixedNow, makeMetadata, makeQuery, makeResult } from './data-fixtures.js'
function setup() {
  const role = { id: 'finance-test-reader', writer: false, allowedMcpServers: ['capiq'] }
  const context = { roleId: role.id, scopeId: 'TEST_ONLY-lifecycle' }
  const registry = new FinancialDataRegistry({ roles: [role], authorize: value => value === context, now: () => fixedNow })
  return { registry, context, binding: id => ({ adapterId: id, sourceAllowlistKey: 'capiq', scopeIds: [context.scopeId], roleIds: [role.id], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'], priority: 0, minQuality: 0, enabled: true, allowTestOnly: true }) }
}
function source(id, broken = false, query = async () => makeResult()) {
  let callback, cleaned = 0
  return { definition: { metadata: makeMetadata(id), state: { getSnapshot: () => ({ state: 'READY', verifiedAt: fixedNow }), subscribe(fn) { callback = fn; return () => { cleaned++; if (broken) throw new Error('api_key=DO_NOT_EXPORT') } } }, validate: async () => ({ compatible: true }), query }, late: () => callback(), cleaned: () => cleaned }
}

test('throwing provider unsubscribe cannot retain a registered capability; repeat disposal is idempotent', () => {
  const { registry } = setup(), broken = source('test-broken', true)
  const remove = registry.registerAdapter(broken.definition)
  assert.doesNotThrow(remove)
  assert.equal(registry.catalog().adapters.length, 0)
  assert.equal(registry.catalog().diagnostics.disposalFailures, 1)
  assert.doesNotThrow(remove)
  assert.equal(broken.cleaned(), 1)
  assert.ok(!JSON.stringify(registry.catalog()).includes('DO_NOT_EXPORT'))
  registry.dispose()
})

test('registry disposal cleans every owned subscription even if the first provider throws', () => {
  const { registry } = setup(), broken = source('test-broken', true), good = source('test-good')
  registry.registerAdapter(broken.definition); registry.registerAdapter(good.definition)
  let changed = 0
  registry.subscribe(() => changed++)
  assert.doesNotThrow(() => registry.dispose())
  assert.equal(good.cleaned(), 1)
  assert.equal(registry.catalog().adapters.length, 0)
  assert.equal(registry.catalog().diagnostics.disposalFailures, 1)
  assert.equal(registry.listeners.size, 0)
  const before = changed
  broken.late(); good.late()
  assert.equal(changed, before)
  assert.throws(() => registry.subscribe(() => {}), error => error.code === 'REGISTRY_DISPOSED')
  assert.doesNotThrow(() => registry.dispose())
})

test('late callbacks from an old registration cannot invalidate its same-ID successor', () => {
  const { registry } = setup(), old = source('test-same'), current = source('test-same')
  registry.registerAdapter(old.definition)()
  registry.registerAdapter(current.definition)
  let changes = 0
  registry.subscribe(() => changes++)
  const snapshot = registry.catalog()
  old.late()
  assert.equal(changes, 0)
  assert.equal(registry.catalog(), snapshot)
  current.late()
  assert.equal(changes, 1)
  registry.dispose()
})

test('unregister aborts a held query even if provider cleanup throws and its late response arrives', async () => {
  const { registry, context, binding } = setup()
  let entered, finish, observedSignal
  const started = new Promise(resolve => { entered = resolve })
  const broken = source('test-broken', true, async (_query, execution) => {
    observedSignal = execution.signal
    entered()
    return await new Promise(resolve => { finish = resolve })
  })
  const remove = registry.registerAdapter(broken.definition)
  registry.setBindings({ expectedRevision: 0, bindings: [binding('test-broken')] })
  const pending = registry.query(makeQuery(), context)
  await started
  assert.doesNotThrow(remove)
  assert.equal(observedSignal.aborted, true)
  const result = await pending
  assert.equal(result.data, null)
  assert.equal(result.status, 'UNAVAILABLE')
  finish(makeResult())
  registry.dispose()
})
