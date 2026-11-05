/** Unit-only codec/build checks. These do not claim actual connected Client acceptance. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createP3ClientContract } from './contract.js'
import { createP3ClientFixture } from './client.js'
const owner = '@local/test-p3-client-codec', runId = randomUUID()
test('serialized contract closes only over supplied builtin and identity', () => {
  const factory = (0, eval)(`(${createP3ClientContract.toString()})`)
  const { remote, schemas } = factory(z, owner)
  assert.equal(remote.package, owner); assert.equal(remote.descriptors.length, 6)
  assert.equal(new Set(remote.descriptors.map(d => d.id)).size, 6)
  for (const descriptor of remote.descriptors) {
    assert.equal(descriptor.namespace, 'financeP3ClientTestOnly'); assert.equal(descriptor.invocation.kind, 'direct')
    assert.ok(descriptor.parameters[0].codec.create()); assert.equal(descriptor.result.create(), schemas.JsonResult)
  }
})
test('narrow owned requests are strict and cannot carry identity credentials endpoint', () => {
  const { schemas } = createP3ClientContract(z, owner)
  assert.deepEqual(schemas.Run.parse({ runId }), { runId })
  for (const key of ['agentId', 'scopeId', 'sessionId', 'roleId', 'apiKey', 'endpoint', 'headers'])
    assert.equal(schemas.Run.safeParse({ runId, [key]: 'TEST_ONLY_NOT_A_SECRET' }).success, false)
  assert.equal(schemas.Empty.safeParse({ request: true }).success, false)
  assert.equal(schemas.Toggle.safeParse({ runId, state: 'ERROR' }).success, false)
  assert.equal(schemas.Run.safeParse({ runId: '*' }).success, false)
})
test('JSON codecs reject invalid text and UTF8-overlong data', () => {
  const { schemas } = createP3ClientContract(z, owner)
  assert.equal(schemas.JsonResult.safeParse({ json: '{' }).success, false)
  assert.equal(schemas.JsonResult.safeParse({ json: JSON.stringify('界'.repeat(100001)) }).success, false)
  assert.deepEqual(schemas.JsonResult.parse({ json: '{"status":"READY"}' }), { json: '{"status":"READY"}' })
})
test('browser fixture serializes without imported runtime values', () => {
  const factory = (0, eval)(`(${createP3ClientFixture.toString()})`)
  const plugin = factory(z, createP3ClientContract, owner)
  assert.deepEqual(plugin.inject, ['remote', 'cordisInspect']); assert.equal(typeof plugin.apply, 'function')
})
test('Client uses verified public APIs and preserves missing production callback failure', async () => {
  const source = await readFile(new URL('./client.js', import.meta.url), 'utf8')
  for (const text of ['ctx.slots.entries(key)', 'ctx.slots.subscribe(key, listener)', 'ctx.slots.entriesOfSlot(key).includes(matching[0])',
    'matching[0].inject?.()', 'PRODUCTION_DATA_CALLBACK_MISSING_REFRESH_REQUIRED', 'ctx.resources.source(ADDRESS)', 'ctx.resources.pin(address, pins.signal)']) assert.ok(source.includes(text))
  for (const forbidden of ['document.', 'querySelector', 'setInterval', 'ctx.resources.register(', 'ctx.slots.register(', 'uiWorkspace', 'conversation.input']) assert.ok(!source.includes(forbidden))
})
