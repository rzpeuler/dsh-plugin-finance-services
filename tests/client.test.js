import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { createFinanceClient } from '../src/client-factory.js'

// These tests exercise only plugin callbacks and registration/resource ownership.
// No component rendering, DOM emulation, browser interaction or visual assertions.
const React = Object.freeze({ createElement() { throw new Error('These Node tests must not render components') } })
const ADDRESS = 'dsh-resource://finance-workspace/current'
const PACKAGE = '@local/dsh-financial-services'
const SNAPSHOT = Object.freeze({
  version: '1', stage: 'P1', revision: 3, onboardingVersion: 0,
  binding: null, workspaceStatus: 'UNBOUND', error: null, limitations: ['P1 only'],
})
const OK = value => ({ ok: true, value })
const FAILURE = { ok: false, error: { code: 'gateway/internal', message: 'TEST_ONLY failure', details: {} } }
function contractFactory() { return { remote: { package: '@local/dsh-financial-services', descriptors: [] } } }

function fixture(options = {}) {
  const effects = []
  const entries = new Map()
  const providers = new Map()
  const dictionaries = new Map()
  const calls = { mount: [], bind: [], snapshot: [], follow: [], pick: 0, panel: [], streams: [], accepted: 0, streamDisposals: 0 }
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
    assert.deepEqual(Object.keys(face).sort(), ['bindWorkspace', 'openWorkbench', 'pickDirectory'])
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
  await assert.rejects(old.pickDirectory(), error => error.code === 'gateway/cancelled')
  old.openWorkbench()
  assert.equal(f.calls.bind.length, 0)
  assert.equal(f.calls.pick, 0)
  assert.equal(f.calls.panel.length, 0)
  await f.plugin.apply(f.ctx)
  assert.equal(f.entries.size, 4)
  assert.equal(f.providers.size, 1)
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
