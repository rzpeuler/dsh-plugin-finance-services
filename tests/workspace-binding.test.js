import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, realpath, stat, access, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { Context } from '@deepseek-ai/cordis'
import FinanceOperations from '../src/host.js'
import { createFinanceContract } from '../src/contract.js'
import { isFullyQualified, WorkspaceBindingOperations } from '../src/workspace-binding.js'

const { schemas } = createFinanceContract(z)
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const fsError = code => Object.assign(new Error(code), { code })

/** Fake durable table + fake registry; only the filesystem is real in these helper tests. */
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'finance-p1-unit-'))
  // Only this unique test-owned temporary root is removed, never a user workspace.
  t.after(() => rm(directory, { recursive: true, force: true }))
  const one = join(directory, 'one')
  const two = join(directory, 'two')
  const file = join(directory, 'file.txt')
  await mkdir(one)
  await mkdir(two)
  await writeFile(file, 'TEST_ONLY')
  const records = options.records ?? new Map()
  const table = {
    get(key) { return records.get(key) },
    async put(key, value) { records.set(key, structuredClone(value)) },
    async update(key, transform) {
      const value = transform(records.get(key))
      if (table.beforeCommit) await table.beforeCommit()
      if (table.fail) throw new Error('TEST_ONLY storage failure')
      records.set(key, structuredClone(value))
      return records.get(key)
    },
  }
  const entities = options.entities ?? new Map()
  const created = []
  const registry = {
    get(id) { return entities.get(id) },
    async create(path, title) {
      created.push([path, title])
      const canonical = await realpath(path)
      let entity = [...entities.values()].find(item => item.path === canonical)
      if (!entity) {
        entity = { id: `TEST_ONLY-workspace-${entities.size + 1}`, path: canonical }
        entities.set(entity.id, entity)
      }
      return entity
    },
  }
  const watchCallbacks = new Map()
  let activeWatches = 0
  const filesystem = { realpath, stat, access }
  const errors = []
  const operations = new WorkspaceBindingOperations({
    table, registry, schemas, filesystem,
    now: () => '2026-11-03T12:00:00.000Z',
    reportError: error => errors.push(error),
    watchDirectory(path, changed) {
      activeWatches++
      watchCallbacks.set(path, changed)
      return () => { activeWatches--; watchCallbacks.delete(path) }
    },
  })
  t.after(() => operations.dispose())
  await operations.initialize()
  return { operations, one, two, file, directory, records, table, entities, registry, created, filesystem, errors, watchCallbacks, activeWatches: () => activeWatches }
}

test('fully qualified path check rejects Windows current-drive/root paths', () => {
  for (const path of ['relative', 'C:folder', '\\folder', '/folder']) assert.equal(isFullyQualified(path, 'win32'), false, path)
  for (const path of ['C:\\folder', 'C:/folder', '\\\\server\\share\\folder']) assert.equal(isFullyQualified(path, 'win32'), true, path)
  assert.equal(isFullyQualified('/folder', 'linux'), true)
  assert.equal(isFullyQualified('relative', 'linux'), false)
})

test('cold root is singular and unbound; actual methods validate before side effects', async t => {
  const f = await fixture(t)
  const initial = await f.operations.snapshot({})
  assert.equal(initial.workspaceStatus, 'UNBOUND')
  assert.equal(initial.revision, 0)
  assert.equal(initial.binding, null)
  assert.equal(f.records.size, 1)
  assert.throws(() => f.operations.snapshot({ extra: true }))
  assert.throws(() => f.operations.bindWorkspace({ path: f.one, expectedRevision: '0' }))
  assert.throws(() => f.operations.unbindWorkspace({ expectedRevision: 0, extra: true }))
  assert.throws(() => f.operations.follow({ extra: true }, new AbortController().signal))
  assert.throws(() => f.operations.follow({}, {}))
  assert.equal(f.created.length, 0)
})

test('bind persists native-returned canonical path/id and onboarding after durability; switch retains old registration', async t => {
  const f = await fixture(t)
  const first = await f.operations.bindWorkspace({ path: join(f.one, '..', 'one'), expectedRevision: 0 })
  assert.equal(first.status, 'BOUND')
  assert.equal(first.snapshot.workspaceStatus, 'READY')
  assert.equal(first.snapshot.binding.path, await realpath(f.one))
  assert.equal(first.snapshot.binding.workspaceId, 'TEST_ONLY-workspace-1')
  assert.equal(first.snapshot.onboardingVersion, 1)
  assert.equal(first.snapshot.revision, 1)
  assert.equal(f.created[0][1], 'Financial Services')
  const second = await f.operations.bindWorkspace({ path: f.two, expectedRevision: 1 })
  assert.equal(second.snapshot.revision, 2)
  assert.equal(f.entities.size, 2)
  assert.equal(f.entities.get(first.snapshot.binding.workspaceId).path, await realpath(f.one))
  assert.equal((await stat(f.one)).isDirectory(), true)
  assert.deepEqual(f.records.get('root').binding, second.snapshot.binding)
  // Returned data cannot mutate the authoritative fake persisted root or follow cache.
  second.snapshot.binding.path = 'tampered'
  assert.equal((await f.operations.snapshot({})).binding.path, await realpath(f.two))
})

test('directory alias resolves through native-create substitute; saved spelling is canonical', async t => {
  const f = await fixture(t)
  const alias = join(f.directory, 'alias')
  await symlink(f.one, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const result = await f.operations.bindWorkspace({ path: alias, expectedRevision: 0 })
  assert.equal(result.status, 'BOUND')
  assert.equal(result.snapshot.binding.path, await realpath(f.one))
  assert.equal(f.created[0][0], alias)
})

test('relative, missing, file and permission failures reject and preserve the existing root', async t => {
  const f = await fixture(t)
  await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  const previous = structuredClone(f.records.get('root'))
  for (const [path, code] of [['relative', 'ABSOLUTE_PATH_REQUIRED'], [join(f.directory, 'missing'), 'MISSING_DIRECTORY'], [f.file, 'NOT_DIRECTORY']]) {
    const result = await f.operations.bindWorkspace({ path, expectedRevision: 1 })
    assert.equal(result.status, 'REJECTED')
    assert.equal(result.error.code, code)
    assert.deepEqual(f.records.get('root'), previous)
  }
  const nativeAccess = f.filesystem.access
  f.filesystem.access = async path => { if (path === await realpath(f.two)) throw fsError('EACCES'); return nativeAccess(path) }
  const denied = await f.operations.bindWorkspace({ path: f.two, expectedRevision: 1 })
  assert.equal(denied.error.code, 'PERMISSION_DENIED')
  assert.deepEqual(f.records.get('root'), previous)
  assert.equal(f.created.length, 1)
})

test('concurrent same-revision binds serialize and late work cannot overwrite the winner', async t => {
  const f = await fixture(t)
  const [first, second] = await Promise.all([
    f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 }),
    f.operations.bindWorkspace({ path: f.two, expectedRevision: 0 }),
  ])
  assert.equal(first.status, 'BOUND')
  assert.equal(second.status, 'REJECTED')
  assert.equal(second.error.code, 'REVISION_CONFLICT')
  assert.equal(f.created.length, 1)
  assert.equal(f.records.get('root').binding.path, await realpath(f.one))
})

test('persisted CAS is rechecked after asynchronous native registration, not only at request admission', async t => {
  const f = await fixture(t)
  const originalCreate = f.registry.create
  f.registry.create = async (...args) => {
    const workspace = await originalCreate(...args)
    f.records.set('root', { ...f.records.get('root'), revision: 7 })
    return workspace
  }
  const result = await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  assert.equal(result.status, 'REJECTED')
  assert.equal(result.error.code, 'REVISION_CONFLICT')
  assert.equal(f.records.get('root').revision, 7)
  assert.equal(f.records.get('root').binding, null)
})

test('storage failure leaves old state untouched and does not publish a successful change', async t => {
  const f = await fixture(t)
  await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  const stream = f.operations.follow({}, new AbortController().signal)
  await stream.next()
  const previous = structuredClone(f.records.get('root'))
  f.table.fail = true
  const result = await f.operations.bindWorkspace({ path: f.two, expectedRevision: 1 })
  assert.equal(result.status, 'REJECTED')
  assert.equal(result.error.code, 'STORAGE_FAILED')
  assert.deepEqual(f.records.get('root'), previous)
  assert.equal(f.entities.size, 2, 'native-create substitute can retain a registration across a separate-domain save failure')
  const pending = stream.next()
  await stream.return()
  assert.equal((await pending).done, true)
})

test('publication waits for storage acknowledgment and persists before follow receives a binding', async t => {
  const f = await fixture(t)
  const started = deferred()
  const release = deferred()
  f.table.beforeCommit = async () => { started.resolve(); await release.promise }
  const stream = f.operations.follow({}, new AbortController().signal)
  assert.equal((await stream.next()).value.revision, 0)
  let published = false
  const frame = stream.next().then(result => { published = true; return result })
  const binding = f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  await started.promise
  assert.equal(f.records.get('root').revision, 0)
  assert.equal(published, false)
  release.resolve()
  await binding
  assert.equal((await frame).value.revision, 1)
  assert.equal(f.records.get('root').revision, 1)
  await stream.return()
})

test('root survives helper reconstruction; native registry missing is explicit', async t => {
  const f = await fixture(t)
  const bound = await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  await f.operations.dispose()
  const recovered = new WorkspaceBindingOperations({
    table: f.table, registry: f.registry, schemas, filesystem: f.filesystem, watchDirectory: () => () => {},
  })
  t.after(() => recovered.dispose())
  await recovered.initialize()
  const snapshot = await recovered.snapshot({})
  assert.deepEqual(snapshot.binding, bound.snapshot.binding)
  assert.equal(snapshot.revision, 1)
  f.entities.delete(snapshot.binding.workspaceId)
  const missing = await recovered.snapshot({})
  assert.equal(missing.workspaceStatus, 'REGISTRY_MISSING')
  assert.equal(missing.error.code, 'REGISTRY_MISSING')
  assert.deepEqual(missing.binding, bound.snapshot.binding)
})

test('status differentiates missing directory, path drift and simulated permission failures without rewriting state', async t => {
  const f = await fixture(t)
  const bound = await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  const entity = f.entities.get(bound.snapshot.binding.workspaceId)
  entity.path = await realpath(f.two)
  assert.equal((await f.operations.snapshot({})).workspaceStatus, 'PATH_DRIFT')
  entity.path = bound.snapshot.binding.path
  const originalRealpath = f.filesystem.realpath
  f.filesystem.realpath = async () => { throw fsError('EPERM') }
  assert.equal((await f.operations.snapshot({})).workspaceStatus, 'PERMISSION_DENIED')
  f.filesystem.realpath = async () => await realpath(f.two)
  assert.equal((await f.operations.snapshot({})).workspaceStatus, 'PATH_DRIFT')
  f.filesystem.realpath = originalRealpath
  // Remove only the test-owned empty child, not the test root or any user's directory.
  await rm(f.one, { recursive: true })
  assert.equal((await f.operations.snapshot({})).workspaceStatus, 'MISSING_DIRECTORY')
  assert.equal(f.records.get('root').revision, 1)
})

test('follow has an initial baseline, observes events without polling, suppresses duplicate values and aborts pending next', async t => {
  const f = await fixture(t)
  const controller = new AbortController()
  const stream = f.operations.follow({}, controller.signal)
  assert.equal((await stream.next()).value.workspaceStatus, 'UNBOUND')
  const changed = stream.next()
  await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  assert.equal((await changed).value.revision, 1)
  const missing = stream.next()
  f.entities.clear()
  f.operations.invalidate() // Same callback invoked by the native Host domain/changed listener.
  assert.equal((await missing).value.workspaceStatus, 'REGISTRY_MISSING')
  const pending = stream.next()
  await f.operations.snapshot({})
  controller.abort()
  assert.equal((await pending).done, true)
  assert.equal(f.operations.followers.size, 0)
  assert.equal((await stream.next()).done, true)
})

test('filesystem event reconciliation publishes a real missing-directory observation', async t => {
  const f = await fixture(t)
  await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  const stream = f.operations.follow({}, new AbortController().signal)
  await stream.next()
  const frame = stream.next()
  const changed = f.watchCallbacks.get(await realpath(f.one))
  await rm(f.one, { recursive: true })
  changed()
  assert.equal((await frame).value.workspaceStatus, 'MISSING_DIRECTORY')
  await stream.return()
})

test('follow subscribe/bind race never loses the latest durable revision; pre-abort and return release listeners', async t => {
  const f = await fixture(t)
  const binding = f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  const controller = new AbortController()
  const stream = f.operations.follow({}, controller.signal)
  await binding
  const baseline = await stream.next()
  assert.equal(baseline.value.revision, 1)
  const pending = stream.next()
  await stream.return()
  assert.equal((await pending).done, true)
  const aborted = new AbortController()
  aborted.abort()
  assert.equal((await f.operations.follow({}, aborted.signal).next()).done, true)
  assert.equal(f.operations.followers.size, 0)
})

test('unbind CAS clears only the default and retains onboarding, files and native registrations', async t => {
  const f = await fixture(t)
  await f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  assert.equal((await f.operations.unbindWorkspace({ expectedRevision: 0 })).error.code, 'REVISION_CONFLICT')
  const result = await f.operations.unbindWorkspace({ expectedRevision: 1 })
  assert.equal(result.status, 'UNBOUND')
  assert.equal(result.snapshot.binding, null)
  assert.equal(result.snapshot.revision, 2)
  assert.equal(result.snapshot.onboardingVersion, 1)
  assert.equal(f.entities.size, 1)
  assert.equal((await stat(f.one)).isDirectory(), true)
  assert.equal(f.activeWatches(), 0)
})

test('dispose drains in-flight commit, ends streams and prevents post-dispose publication or registration', async t => {
  const f = await fixture(t)
  const entered = deferred()
  const release = deferred()
  f.table.beforeCommit = async () => { entered.resolve(); await release.promise }
  const stream = f.operations.follow({}, new AbortController().signal)
  await stream.next()
  const frame = stream.next()
  const binding = f.operations.bindWorkspace({ path: f.one, expectedRevision: 0 })
  await entered.promise
  const disposal = f.operations.dispose()
  assert.equal((await frame).done, true)
  const rejected = assert.rejects(binding, /not active/)
  release.resolve()
  await disposal
  await rejected
  assert.equal(f.activeWatches(), 0)
  assert.equal(f.records.get('root').revision, 1, 'already-issued durable write may finish while disposal drains')
  await assert.rejects(f.operations.bindWorkspace({ path: f.two, expectedRevision: 1 }), /not active/)
  assert.equal(f.created.length, 1)
})

test('actual Cordis Service initialization owns strict/tool effects and closes the injected domain on unload (substituted services)', async t => {
  const f = await fixture(t)
  await f.operations.dispose()
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const registrations = new Map()
  let closed = 0
  let contributed
  ctx.provide('workspaceRegistry', f.registry)
  ctx.provide('storageDomain', {
    async open(spec) {
      assert.equal(spec.name, 'financial_services')
      assert.equal(spec.version, 1)
      assert.deepEqual(Object.keys(spec.tables), ['state'])
      return { table: () => f.table, async close() { closed++ } }
    },
  })
  ctx.provide('typert', { register(value) { contributed = value; registrations.set('remote', value); return async () => { registrations.delete('remote') } } })
  ctx.provide('tools', { register(value) { registrations.set('tool', value); return () => { registrations.delete('tool') } } })
  const fiber = ctx.plugin(FinanceOperations)
  await fiber
  const service = ctx.financeOperations
  assert.equal((await service.snapshot({})).workspaceStatus, 'UNBOUND')
  assert.equal(contributed.invocations.length, 9)
  assert.equal(registrations.get('tool').name, 'finance_workspace')
  const actor = { id: 'TEST_ONLY_actor_identity' }
  const role = await service.roleDefinition('finance-pitch-agent')
  const expected = { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 }
  assert.equal(service.isRoleRuntimeActive(actor, role.id, expected), false)
  const oldGrant = service.registerRoleRuntime(actor, role.id)
  assert.equal(service.isRoleRuntimeActive(actor, role.id, expected), true)
  assert.equal(service.isRoleRuntimeActive(actor, role.id, { ...expected, sourceSha256: '0'.repeat(64) }), false)
  const latestGrant = service.registerRoleRuntime(actor, role.id)
  oldGrant()
  assert.equal(service.isRoleRuntimeActive(actor, role.id, expected), true, 'old cleanup must not revoke a successor admission')
  latestGrant()
  assert.equal(service.isRoleRuntimeActive(actor, role.id, expected), false)
  service.registerRoleRuntime(actor, role.id)
  assert.throws(() => service.bindWorkspace({ path: f.one, expectedRevision: 0, approve: true }))
  const stream = service.follow({}, new AbortController().signal)
  await stream.next()
  const pending = stream.next()
  await fiber.dispose()
  assert.equal(service.isRoleRuntimeActive(actor, role.id, expected), false)
  assert.throws(() => service.registerRoleRuntime(actor, role.id), /ROLE_AUTHORITY_UNAVAILABLE/)
  assert.equal((await pending).done, true)
  assert.equal(registrations.size, 0)
  assert.equal(closed, 1)
  await assert.rejects(service.snapshot({}), /not active/)
  assert.equal(f.records.size, 1)
})
