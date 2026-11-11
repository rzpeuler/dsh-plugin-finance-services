import test from 'node:test'
import assert from 'node:assert/strict'
import { applySessionEvent, applyWorkerEvent, createRun, emptyRunDocument, interruptActiveRuns, recentRuns } from '../src/run/store.js'

function userMessage(seq, id = `message-${seq}`) {
  return { type: 'user/message', seq, time: 1000 + seq, data: { id, source: { kind: 'user' }, content: [{ type: 'text', text: 'private prompt' }] } }
}

function event(type, seq, data, time = 1000 + seq) { return { type, seq, time, data } }

function submitted(sessionId = 'session-1', seq = 1, agentId = 'finance-model-builder') {
  return createRun(emptyRunDocument(), { sessionId, agentId, runId: `${sessionId}:${seq}`, message: userMessage(seq) })
}

test('creates one Run per durable user-message identity without storing prompt content', () => {
  const first = submitted()
  const duplicate = createRun(first, { sessionId: 'session-1', agentId: 'finance-model-builder', runId: 'duplicate', message: userMessage(1) })
  assert.equal(first.runs.length, 1)
  assert.equal(duplicate, first)
  assert.equal(first.runs[0].status, 'SUBMITTED')
  assert.equal(first.runs[0].taskType, null)
  assert.equal(JSON.stringify(first).includes('private prompt'), false)
})

test('projects actual turn, step, tool, output, and terminal events per Session', () => {
  let doc = submitted('session-1', 4)
  doc = applySessionEvent(doc, 'session-1', event('turn/start', 5, { turn: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('step/start', 6, { turn: 1, step: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('tool/call', 7, { turn: 1, step: 1, callId: 'call-1', name: 'read', arguments: '{"path":"private"}' }))
  doc = applySessionEvent(doc, 'session-1', event('tool/result', 8, { turn: 1, step: 1, message: { toolCallId: 'call-1', isError: true }, error: { code: 'FILE_NOT_FOUND', reason: 'private path' } }))
  doc = applySessionEvent(doc, 'session-1', event('assistant/message', 9, { turn: 1, step: 1, message: { id: 'assistant-1' }, interrupted: true }))
  doc = applySessionEvent(doc, 'session-1', event('step/end', 10, { turn: 1, step: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('turn/end', 11, { turn: 1, reason: { kind: 'completed' } }))
  const [run] = recentRuns(doc)
  assert.equal(run.status, 'COMPLETED')
  assert.equal(run.phases[0].status, 'COMPLETED')
  assert.equal(run.phases[1].status, 'ENDED')
  assert.equal(run.attempts[0].status, 'FAILED')
  assert.equal(run.attempts[0].errorCode, 'FILE_NOT_FOUND')
  assert.deepEqual(run.outputs.map(item => item.messageId), ['assistant-1'])
  assert.equal(run.diagnostics.length, 1)
  assert.equal(JSON.stringify(run).includes('private path'), false)
  assert.equal(JSON.stringify(run).includes('private'), false)
})

test('closes pending phases and leaves missing tool results explicitly unknown', () => {
  let doc = submitted('session-1', 1)
  doc = applySessionEvent(doc, 'session-1', event('turn/start', 2, { turn: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('step/start', 3, { turn: 1, step: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('tool/call', 4, { turn: 1, step: 1, callId: 'call-1', name: 'read', arguments: '{}' }))
  doc = applySessionEvent(doc, 'session-1', event('turn/end', 5, { turn: 1, reason: { kind: 'completed' } }))
  const [run] = recentRuns(doc)
  assert.equal(run.phases[1].status, 'ENDED')
  assert.equal(run.attempts[0].status, 'NO_RESULT')
  assert.equal(run.diagnostics[0].code, 'TOOL_RESULT_MISSING')
})

test('does not cross-associate Sessions that reuse event sequence numbers', () => {
  let doc = submitted('session-a', 1)
  doc = createRun(doc, { sessionId: 'session-b', agentId: 'finance-market-researcher', runId: 'session-b:1', message: userMessage(1) })
  doc = applySessionEvent(doc, 'session-b', event('turn/start', 2, { turn: 1 }))
  assert.equal(doc.runs.find(run => run.sessionId === 'session-a').status, 'SUBMITTED')
  assert.equal(doc.runs.find(run => run.sessionId === 'session-b').status, 'RUNNING')
})

test('does not label an assistant attempt without a message as a failure', () => {
  let doc = submitted('session-1', 1)
  doc = applySessionEvent(doc, 'session-1', event('turn/start', 2, { turn: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('assistant/attempt', 3, { turn: 1, step: 1, stream: [] }))
  const [run] = recentRuns(doc)
  assert.equal(run.attempts[0].status, 'NO_MESSAGE')
  assert.equal(run.diagnostics.length, 0)
})

test('replays Worker attempts from child Sessions after the parent turn ends', () => {
  let doc = submitted('parent', 1)
  doc = applySessionEvent(doc, 'parent', event('turn/start', 2, { turn: 1 }, 1002))
  doc = applySessionEvent(doc, 'parent', event('turn/end', 3, { turn: 1, reason: { kind: 'completed' } }, 1005))
  doc = applyWorkerEvent(doc, { parentSessionId: 'parent', childSessionId: 'child', agentId: 'finance-model-builder-modeler' },
    event('turn/start', 1, { turn: 1 }, 1003))
  doc = applyWorkerEvent(doc, { parentSessionId: 'parent', childSessionId: 'child', agentId: 'finance-model-builder-modeler' },
    event('turn/end', 2, { turn: 1, reason: { kind: 'completed' } }, 1004))
  const [run] = recentRuns(doc)
  assert.equal(run.status, 'COMPLETED')
  assert.equal(run.attempts[0].kind, 'worker')
  assert.equal(run.attempts[0].targetSessionId, 'child')
  assert.equal(run.attempts[0].turn, 1)
  assert.equal(run.attempts[0].status, 'COMPLETED')
})

test('projects persisted RUNNING work as interrupted after reactivation', () => {
  let doc = submitted('session-1', 1)
  doc = applySessionEvent(doc, 'session-1', event('turn/start', 2, { turn: 1 }))
  doc = applySessionEvent(doc, 'session-1', event('tool/call', 3, { turn: 1, step: 1, callId: 'call-1', name: 'read', arguments: '{}' }))
  const recovered = interruptActiveRuns(doc, 2000)
  const [run] = recovered.runs
  assert.equal(run.status, 'INTERRUPTED')
  assert.equal(run.phases[0].status, 'INTERRUPTED')
  assert.equal(run.attempts[0].status, 'INTERRUPTED')
  assert.equal(run.diagnostics.at(-1).code, 'TRACKER_RESTARTED')
})
