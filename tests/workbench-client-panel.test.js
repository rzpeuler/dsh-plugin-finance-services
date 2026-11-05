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
const role = (id, extra = {}) => ({ id, kind: 'main', writer: false, builtinTools: ['read', 'finance_data_query'],
  allowedMcpServers: ['capiq'], workerPresetIds: ['w1', 'w2', 'w3'], skillNames: ['a', 'b'], mountStatus: 'AVAILABLE', ...extra })
const catalogue = { ok: true, value: {
  agents: [role('finance-pitch-agent'), ...new Array(9).fill({}).map((_, index) => role(`finance-other-${index}`))],
  workers: new Array(30).fill({}),
  skills: [{ name: 'dcf-model', issues: [] }, { name: 'comps', issues: ['missing asset'] }, ...new Array(61).fill({ name: 'x', issues: [] })],
} }
const data = { ok: true, value: { catalogJson: JSON.stringify({ revision: 8, adapters: [], bindings: [] }) } }
const reviews = { ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state', revision: 35,
  groups: [], totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } }
const templates = { ok: true, value: { templatesJson: JSON.stringify({ templateVersion: '1.0.0', templates: [
  { presetId: 'finance-pitch-agent', title: 'Bank pitch first draft', templateVersion: '1.0.0', checkpoints: ['a', 'b'], sourceRefs: [] },
  { presetId: 'finance-gl-reconciler', title: 'GL reconciliation', templateVersion: '1.0.0', checkpoints: ['c'], sourceRefs: [] },
] }) } }
const runs = { ok: true, value: { runsJson: JSON.stringify({ deliverableRevision: 2, runs: [
  { runId: 'run-a', agents: ['finance-model-builder'], sessions: ['session-a'],
    checkpoints: { model_build_complete: 'COMPLETED' }, classification: 'IN_PROGRESS', deliverableCount: 2 }] }) } }
const deliverables = { ok: true, value: { deliverablesJson: JSON.stringify({ revision: 2, deliverables: [
  { path: 'artifacts/model.xlsx', sha256: 'a'.repeat(64), bytes: 1234, classification: 'TEST_ONLY',
    sessionId: 'session-a', runId: 'run-a', reviewId: null }] }) } }

test('every card decodes from its own source and reports that source', () => {
  const workspace = client.decodeWorkspace(snapshot)
  assert.equal(workspace.ok, true)
  assert.equal(workspace.source, 'financeOperations.snapshot')
  assert.equal(workspace.value.binding, null)
  const taskView = client.decodeTemplates(templates)
  assert.equal(taskView.value.templates.length, 2)
  assert.equal(taskView.value.templates[0].checkpoints, 2)
  const roles = client.decodeCatalogue(catalogue)
  assert.equal(roles.value.agents, 10)
  assert.equal(roles.value.workers, 30)
  assert.equal(roles.value.mains[0].id, 'finance-pitch-agent')
  assert.equal(roles.value.mains[0].workers, 3)
  assert.deepEqual(roles.value.mains[0].sources, ['capiq'])
  assert.equal(roles.value.skills.total, 63)
  assert.equal(roles.value.skills.flagged, 1)
  const sources = client.decodeDataSources(data)
  assert.equal(sources.value.revision, 8)
  const queue = client.decodeReviews(reviews)
  assert.equal(queue.value.revision, 35)
  const runView = client.decodeRuns(runs)
  assert.equal(runView.value.runs[0].classification, 'IN_PROGRESS')
  assert.equal(runView.value.runs[0].deliverableCount, 2)
  const index = client.decodeDeliverables(deliverables)
  assert.equal(index.value.items[0].bytes, 1234)
  assert.equal(index.value.revision, 2)
})

test('a malformed or failed payload degrades only its own card', () => {
  assert.equal(client.decodeWorkspace({ ok: false, error: { code: 'gateway/refused' } }).code, 'gateway/refused')
  assert.equal(client.decodeWorkspace({ ok: true, value: { revision: 'x' } }).code, 'gateway/bad-snapshot')
  assert.equal(client.decodeCatalogue({ ok: true, value: { agents: [] } }).code, 'gateway/bad-catalogue')
  assert.equal(client.decodeDataSources({ ok: true, value: { catalogJson: 'nope' } }).code, 'gateway/bad-json')
  assert.equal(client.decodeReviews({ ok: true, value: { summaryJson: '{}' } }).code, 'gateway/bad-totals')
  assert.equal(client.decodeRuns({ ok: true, value: { runsJson: '{}' } }).code, 'gateway/bad-runs')
  assert.equal(client.decodeDeliverables({ ok: true, value: { deliverablesJson: '{}' } }).code, 'gateway/bad-deliverables')
  const badHash = { ok: true, value: { deliverablesJson: JSON.stringify({ revision: 1, deliverables: [
    { path: 'x', sha256: 'nope', bytes: 1, classification: 'TEST_ONLY' }] }) } }
  assert.equal(client.decodeDeliverables(badHash).code, 'gateway/bad-deliverable')
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
      financeOperations: {
        async snapshot() { calls.push(['snapshot']); return { ok: true, value: { binding: null, workspaceStatus: 'UNBOUND', revision: 19 } } },
        async catalog() { calls.push(['catalog']); return { ok: false, error: { code: 'gateway/refused' } } },
        async taskTemplates() { calls.push(['taskTemplates']); return templates },
      },
      financeReview: { async reviewSummary() { calls.push(['reviews']); return reviews },
        async reviewRuns() { calls.push(['runs']); return runs },
        async reviewDeliverables() { calls.push(['deliverables']); return deliverables } },
    },
  }
  const props = client.install(ctx)
  const cards = await props.loadOverview()
  assert.deepEqual(calls.map(item => item[0]).sort(), ['catalog', 'data', 'deliverables', 'reviews', 'runs', 'snapshot', 'taskTemplates'])
  assert.equal(cards.workspace.ok, true)
  assert.equal(cards.roles.ok, false)
  assert.equal(cards.roles.code, 'gateway/refused')
  assert.equal(cards.dataSources.ok, true)
  assert.equal(cards.reviews.ok, true)
  assert.equal(cards.tasks.ok, true)
  assert.equal(cards.runs.ok, true)
  assert.equal(cards.deliverables.ok, true)
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
  assert.equal(cards.tasks.code, 'NOT_CONFIGURED')
  assert.equal(cards.runs.code, 'NOT_CONFIGURED')
  assert.equal(cards.deliverables.code, 'NOT_CONFIGURED')
})

test('the loader never writes: no decision, binding or policy call is made', async () => {
  const calls = []
  const track = name => async () => { calls.push(name); return { ok: false, error: { code: 'gateway/refused' } } }
  const ctx = {
    effect(register) { register() },
    locale: { register() {}, bind() { return key => key } },
    remote: {
      financeOperations: { snapshot: track('snapshot'), catalog: track('catalog'), taskTemplates: track('taskTemplates'),
        bindWorkspace: track('bindWorkspace'), prepareDraft: track('prepareDraft') },
      financeData: { catalog: track('dataCatalog'), setBindings: track('setBindings') },
      financeReview: { reviewSummary: track('reviewSummary'), settle: track('settle'), reviewPolicy: track('reviewPolicy'),
        reviewRuns: track('reviewRuns'), reviewDeliverables: track('reviewDeliverables') },
    },
  }
  const props = client.install(ctx)
  await props.loadOverview()
  assert.deepEqual(calls.sort(), ['catalog', 'dataCatalog', 'reviewDeliverables', 'reviewRuns', 'reviewSummary', 'snapshot', 'taskTemplates'])
})

test('the panel renders four cards, the degraded warning and the read-only note', async () => {
  const load = async () => ({ workspace: client.decodeWorkspace(snapshot), roles: client.decodeCatalogue(catalogue),
    dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews),
    tasks: client.decodeTemplates(templates),
    runs: client.decodeRuns(runs), deliverables: client.decodeDeliverables(deliverables) })
  stub.reset()
  client.Panel({ workbenchT: key => key, loadOverview: load })
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  stub.flush(); stub.rewind()
  const tree = client.Panel({ workbenchT: key => key, loadOverview: load })
  const lines = texts(tree).join('\n')
  for (const expected of ['agents: 10', 'workers: 30', 'skills: 63', 'flagged: 1', 'adapters: 0', 'policy: 0', 'pending: 0',
    'finance-pitch-agent', 'Bank pitch first draft',
    'finance-pitch-agent', 'sources: capiq', 'IN_PROGRESS', 'artifacts/model.xlsx', 'TEST_ONLY']) {
    assert.ok(lines.includes(expected), `${expected} missing from ${lines}`)
  }
  assert.ok(lines.includes('readOnly'))
  assert.ok(!lines.includes('degraded'), 'a fully successful read must not warn')

  const degradedTree = await (async () => {
    stub.reset()
    const degradedLoad = async () => ({ workspace: client.decodeWorkspace(snapshot),
      roles: { ok: false, code: 'gateway/refused', source: 'financeOperations.catalog' },
      dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews),
      tasks: client.decodeTemplates(templates),
      runs: client.decodeRuns(runs), deliverables: client.decodeDeliverables(deliverables) })
    client.Panel({ workbenchT: key => key, loadOverview: degradedLoad })
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    stub.flush(); stub.rewind()
    return client.Panel({ workbenchT: key => key, loadOverview: degradedLoad })
  })()
  const degradedLines = texts(degradedTree).join('\n')
  assert.ok(degradedLines.includes('degraded'))
  assert.ok(degradedLines.includes('gateway/refused'))
})

test('a delivered workbook is validated before the browser sees it', () => {
  const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])
  const base64 = Buffer.from(bytes).toString('base64')
  const payload = { ok: true, value: { filename: 'review.xlsx', bytes: bytes.length, sha256: 'a'.repeat(64), base64 } }
  const decoded = client.decodeWorkbook(payload)
  assert.equal(decoded.ok, true)
  assert.equal(decoded.value.bytes.length, bytes.length)
  assert.equal(decoded.value.filename, 'review.xlsx')
  assert.equal(client.decodeWorkbook({ ...payload, value: { ...payload.value, filename: 'evil.html' } }).code, 'gateway/bad-filename')
  assert.equal(client.decodeWorkbook({ ...payload, value: { ...payload.value, bytes: 99 } }).code, 'gateway/bad-payload')
  assert.equal(client.decodeWorkbook({ ...payload, value: { ...payload.value, sha256: 'nope' } }).code, 'gateway/bad-hash')
  const notZip = Buffer.from('nope')
  assert.equal(client.decodeWorkbook({ ok: true, value: { ...payload.value, bytes: notZip.length, base64: notZip.toString('base64') } }).code, 'gateway/not-a-zip')
  assert.equal(client.decodeWorkbook({ ok: false, error: { code: 'gateway/refused' } }).code, 'gateway/refused')
})

test('saving a workbook uses one anchor, then revokes the object URL', () => {
  const calls = []
  const anchor = { clicks: 0, click() { this.clicks += 1; calls.push('click') }, remove() { calls.push('remove') } }
  const env = {
    Blob: class { constructor(parts, options) { this.parts = parts; this.options = options } },
    URL: { createObjectURL: () => { calls.push('create'); return 'blob:test' }, revokeObjectURL: () => calls.push('revoke') },
    document: { body: { appendChild: () => calls.push('append') }, createElement: () => { calls.push('createElement'); return anchor } },
  }
  const saved = client.saveWorkbook(env, { filename: 'review.xlsx', bytes: new Uint8Array([1, 2, 3]) })
  assert.equal(saved.ok, true)
  assert.deepEqual(calls, ['create', 'createElement', 'append', 'click', 'remove', 'revoke'])
  assert.equal(anchor.clicks, 1)
  assert.equal(client.saveWorkbook({}, { filename: 'x.xlsx', bytes: new Uint8Array([1]) }).code, 'gateway/download-unsupported')
})

test('the panel offers one download control and reports its state', async () => {
  const load = async () => ({ workspace: client.decodeWorkspace(snapshot), roles: client.decodeCatalogue(catalogue),
    dataSources: client.decodeDataSources(data), reviews: client.decodeReviews(reviews),
    tasks: client.decodeTemplates(templates),
    runs: client.decodeRuns(runs), deliverables: client.decodeDeliverables(deliverables) })
  const loadWorkbook = async () => ({ ok: false, code: 'gateway/refused' })
  stub.reset()
  client.Panel({ workbenchT: key => key, loadOverview: load, loadWorkbook })
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  stub.flush(); stub.rewind()
  const tree = client.Panel({ workbenchT: key => key, loadOverview: load, loadWorkbook })
  const buttons = flatten(tree).filter(node => node && node.type === 'button')
  assert.equal(buttons.length, 2, 'refresh plus download')
  assert.ok(buttons.some(button => texts(button).join(' ').includes('download')))
})
