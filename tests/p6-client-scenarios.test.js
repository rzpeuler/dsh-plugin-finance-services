import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createWorkbenchClient } from '../src/workbench/client-panel.js'
import { createReviewClient } from '../src/review/client-panel.js'
import { createReviewRemoteContract } from '../src/review/remote.js'

// Hook host that re-renders once after effects settle.
function hookHost() {
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
  return {
    React,
    async render(component, props) {
      state = []; cursor = 0; pending = []
      component(props)
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))
      cursor = 0; pending = []
      return component(props)
    },
    rerender(component, props) { cursor = 0; pending = []; return component(props) },
  }
}

const flatten = node => {
  if (node == null) return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(flatten)
  return [node, ...flatten(node.props?.children ?? [])]
}
const texts = tree => flatten(tree).filter(value => typeof value === 'string').join('\n')

// Each scenario gets its own hook host and factories so no state leaks between tests.
function makeWorkbench() {
  const host = hookHost()
  const workbench = createWorkbenchClient(host.React, z)
  return { host, workbench }
}
function makeReview() {
  const host = hookHost()
  const review = createReviewClient(host.React, z, createReviewRemoteContract)
  return { host, review }
}

const ok = (fn, value) => ({ ok: true, value })
const denied = () => ({ ok: false, error: { code: 'gateway/not-authorized' } })
const snapshot = binding => ({ ok: true, value: { binding, workspaceStatus: binding ? 'READY' : 'UNBOUND', revision: 19 } })
const roleStub = index => ({ id: `finance-role-${index}`, builtinTools: ['read'], allowedMcpServers: [], workerPresetIds: [],
  skillNames: [], writer: false, mountStatus: 'AVAILABLE' })
const catalogue = (agents, workers) => ({ ok: true, value: {
  agents: new Array(agents).fill({}).map((_, index) => roleStub(index)),
  workers: new Array(workers).fill({}), skills: new Array(63).fill({ name: 'x', issues: [] }) } })
const cataloguePayload = (agents, workers) => ({
  agents: new Array(agents).fill({}).map((_, index) => roleStub(index)),
  workers: new Array(workers).fill({}), skills: new Array(63).fill({ name: 'x', issues: [] }) })
const dataPayload = { ok: true, value: { catalogJson: JSON.stringify({ revision: 8, adapters: [], bindings: [] }) } }
const reviewsPayload = { ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state', revision: 35,
  groups: [], totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } }
const runsPayload = { ok: true, value: { runsJson: JSON.stringify({ deliverableRevision: 0, runs: [] }) } }
const deliverablesPayload = { ok: true, value: { deliverablesJson: JSON.stringify({ revision: 0, deliverables: [] }) } }

async function workbenchTree(overrides = {}) {
  const { host, workbench } = makeWorkbench()
  const load = async () => ({
    workspace: workbench.decodeWorkspace(overrides.workspace ?? snapshot(null)),
    roles: workbench.decodeCatalogue(overrides.roles ?? catalogue(10, 30)),
    dataSources: overrides.dataSources ?? workbench.decodeDataSources(dataPayload),
    reviews: overrides.reviews ?? workbench.decodeReviews({ ...reviewsPayload }),
    runs: overrides.runs ?? workbench.decodeRuns(runsPayload),
    deliverables: overrides.deliverables ?? workbench.decodeDeliverables(deliverablesPayload),
  })
  return host.render(workbench.Panel, { workbenchT: key => key, loadOverview: load })
}

async function reviewTree(loadReview) {
  const { host, review } = makeReview()
  return host.render(review.Panel, { reviewT: key => key, loadReview })
}

test('unbound workspace is shown as unbound, never as a ready workspace', async () => {
  const tree = await workbenchTree({ workspace: snapshot(null) })
  const lines = texts(tree)
  assert.match(lines, /binding: unbound/)
  assert.match(lines, /UNBOUND/)
  assert.doesNotMatch(lines, /binding: bound/)
})

test('a bound workspace names the binding state without inventing readiness elsewhere', async () => {
  const tree = await workbenchTree({ workspace: snapshot({ workspaceId: 'ws-1', path: 'C:/work' }) })
  const lines = texts(tree)
  assert.match(lines, /binding: bound/)
})

test('zero roles render as zero rather than a hidden card', async () => {
  const tree = await workbenchTree({ roles: { ok: true, value: cataloguePayload(0, 0) } })
  const lines = texts(tree)
  assert.match(lines, /agents: 0/)
  assert.match(lines, /workers: 0/)
})

test('a missing data namespace says NOT_CONFIGURED and marks the page degraded', async () => {
  const tree = await workbenchTree({ dataSources: { ok: false, code: 'NOT_CONFIGURED', source: 'financeData.catalog' } })
  const lines = texts(tree)
  assert.match(lines, /NOT_CONFIGURED/)
  assert.match(lines, /degraded/)
})

test('a permission denial surfaces its own code and does not look like success', async () => {
  const { workbench } = makeWorkbench()
  const card = workbench.decodeDataSources(denied())
  assert.equal(card.ok, false)
  assert.equal(card.code, 'gateway/not-authorized')
  const tree = await workbenchTree({ dataSources: card })
  const lines = texts(tree)
  assert.match(lines, /not-authorized/)
  assert.match(lines, /degraded/)
  for (const forbidden of ['APPROVED', 'published', '已批准', '已发布']) {
    assert.ok(!lines.includes(forbidden), `failure render must not contain ${forbidden}`)
  }
})

test('when every read fails the page still renders four unavailable cards and a refresh', async () => {
  const failed = source => ({ ok: false, code: 'gateway/failed', source })
  const tree = await workbenchTree({
    workspace: failed('financeOperations.snapshot'), roles: failed('financeOperations.catalog'),
    dataSources: failed('financeData.catalog'), reviews: failed('financeReview.reviewSummary'),
    runs: failed('financeReview.reviewRuns'), deliverables: failed('financeReview.reviewDeliverables'),
  })
  const lines = texts(tree)
  for (const source of ['financeOperations.snapshot', 'financeOperations.catalog', 'financeData.catalog',
    'financeReview.reviewSummary', 'financeReview.reviewRuns', 'financeReview.reviewDeliverables']) {
    assert.ok(lines.includes(source), `missing unavailable card for ${source}`)
  }
  assert.ok((lines.match(/unavailable/g) ?? []).length >= 6)
  assert.match(lines, /degraded/)
  const buttons = flatten(tree).filter(node => node && node.type === 'button')
  assert.equal(buttons.length, 2, 'refresh and download stay available')
})

test('an empty review queue renders the empty state rather than a blank panel', async () => {
  const { review } = makeReview()
  const tree = await reviewTree(async () => ({
    summary: review.decodeSummary({ ok: true, value: { summaryJson: JSON.stringify({
      source: 'financial_review.domain/state', revision: 1, groups: [],
      totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } }),
    policy: review.decodePolicy({ ok: true, value: { policyJson: JSON.stringify({
      policyId: 'original', version: 'p5-policy-v1', digest: 'a'.repeat(64),
      lockedBoundaries: new Array(8).fill('x'), externalSideEffects: 'DISABLED' }) } }),
  }))
  assert.match(texts(tree), /empty/)
})

test('a review permission denial replaces rows with the refusal and its code', async () => {
  const { review } = makeReview()
  const tree = await reviewTree(async () => ({ summary: review.decodeSummary(denied()), policy: review.decodePolicy(denied()) }))
  const lines = texts(tree)
  assert.match(lines, /not-authorized/)
  assert.match(lines, /stale/)
  assert.ok(!lines.includes('APPROVED'))
})

test('the review panel refuses to show rows whose policy could not be read', async () => {
  const summaryOk = { ok: true, value: { summaryJson: JSON.stringify({
    source: 'financial_review.domain/state', revision: 2,
    groups: [{ sessionId: 's', live: true, status: 'LIVE_SESSION', preset: 'finance-pitch-agent', pending: 1, decided: 0,
      items: [{ agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', runId: 'r', decision: 'HOLD',
        reason: 'REVIEW_REQUIRED', stageStatus: 'COMPLETED' }] }],
    totals: { sessions: 1, items: 1, pending: 1, decided: 0 } }) } }
  const { review } = makeReview()
  const tree = await reviewTree(async () => ({ summary: review.decodeSummary(summaryOk), policy: review.decodePolicy(denied()) }))
  const lines = texts(tree)
  assert.match(lines, /not-authorized/)
  assert.doesNotMatch(lines, /valuation_complete/, 'rows must not render when the policy read failed')
})
