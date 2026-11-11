import test from 'node:test'
import assert from 'node:assert/strict'
import { FinancialDataRegistry } from '../src/data/registry.js'

const now = '2025-03-02T00:00:00Z'
const role = { id: 'finance-reader', writer: false, allowedMcpServers: ['TEST_ONLY-source'] }
function registry() {
  return new FinancialDataRegistry({ roles: [role], authorize: () => true, now: () => now })
}
function source(id, { broken = false } = {}) {
  let callback, cleaned = 0
  const definition = {
    metadata: { id, version: '1.0.0', sourceId: id, label: `TEST_ONLY ${id}`, testOnly: true, licenseClass: 'TEST_ONLY',
      capabilities: [{ id: 'financial.statements', markets: ['CN'], fields: ['net_profit'], temporalModes: ['strict'], priority: 1, quality: 50 }] },
    state: { getSnapshot: () => ({ state: 'READY', verifiedAt: now }), subscribe(fn) { callback = fn; return () => { cleaned++; if (broken) throw new Error('api_key=DO_NOT_EXPORT') } } },
    validate: async () => ({ compatible: true }), query: async () => ({ observations: [], corporateActions: [], filings: [], warnings: [] }),
  }
  return { definition, late: () => callback(), cleaned: () => cleaned }
}

test('throwing adapter unsubscribe cannot retain registration; repeat disposal is idempotent', () => {
  const value = registry(), broken = source('test-broken', { broken: true })
  const remove = value.registerAdapter(broken.definition)
  assert.doesNotThrow(remove)
  assert.equal(value.catalog().adapters.length, 0)
  assert.equal(value.catalog().diagnostics.disposalFailures, 1)
  assert.doesNotThrow(remove)
  assert.equal(broken.cleaned(), 1)
  assert.ok(!JSON.stringify(value.catalog()).includes('DO_NOT_EXPORT'))
  value.dispose()
})

test('registry disposal cleans every subscription if one adapter cleanup throws', () => {
  const value = registry(), broken = source('test-broken', { broken: true }), good = source('test-good')
  value.registerAdapter(broken.definition)
  value.registerAdapter(good.definition)
  let changed = 0
  value.subscribe(() => changed++)
  assert.doesNotThrow(() => value.dispose())
  assert.equal(good.cleaned(), 1)
  assert.equal(value.catalog().adapters.length, 0)
  assert.equal(value.catalog().diagnostics.disposalFailures, 1)
  assert.equal(value.listeners.size, 0)
  const before = changed
  broken.late(); good.late()
  assert.equal(changed, before)
  assert.throws(() => value.subscribe(() => {}), error => error.code === 'REGISTRY_DISPOSED')
  assert.doesNotThrow(() => value.dispose())
})

test('synchronous status notification that reenters dispose detaches the late subscription handle', () => {
  const value = registry(), candidate = source('test-reentrant')
  let attached = false, cleaned = 0
  const definition = { ...candidate.definition, state: {
    getSnapshot: () => ({ state: 'READY', verifiedAt: now }),
    subscribe(listener) {
      attached = true
      listener()
      return () => { attached = false; cleaned++ }
    },
  } }
  value.subscribe(() => value.dispose())
  assert.throws(() => value.registerAdapter(definition), { code: 'ADAPTER_ERROR' })
  assert.equal(attached, false)
  assert.equal(cleaned, 1)
  assert.equal(value.catalog().adapters.length, 0)
  assert.equal(value.catalog().diagnostics.disposalFailures, 0)
})

test('late callbacks from an old registration cannot invalidate its same-ID successor', () => {
  const value = registry(), old = source('test-same'), current = source('test-same')
  value.registerAdapter(old.definition)()
  value.registerAdapter(current.definition)
  let changes = 0
  value.subscribe(() => changes++)
  const snapshot = value.catalog()
  old.late()
  assert.equal(changes, 0)
  assert.deepEqual(value.catalog(), snapshot)
  current.late()
  assert.equal(changes, 1)
  value.dispose()
})
