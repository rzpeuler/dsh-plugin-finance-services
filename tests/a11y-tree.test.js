import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createWorkbenchClient } from '../src/workbench/client-panel.js'
import { createReviewClient } from '../src/review/client-panel.js'
import { createReviewRemoteContract } from '../src/review/remote.js'

// Structural accessibility checks on the rendered element tree.
// They cannot judge contrast or screen-reader output; they catch missing labels, bad heading
// levels, untyped buttons and non-live status regions.
function hookHost() {
  let state = []
  let cursor = 0
  const React = {
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children: children.flat(Infinity).filter(value => value != null) } }
    },
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }]
    },
    useEffect(effect) { effect() },
  }
  return {
    React,
    async render(component, props) {
      state = []; cursor = 0
      component(props)
      await new Promise(resolve => setImmediate(resolve))
      await new Promise(resolve => setImmediate(resolve))
      cursor = 0
      return component(props)
    },
  }
}

const walk = (node, visit) => {
  if (node == null) return
  if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return }
  if (typeof node !== 'object') return
  visit(node)
  walk(node.props?.children ?? [], visit)
}

const elements = tree => {
  const found = []
  walk(tree, node => found.push(node))
  return found
}
const textOf = node => {
  const parts = []
  const collect = value => {
    if (value == null) return
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (typeof value === 'string' || typeof value === 'number') { parts.push(String(value)); return }
    if (typeof value === 'object') collect(value.props?.children ?? [])
  }
  collect(node)
  return parts.join(' ').trim()
}

const host = hookHost()
const workbench = createWorkbenchClient(host.React, z)
const review = createReviewClient(host.React, z, createReviewRemoteContract)

const role = index => ({ id: `finance-role-${index}`, builtinTools: ['read'], allowedMcpServers: ['capiq'],
  workerPresetIds: ['a', 'b', 'c'], skillNames: ['s'], writer: false, mountStatus: 'AVAILABLE' })
const catalogue = { ok: true, value: { agents: new Array(3).fill({}).map((_, index) => role(index)),
  workers: new Array(9).fill({}), skills: [{ name: 'x', issues: [] }] } }

async function renderedWorkbench(ok = true) {
  const load = async () => ({
    workspace: workbench.decodeWorkspace({ ok: true, value: { binding: null, workspaceStatus: 'UNBOUND', revision: 19 } }),
    roles: workbench.decodeCatalogue(catalogue),
    dataSources: ok ? workbench.decodeDataSources({ ok: true, value: { catalogJson: JSON.stringify({ revision: 1, adapters: [], bindings: [] }) } })
      : { ok: false, code: 'NOT_CONFIGURED', source: 'financeData.catalog' },
    tasks: workbench.decodeTemplates({ ok: true, value: { templatesJson: JSON.stringify({ templateVersion: '1.0.0', templates: [
      { presetId: 'finance-earnings-reviewer', title: 'Pitch', templateVersion: '1.0.0', checkpoints: ['a'] }] }) } }),
    reviews: workbench.decodeReviews({ ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state',
      revision: 1, groups: [], totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } }),
    runs: workbench.decodeRuns({ ok: true, value: { runsJson: JSON.stringify({ deliverableRevision: 0, runs: [] }) } }),
    deliverables: workbench.decodeDeliverables({ ok: true, value: { deliverablesJson: JSON.stringify({ revision: 0, deliverables: [] }) } }),
  })
  return host.render(workbench.Panel, { workbenchT: key => key, loadOverview: load })
}

async function renderedReview() {
  const load = async () => ({
    summary: review.decodeSummary({ ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state',
      revision: 3, groups: [{ sessionId: 's-1', live: true, status: 'LIVE_SESSION', preset: 'finance-earnings-reviewer',
        pending: 1, decided: 0, items: [{ agentId: 'finance-earnings-reviewer', checkpointId: 'note_complete',
          runId: 'r-1', decision: 'HOLD', reason: 'REVIEW_REQUIRED', stageStatus: 'COMPLETED' }] }],
      totals: { sessions: 1, items: 1, pending: 1, decided: 0 } }) } }),
    policy: review.decodePolicy({ ok: true, value: { policyJson: JSON.stringify({ policyId: 'original', version: 'p5-policy-v1',
      digest: 'a'.repeat(64), lockedBoundaries: new Array(8).fill('x'), externalSideEffects: 'DISABLED' }) } }),
  })
  return host.render(review.Panel, { reviewT: key => key, loadReview: load })
}

function audit(name, tree) {
  const nodes = elements(tree)
  const headings = nodes.filter(node => /^h[1-6]$/.test(String(node.type)))
  const inputs = nodes.filter(node => node.type === 'input')
  const buttons = nodes.filter(node => node.type === 'button')
  const labels = nodes.filter(node => node.type === 'label')
  const region = nodes.find(node => node.type === 'section')
  return { name, nodes, headings, inputs, buttons, labels, region }
}

test('no panel introduces a page-level heading or an untyped button', async () => {
  for (const [name, tree] of [['workbench', await renderedWorkbench()], ['review', await renderedReview()]]) {
    const { headings, buttons } = audit(name, tree)
    assert.ok(headings.length >= 1, `${name} should have at least one heading`)
    for (const heading of headings) assert.notEqual(heading.type, 'h1', `${name} must not own the page h1`)
    assert.ok(buttons.length >= 1, `${name} should expose a refresh control`)
    for (const button of buttons) {
      assert.equal(button.props.type, 'button', `${name} button must be explicitly typed`)
      assert.ok(textOf(button).length > 0, `${name} button must have a text label`)
    }
  }
})

test('the status region is announced and every input is labelled', async () => {
  const { region, inputs, labels } = audit('workbench', await renderedWorkbench())
  assert.ok(region, 'the panel should be a section')
  assert.equal(region.props['aria-live'], 'polite', 'status changes must be announced')
  for (const input of inputs) {
    assert.ok(input.props.id, 'every input needs an id')
    const label = labels.find(node => node.props.htmlFor === input.props.id)
    assert.ok(label, `input ${input.props.id} needs a matching label`)
  }
})

test('the review panel announces changes and labels nothing implicitly', async () => {
  const { region, inputs, labels } = audit('review', await renderedReview())
  assert.ok(region)
  assert.equal(region.props['aria-live'], 'polite')
  assert.equal(inputs.length, 0, 'the read-only panel should not render inputs')
  assert.equal(labels.length, 0)
})

test('a degraded workbench keeps the same structural guarantees', async () => {
  const { region, buttons, headings } = audit('degraded', await renderedWorkbench(false))
  assert.equal(region?.props['aria-live'], 'polite')
  assert.ok(headings.every(heading => heading.type !== 'h1'))
  assert.equal(buttons.length, 2, 'refresh plus the workbook download control')
  const labels = buttons.map(button => textOf(button))
  assert.ok(labels.some(label => label.includes('refresh')))
  assert.ok(labels.some(label => label.includes('download')))
})

test('no interactive element is removed from the tab order', async () => {
  for (const tree of [await renderedWorkbench(), await renderedReview()]) {
    for (const node of elements(tree)) {
      if (node.props && 'tabIndex' in node.props) assert.notEqual(node.props.tabIndex, -1)
    }
  }
})
