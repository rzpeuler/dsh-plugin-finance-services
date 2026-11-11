import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { z } from 'zod'
import { createDataSourcesClient } from '../src/data/client-panel.js'
import { createDataRemoteContract } from '../src/data/remote.js'
import { CAPABILITIES, createDataSchemas } from '../src/data/contracts.js'

// Callback/resource/tree tests only; no Native Client, browser, DOM or visual verification.
const ADDRESS = 'dsh-resource://finance-data/current'
const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
const noRender = { createElement() { throw Error('Rendering is not part of this callback test') } }
const ok = value => ({ ok: true, value })
const raw = value => ({ catalogJson: JSON.stringify(value) })
const adapter = () => ({ id: 'TEST_ONLY-adapter', version: '1.0.0', sourceId: 'TEST_ONLY-source', label: 'TEST_ONLY adapter',
  testOnly: true, licenseClass: 'TEST_ONLY', credentialConfigured: false,
  status: { state: 'NOT_AUTHORIZED', verifiedAt: '2026-11-05T00:00:00Z', code: 'NOT_AUTHORIZED' },
  capabilities: [{ id: 'company.identity', markets: ['CN'], fields: ['name'], temporalModes: ['strict'], priority: 4, quality: 75 }] })
const snapshot = (patch = {}) => ({ revision: 4, capabilities: [...CAPABILITIES], adapters: [adapter()],
  bindings: [], diagnostics: { observerFailures: 0, disposalFailures: 0 }, commercialExecutionVerified: false, ...patch })
const binding = (patch = {}) => ({ adapterId: 'TEST_ONLY-adapter', sourceAllowlistKey: 'TEST_ONLY-source', scopeIds: ['TEST_ONLY-agent-1'],
  roleIds: ['finance-test-reader'], capabilities: ['company.identity'], markets: ['CN'], purposes: ['research'], temporalModes: ['strict'],
  priority: 10, minQuality: 50, enabled: true, allowTestOnly: false, ...patch })

function fixture(options = {}, React = noRender) {
  const effects = [], providers = new Map(), dictionaries = new Map()
  const calls = { catalog: 0, follow: 0, set: [], accepted: 0, streams: [], disposed: 0, ended: 0 }
  let active = true
  const namespace = {
    async catalog(request) { assert.deepEqual(request, {}); calls.catalog++; return options.catalog ? await options.catalog() : ok(raw(snapshot())) },
    async *follow(request, signal) {
      calls.follow++; assert.deepEqual(request, {}); assert.ok(signal instanceof AbortSignal)
      if (options.follow) yield* options.follow(signal)
      else yield raw(snapshot({ revision: 5 }))
    },
    async setBindings(request) { calls.set.push(request); return options.set ? await options.set(request) : ok({ status: 'APPLIED', revision: 5, error: null }) },
  }
  const remote = {
    $stream(spec) {
      calls.streams.push(spec)
      let disposed = false, controller
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
            } catch (error) { if (generation + 1 >= (options.generations ?? 1)) throw error }
            finally { controller.abort() }
          }
        },
        async dispose() { if (!disposed) { disposed = true; calls.disposed++; controller?.abort() } },
      }
    },
  }
  Object.defineProperty(remote, 'financeData', { get() { assert.ok(active, 'disposed namespace used'); return namespace } })
  const scoped = {
    remote,
    effect(callback) { const dispose = callback(); effects.push(dispose); return dispose },
    resources: { register(provider) { assert.equal(provider.protocol, 'finance-data'); providers.set(provider.protocol, provider); return () => providers.delete(provider.protocol) } },
    locale: { register(ns, value) { dictionaries.set(ns, value); return () => dictionaries.delete(ns) }, bind(ns) { return key => dictionaries.get(ns).en[key] } },
  }
  const client = createDataSourcesClient(React, z, createDataRemoteContract, createDataSchemas)
  const props = client.install(scoped)
  return { client, props, providers, dictionaries, calls,
    open(address = ADDRESS, signal = new AbortController().signal) { return providers.get('finance-data').open(address, { signal }) },
    async dispose() { for (const effect of effects.splice(0).reverse()) await effect(); active = false },
  }
}
async function values(iterable) { const result = []; for await (const value of iterable) result.push(value); return result }

test('self-contained client exposes only the canonical remote and resource props', async () => {
  const sandbox = { React: noRender, z, AbortController, TextEncoder, createDataSchemas, createDataRemoteContract }
  const client = vm.runInNewContext(`(${createDataSourcesClient.toString()})(React,z,createDataRemoteContract,createDataSchemas)`, sandbox)
  assert.deepEqual(Object.keys(client).sort(), ['Panel', 'install', 'remote'])
  assert.equal(client.remote.package, '@local/dsh-financial-services/data-api')
  assert.deepEqual(client.remote.descriptors.map(item => item.method), ['catalog', 'setBindings', 'follow'])
  const f = fixture()
  assert.deepEqual(Object.keys(f.props).sort(), ['dataAddress', 'dataCatalogAddress', 'dataT', 'updateDataPolicy'])
  assert.equal(f.props.dataAddress, ADDRESS)
  assert.equal(f.props.dataCatalogAddress, CATALOG_ADDRESS)
  assert.deepEqual(Object.keys(f.dictionaries.get('financial-data-ui').en), Object.keys(f.dictionaries.get('financial-data-ui').zh))
  await f.dispose()
})

test('resource decodes initial RemoteResult and raw follow frames once and disposes supervisor', async () => {
  const f = fixture()
  const result = await values(f.open())
  assert.deepEqual(result, [ok(snapshot()), ok(snapshot({ revision: 5 }))])
  assert.equal(f.calls.catalog, 1)
  assert.equal(f.calls.follow, 1)
  assert.equal(f.calls.accepted, 2)
  assert.equal(f.calls.streams[0].name, 'financial-services data')
  assert.equal(f.calls.disposed, 1)
  await f.dispose()
})

test('resource rejects malformed, credential-bearing and unknown catalog data', async () => {
  for (const value of [
    raw(snapshot({ adapters: [{ ...adapter(), credentialRef: 'private-reference' }] })),
    raw(snapshot({ adapters: [{ ...adapter(), endpoint: 'https://example.test' }] })),
    raw(snapshot({ capabilities: [...CAPABILITIES.slice(1), CAPABILITIES[1]] })),
    { catalogJson: '{' },
  ]) {
    const f = fixture({ catalog: () => ok(value), async *follow() {} })
    const result = await values(f.open())
    assert.equal(result.length, 1)
    assert.equal(result[0].ok, false)
    assert.match(result[0].error.code, /invalid-snapshot/)
    assert.doesNotMatch(result[0].error.message, /private-reference/)
    await f.dispose()
  }
})

test('policy callback sends complete bindings with expectedRevision CAS and never claims remote failure', async () => {
  const f = fixture()
  const bindings = [binding()]
  assert.deepEqual(await f.props.updateDataPolicy({ expectedRevision: 4, bindings }), { status: 'APPLIED', revision: 5, error: null })
  assert.deepEqual(f.calls.set, [{ expectedRevision: 4, bindingsJson: JSON.stringify(bindings) }])
  assert.equal(f.calls.catalog, 0, 'saving does not optimistically reread/cache the resource')
  await f.dispose()
  const failed = fixture({ set: () => ({ ok: false, error: { code: 'NOT_AUTHORIZED', message: 'TEST_ONLY denied' } }) })
  assert.equal((await failed.props.updateDataPolicy({ expectedRevision: 4, bindings: [] })).status, 'REMOTE_ERROR')
  await failed.dispose()
})

test('policy input rejects wildcards, duplicate grants, secrets and invalid corporate-action fields before RPC', async () => {
  const f = fixture()
  for (const input of [
    null, {}, { expectedRevision: -1, bindings: [] }, { expectedRevision: 4, bindings: [], rawApiKey: 'not-allowed' },
    { expectedRevision: 4, bindings: [binding({ credentialRef: 'private' })] },
    { expectedRevision: 4, bindings: [binding({ scopeIds: ['*'] })] },
    { expectedRevision: 4, bindings: [binding(), binding()] },
    { expectedRevision: 4, bindings: [binding({ capabilities: ['corporate.actions'] })] },
  ]) assert.equal((await f.props.updateDataPolicy(input)).status, 'INVALID_REQUEST')
  assert.equal(f.calls.set.length, 0)
  await f.dispose()
})

test('stale resource disables policy editing and foreign addresses never reach remote', async () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children: children.flat(Infinity).filter(value => value != null) } } },
    useState(initial) { return [initial, () => {}] }, useRef(current) { return { current } }, useId() { return 'stale-test' },
  }
  const f = fixture({}, React)
  assert.equal((await values(f.open('dsh-resource://finance-data/other')))[0].error.code, 'gateway/bad-request')
  assert.equal(f.calls.streams.length, 0)
  const tree = f.client.Panel({ useResource(address) {
    if (address === ADDRESS) return { status: 'stale', value: snapshot({ bindings: [binding()] }) }
    return { status: 'live', value: { agents: [{ id: 'finance-test-reader', writer: false, allowedMcpServers: ['TEST_ONLY-source'] }], workers: [] } }
  }, dataT: key => key, updateDataPolicy: f.props.updateDataPolicy })
  const descendants = node => node == null ? [] : Array.isArray(node) ? node.flatMap(descendants) : typeof node === 'object'
    ? [node, ...descendants(node.props?.children)] : []
  const controls = descendants(tree).filter(node => ['input', 'select', 'button'].includes(node.type))
  assert.ok(controls.length > 0)
  assert.ok(controls.every(node => node.props.disabled), 'stale snapshots never leave editable policy controls')
  await f.dispose()
})
