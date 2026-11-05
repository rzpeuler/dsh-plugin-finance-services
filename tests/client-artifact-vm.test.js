import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { z } from 'zod'

// Execute the *built* client artifact. The build serializes factories with Function.prototype.toString,
// so a factory that closes over a module-level helper only breaks at this boundary, never in src tests.
const artifact = readFileSync('lib/client.js', 'utf8')

function loadArtifact() {
  let factory
  const window = { __ModuleLoader__: { load: options => { factory = options.factory } } }
  const modules = {
    react: {
      createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children: children.flat(Infinity).filter(v => v != null) } } },
      useState(initial) { return [initial, () => {}] },
      useEffect() {}, useId() { return 'id' },
    },
    zod: { z },
  }
  const require = specifier => {
    if (!(specifier in modules)) throw new Error(`unexpected module ${specifier}`)
    return modules[specifier]
  }
  // The client half runs in a browser-like realm: supply the globals it legitimately uses.
  const sandbox = { window, require, console,
    AbortController, AbortSignal, TextEncoder, TextDecoder, URL, URLSearchParams, Blob,
    setTimeout, clearTimeout, queueMicrotask, Promise }
  runInNewContext(artifact, sandbox, { filename: 'lib/client.js' })
  assert.equal(typeof factory, 'function', 'the artifact must register a factory')
  return factory(require)
}

const plugin = loadArtifact()

function fakeContext() {
  const record = { mounted: [], namespaces: [], locales: [], effects: [], slots: [], resources: [], panels: [], sidebars: [] }
  const remote = {
    async $mount(contract) { record.mounted.push(contract.package) },
    financeOperations: {
      async snapshot() { return { ok: true, value: { binding: null, workspaceStatus: 'UNBOUND', revision: 19 } } },
      async catalog() { return { ok: true, value: { agents: [], workers: [], skills: [], commands: [] } } },
      async bindWorkspace() { return { ok: true, value: {} } },
      async prepareDraft() { return { ok: true, value: {} } },
      async *follow() {},
    },
    financeData: { async catalog() { return { ok: true, value: { catalogJson: JSON.stringify({ revision: 0, adapters: [], bindings: [] }) } } } },
    financeReview: {
      async reviewSummary() { return { ok: true, value: { summaryJson: JSON.stringify({ source: 'financial_review.domain/state', revision: 0, groups: [], totals: { sessions: 0, items: 0, pending: 0, decided: 0 } }) } } },
      async reviewPolicy() { return { ok: true, value: { policyJson: JSON.stringify({ policyId: 'original', version: 'p5-policy-v1', digest: 'a'.repeat(64), lockedBoundaries: [], externalSideEffects: 'DISABLED' }) } } },
      async reviewRuns() { return { ok: true, value: { runsJson: JSON.stringify({ deliverableRevision: 0, runs: [] }) } } },
      async reviewDeliverables() { return { ok: true, value: { deliverablesJson: JSON.stringify({ revision: 0, deliverables: [] }) } } },
    },
    async $stream(options) {
      // A supervisor stub: one snapshot frame then it ends.
      return { async *[Symbol.asyncIterator]() {}, dispose: async () => {} }
    },
  }
  const ctx = {
    remote,
    locale: {
      register(namespace) { record.locales.push(namespace); return () => {} },
      bind(namespace) { return key => `${namespace}.${key}` },
    },
    effect(register, label) { record.effects.push(label); register() },
    resources: { register(definition) { record.resources.push(definition.protocol ?? 'unknown'); return () => {} } },
    slots: {
      inject(slot, register) { record.slots.push(slot); register() },
      register(options, component) {
        if (options.name === 'main') { record.panels.push(options.key); return { options, component } }
        if (options.name === 'sidebar.panellist') { record.sidebars.push(options); return { options } }
        return { options }
      },
    },
    layout: { panelInfo: { getSnapshot: () => ({ activePanelId: null }) }, selectPanel() {} },
    uiWorkspace: { async startSession() { return {} }, async pickDirectory() { return null } },
    workingDirectory: { get: () => undefined },
  }
  return { ctx, record }
}

test('the built artifact loads and returns a Cordis client plugin', () => {
  // The plugin is a cross-realm value; compare copies rather than the foreign prototypes.
  assert.deepEqual([...plugin.inject], ['slots', 'remote', 'resources', 'uiWorkspace', 'layout', 'locale'])
  assert.equal(typeof plugin.apply, 'function')
})

test('apply mounts every remote namespace this bundle owns', async () => {
  const { ctx, record } = fakeContext()
  const root = {
    remote: ctx.remote,
    inject(dependencies, callback) { record.namespaces.push(...dependencies); return callback(ctx) },
  }
  await plugin.apply(root)
  assert.deepEqual([...record.mounted], [
    '@local/dsh-financial-services',
    '@local/dsh-financial-services/data-api-v1',
    '@local/dsh-financial-services/review-api-v1',
  ])
  assert.ok(record.namespaces.includes('remote.financeReview'), 'the review namespace must be injected')
})

test('apply registers one main panel, one sidebar entry and the two plugin pages', async () => {
  const { ctx, record } = fakeContext()
  const root = {
    remote: ctx.remote,
    inject(dependencies, callback) { return callback(ctx) },
  }
  await plugin.apply(root)
  assert.deepEqual(record.panels, ['financial-services'])
  assert.equal(record.sidebars.length, 1)
  assert.ok(record.slots.includes('plugins.bundle.config'))
  assert.ok(record.slots.includes('plugins.bundle.activation'))
})

test('the serialized client still registers its dictionary namespaces', async () => {
  const { ctx, record } = fakeContext()
  await plugin.apply({ remote: ctx.remote, inject: (deps, callback) => callback(ctx) })
  for (const namespace of ['financial-services', 'financial-data-ui', 'financial-review-ui', 'financial-workbench-ui']) {
    assert.ok(record.locales.includes(namespace), `missing dictionary ${namespace}`)
  }
})
