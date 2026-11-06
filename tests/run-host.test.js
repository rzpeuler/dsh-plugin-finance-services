import test from 'node:test'
import assert from 'node:assert/strict'
import FinanceRuns from '../src/run/host.js'
import { emptyRunDocument } from '../src/run/store.js'

function fixture(flushResult) {
  const session = { id: 'session-1', header: { origin: 'main' } }
  const writes = []
  const service = Object.create(FinanceRuns.prototype)
  service.active = true
  service.mainIds = new Set(['finance-model-builder'])
  service.config = { retainedRuns: 5000 }
  service.document = emptyRunDocument()
  service.table = { async put(key, value) { writes.push({ key, value }) } }
  service.waiters = new Map()
  service.globalWaiters = new Set()
  service.ctx = {
    sessions: { get: id => id === session.id ? session : undefined, flush: async () => flushResult },
    sessionProjections: { stateOf: () => 'finance-model-builder' },
  }
  return { service, session, writes }
}

const message = { type: 'user/message', seq: 8, time: 2000, data: { id: 'message-8', source: { kind: 'user' },
  content: [{ type: 'text', text: 'private prompt' }] } }

test('does not create a Run before the accepted Session message is durably flushed', async () => {
  const { service, session, writes } = fixture(false)
  await service.consume(session, message, false)
  assert.equal(service.document.runs.length, 0)
  assert.equal(writes.length, 0)
})

test('persists metadata only after the accepted Session message is durably flushed', async () => {
  const { service, session, writes } = fixture(true)
  await service.consume(session, message, false)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].key, 'root')
  assert.equal(service.document.runs.length, 1)
  assert.equal(service.document.runs[0].sessionId, session.id)
  assert.equal(service.document.runs[0].agentId, 'finance-model-builder')
  assert.equal(JSON.stringify(writes[0].value).includes('private prompt'), false)
})
