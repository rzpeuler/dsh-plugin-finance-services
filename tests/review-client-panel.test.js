import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createReviewRemoteContract } from '../src/review/remote.js'
import { createReviewClient } from '../src/review/client-panel.js'

// Minimal hook host: effects run once per render pass, state updates re-render synchronously.
function reactStub() {
  let state = []
  let cursor = 0
  let pending = []
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children: children.flat(Infinity).filter(value => value != null) } } },
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; pending.push(index) }]
    },
    useEffect(effect) { const cleanup = effect(); if (typeof cleanup === 'function') pending.push(cleanup) },
    useId() { return `id-${cursor++}` },
  }
  return { React, reset() { state = []; cursor = 0; pending = [] },
    rewind() { cursor = 0; pending = [] },
    flush() { cursor = 0; const cleanups = pending; pending = []; return cleanups } }
}

const stub = reactStub()
const client = createReviewClient(stub.React, z, createReviewRemoteContract)
const flatten = node => {
  if (node == null) return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(flatten)
  return [node, ...flatten(node.props?.children ?? [])]
}
const texts = tree => flatten(tree).filter(value => typeof value === 'string')
const buttons = tree => flatten(tree).filter(node => node && node.type === 'button')

const summaryPayload = (overrides = {}) => ({
  ok: true,
  value: { summaryJson: JSON.stringify({
    source: 'financial_review.domain/state', revision: 12,
    groups: [{ sessionId: 'session-a', live: true, status: 'LIVE_SESSION', preset: 'finance-pitch-agent',
      pending: 1, decided: 0,
      items: [{ agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', runId: 'run-a',
        decision: 'HOLD', reason: 'REVIEW_REQUIRED', stageStatus: 'COMPLETED' }] }],
    totals: { sessions: 1, items: 1, pending: 1, decided: 0 },
    ...overrides,
  }) },
})

const policyPayload = overrides => ({
  ok: true,
  value: { policyJson: JSON.stringify({
    policyId: 'original', version: 'p5-policy-v1', digest: 'a'.repeat(64),
    lockedBoundaries: new Array(8).fill('x'), externalSideEffects: 'DISABLED',
    requirements: { 'finance-pitch-agent': { valuation_complete: 'MANDATORY' } },
    ...overrides,
  }) },
})

test('the factory exposes a remote contract, a panel, an installer and pure decoders', () => {
  assert.equal(typeof client.install, 'function')
  assert.equal(typeof client.Panel, 'function')
  assert.ok(client.remote && Array.isArray(client.remote.descriptors))
  assert.equal(client.remote.descriptors.length, 2)
  assert.equal(typeof client.decodeSummary, 'function')
})

test('a valid summary and policy decode into a bounded view model', () => {
  const summary = client.decodeSummary(summaryPayload())
  assert.equal(summary.ok, true)
  assert.equal(summary.summary.groups[0].items[0].decision, 'HOLD')
  assert.equal(summary.summary.totals.pending, 1)
  const policy = client.decodePolicy(policyPayload())
  assert.equal(policy.ok, true)
  assert.equal(policy.policy.locked, 8)
  assert.equal(policy.policy.externalSideEffects, 'DISABLED')
})

test('the decoders reject anything outside the contract', () => {
  assert.equal(client.decodeSummary({ ok: false, error: { code: 'gateway/refused' } }).code, 'gateway/refused')
  assert.equal(client.decodeSummary({ ok: true, value: { summaryJson: '{' } }).code, 'gateway/bad-json')
  assert.equal(client.decodeSummary(summaryPayload({ source: 'other' })).code, 'gateway/bad-source')
  assert.equal(client.decodeSummary(summaryPayload({ revision: -1 })).code, 'gateway/bad-revision')
  assert.equal(client.decodeSummary(summaryPayload({ totals: { sessions: 1 } })).code, 'gateway/bad-totals')
  const badDecision = summaryPayload()
  const parsed = JSON.parse(badDecision.value.summaryJson)
  parsed.groups[0].items[0].decision = 'MAYBE'
  badDecision.value.summaryJson = JSON.stringify(parsed)
  assert.equal(client.decodeSummary(badDecision).code, 'gateway/bad-item')
  const manyGroups = summaryPayload({ groups: new Array(201).fill({}) })
  assert.equal(client.decodeSummary(manyGroups).code, 'gateway/bad-groups')
  assert.equal(client.decodePolicy(policyPayload({ digest: 'nope' })).code, 'gateway/bad-digest')
})

test('install binds a locale namespace and a read-only loader', async () => {
  const calls = []
  const registered = []
  const ctx = {
    effect(register, label) { registered.push(label); assert.equal(typeof register, 'function'); register() },
    locale: {
      register(namespace, dictionaries) { assert.equal(namespace, 'financial-review-ui'); assert.ok(dictionaries.en && dictionaries.zh) },
      bind(namespace) { return key => `${namespace}.${key}` },
    },
    remote: {
      financeReview: {
        async reviewSummary(request) { calls.push(['summary', request]); return summaryPayload() },
        async reviewPolicy(request) { calls.push(['policy', request]); return policyPayload() },
      },
    },
  }
  const props = client.install(ctx)
  assert.equal(typeof props.reviewT, 'function')
  const result = await props.loadReview()
  assert.deepEqual(calls, [['summary', {}], ['policy', {}]])
  assert.equal(result.summary.ok, true)
  assert.equal(result.policy.ok, true)
  assert.match(registered.join(','), /dictionaries/)
})

test('the loader never writes: no decision or publication method is called', async () => {
  const calls = []
  const ctx = {
    effect(register) { register() },
    locale: { register() {}, bind() { return key => key } },
    remote: {
      financeReview: {
        async reviewSummary() { calls.push('summary'); return summaryPayload() },
        async reviewPolicy() { calls.push('policy'); return policyPayload() },
      },
    },
  }
  const props = client.install(ctx)
  await props.loadReview()
  assert.deepEqual(calls, ['summary', 'policy'])
})

async function renderPanel(loadReview) {
  stub.reset()
  client.Panel({ reviewT: key => key, loadReview })
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  stub.flush()
  stub.rewind()
  return client.Panel({ reviewT: key => key, loadReview })
}

test('the panel renders policy, totals and per-session rows from a ready state', async () => {
  const loadReview = async () => ({ summary: client.decodeSummary(summaryPayload()), policy: client.decodePolicy(policyPayload()) })
  const rerendered = await renderPanel(loadReview)
  const lines = texts(rerendered).join('\n')
  assert.match(lines, /POLICY|policy/)
  assert.match(lines, /session-a|—/)
  assert.match(lines, /checkpoint: valuation_complete|valuation_complete/)
  assert.match(lines, /readOnly/)
  assert.equal(buttons(rerendered).length, 1)
})

test('the panel shows the empty state and the failure state', async () => {
  const emptyTree = await renderPanel(async () => ({ summary: client.decodeSummary(summaryPayload({ groups: [] })),
    policy: client.decodePolicy(policyPayload()) }))
  const emptyLines = texts(emptyTree)
  assert.ok(emptyLines.some(value => value === 'empty'), emptyLines.join('|'))

  const failureTree = await renderPanel(async () => ({ summary: { ok: false, code: 'gateway/refused' }, policy: { ok: false, code: 'x' } }))
  const failureLines = texts(failureTree)
  assert.ok(failureLines.some(value => String(value).includes('gateway/refused')), failureLines.join('|'))
})
