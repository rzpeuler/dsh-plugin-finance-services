import test from 'node:test'
import assert from 'node:assert/strict'
import { FinancialDataRegistry } from '../src/data/registry.js'
import { fixedNow, makeMetadata, makeResult } from './data-fixtures.js'
function fixture() {
  const role = { id: 'finance-test-reader', writer: false, allowedMcpServers: ['capiq'] }
  const agent = { roleId: role.id, scopeId: 'TEST_ONLY-a' }, other = { roleId: role.id, scopeId: 'TEST_ONLY-b' }
  const registry = new FinancialDataRegistry({ roles: [role], authorize: value => value === agent || value === other, now: () => fixedNow })
  const metadata = { ...makeMetadata('test-provider'), credentialRef: 'PRIVATE_REF' }
  const remove = registry.registerAdapter({ metadata, state: { getSnapshot: () => ({ state: 'READY', verifiedAt: fixedNow }), subscribe: () => () => {} }, validate: async () => ({ compatible: true }), query: async () => makeResult() })
  const grant = () => registry.setBindings({ expectedRevision: 0, bindings: [{ adapterId: metadata.id, sourceAllowlistKey: 'capiq', scopeIds: [agent.scopeId], roleIds: [role.id], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'], priority: 0, minQuality: 50, enabled: true, allowTestOnly: true }] })
  return { registry, agent, other, grant, remove }
}

test('capability discovery reveals no Provider merely because it registered', () => {
  const f = fixture()
  assert.deepEqual(f.registry.describeCapability('financial.statements', f.agent), { status: 'NOT_AUTHORIZED', providers: [] })
  f.registry.dispose()
})

test('explicit scope discovery exposes allowed field/market/purpose coverage, not credentials or other Session policy', () => {
  const f = fixture(); f.grant()
  const result = f.registry.describeCapability('financial.statements', f.agent)
  assert.equal(result.status, 'EXPLICIT_SCOPE_GRANTS_FOUND')
  assert.deepEqual(result.providers[0].fields, ['revenue'])
  assert.deepEqual(result.providers[0].markets, ['US'])
  assert.deepEqual(result.providers[0].purposes, ['research'])
  assert.equal(result.providers[0].licenseUse, 'PER_REQUEST_VALIDATION_REQUIRED')
  for (const text of ['PRIVATE_REF', f.agent.scopeId, f.other.scopeId]) assert.ok(!JSON.stringify(result).includes(text))
  assert.deepEqual(f.registry.describeCapability('financial.statements', f.other).providers, [])
  assert.equal(f.registry.describeCapability('financial.statements', { ...f.agent }).status, 'ROLE_QUERY_DENIED')
  f.registry.dispose()
})

test('removal and unknown capability discovery fail closed rather than retaining stale Provider coverage', () => {
  const f = fixture(); f.grant(); f.remove()
  assert.equal(f.registry.describeCapability('financial.statements', f.agent).status, 'NOT_CONFIGURED')
  assert.throws(() => f.registry.describeCapability('arbitrary.write', f.agent))
  f.registry.dispose()
  assert.throws(() => f.registry.describeCapability('financial.statements', f.agent), error => error.code === 'REGISTRY_DISPOSED')
})
