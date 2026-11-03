import { posix, win32 } from 'node:path'

/** Reject cwd-dependent Windows drive/root spellings as well as ordinary relative paths. */
export function isFullyQualified(path, platform = process.platform) {
  if (platform !== 'win32') return posix.isAbsolute(path)
  const root = win32.parse(path).root
  return win32.isAbsolute(path) && root !== '\\' && root !== '/'
}

const initialState = () => ({ version: 1, revision: 0, onboardingVersion: 0, binding: null })
const failure = (code, message) => ({ code, message })
const unavailable = () => new Error('Financial Services is not active.')

/**
 * Binding business logic. The Host supplies native registry, domain table and filesystem handles.
 * Tests may supply isolated substitutes; those tests do not establish native integration.
 */
export class WorkspaceBindingOperations {
  constructor({ table, registry, filesystem, watchDirectory, schemas, now = () => new Date().toISOString(), platform = process.platform, reportError = () => {} }) {
    this.table = table
    this.registry = registry
    this.filesystem = filesystem
    this.watchDirectory = watchDirectory
    this.schemas = schemas
    this.now = now
    this.platform = platform
    this.reportError = reportError
    this.tail = Promise.resolve()
    this.closed = false
    this.followers = new Set()
    this.watchers = new Map()
    this.watchFailures = new Set()
    this.watchedBinding = null
    this.current = undefined
    this.refreshQueued = false
    this.dirty = false
  }

  async initialize() {
    if (this.table.get('root') === undefined) await this.table.put('root', initialState())
    this.schemas.StateRoot.parse(this.table.get('root'))
    await this.enqueue(() => this.refreshNow())
  }

  enqueue(work) {
    if (this.closed) return Promise.reject(unavailable())
    const operation = this.tail.then(() => {
      if (this.closed) throw unavailable()
      return work()
    })
    this.tail = operation.then(() => {}, () => {})
    return operation
  }

  state() {
    return this.schemas.StateRoot.parse(this.table.get('root'))
  }

  /** Read and recheck status; no directory creation, Session mutation or migration occurs. */
  snapshot(request) {
    this.schemas.EmptyRequest.parse(request)
    return this.enqueue(() => this.refreshNow())
  }

  /** Serializes CAS, native registration and the one authoritative root update. */
  bindWorkspace(request) {
    const input = this.schemas.BindRequest.parse(request)
    return this.enqueue(async () => {
      const previous = this.state()
      const reject = async error => ({ status: 'REJECTED', snapshot: await this.refreshNow(), error })
      if (input.expectedRevision !== previous.revision) {
        return reject(failure('REVISION_CONFLICT', 'The workspace binding changed. Read status and retry with its revision.'))
      }
      if (!isFullyQualified(input.path, this.platform)) {
        return reject(failure('ABSOLUTE_PATH_REQUIRED', 'Choose an existing fully qualified directory path.'))
      }
      let workspace
      try {
        const canonical = await this.checkDirectory(input.path)
        if (this.closed) throw unavailable()
        workspace = await this.registry.create(input.path, 'Financial Services')
        if (this.closed) throw unavailable()
        // Recheck the returned native identity, including path changes during registration.
        const verified = await this.checkDirectory(workspace.path)
        if (canonical !== workspace.path || verified !== workspace.path || this.registry.get(workspace.id)?.path !== workspace.path) {
          return reject(failure('PATH_DRIFT', 'The directory or Workspace registration changed during binding. Retry after checking the path.'))
        }
      } catch (error) {
        if (this.closed) throw unavailable()
        return reject(this.directoryFailure(error))
      }
      const binding = { workspaceId: workspace.id, path: workspace.path, boundAt: this.now() }
      const next = this.schemas.StateRoot.parse({
        version: 1, revision: previous.revision + 1, onboardingVersion: 1, binding,
      })
      try {
        await this.table.update('root', current => {
          if (this.closed) throw unavailable()
          if (current.revision !== input.expectedRevision) {
            const error = new Error('The persisted binding revision changed.')
            error.code = 'REVISION_CONFLICT'
            throw error
          }
          return next
        })
      } catch (error) {
        if (this.closed) throw unavailable()
        return reject(failure(error.code === 'REVISION_CONFLICT' ? 'REVISION_CONFLICT' : 'STORAGE_FAILED',
          error.code === 'REVISION_CONFLICT' ? 'The workspace binding changed. Read status and retry.' : 'The binding could not be saved. The previous binding is unchanged; a Workspace registration may have been retained.'))
      }
      if (this.closed) throw unavailable()
      return { status: 'BOUND', snapshot: await this.refreshNow(), error: null }
    })
  }

  /** Clear the default only; preserve onboarding, native registrations, directories and history. */
  unbindWorkspace(request) {
    const input = this.schemas.UnbindRequest.parse(request)
    return this.enqueue(async () => {
      try {
        await this.table.update('root', current => {
          if (this.closed) throw unavailable()
          if (current.revision !== input.expectedRevision) {
            const error = new Error('The persisted binding revision changed.')
            error.code = 'REVISION_CONFLICT'
            throw error
          }
          return this.schemas.StateRoot.parse({ ...current, revision: current.revision + 1, binding: null })
        })
      } catch (cause) {
        if (this.closed) throw unavailable()
        return {
          status: 'REJECTED', snapshot: await this.refreshNow(),
          error: failure(cause.code === 'REVISION_CONFLICT' ? 'REVISION_CONFLICT' : 'STORAGE_FAILED',
            cause.code === 'REVISION_CONFLICT' ? 'The workspace binding changed. Read status and retry.' : 'The binding could not be cleared. The previous binding is unchanged.'),
        }
      }
      if (this.closed) throw unavailable()
      return { status: 'UNBOUND', snapshot: await this.refreshNow(), error: null }
    })
  }

  async checkDirectory(path) {
    const canonical = await this.filesystem.realpath(path)
    if (!(await this.filesystem.stat(canonical)).isDirectory()) {
      const error = new Error('The selected path is not a directory.')
      error.code = 'NOT_DIRECTORY'
      throw error
    }
    await this.filesystem.access(canonical)
    return canonical
  }

  directoryFailure(error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return failure('MISSING_DIRECTORY', 'The selected directory does not exist. Choose an existing directory.')
    if (error.code === 'NOT_DIRECTORY') return failure('NOT_DIRECTORY', 'The selected path is a file, not a directory.')
    if (error.code === 'EACCES' || error.code === 'EPERM') return failure('PERMISSION_DENIED', 'The Host cannot access this directory. Choose an accessible directory.')
    return failure('WORKSPACE_REGISTRATION_FAILED', 'The directory could not be registered. The previous binding is unchanged.')
  }

  async readSnapshot() {
    const root = this.state()
    let workspaceStatus = 'UNBOUND'
    let error = null
    if (root.binding !== null) {
      const registered = this.registry.get(root.binding.workspaceId)
      if (registered === undefined) {
        workspaceStatus = 'REGISTRY_MISSING'
        error = failure('REGISTRY_MISSING', 'The Workspace registration is missing. Rebind an existing directory.')
      } else if (registered.path !== root.binding.path) {
        workspaceStatus = 'PATH_DRIFT'
        error = failure('PATH_DRIFT', 'The Workspace path no longer matches the saved binding. Rebind the directory.')
      } else {
        try {
          const canonical = await this.checkDirectory(root.binding.path)
          workspaceStatus = canonical === root.binding.path ? 'READY' : 'PATH_DRIFT'
          if (workspaceStatus === 'PATH_DRIFT') error = failure('PATH_DRIFT', 'The directory resolves to a different path. Rebind the directory.')
        } catch (cause) {
          if (['ENOENT', 'ENOTDIR', 'NOT_DIRECTORY'].includes(cause.code)) {
            workspaceStatus = 'MISSING_DIRECTORY'
            error = failure('MISSING_DIRECTORY', 'The saved directory is missing or no longer a directory. Rebind an existing directory.')
          } else if (cause.code === 'EACCES' || cause.code === 'EPERM') {
            workspaceStatus = 'PERMISSION_DENIED'
            error = failure('PERMISSION_DENIED', 'The Host cannot access the saved directory. Restore access or rebind.')
          } else {
            throw cause
          }
        }
      }
    }
    const limitations = [
      'P1 provides workspace binding only; financial Agents, data sources, runs and review are not implemented.',
      'Switching changes the default for new tasks only; existing Sessions and files are never moved.',
      'Directory monitoring uses best-effort filesystem events, not polling. Permission changes or missing-parent recovery may require a fresh status read.',
      'Workspace registration and binding persistence are separate native domains; a failed save may retain an unused Workspace registration.',
      'Streams coalesce intermediate changes to the latest observed snapshot.',
    ]
    if (this.watchFailures.size > 0) limitations.push('Some filesystem watches are unavailable. Read status to recheck the directory.')
    return this.schemas.Snapshot.parse({
      version: '1', stage: 'P1', revision: root.revision, onboardingVersion: root.onboardingVersion,
      binding: root.binding, workspaceStatus, error, limitations,
    })
  }

  synchronizeWatches() {
    const path = this.state().binding?.path ?? null
    if (path !== this.watchedBinding) {
      this.closeWatches()
      this.watchedBinding = path
    }
    if (path === null) return
    const api = this.platform === 'win32' ? win32 : posix
    for (const directory of new Set([path, api.dirname(path)])) {
      if (this.watchers.has(directory)) continue
      try {
        const stop = this.watchDirectory(directory, () => this.invalidate(), cause => {
          if (this.closed) return
          this.watchFailures.add(directory)
          this.reportError(cause)
          this.invalidate()
        })
        this.watchers.set(directory, stop)
        this.watchFailures.delete(directory)
      } catch (cause) {
        this.watchFailures.add(directory)
        // Missing paths are normal status outcomes; unknown watcher failures remain diagnostic.
        if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(cause.code)) this.reportError(cause)
      }
    }
  }

  closeWatches() {
    for (const stop of this.watchers.values()) stop()
    this.watchers.clear()
    this.watchFailures.clear()
  }

  async refreshNow() {
    if (this.closed) throw unavailable()
    this.synchronizeWatches()
    const snapshot = await this.readSnapshot()
    if (this.closed) throw unavailable()
    const serialized = JSON.stringify(snapshot)
    if (serialized !== this.current?.serialized) {
      this.current = { snapshot, serialized }
      for (const follower of this.followers) follower.offer(snapshot, serialized)
    }
    return structuredClone(snapshot)
  }

  /** Schedule event-driven reconciliation; serialize it with binding and status reads. */
  invalidate() {
    if (this.closed) return
    this.dirty = true
    if (this.refreshQueued) return
    this.refreshQueued = true
    this.enqueue(async () => {
      do {
        this.dirty = false
        // A renamed/replaced directory invalidates watch handles, even at the same path.
        this.closeWatches()
        await this.refreshNow()
      } while (this.dirty && !this.closed)
    }).catch(error => {
      if (!this.closed) {
        this.reportError(error)
        for (const follower of this.followers) follower.close(error)
      }
    }).finally(() => {
      this.refreshQueued = false
      if (this.dirty && !this.closed) this.invalidate()
    })
  }

  /** Returns a bounded latest-value stream; return/abort/dispose settle even a pending next(). */
  follow(request, signal) {
    this.schemas.EmptyRequest.parse(request)
    if (!(signal instanceof AbortSignal)) throw new TypeError('follow requires an AbortSignal')
    if (this.closed) throw unavailable()
    let latest
    let pending
    let last
    let ended = false
    let failed
    const close = error => {
      if (ended) return
      ended = true
      failed = error
      latest = undefined
      signal.removeEventListener('abort', abort)
      this.followers.delete(follower)
      if (pending) {
        const waiter = pending
        pending = undefined
        if (error) waiter.reject(error)
        else waiter.resolve({ done: true, value: undefined })
      }
    }
    const abort = () => close()
    const follower = {
      close,
      offer(snapshot, serialized) {
        if (ended || last === serialized) return
        last = serialized
        const value = structuredClone(snapshot)
        if (pending) {
          const waiter = pending
          pending = undefined
          waiter.resolve({ done: false, value })
        } else latest = value
      },
    }
    this.followers.add(follower)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) close()
    else this.enqueue(async () => {
      await this.refreshNow()
      if (!ended) follower.offer(this.current.snapshot, this.current.serialized)
    }).catch(close)
    return {
      [Symbol.asyncIterator]() { return this },
      next() {
        if (ended) return failed ? Promise.reject(failed) : Promise.resolve({ done: true, value: undefined })
        if (latest !== undefined) {
          const value = latest
          latest = undefined
          return Promise.resolve({ done: false, value })
        }
        if (pending) return Promise.reject(new Error('Only one pending next() is supported.'))
        return new Promise((resolve, reject) => { pending = { resolve, reject } })
      },
      return() { close(); return Promise.resolve({ done: true, value: undefined }) },
      throw(error) { close(error); return Promise.reject(error) },
    }
  }

  /** Stop publications immediately, drain accepted operations, and retain all user data. */
  async dispose() {
    this.closed = true
    this.closeWatches()
    for (const follower of this.followers) follower.close()
    await this.tail
  }
}
