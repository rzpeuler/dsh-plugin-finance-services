import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { z } from 'zod'
import { createDataSourcesClient } from '../src/data/client-panel.js'
import { createDataRemoteContract } from '../src/data/remote.js'
import { CAPABILITIES, createDataSchemas } from '../src/data/contracts.js'

// Narrow Node callback/resource/tree tests only. No Native Client, browser, DOM or visual verification.
const ADDRESS = 'dsh-resource://finance-data/current'
const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
const noRender = { createElement() { throw Error('Rendering is not part of this callback test') } }
const ok = value => ({ ok: true, value })
const raw = value => ({ catalogJson: JSON.stringify(value) })
const adapter = () => ({ id: 'TEST_ONLY-adapter', version: '1.0.0', sourceId: 'TEST_ONLY-source', label: 'TEST_ONLY adapter',
  testOnly: true, licenseClass: 'TEST_ONLY', credentialConfigured: false,
  status: { state: 'NOT_AUTHORIZED', verifiedAt: '2026-11-05T00:00:00Z', code: 'NOT_AUTHORIZED' },
  capabilities: [{ id: 'company.identity', markets: ['US'], fields: ['name'], quality: 75, priority: 4, pointInTime: true }] })
const snapshot = (patch = {}) => ({ contractVersion: '1.0.0', revision: 2, capabilities: [...CAPABILITIES], adapters: [adapter()],
  bindings: [], diagnostics: { observerFailures: 0, disposalFailures: 0 }, commercialExecutionVerified: false, ...patch })
const binding = (patch = {}) => ({ adapterId: 'TEST_ONLY-adapter', sourceAllowlistKey: 'TEST_ONLY-source', scopeIds: ['TEST_ONLY-agent-1'],
  roleIds: ['finance-test-reader'], capabilities: ['company.identity'], markets: ['US'], purposes: ['research'], priority: 10,
  minQuality: 50, enabled: true, allowTestOnly: false, ...patch })

function fixture(options = {}, React = noRender) {
  const effects = []
  const providers = new Map()
  const dictionaries = new Map()
  const calls = { catalog: 0, follow: 0, set: [], accepted: 0, streams: [], disposed: 0, ended: 0 }
  let active = true
  const namespace = {
    async catalog(request) { assert.deepEqual(request, {}); calls.catalog++; return options.catalog ? await options.catalog() : ok(raw(snapshot())) },
    async *follow(request, signal) {
      calls.follow++
      assert.deepEqual(request, {})
      assert.ok(signal instanceof AbortSignal)
      if (options.follow) yield* options.follow(signal)
      else yield raw(snapshot({ revision: 3 }))
    },
    async setBindings(request) { calls.set.push(request); return options.set ? await options.set(request) : ok({ status: 'APPLIED', revision: 3, error: null }) },
  }
  const remote = {
    $mount() { throw Error('Child must not mount remote') },
    $stream(spec) {
      calls.streams.push(spec)
      let disposed = false
      let controller
      return {
        async *[Symbol.asyncIterator]() {
          for (let generation = 0; generation < (options.generations ?? 1); generation++) {
            if (disposed) return
            controller = new AbortController()
            try {
              for await (const value of spec.open(controller.signal)) {
                if (disposed) return
                yield { value, signal: controller.signal, generation, accept() { calls.accepted++ } }
              }
              if (!disposed) { calls.ended++; assert.ok(spec.ended() instanceof Error) }
            } catch (error) {
              if (generation + 1 >= (options.generations ?? 1)) throw error
            } finally { controller.abort() }
          }
        },
        async dispose() { if (disposed) return; disposed = true; calls.disposed++; controller?.abort() },
      }
    },
  }
  Object.defineProperty(remote, 'financeData', { get() { assert.ok(active, 'disposed namespace used'); return namespace } })
  const scoped = {
    remote,
    effect(callback) { const dispose = callback(); effects.push(dispose); return dispose },
    resources: { register(provider) { assert.equal(provider.protocol, 'finance-data'); assert.equal(providers.size, 0); providers.set(provider.protocol, provider); return () => providers.delete(provider.protocol) } },
    locale: {
      register(ns, value) { assert.equal(ns, 'financial-data-ui'); dictionaries.set(ns, value); return () => dictionaries.delete(ns) },
      bind(ns) { assert.ok(dictionaries.has(ns)); return key => dictionaries.get(ns).en[key] },
    },
    slots: { register() { throw Error('Child must not register Slots') } },
    inject() { throw Error('Parent owns namespace injection') },
  }
  const root = Object.create(scoped)
  root.remote = Object.create(remote)
  Object.defineProperty(root.remote, 'financeData', { get() { throw Error('remote.financeData requires explicit injected namespace') } })
  const client = createDataSourcesClient(React, z, createDataRemoteContract, createDataSchemas)
  const props = client.install(scoped)
  return { client, props, root, scoped, providers, dictionaries, calls,
    open(address = ADDRESS, signal = new AbortController().signal) { return providers.get('finance-data').open(address, { signal }) },
    async dispose() { for (const effect of effects.splice(0).reverse()) await effect(); active = false },
  }
}
async function values(iterable) { const result = []; for await (const value of iterable) result.push(value); return result }

test('self-contained serialized factory and exact parent-owned API/namespace boundary', async () => {
  const sandbox = { React: noRender, z, AbortController, TextEncoder, createDataSchemas, createDataRemoteContract }
  const client = vm.runInNewContext(`(${createDataSourcesClient.toString()})(React,z,createDataRemoteContract,createDataSchemas)`, sandbox)
  assert.deepEqual(Object.keys(client).sort(), ['Panel', 'install', 'remote'])
  assert.equal(client.remote.package, '@local/dsh-financial-services/data-api-v1')
  const f = fixture()
  assert.deepEqual(Object.keys(f.props).sort(), ['dataAddress', 'dataCatalogAddress', 'dataT', 'updateDataPolicy'])
  assert.equal(f.props.dataAddress, ADDRESS)
  assert.equal(f.props.dataCatalogAddress, CATALOG_ADDRESS)
  assert.throws(() => f.root.remote.financeData, /requires explicit injected namespace/)
  const dictionaries = f.dictionaries.get('financial-data-ui')
  assert.deepEqual(Object.keys(dictionaries.en), Object.keys(dictionaries.zh))
  assert.ok(Object.values(dictionaries.en).every(value => typeof value === 'string'))
  assert.ok(Object.values(dictionaries.zh).every(value => typeof value === 'string'))
  await f.dispose()
})

test('unary RemoteResult and raw follow decode exactly once; native supervisor owns acceptance/disposal', async () => {
  const f = fixture()
  const result = await values(f.open())
  assert.deepEqual(result, [ok(snapshot()), ok(snapshot({ revision: 3 }))])
  assert.equal(result[1].value.ok, undefined)
  assert.equal(f.calls.accepted, 2)
  assert.equal(f.calls.disposed, 1)
  assert.equal(f.calls.streams.length, 1)
  assert.equal(f.calls.ended, 1)
  await f.dispose()
})

test('supervised reopen reads a fresh baseline and preserves failure before a new generation', async () => {
  let generation = 0
  const f = fixture({ generations: 2,
    catalog: () => ok(raw(snapshot({ revision: ++generation }))),
    async *follow() {
      if (generation === 1) throw Object.assign(Error('TEST_ONLY carrier failure'), { code: 'TEST_ONLY_DISCONNECTED' })
      // The Host/supervisor may coalesce intermediate invalidations; UI forwards only complete DTOs supplied.
      yield raw(snapshot({ revision: 20 }))
    },
  })
  const result = await values(f.open())
  assert.equal(result.length, 4)
  assert.equal(result[0].value.revision, 1)
  assert.equal(result[1].error.code, 'TEST_ONLY_DISCONNECTED')
  assert.equal(result[2].value.revision, 2)
  assert.equal(result[3].value.revision, 20)
  assert.equal(f.calls.catalog, 2)
  assert.equal(f.calls.streams.length, 1, 'No second local reconnect supervisor')
  assert.equal(f.calls.accepted, 4)
  await f.dispose()
})

test('strict bounded snapshot rejects malformed JSON, unknown fields, secrets, IDs and incompatible metadata', async () => {
  const bad = [
    { catalogJson: '{' },
    { catalogJson: ' '.repeat(2000001) },
    { ...raw(snapshot()), credentialRef: 'private' },
    raw(snapshot({ extra: true })), raw(snapshot({ commercialExecutionVerified: true })),
    raw(snapshot({ capabilities: [...CAPABILITIES.slice(1), CAPABILITIES[1]] })),
    raw(snapshot({ revision: -1 })), raw(snapshot({ revision: Number.MAX_SAFE_INTEGER + 1 })),
    raw(snapshot({ adapters: Array.from({ length: 65 }, adapter) })),
    raw(snapshot({ adapters: [{ ...adapter(), credentialRef: 'private-reference' }] })),
    raw(snapshot({ adapters: [{ ...adapter(), endpoint: 'https://example.test' }] })),
    raw(snapshot({ adapters: [{ ...adapter(), testOnly: false }] })),
    raw(snapshot({ adapters: [{ ...adapter(), status: { ...adapter().status, rawApiKey: 'not-allowed' } }] })),
    raw(snapshot({ bindings: [binding({ scopeIds: ['*'] })] })),
    raw(snapshot({ bindings: [binding({ priority: 1000001 })] })),
    raw(snapshot({ diagnostics: { observerFailures: 0, disposalFailures: 0, unknown: true } })),
  ]
  for (const value of bad) {
    const f = fixture({ catalog: () => ok(value), async *follow() {} })
    const result = await values(f.open())
    assert.equal(result.length, 1)
    assert.equal(result[0].ok, false)
    assert.equal(result[0].error.code, 'finance-data/invalid-snapshot')
    assert.doesNotMatch(result[0].error.message, /private-reference|rawApiKey/)
    await f.dispose()
  }
})

test('Remote failure, raw unary and incorrectly wrapped follow remain failures; optional diagnostics accepted', async () => {
  const failure = { ok: false, error: { code: 'NOT_AUTHORIZED', message: 'TEST_ONLY no authorization', details: {} } }
  const f = fixture({ catalog: () => failure, async *follow() {
    yield ok(raw(snapshot())) // Wrong transport shape must not be silently accepted.
    yield raw(snapshot({ diagnostics: { observerFailures: 1, disposalFailures: 2, transition: 'TEST_ONLY-transition' } }))
  } })
  const result = await values(f.open())
  assert.deepEqual(result[0], failure)
  assert.equal(result[1].ok, false)
  assert.equal(result[2].value.diagnostics.transition, 'TEST_ONLY-transition')
  await f.dispose()
  const unary = fixture({ catalog: () => raw(snapshot()), async *follow() {} })
  assert.equal((await values(unary.open()))[0].ok, false)
  await unary.dispose()
})

test('production policy callback passes expected revision and complete serialized binding; resource remains sole truth', async () => {
  const f = fixture()
  const before = await values(f.open())
  const bindings = [binding()]
  const result = await f.props.updateDataPolicy({ expectedRevision: 2, bindings })
  assert.deepEqual(result, { status: 'APPLIED', revision: 3, error: null })
  assert.deepEqual(f.calls.set, [{ expectedRevision: 2, bindingsJson: JSON.stringify(bindings) }])
  assert.equal(f.calls.catalog, 1, 'Policy save does not trigger a second snapshot read/cache')
  assert.equal(before[0].value.bindings.length, 0)
  const after = await values(f.open())
  assert.equal(after[0].value.bindings.length, 0, 'No optimistic assignment of APPLIED policy')
  assert.deepEqual(bindings, [binding()])
  await f.dispose()
})

test('policy input outer shape, duplicate grants, wildcards, bounds and credential fields are rejected before RPC', async () => {
  const f = fixture()
  for (const request of [
    null, {}, { expectedRevision: -1, bindings: [] }, { expectedRevision: 2, bindings: [], rawApiKey: 'not-allowed' },
    { expectedRevision: 2, bindings: [binding({ credentialRef: 'not-allowed' })] },
    { expectedRevision: 2, bindings: [binding({ scopeIds: ['*'] })] },
    { expectedRevision: 2, bindings: [binding({ roleIds: ['finance-test-reader', 'finance-test-reader'] })] },
    { expectedRevision: 2, bindings: [binding({ minQuality: 101 })] },
    { expectedRevision: 2, bindings: [binding({ priority: 1.1 })] },
    { expectedRevision: 2, bindings: Array.from({ length: 257 }, binding) },
    { expectedRevision: 2, bindings: [binding(), binding()] },
  ]) assert.equal((await f.props.updateDataPolicy(request)).status, 'INVALID_REQUEST')
  assert.equal(f.calls.set.length, 0)
  await f.dispose()
})

test('policy Host CONFLICT/REJECTED/DISPOSED and remote NOT_AUTHORIZED are surfaced without success claims', async () => {
  for (const status of ['CONFLICT', 'REJECTED', 'DISPOSED']) {
    const value = { status, revision: 9, error: { code: 'TEST_ONLY_DENIED', message: 'TEST_ONLY Host decision' } }
    const f = fixture({ set: () => ok(value) })
    assert.deepEqual(await f.props.updateDataPolicy({ expectedRevision: 2, bindings: [] }), value)
    await f.dispose()
  }
  const f = fixture({ set: () => ({ ok: false, error: { code: 'NOT_AUTHORIZED', message: 'TEST_ONLY no permission' } }) })
  const result = await f.props.updateDataPolicy({ expectedRevision: 2, bindings: [] })
  assert.equal(result.status, 'REMOTE_ERROR')
  assert.equal(result.error.code, 'NOT_AUTHORIZED')
  await f.dispose()
})

test('pending policy callback becomes CANCELLED after disposal, including remote rejection; old callback never RPCs', async () => {
  for (const reject of [false, true]) {
    let release
    const pending = new Promise((resolve, fail) => { release = reject ? () => fail(Error('TEST_ONLY failure')) : () => resolve(ok({ status: 'APPLIED', revision: 3, error: null })) })
    const f = fixture({ set: () => pending })
    const call = f.props.updateDataPolicy({ expectedRevision: 2, bindings: [] })
    await f.dispose()
    release()
    assert.equal((await call).status, 'CANCELLED')
    assert.equal((await f.props.updateDataPolicy({ expectedRevision: 2, bindings: [] })).status, 'CANCELLED')
    assert.equal(f.calls.set.length, 1)
    assert.equal(f.providers.size, 0)
    assert.equal(f.dictionaries.size, 0)
  }
})

test('resource rejects foreign address, aborts exactly owned stream and unregisters on scope disposal', async () => {
  let stopped = false
  const f = fixture({ async *follow(signal) {
    try { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })) }
    finally { stopped = true }
  } })
  assert.equal((await values(f.open('dsh-resource://finance-data/other')))[0].error.code, 'gateway/bad-request')
  assert.equal(f.calls.streams.length, 0)
  const controller = new AbortController()
  const stream = f.open(ADDRESS, controller.signal)
  assert.equal((await stream.next()).value.ok, true)
  const waiting = stream.next()
  await Promise.resolve()
  controller.abort()
  await waiting
  assert.equal(stopped, true)
  assert.equal(f.calls.disposed, 1)
  await stream.return()
  const second = f.open()
  await second.next()
  const pending = second.next()
  await Promise.resolve()
  await f.dispose()
  await pending
  assert.equal(f.calls.disposed, 2)
  assert.equal(f.providers.size, 0)
  assert.equal(f.dictionaries.size, 0)
})

// A small function-tree harness verifies handlers/request shapes, not browser behavior.
function treeReact() {
  const state = []
  let cursor = 0
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity).filter(value => value != null) } } },
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }] },
    useRef(initial) { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index] },
    useId() { cursor++; return 'TEST_ONLY-control' },
  }
  return { React, reset() { state.length = 0; cursor = 0 }, render(Component, props) { cursor = 0; return Component(props) } }
}
function nodes(tree) {
  if (typeof tree !== 'object' || !tree) return []
  return [tree, ...(tree.props?.children ?? []).flatMap(nodes)]
}
function text(tree) { return typeof tree === 'object' && tree ? (tree.props?.children ?? []).map(text).join(' ') : String(tree) }

test('Panel form filters writers/empty grants and builds one explicit SourceBinding from real catalogue', async () => {
  const r = treeReact()
  const f = fixture({}, r.React)
  const roles = [
    { id: 'finance-test-reader', name: 'TEST_ONLY reader', writer: false, allowedMcpServers: ['TEST_ONLY-source'] },
    { id: 'finance-test-writer', name: 'TEST_ONLY writer', writer: true, allowedMcpServers: ['writer-source'] },
    { id: 'finance-test-empty', name: 'TEST_ONLY empty', writer: false, allowedMcpServers: [] },
  ]
  const requests = []
  const props = { ...f.props, updateDataPolicy: async input => { requests.push(input); return { status: 'REJECTED', error: { code: 'NOT_AUTHORIZED', message: 'TEST_ONLY denial' } } },
    useResource(address) { return { status: 'live', value: address === ADDRESS ? snapshot() : { agents: roles.slice(0, 2), workers: roles.slice(2) } } } }
  const render = () => r.render(f.client.Panel, props)
  let tree = render()
  const roleSelect = nodes(tree).find(node => node.type === 'select' && node.props.id.endsWith('-roleId'))
  assert.deepEqual(roleSelect.props.children.filter(node => node.type === 'option').map(node => node.props.value), ['', 'finance-test-reader'])
  for (const [key, value] of Object.entries({ adapterId: 'TEST_ONLY-adapter', roleId: 'finance-test-reader', source: 'TEST_ONLY-source',
    capability: 'company.identity', scope: 'TEST_ONLY-agent-1', market: 'US', priority: '7', minQuality: '50' })) {
    tree = render()
    nodes(tree).find(node => node.props?.id === `TEST_ONLY-control-${key}`).props.onChange({ target: { value } })
  }
  tree = render()
  assert.match(text(tree), /Credential configured does not mean authenticated/)
  assert.match(text(tree), /NOT_AUTHORIZED/)
  assert.match(text(tree), /Capability directory \(not availability\)/)
  nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await Promise.resolve()
  assert.deepEqual(requests, [{ expectedRevision: 2, bindings: [binding({ priority: 7 })] }])
  tree = render()
  assert.match(text(tree), /REJECTED: NOT_AUTHORIZED/)
  assert.doesNotMatch(text(tree), /Host APPLIED/)
  assert.equal(nodes(tree).some(node => node.type === 'input' && /password|endpoint|token|oauth|apikey/i.test(node.props.id)), false)
  await f.dispose()
})

test('Panel distinguishes loading, unavailable, stale, live-empty and disables every action without live resource', async () => {
  for (const status of ['loading', 'none', 'failed', 'live']) {
    const r = treeReact()
    const f = fixture({}, r.React)
    const tree = r.render(f.client.Panel, { ...f.props, useResource(address) {
      return address === ADDRESS ? { status, value: snapshot({ adapters: [] }), failure: status === 'failed' ? { code: 'TEST_ONLY_ERROR', message: 'TEST_ONLY disconnected' } : null }
        : { status: 'none', value: null }
    } })
    const content = text(tree)
    if (status === 'loading') assert.match(content, /Reading data sources/)
    if (status === 'none') assert.match(content, /Data resource unavailable/)
    if (status === 'failed') assert.match(content, /Displayed data is stale/)
    assert.match(content, /No adapters are registered/)
    assert.equal(nodes(tree).filter(node => ['input', 'select', 'button'].includes(node.type)).every(node => node.props.disabled), true)
    await f.dispose()
  }
})

test('existing binding row priority, enable/disable and explicit remove build complete CAS successors', async () => {
  const r = treeReact()
  const f = fixture({}, r.React)
  const current = snapshot({ bindings: [binding(), binding({ scopeIds: ['TEST_ONLY-agent-2'], priority: 20 })] })
  const tree = r.render(f.client.Panel, { ...f.props, useResource(address) {
    return { status: 'live', value: address === ADDRESS ? current : { agents: [], workers: [] } }
  } })
  const row = nodes(tree).find(node => typeof node.type === 'function' && node.props.index === 0)
  assert.ok(row)
  const requests = []
  const rowProps = { ...row.props, save: input => requests.push(input) }
  // Start a separate component hook frame; no React reconciliation is simulated.
  r.reset()
  let output = r.render(row.type, rowProps)
  nodes(output).find(node => node.type === 'input').props.onChange({ target: { value: '99' } })
  output = r.render(row.type, rowProps)
  nodes(output).find(node => node.type === 'button' && text(node) === 'Apply priority').props.onClick()
  nodes(output).find(node => node.type === 'button' && text(node) === 'Disable binding').props.onClick()
  nodes(output).find(node => node.type === 'button' && text(node) === 'Remove binding').props.onClick()
  assert.deepEqual(requests, [
    { expectedRevision: 2, bindings: [binding({ priority: 99 }), current.bindings[1]] },
    { expectedRevision: 2, bindings: [binding({ enabled: false }), current.bindings[1]] },
    { expectedRevision: 2, bindings: [current.bindings[1]] },
  ])
  assert.equal(current.bindings[0].priority, 10, 'Row does not mutate authoritative snapshot')
  output = r.render(row.type, { ...rowProps, live: false })
  assert.ok(nodes(output).filter(node => ['input', 'button'].includes(node.type)).every(node => node.props.disabled))
  await f.dispose()
})
