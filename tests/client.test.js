import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { createFinanceClient } from '../src/client-factory.js'
import { createFinanceContract } from '../src/contract.js'
import { z } from 'zod'

// These tests exercise only plugin callbacks and registration/resource ownership.
// No component rendering, DOM emulation, browser interaction or visual assertions.
const React = Object.freeze({ createElement() { throw new Error('These Node tests must not render components') } })
const ADDRESS = 'dsh-resource://finance-workspace/current'
const PACKAGE = '@local/dsh-financial-services'
const SNAPSHOT = Object.freeze({
  version: '1', stage: 'P1', revision: 3, onboardingVersion: 0,
  binding: null, workspaceStatus: 'UNBOUND', error: null, limitations: ['P1 only'],
})
const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
// TEST_ONLY fixtures are callback inputs, never a rendering or native-runtime simulation.
const role = (index, worker = false) => ({
  id: `finance-test-${worker ? 'worker' : 'main'}-${index}`, kind: worker ? 'worker' : 'main', slug: `TEST_ONLY-${index}`,
  name: `TEST_ONLY ${worker ? 'Worker' : 'Agent'} ${index}`, description: 'TEST_ONLY role description',
  parentId: worker ? `finance-test-main-${Math.floor(index / 3)}` : null, writer: worker && index % 3 === 2, shellRestricted: true,
  builtinTools: ['read'], allowedMcpServers: [], workerPresetIds: worker ? [] : Array.from({ length: 3 }, (_, offset) => `finance-test-worker-${index * 3 + offset}`),
  skillNames: ['TEST_ONLY-skill-0'], sourcePath: `TEST_ONLY/${index}.yaml`, sourceSha256: 'TEST_ONLY-source-sha', adaptedPromptSha256: 'TEST_ONLY-prompt-sha',
  mountStatus: index === 0 ? 'UNAVAILABLE' : 'AVAILABLE', diagnostic: index === 0 ? 'TEST_ONLY native mount diagnostic' : null,
})
const CATALOG = Object.freeze({
  stage: 'P2', sourceTreeSha256: 'TEST_ONLY-tree-sha',
  agents: Array.from({ length: 10 }, (_, index) => role(index)), workers: Array.from({ length: 30 }, (_, index) => role(index, true)),
  skills: Array.from({ length: 63 }, (_, index) => ({ name: `TEST_ONLY-skill-${index}`, description: 'TEST_ONLY skill description', assetStatus: index ? 'AVAILABLE' : 'BLOCKED', issues: index ? [] : ['TEST_ONLY missing template'] })),
  commands: Array.from({ length: 41 }, (_, index) => ({ id: `TEST_ONLY-command-${index}`, name: `TEST_ONLY Command ${index}`, sourcePath: `TEST_ONLY/${index}.md`, targetPresetIds: ['finance-test-main-1', 'finance-test-main-2'], selectionRequired: true })),
  steering: Array.from({ length: 29 }, (_, index) => ({ id: `TEST_ONLY-steering-${index}`, targetPresetId: `finance-test-main-${index % 10}`, title: 'TEST_ONLY steering title' })),
  limitations: ['TEST_ONLY catalogue limitation'],
})
const DRAFT = Object.freeze({ status: 'DRAFT_READY', workspaceId: 'TEST_ONLY-workspace', agentPreset: 'finance-test-main', prompt: 'TEST_ONLY unsent prompt', whenDraftExists: 'keep', autoSubmit: false, error: null })
const OK = value => ({ ok: true, value })
const FAILURE = { ok: false, error: { code: 'gateway/internal', message: 'TEST_ONLY failure', details: {} } }
function contractFactory() { return { remote: { package: '@local/dsh-financial-services', descriptors: [] } } }

function fixture(options = {}) {
  const effects = []
  const entries = new Map()
  const providers = new Map()
  const dictionaries = new Map()
  const calls = { mount: [], bind: [], snapshot: [], catalog: [], prepare: [], start: [], follow: [], pick: 0, panel: [], streams: [], accepted: 0, streamDisposals: 0 }
  const ctx = {
    effect(callback) {
      const dispose = callback()
      effects.push(dispose)
      return dispose
    },
    slots: {
      inject(name, callback) {
        const dispose = callback()
        effects.push(dispose)
        return dispose
      },
      register(registration, Component) {
        const id = `${registration.name}:${registration.key ?? registration.id}`
        assert.equal(entries.has(id), false, `duplicate entry ${id}`)
        entries.set(id, { registration, Component })
        return () => { entries.delete(id) }
      },
    },
    resources: {
      register(provider) {
        assert.equal(providers.has(provider.protocol), false)
        providers.set(provider.protocol, provider)
        return () => { providers.delete(provider.protocol) }
      },
    },
    locale: {
      register(namespace, dicts) {
        dictionaries.set(namespace, dicts)
        return () => { dictionaries.delete(namespace) }
      },
      bind(namespace) { return key => dictionaries.get(namespace).en[key] },
    },
    uiWorkspace: {
      async pickDirectory() { calls.pick++; return options.directory ?? 'C:\\TEST_ONLY' },
      startSession(workspaceId, input) { calls.start.push({ workspaceId, input }); return options.start?.() },
      prompt() { throw new Error('Draft callbacks must never prompt or submit') },
      submit() { throw new Error('Draft callbacks must never prompt or submit') },
    },
    layout: { selectPanel(panel) { calls.panel.push(panel) } },
    remote: {
      async $mount(remote) {
        calls.mount.push(remote)
        if (options.mount) await options.mount()
        effects.push(() => { calls.unmounted = true })
      },
      financeOperations: {
        async snapshot(request) { calls.snapshot.push(request); return options.snapshot ?? OK(SNAPSHOT) },
        async catalog(request) { calls.catalog.push(request); return typeof options.catalog === 'function' ? options.catalog() : options.catalog ?? OK(CATALOG) },
        async prepareDraft(request) { calls.prepare.push(request); return typeof options.prepare === 'function' ? options.prepare() : options.prepare ?? OK(DRAFT) },
        async bindWorkspace(request) { calls.bind.push(request); return options.bind ?? OK({ status: 'BOUND', snapshot: SNAPSHOT, error: null }) },
        async *follow(request, signal) {
          calls.follow.push({ request, signal })
          if (options.follow) { yield* options.follow(signal); return }
          yield OK({ ...SNAPSHOT, revision: 4 })
        },
      },
      $stream(spec) {
        calls.streams.push(spec)
        const abort = new AbortController()
        let disposed = false
        return {
          async *[Symbol.asyncIterator]() {
            for await (const value of spec.open(abort.signal)) {
              if (abort.signal.aborted) return
              yield { value, generation: 1, signal: abort.signal, accept() { calls.accepted++ } }
            }
          },
          async dispose() {
            if (disposed) return
            disposed = true
            calls.streamDisposals++
            abort.abort()
          },
        }
      },
    },
  }
  return {
    ctx, entries, providers, dictionaries, calls,
    face() { return entries.get('main:financial-services').registration.inject() },
    async dispose() { for (const effect of effects.splice(0).reverse()) await effect() },
  }
}

async function started(options) {
  const f = fixture(options)
  const plugin = createFinanceClient(React, {}, contractFactory)
  await plugin.apply(f.ctx)
  return { ...f, plugin }
}

test('factory materializes through the parent ModuleLoader wrapper with only React/Zod requests', async () => {
  const names = []
  let plugin
  const sandbox = {
    window: { __ModuleLoader__: { load({ id, factory }) {
      assert.equal(id, PACKAGE)
      plugin = factory(name => {
        names.push(name)
        if (name === 'react') return React
        if (name === 'zod') return { z: {} }
        throw new Error(`unexpected request ${name}`)
      })
    } } },
    AbortController,
  }
  vm.runInNewContext(`const createFinanceContract = ${contractFactory.toString()}; const createFinanceClient = ${createFinanceClient.toString()}; window.__ModuleLoader__.load({id:'${PACKAGE}',factory(require){return createFinanceClient(require('react'),require('zod').z,createFinanceContract)}})`, sandbox)
  assert.deepEqual(names, ['react', 'zod'])
  assert.deepEqual([...plugin.inject], ['slots', 'remote', 'resources', 'uiWorkspace', 'layout', 'locale'])
  const f = fixture()
  await plugin.apply(f.ctx)
  assert.equal(f.entries.size, 4)
  await f.dispose()
})

test('mount completes before registering resources, dictionaries or slots', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const f = fixture({ mount: () => pending })
  const applying = createFinanceClient(React, {}, contractFactory).apply(f.ctx)
  assert.equal(f.calls.mount.length, 1)
  assert.equal(f.entries.size, 0)
  assert.equal(f.providers.size, 0)
  assert.equal(f.dictionaries.size, 0)
  release()
  await applying
  await f.dispose()
})

test('failed mount does not leave partial registrations', async () => {
  const f = fixture({ mount: () => { throw new Error('TEST_ONLY mount failure') } })
  await assert.rejects(createFinanceClient(React, {}, contractFactory).apply(f.ctx), /mount failure/)
  assert.equal(f.entries.size, 0)
  assert.equal(f.providers.size, 0)
  assert.equal(f.dictionaries.size, 0)
})

test('one global sidebar id matches a new main key; config and activation belong only to this package', async () => {
  const f = await started()
  assert.deepEqual([...f.entries.keys()], [
    'main:financial-services', 'sidebar.panellist:financial-services',
    `plugins.bundle.activation:${PACKAGE}`, `plugins.bundle.config:${PACKAGE}`,
  ])
  const main = f.entries.get('main:financial-services')
  const config = f.entries.get(`plugins.bundle.config:${PACKAGE}`)
  assert.equal(main.Component, config.Component, 'shared component identity is stable at registration')
  for (const { registration, Component } of f.entries.values()) {
    assert.equal(typeof Component, 'function')
    assert.equal(registration.locale, 'financial-services')
    if (!registration.inject) continue
    const face = registration.inject()
    assert.deepEqual(Object.keys(face).sort(), ['bindWorkspace', 'openWorkbench', 'pickDirectory', 'startDraft'])
    assert.ok(Object.values(face).every(value => typeof value === 'function'))
  }
  assert.equal(f.entries.get('sidebar.panellist:financial-services').registration.label(), 'Financial Services')
  await f.dispose()
})

test('factory dictionaries have matching bilingual keys and package locale files contain metadata only', async () => {
  const f = await started()
  const { en, zh } = f.dictionaries.get('financial-services')
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  for (const value of [...Object.values(en), ...Object.values(zh)]) assert.equal(typeof value, 'string')
  assert.match(zh.scope, /尚未开放/)
  assert.match(en.scope, /not yet available/)
  for (const language of ['en', 'zh']) {
    const metadata = JSON.parse(await readFile(new URL(`../locale/${language}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(Object.keys(metadata), ['meta'])
    assert.ok(metadata.meta.title && metadata.meta.description)
  }
  const icon = await readFile(new URL('../icon.svg', import.meta.url), 'utf8')
  assert.match(icon, /<svg[^>]+viewBox="0 0 64 64"/)
  assert.equal(/<script|<image|https?:\/\/(?!www\.w3\.org)/i.test(icon), false)
  await f.dispose()
})

test('binding callback preserves the exact Host request and native RemoteResult without unwrapping failure', async () => {
  for (const response of [FAILURE, OK({ status: 'REJECTED', snapshot: SNAPSHOT, error: { code: 'TEST_ONLY', message: 'no' } })]) {
    const f = await started({ bind: response })
    const request = { path: 'C:\\TEST_ONLY existing', expectedRevision: 3 }
    assert.equal(await f.face().bindWorkspace(request), response)
    assert.equal(f.calls.bind[0], request)
    await f.dispose()
  }
})

test('directory selection uses native uiWorkspace and navigation uses layout only', async () => {
  const f = await started()
  assert.equal(await f.face().pickDirectory(), 'C:\\TEST_ONLY')
  assert.equal(f.calls.pick, 1)
  f.face().openWorkbench()
  assert.deepEqual(f.calls.panel, ['financial-services'])
  await f.dispose()
})

test('resource passes through native result frames, including failures, without inventing Host facts', async () => {
  const f = await started({ snapshot: FAILURE })
  const controller = new AbortController()
  const provider = f.providers.get('finance-workspace')
  const frames = []
  for await (const frame of provider.open(ADDRESS, { signal: controller.signal })) frames.push(frame)
  assert.equal(frames[0], FAILURE)
  assert.equal(frames[1].ok, true)
  assert.equal(frames[1].value.revision, 4)
  assert.deepEqual(f.calls.snapshot, [{}])
  assert.deepEqual(f.calls.follow[0].request, {})
  assert.equal(f.calls.accepted, 2)
  assert.equal(f.calls.streamDisposals, 1)
  await f.dispose()
})

test('native supervisor opener reads a new baseline on every physical generation', async () => {
  const f = await started()
  const provider = f.providers.get('finance-workspace')
  for await (const frame of provider.open(ADDRESS, { signal: new AbortController().signal })) assert.equal(frame.ok, true)
  const spec = f.calls.streams[0]
  assert.equal(typeof spec.ended(false), 'object')
  const second = []
  for await (const frame of spec.open(new AbortController().signal)) second.push(frame)
  assert.equal(f.calls.snapshot.length, 2)
  assert.equal(f.calls.follow.length, 2)
  assert.equal(second[0].value, SNAPSHOT)
  // This asserts delegation and per-generation baselines, not the native supervisor's reconnect implementation.
  await f.dispose()
})

test('stream exceptions first produce a failed resource frame and remain visible to native retry classification', async () => {
  const error = new Error('TEST_ONLY carrier lost')
  const f = await started({ follow: async function* () { throw error } })
  const frames = []
  for await (const frame of f.providers.get('finance-workspace').open(ADDRESS, { signal: new AbortController().signal })) frames.push(frame)
  assert.equal(frames[0].ok, true)
  assert.equal(frames[1].ok, false)
  assert.match(frames[1].error.message, /carrier lost/)
  const physical = f.calls.streams[0].open(new AbortController().signal)
  await physical.next()
  assert.equal((await physical.next()).value.ok, false)
  await assert.rejects(physical.next(), /carrier lost/)
  await f.dispose()
})

test('resource abort closes an active native stream and prevents late frames', async () => {
  let entered
  const following = new Promise(resolve => { entered = resolve })
  const f = await started({ follow: async function* (signal) {
    entered(signal)
    await new Promise(resolve => {
      if (signal.aborted) resolve()
      else signal.addEventListener('abort', resolve, { once: true })
    })
    yield OK({ ...SNAPSHOT, revision: 999 })
  } })
  const controller = new AbortController()
  const iterator = f.providers.get('finance-workspace').open(ADDRESS, { signal: controller.signal })
  assert.equal((await iterator.next()).value.value.revision, 3)
  const pending = iterator.next()
  const nativeSignal = await following
  controller.abort()
  assert.equal((await pending).done, true)
  assert.equal(nativeSignal.aborted, true)
  assert.equal(f.calls.streamDisposals, 1)
  await f.dispose()
})

test('pre-aborted and unsupported resource addresses do not call Host methods', async () => {
  const f = await started()
  const provider = f.providers.get('finance-workspace')
  const cancelled = new AbortController()
  cancelled.abort()
  assert.deepEqual(await Array.fromAsync(provider.open(ADDRESS, { signal: cancelled.signal })), [])
  const [failure] = await Array.fromAsync(provider.open('dsh-resource://finance-workspace/unsupported', { signal: new AbortController().signal }))
  assert.equal(failure.ok, false)
  assert.equal(f.calls.snapshot.length, 0)
  assert.equal(f.calls.follow.length, 0)
  await f.dispose()
})

test('disposal removes all owned registrations and old callbacks fail closed; re-enable is unique', async () => {
  const f = await started()
  const old = f.face()
  await f.dispose()
  assert.equal(f.entries.size, 0)
  assert.equal(f.providers.size, 0)
  assert.equal(f.dictionaries.size, 0)
  assert.equal(f.calls.unmounted, true)
  assert.equal((await old.bindWorkspace({ path: 'C:\\TEST_ONLY', expectedRevision: 3 })).ok, false)
  assert.equal((await old.startDraft({ agentId: 'finance-test-main' })).status, 'CANCELLED')
  assert.equal(f.calls.prepare.length, 0)
  assert.equal(f.calls.start.length, 0)
  await assert.rejects(old.pickDirectory(), error => error.code === 'gateway/cancelled')
  old.openWorkbench()
  assert.equal(f.calls.bind.length, 0)
  assert.equal(f.calls.pick, 0)
  assert.equal(f.calls.panel.length, 0)
  await f.plugin.apply(f.ctx)
  assert.equal(f.entries.size, 4)
  assert.equal(f.providers.size, 2)
  assert.deepEqual([...f.providers.keys()], ['finance-workspace', 'finance-catalog'])
  await f.dispose()
})

test('a completed bind after plugin disposal cannot report success through the old callback', async () => {
  const f = await started()
  let resolve
  f.ctx.remote.financeOperations.bindWorkspace = () => new Promise(done => { resolve = done })
  const pending = f.face().bindWorkspace({ path: 'C:\\TEST_ONLY', expectedRevision: 3 })
  await f.dispose()
  resolve(OK({ status: 'BOUND', snapshot: SNAPSHOT, error: null }))
  assert.equal((await pending).ok, false)
})

test('catalogue provider preserves exact native RemoteResults and never synthesizes mount diagnostics', async () => {
  const { Catalog, PreparedDraft } = createFinanceContract(z).schemas
  assert.equal(Catalog.safeParse(CATALOG).success, true, 'TEST_ONLY catalogue obeys the exact shared P2 shape and counts')
  assert.equal(PreparedDraft.safeParse(DRAFT).success, true)
  assert.equal(Catalog.safeParse({ ...CATALOG, agents: CATALOG.agents.slice(1) }).success, false)
  assert.equal(Catalog.safeParse({ ...CATALOG, extraStatus: 'TEST_ONLY invented status' }).success, false)
  for (const result of [OK(CATALOG), FAILURE]) {
    const f = await started({ catalog: result })
    assert.equal(f.providers.size, 2)
    const frames = await Array.fromAsync(f.providers.get('finance-catalog').open(CATALOG_ADDRESS, { signal: new AbortController().signal }))
    assert.equal(frames.length, 1)
    assert.equal(frames[0], result)
    assert.deepEqual(f.calls.catalog, [{}])
    assert.equal(f.calls.prepare.length, 0)
    assert.equal(f.calls.start.length, 0)
    await f.dispose()
  }
})

test('catalogue address guards, resource cancellation and unloading suppress late data', async () => {
  let finish
  const f = await started({ catalog: () => new Promise(resolve => { finish = resolve }) })
  const provider = f.providers.get('finance-catalog')
  const cancelled = new AbortController()
  cancelled.abort()
  assert.deepEqual(await Array.fromAsync(provider.open(CATALOG_ADDRESS, { signal: cancelled.signal })), [])
  const [bad] = await Array.fromAsync(provider.open('dsh-resource://finance-catalog/other', { signal: new AbortController().signal }))
  assert.equal(bad.error.code, 'gateway/bad-request')
  assert.equal(f.calls.catalog.length, 0)
  const controller = new AbortController()
  const iterator = provider.open(CATALOG_ADDRESS, { signal: controller.signal })
  const pending = iterator.next()
  controller.abort()
  finish(OK(CATALOG))
  assert.equal((await pending).done, true)
  const late = provider.open(CATALOG_ADDRESS, { signal: new AbortController().signal }).next()
  await f.dispose()
  finish(OK(CATALOG))
  assert.equal((await late).done, true)
  assert.deepEqual(await Array.fromAsync(provider.open(CATALOG_ADDRESS, { signal: new AbortController().signal })), [])
})

test('catalogue errors remain explicit failed resource frames', async () => {
  const f = await started({ catalog: () => { throw new Error('TEST_ONLY catalogue unavailable') } })
  const [result] = await Array.fromAsync(f.providers.get('finance-catalog').open(CATALOG_ADDRESS, { signal: new AbortController().signal }))
  assert.equal(result.ok, false)
  assert.match(result.error.message, /catalogue unavailable/)
  await f.dispose()
})

test('draft callback distinguishes transport failure and Host business rejection; neither starts a Session', async () => {
  const rejected = { ...DRAFT, status: 'REJECTED', workspaceId: null, agentPreset: null, error: { code: 'TEST_ONLY_NOT_READY', message: 'TEST_ONLY unavailable preset or workspace' } }
  for (const response of [FAILURE, OK(rejected)]) {
    const f = await started({ prepare: response })
    const request = { agentId: 'finance-test-main' }
    const result = await f.face().startDraft(request)
    assert.equal(f.calls.prepare[0], request)
    assert.equal(result.status, response.ok ? 'REJECTED' : 'REMOTE_ERROR')
    assert.equal(result.error, response.ok ? rejected.error : FAILURE.error)
    assert.equal(result.whenDraftExists, 'keep')
    assert.equal(result.autoSubmit, false)
    if (response.ok) assert.equal(result, rejected)
    assert.equal(f.calls.start.length, 0)
    await f.dispose()
  }
})

test('only DRAFT_READY calls native startSession with Workspace-owned cwd and keep, returning intent not Session ID', async () => {
  for (const choice of [{}, { prompt: 'TEST_ONLY free prompt' }, { commandId: 'TEST_ONLY multi-target command' }, { steeringId: 'TEST_ONLY steering' }]) {
    const f = await started()
    const request = { agentId: 'finance-test-main', ...choice }
    const result = await f.face().startDraft(request)
    assert.equal(result, DRAFT)
    assert.equal(f.calls.prepare[0], request)
    assert.deepEqual(f.calls.start, [{ workspaceId: DRAFT.workspaceId, input: { agentPreset: DRAFT.agentPreset, prompt: DRAFT.prompt, whenDraftExists: 'keep' } }])
    assert.equal('sessionId' in result, false)
    assert.equal('cwd' in f.calls.start[0].input, false)
    assert.equal('autoSubmit' in f.calls.start[0].input, false)
    await f.dispose()
  }
})

test('draft preparation throw and native start failure carry distinct errors without reporting execution success', async () => {
  const preparation = await started({ prepare: () => { throw new Error('TEST_ONLY transport lost') } })
  const remote = await preparation.face().startDraft({ agentId: 'finance-test-main' })
  assert.equal(remote.status, 'REMOTE_ERROR')
  assert.match(remote.error.message, /transport lost/)
  assert.equal(preparation.calls.start.length, 0)
  await preparation.dispose()
  for (const start of [() => { throw new Error('TEST_ONLY native opening failed') }, () => Promise.reject(new Error('TEST_ONLY native opening failed'))]) {
    const f = await started({ start })
    const result = await f.face().startDraft({ agentId: 'finance-test-main' })
    assert.equal(result.status, 'START_FAILED')
    assert.match(result.error.message, /native opening failed/)
    assert.equal(result.workspaceId, DRAFT.workspaceId)
    assert.equal(result.autoSubmit, false)
    await f.dispose()
  }
})

test('unloading during prepareDraft prevents native start; unloading during start cannot report ready', async () => {
  let finishPrepare
  const f = await started({ prepare: () => new Promise(resolve => { finishPrepare = resolve }) })
  const pending = f.face().startDraft({ agentId: 'finance-test-main' })
  await f.dispose()
  finishPrepare(OK(DRAFT))
  assert.equal((await pending).status, 'CANCELLED')
  assert.equal(f.calls.start.length, 0)
  let finishStart
  const g = await started({ start: () => new Promise(resolve => { finishStart = resolve }) })
  const opening = g.face().startDraft({ agentId: 'finance-test-main' })
  // Let prepareDraft resolve into startSession without a timer or fake renderer.
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(g.calls.start.length, 1)
  await g.dispose()
  finishStart()
  assert.equal((await opening).status, 'CANCELLED')
})
