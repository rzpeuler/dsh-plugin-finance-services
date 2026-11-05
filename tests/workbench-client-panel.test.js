import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createWorkbenchClient } from '../src/workbench/client-panel.js'

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
  }
  return { React, reset() { state = []; cursor = 0; pending = [] }, rewind() { cursor = 0; pending = [] }, flush() { cursor = 0; const cleanups = pending; pending = []; return cleanups } }
}

const stub = reactStub()
const client = createWorkbenchClient(stub.React, z)
const flatten = node => {
  if (node == null) return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(flatten)
  return [node, ...flatten(node.props?.children ?? [])]
}
const texts = tree => flatten(tree).filter(value => typeof value === 'string')

const snapshot = { ok: true, value: { binding: null, workspaceStatus: 'UNBOUND', revision: 19 } }
const catalogue = { ok: true, value: { agents: new Array(10).fill({}), workers: new Array(30).fill({}) } }
const data = { ok: true, value: { catalogJson: JSON.stringify({ revision: 8, adapters: [], bindings: [] }) } }
const reviews = { ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state', revision: 35,
  groups: [], totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } }

test('every card decodes from its own source and reports that source', () => {
  const workspace = client.decodeWorkspace(snapshot)
  assert.equal(workspace.ok, true)
  assert.equal(workspace.source, 'financeOperations.snapshot')
  assert.equal(workspace.value.binding, null)
  const roles = client.decodeCatalogue(catalogue)
  assert.equal(roles.value.agents, 10)
  assert.equal(roles.value.workers, 30)
  const sources = client.decodeDataSources(data)
  assert.equal(sources.value.revision, 8)
  const queue = client.decodeReviews(reviews)
  assert.equal(queue.value.revision, 35)
})

test('a malformed or failed payload degrades only its own card', () => {
  assert.equal(client.decodeWorkspace({ ok: false, error: { code: 'gateway/refused' } }).code, 'gateway/refused')
  assert.equal(client.decodeWorkspace({ ok: true, value: { revision: 'x' } }).code, 'gateway/bad-snapshot')
  assert.equal(client.decodeCatalogue({ ok: true, value: { agents: [] } }).code, 'gateway/bad-catalogue')
  assert.equal(client.decodeDataSources({ ok: true, value: { catalogJson: 'nope' } }).code, 'gateway/bad-json')
  assert.equal(client.decodeReviews({ ok: true, value: { summaryJson: '{}' } }).code, 'gateway/bad-totals')
})

test('the loader reads four sources and keeps per-card failures', async () => {
  const calls = []
  const ctx = {
    effect(register) { register() },
    locale: { register(namespace, dictionaries) { assert.ok(dictionaries.en && dictionaries.zh); assert.equal(namespace, 'financial-workbench-ui') }, bind() { return key => key } },
    remote: {
      financeOperations: {
        async snapshot(request) { calls.push(['snapshot', request]); return snapshot },
        async catalog(request) { calls.push(['catalog', request]); return { ok: false, error: { code: 'gateway/refused' } } },
      },
      financeData: { async catalog() { calls.push(['data']); return data } },
      financeReview: { async reviewSummary() { calls.push(['reviews']); return reviews } },
    },
  }
  const props = client.install(ctx)
  const cards = await props.loadOverview()
  assert.deepEqual(calls.map(item => item[0]), ['snapshot', 'catalog', 'data', 'reviews'])
  assert.equal(cards.workspace.ok, true)
  assert.equal(cards.roles.ok, false)
  assert.equal(cards.roles.code, 'gateway/refused')
  assert.equal(cards.dataSources.ok, true)
  assert.equal(cards.reviews.ok, true)
})

test('missing namespaces are reported as NOT_CONFIGURED rather than crashing', async () => {
  const ctx = {
    effect(register) { register() },
    locale: { register() {}, bind() { return key => key } },
    remote: { financeOperations: { async snapshot() { return snapshot }, async catalog() { return catalogue } } },
  }
  const props = client.install(ctx)
  const cards = await props.loadOverview()
  assert.equal(cards.workspace.ok, true)
  assert.equal(cards.roles.ok, true)
  assert.equal(cards.dataSources.code, 'NOT_CONFIGURED')
  assert.equal(cards.reviews.code, 'NOT_CONFIGURED')
})

test('the loader never writes: no decision, binding or policy call is made', async () => {
  const calls = []
  const track = name => async () => { calls.push(name); return { ok: false, error: { code: 'gateway/refused' } } }
  const ctx = {
    effect(register) { register() },
    locale: { register() {}, bind() { return key => key } },
    remote: {
      financeOperations: { snapshot: track('snapshot'), catalog: track('catalog'),
        bindWorkspace: track('bindWorkspace'), prepareDraft: track('prepareDraft') },
      financeData: { catalog: track('dataCatalog'), setBindings: track('setBindings') },
      financeReview: { reviewSummary: track('reviewSummary'), settle: track('settle'), reviewPolicy: track('reviewPolicy') },
    },
  }
  const props = client.install(ctx)
  await props.loadOverview()
  assert.deepEqual(calls.sort(), ['catalog', 'dataCatalog', 'reviewSummary', 'snapshot'])
})

test('the panel renders four cards, the degraded warning and the read-only note', async () => {
  const load = async () => ({ workspace: client.decodeWorkspace(snapshot), roles: client.decodeCatalogue(catalogue),
    dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews) })
  stub.reset()
  client.Panel({ workbenchT: key => key, loadOverview: load })
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  stub.flush(); stub.rewind()
  const tree = client.Panel({ workbenchT: key => key, loadOverview: load })
  const lines = texts(tree).join('\n')
  for (const expected of ['agents: 10', 'workers: 30', 'adapters: 0', 'policy: 0', 'pending: 0']) {
    assert.ok(lines.includes(expected), `${expected} missing from ${lines}`)
  }
  assert.ok(lines.includes('readOnly'))
  assert.ok(!lines.includes('degraded'), 'a fully successful read must not warn')

  const degradedTree = await (async () => {
    stub.reset()
    client.Panel({ workbenchT: key => key, loadOverview: async () => ({ workspace: client.decodeWorkspace(snapshot),
      roles: { ok: false, code: 'gateway/refused', source: 'financeOperations.catalog' },
      dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews) }) })
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    stub.flush(); stub.rewind()
    return client.Panel({ workbenchT: key => key, loadOverview: async () => ({ workspace: client.decodeWorkspace(snapshot),
      roles: { ok: false, code: 'gateway/refused', source: 'financeOperations.catalog' },
      dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews) }) })
  })()
  const degradedLines = texts(degradedTree).join('\n')
  assert.ok(degradedLines.includes('degraded'))
  assert.ok(degradedLines.includes('gateway/refused'))
})
