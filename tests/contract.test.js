import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createFinanceContract } from '../src/contract.js'
import { createWorkspaceTool } from '../src/host/tool.js'
import { financeReflection } from '../src/host/reflection.js'

const { remote, schemas } = createFinanceContract(z)
const snapshot = () => ({ version: '1', stage: 'P1', revision: 0, onboardingVersion: 0, binding: null, workspaceStatus: 'UNBOUND', error: null, limitations: [] })

test('Client-embedded factory has no module closure dependencies', () => {
  const embedded = Function(`return (${createFinanceContract.toString()})`)()(z)
  assert.equal(embedded.remote.package, '@local/dsh-financial-services')
  assert.deepEqual(embedded.remote.descriptors.map(item => item.method), ['snapshot', 'bindWorkspace', 'unbindWorkspace', 'follow'])
  assert.deepEqual(embedded.schemas.Snapshot.parse(snapshot()), snapshot())
})

test('all public descriptors are direct, strict and uniquely identified; follow has native cancellation', () => {
  const ids = new Set()
  for (const descriptor of remote.descriptors) {
    assert.equal(descriptor.service, 'financeOperations')
    assert.equal(descriptor.namespace, 'financeOperations')
    assert.deepEqual(descriptor.invocation, { kind: 'direct' })
    assert.equal(descriptor.id, `${remote.package}#financeOperations/${descriptor.method}`)
    ids.add(descriptor.id)
    assert.equal(descriptor.parameters.length, 1)
    assert.deepEqual(Object.keys(descriptor.parameters[0]).sort(), ['codec', 'name', 'source', 'wire'])
    assert.equal(descriptor.parameters[0].codec.mode, 'strict')
    assert.equal(descriptor.result.mode, 'strict')
    assert.ok(descriptor.result.create().safeParse(descriptor.method.includes('Workspace') ? { status: 'REJECTED', snapshot: snapshot(), error: { code: 'X', message: 'X' } } : snapshot()).success)
  }
  assert.equal(ids.size, 4)
  const stream = remote.descriptors.find(item => item.method === 'follow')
  assert.equal(stream.mode, 'stream')
  assert.deepEqual(stream.cancellation, { parameter: 'signal' })
  assert.ok(remote.descriptors.filter(item => item.method !== 'follow').every(item => item.mode === undefined && item.cancellation === undefined))
})

test('request codecs reject missing, wrongly typed, fractional, negative and extra fields', () => {
  for (const bad of [undefined, null, [], { extra: true }]) assert.throws(() => schemas.EmptyRequest.parse(bad))
  for (const bad of [{}, { path: '', expectedRevision: 0 }, { path: 'x', expectedRevision: -1 }, { path: 'x', expectedRevision: 0.1 }, { path: 'x', expectedRevision: '0' }, { path: 'x', expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { path: 'x', expectedRevision: 0, approve: true }]) assert.throws(() => schemas.BindRequest.parse(bad))
  assert.throws(() => schemas.UnbindRequest.parse({ expectedRevision: 0, path: 'x' }))
  assert.deepEqual(schemas.EmptyRequest.parse({}), {})
  assert.deepEqual(schemas.BindRequest.parse({ path: 'x', expectedRevision: 0 }), { path: 'x', expectedRevision: 0 })
})

test('Snapshot, nested binding/error, state root and BindResult remain strict', () => {
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), data: 'fabricated' }))
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), stage: 'P2' }))
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), revision: 0.5 }))
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), workspaceStatus: 'UNKNOWN' }))
  const binding = { workspaceId: 'w', path: '/existing', boundAt: '2026-11-03T12:00:00.000Z' }
  assert.ok(schemas.Snapshot.safeParse({ ...snapshot(), binding }).success)
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), binding: { ...binding, secret: 'x' } }))
  assert.throws(() => schemas.Snapshot.parse({ ...snapshot(), error: { code: 'X', message: 'X', actor: 'human' } }))
  assert.throws(() => schemas.StateRoot.parse({ version: 2, revision: 0, onboardingVersion: 0, binding: null }))
  assert.throws(() => schemas.BindResult.parse({ status: 'BOUND', snapshot: snapshot(), error: null, remoteError: {} }))
})

test('workspace tool validates at execution, uses shared methods, and offers no approval/shell action', async () => {
  const calls = []
  const service = {
    async snapshot(request) { calls.push(['snapshot', request]); return snapshot() },
    async bindWorkspace(request) { calls.push(['bind', request]); return { status: 'BOUND', snapshot: snapshot(), error: null } },
    async unbindWorkspace(request) { calls.push(['unbind', request]); return { status: 'UNBOUND', snapshot: snapshot(), error: null } },
  }
  const tool = createWorkspaceTool(service, schemas, z)
  assert.deepEqual(tool.parameters.properties.action.enum, ['status', 'bind', 'unbind'])
  for (const input of [{ action: 'approve' }, { action: 'bind', path: '/a' }, { action: 'status', expectedRevision: 0 }, { action: 'unbind', expectedRevision: 0, shell: 'x' }]) await assert.rejects(tool.execute(input))
  assert.deepEqual(calls, [])
  await tool.execute({ action: 'status' })
  await tool.execute({ action: 'bind', path: '/a', expectedRevision: 0 })
  await tool.execute({ action: 'unbind', expectedRevision: 1 })
  assert.deepEqual(calls, [['snapshot', {}], ['bind', { path: '/a', expectedRevision: 0 }], ['unbind', { expectedRevision: 1 }]])
  assert.equal(tool.isConcurrencySafe({ action: 'status' }), true)
  assert.equal(tool.isConcurrencySafe({ action: 'bind', path: '/a', expectedRevision: 0 }), false)
  assert.equal(tool.presentCall({ action: 'approve' }), undefined)
  assert.equal(tool.output.render({}, snapshot())[0].type, 'text')
})

test('Tool output uses only the native JSON Schema subset while executor retains refinements', async () => {
  const tool = createWorkspaceTool({ async snapshot() { return { ...snapshot(), revision: -1 } } }, schemas, z)
  const allowed = new Set(['type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'description', 'title', 'default', 'examples'])
  function check(schema) {
    for (const [key, value] of Object.entries(schema)) {
      assert.ok(allowed.has(key), `Unsupported native Tool keyword: ${key}`)
      if (key === 'properties') Object.values(value).forEach(check)
      else if (key === 'oneOf') value.forEach(check)
      else if (key === 'items' || key === 'additionalProperties' && typeof value === 'object') check(value)
    }
  }
  check(tool.output.schema)
  await assert.rejects(tool.execute({ action: 'status' }))
})

test('reflection describes the actual public signatures and stream, without business readings', () => {
  const model = financeReflection()
  assert.equal(model.services.length, 1)
  assert.equal(model.services[0].key, 'financeOperations')
  assert.deepEqual(model.services[0].members.map(item => item.name), remote.descriptors.map(item => item.method))
  assert.match(model.services[0].members.at(-1).signature, /AbortSignal.*AsyncIterable<Snapshot>/)
  assert.deepEqual(model.events, [])
})
