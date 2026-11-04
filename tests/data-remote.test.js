import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createDataRemoteContract } from '../src/data/remote.js'

// Contract tests only: no claim that a NativeHost/Gateway transport has executed these descriptors.
test('Remote descriptors expose only strict control-plane request JSON; Agent queries stay same-process', () => {
  const { remote, schemas } = createDataRemoteContract(z)
  assert.deepEqual(Object.keys(schemas).sort(), ['Catalog', 'Empty', 'PolicyRequest', 'PolicyResult'])
  assert.deepEqual(remote.descriptors.map(item => item.method), ['catalog', 'setBindings', 'follow'])
  for (const descriptor of remote.descriptors) {
    assert.equal(descriptor.service, 'financeData')
    assert.equal(descriptor.namespace, 'financeData')
    assert.deepEqual(descriptor.invocation, { kind: 'direct' })
    assert.equal(descriptor.parameters.length, 1)
    const parameter = descriptor.parameters[0]
    assert.equal(parameter.name, 'request')
    assert.equal(parameter.wire, 'request')
    assert.equal(parameter.source, 'json')
    assert.equal(parameter.codec.mode, 'strict')
    const valid = descriptor.method === 'setBindings' ? { expectedRevision: 0, bindingsJson: '[]' } : {}
    assert.deepEqual(parameter.codec.create().parse(JSON.parse(JSON.stringify(valid))), valid)
    for (const field of ['agent', 'roleId', 'scopeId', 'signal', 'query', 'sourceSha256', 'adaptedPromptSha256']) {
      assert.equal(parameter.codec.create().safeParse({ ...valid, [field]: 'TEST_ONLY' }).success, false)
    }
    assert.equal(descriptor.result.mode, 'strict')
    assert.match(descriptor.result.typeSymbol, /#(?:Catalog|PolicyResult)$/)
  }
  const follow = remote.descriptors.find(item => item.method === 'follow')
  assert.equal(follow.mode, 'stream')
  assert.deepEqual(follow.cancellation, { parameter: 'signal' })
  for (const descriptor of remote.descriptors.filter(item => item.method !== 'follow')) {
    assert.equal(descriptor.mode, undefined)
    assert.equal(descriptor.cancellation, undefined)
  }
})

test('Remote JSON carriers validate JSON, bound UTF-8 bytes, and reject non-string or extra payloads', () => {
  const { schemas } = createDataRemoteContract(z)
  for (const invalid of ['', '{', 'undefined', 'NaN', '\u0000', '"unterminated']) {
    assert.equal(schemas.Catalog.safeParse({ catalogJson: invalid }).success, false)
    assert.equal(schemas.PolicyRequest.safeParse({ expectedRevision: 0, bindingsJson: invalid }).success, false)
  }
  assert.equal(schemas.Catalog.safeParse({ catalogJson: {} }).success, false)
  assert.equal(schemas.Catalog.safeParse({ catalogJson: '{}', observations: [] }).success, false)
  assert.equal(schemas.PolicyRequest.safeParse({ expectedRevision: -1, bindingsJson: '[]' }).success, false)
  assert.equal(schemas.PolicyRequest.safeParse({ expectedRevision: 0.5, bindingsJson: '[]' }).success, false)
  const exactBytes = JSON.stringify('a'.repeat(1999998))
  assert.equal(new TextEncoder().encode(exactBytes).byteLength, 2000000)
  assert.equal(schemas.Catalog.safeParse({ catalogJson: exactBytes }).success, true)
  assert.equal(schemas.Catalog.safeParse({ catalogJson: JSON.stringify('a'.repeat(1999999)) }).success, false)
  const multibyte = JSON.stringify('界'.repeat(700000))
  assert.ok(multibyte.length < 2000000)
  assert.equal(schemas.Catalog.safeParse({ catalogJson: multibyte }).success, false)
  // Inner policy semantics are intentionally enforced by the real Host registry, not a permissive JSON carrier.
  assert.deepEqual(schemas.PolicyRequest.parse({ expectedRevision: 4, bindingsJson: '[]' }), { expectedRevision: 4, bindingsJson: '[]' })
})

test('Remote result schemas round-trip statuses and refuse unknown status or authority/credential fields', () => {
  const { schemas } = createDataRemoteContract(z)
  for (const status of ['APPLIED', 'CONFLICT', 'REJECTED', 'DISPOSED']) {
    const value = { status, revision: 3, error: status === 'APPLIED' ? null : { code: 'TEST_ONLY', message: 'TEST_ONLY result' } }
    assert.deepEqual(schemas.PolicyResult.parse(JSON.parse(JSON.stringify(value))), value)
  }
  for (const invalid of [
    { status: 'APPROVED', revision: 1, error: null },
    { status: 'APPLIED', revision: -1, error: null },
    { status: 'APPLIED', revision: 1, error: null, apiKey: 'TEST_ONLY' },
    { status: 'REJECTED', revision: 1, error: { code: 'X'.repeat(65), message: 'TEST_ONLY' } },
    { status: 'REJECTED', revision: 1, error: { code: 'TEST_ONLY', message: 'x'.repeat(257) } },
    { status: 'REJECTED', revision: 1, error: { code: 'TEST_ONLY', message: 'TEST_ONLY', agent: 'TEST_ONLY' } },
  ]) assert.equal(schemas.PolicyResult.safeParse(invalid).success, false)
})
