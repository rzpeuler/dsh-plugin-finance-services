import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import schema from '@deepseek-ai/schemastery'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { assetUrl } from '../asset-location.js'
import { applySessionEvent, applyWorkerEvent, createRun, emptyRunDocument, interruptActiveRuns, recentRuns } from './store.js'
import { createFinanceRunsRemoteContract } from './remote.js'

const RunStatus = z.enum(['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'ABORTED'])
const Phase = z.strictObject({ phaseId: z.string(), kind: z.enum(['turn', 'step']), name: z.string(), status: z.enum([...RunStatus.options, 'ENDED']),
  startedAt: z.number().int().nonnegative(), endedAt: z.number().int().nonnegative().nullable(), errorCode: z.string().nullable() })
const Attempt = z.strictObject({ attemptId: z.string(), kind: z.enum(['tool', 'model', 'worker']), name: z.string(), targetSessionId: z.string().nullable(),
  turn: z.number().int().nonnegative().nullable(), step: z.number().int().nonnegative().nullable(), status: z.enum([...RunStatus.options, 'NO_MESSAGE', 'NO_RESULT']),
  startedAt: z.number().int().nonnegative().nullable(), endedAt: z.number().int().nonnegative().nullable(), errorCode: z.string().nullable() })
const Output = z.strictObject({ messageId: z.string(), seq: z.number().int().nonnegative(), time: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(), step: z.number().int().nonnegative(), interrupted: z.boolean() })
const Diagnostic = z.strictObject({ code: z.string().min(1).max(64), eventSeq: z.number().int().nonnegative(), time: z.number().int().nonnegative(), source: z.string().min(1).max(64) })
const TimelineFact = z.strictObject({ sessionId: z.string().min(1).max(128), kind: z.string().min(1).max(64), seq: z.number().int().nonnegative(),
  time: z.number().int().nonnegative(), phaseId: z.string().nullable(), attemptId: z.string().nullable(), code: z.string().nullable() })
const Run = z.strictObject({ runId: z.string().min(1).max(128), sessionId: z.string().min(1).max(128), agentId: z.string().min(1).max(128),
  taskType: z.string().nullable(), title: z.string().nullable(), subject: z.string().nullable(), sourceSeq: z.number().int().nonnegative(),
  messageId: z.string().min(1).max(128), createdAt: z.number().int().nonnegative(), status: RunStatus,
  turnNumber: z.number().int().nonnegative().nullable(), phases: z.array(Phase), attempts: z.array(Attempt), outputs: z.array(Output),
  diagnostics: z.array(Diagnostic), timeline: z.array(TimelineFact) })
const Document = z.strictObject({ version: z.literal(1), revision: z.number().int().nonnegative(), prunedRuns: z.number().int().nonnegative(), runs: z.array(Run) })
const ConfigInput = z.strictObject({ serviceKey: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/).default('financeRuns'),
  domainSuffix: z.string().max(32).regex(/^[A-Za-z0-9_]*$/).default(''), retainedRuns: z.number().int().min(100).max(20000).default(5000), remote: z.boolean().default(true) })

function runIdFor(sessionId, seq) {
  return `fr-${createHash('sha256').update(`${sessionId}\0${seq}`).digest('hex').slice(0, 32)}`
}

/** Host-owned, durable read model for Runs derived from real Session events. */
export default class FinanceRuns extends TypertRemoteService {
  static inject = ['storageDomain', 'typert', 'sessions', 'sessionProjections']
  static Config = schema.object({ serviceKey: schema.string().default('financeRuns'), domainSuffix: schema.string().default(''),
    retainedRuns: schema.number().default(5000), remote: schema.boolean().default(true) })

  constructor(ctx, config) {
    const parsed = ConfigInput.parse(config ?? {})
    super(ctx, parsed.serviceKey)
    this.config = parsed
    this.active = false
    this.tail = Promise.resolve()
    this.waiters = new Map()
    this.globalWaiters = new Set()
  }

  async* [Service.init]() {
    const manifest = JSON.parse(await readFile(assetUrl('runtime-manifest.json'), 'utf8'))
    this.mainIds = new Set(manifest.roles.filter(role => role.kind === 'main').map(role => role.id))
    if (this.mainIds.size !== 3) throw new Error('FinanceRun requires the scoped three-Agent runtime manifest')
    this.domain = await this.ctx.storageDomain.open(defineDomain({ name: `financial_runs${this.config.domainSuffix}`, version: 1,
      tables: { state: domainTable(Document) } }))
    try {
      this.table = this.domain.table('state')
      const loaded = this.table.get('root')
      this.document = loaded ? Document.parse(loaded) : emptyRunDocument()
      const { remote, schemas } = createFinanceRunsRemoteContract(z)
      this.runSchemas = schemas
      this.active = true
      this.ctx.on('session/event', (session, event) => {
        if (!this.relevant(event.type)) return
        void this.serialize(() => this.consume(session, event, false)).catch(error =>
          this.ctx.logger.warn('FinanceRun event processing failed for Session %s: %s', session.id, String(error)))
      })
      if (this.config.remote) yield this.ctx.typert.register({ package: remote.package, face: 'host',
        schemas: Object.entries(schemas).map(([name, value]) => ({ name, create: () => value })),
        model: { services: [], events: [], objects: [] }, invocations: remote.descriptors })
      const sessions = this.ctx.sessions.list().slice().sort((left, right) => Number(left.header.origin === 'subagent') - Number(right.header.origin === 'subagent'))
      for (const session of sessions) await this.serialize(() => this.reconcile(session))
      await this.serialize(async () => {
        const next = interruptActiveRuns(this.document)
        if (next !== this.document) await this.persist(next)
      })
    } catch (error) {
      this.active = false
      await this.domain.close()
      throw error
    }
    yield async () => {
      this.active = false
      for (const listeners of this.waiters.values()) for (const resolve of listeners) resolve()
      this.waiters.clear()
      for (const resolve of this.globalWaiters) resolve()
      this.globalWaiters.clear()
      await this.tail
      await this.domain.close()
    }
  }

  relevant(type) {
    return ['user/message', 'turn/start', 'turn/end', 'step/start', 'step/end', 'tool/call', 'tool/result', 'assistant/message', 'assistant/attempt'].includes(type)
  }

  serialize(operation) {
    const run = this.tail.then(operation, operation)
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }

  live(session) { return this.ctx.sessions.get(session.id) === session }

  presetOf(session) {
    try { return this.ctx.sessionProjections.stateOf(session, 'agentPreset') }
    catch (error) {
      this.ctx.logger.warn('FinanceRun could not read the Session preset projection for %s: %s', session.id, String(error))
      return undefined
    }
  }

  async durable(session) {
    if (!this.live(session)) return false
    try { return await this.ctx.sessions.flush(session) && this.live(session) }
    catch (error) {
      this.ctx.logger.warn('FinanceRun durability checkpoint failed for %s: %s', session.id, String(error))
      return false
    }
  }

  apply(document, session, event, preset) {
    if (session.header.origin === 'subagent') {
      const parentSessionId = session.header.parentSession
      if (!parentSessionId) return document
      return applyWorkerEvent(document, { parentSessionId, childSessionId: session.id, agentId: typeof preset === 'string' ? preset : null }, event)
    }
    if (event.type === 'user/message') {
      if (event.data.source?.kind !== 'user' || typeof preset !== 'string' || !this.mainIds.has(preset)) return document
      return createRun(document, { runId: runIdFor(session.id, event.seq), sessionId: session.id, agentId: preset, message: event })
    }
    if (typeof preset !== 'string' || !this.mainIds.has(preset)) return document
    return applySessionEvent(document, session.id, event)
  }

  async consume(session, event, alreadyDurable) {
    if (!this.active || !this.live(session)) return
    if (event.type === 'user/message' && event.data.source?.kind !== 'user') return
    const preset = this.presetOf(session)
    const isWorker = session.header.origin === 'subagent' && Boolean(session.header.parentSession)
    if (!isWorker && (typeof preset !== 'string' || !this.mainIds.has(preset))) return
    if (isWorker && !this.document.runs.some(run => run.sessionId === session.header.parentSession && run.status === 'RUNNING')) return
    if (!alreadyDurable && !(await this.durable(session))) return
    const next = this.apply(this.document, session, event, preset)
    if (next !== this.document) await this.persist(next)
  }

  async reconcile(session) {
    if (!this.active || !this.live(session) || !(await this.durable(session))) return
    const preset = this.presetOf(session)
    const isWorker = session.header.origin === 'subagent' && Boolean(session.header.parentSession)
    if (!isWorker && (typeof preset !== 'string' || !this.mainIds.has(preset))) return
    let next = this.document
    for (const event of session.ownEvents()) if (this.relevant(event.type)) next = this.apply(next, session, event, preset)
    if (next !== this.document) await this.persist(next)
  }

  async persist(candidate) {
    const previousById = new Map(this.document.runs.map(run => [run.runId, run]))
    const nextIds = new Set(candidate.runs.map(run => run.runId))
    const affected = new Set(candidate.runs.filter(run => previousById.get(run.runId) !== run).map(run => run.sessionId))
    for (const run of this.document.runs) if (!nextIds.has(run.runId)) affected.add(run.sessionId)
    const parsed = Document.parse(candidate)
    const overflow = Math.max(0, parsed.runs.length - this.config.retainedRuns)
    const next = overflow === 0 ? parsed : Document.parse({ ...parsed,
      prunedRuns: parsed.prunedRuns + overflow, runs: parsed.runs.slice(overflow) })
    await this.table.put('root', next)
    this.document = next
    for (const sessionId of affected) this.notify(sessionId)
    for (const resolve of this.globalWaiters) resolve()
  }

  notify(sessionId) {
    const listeners = this.waiters.get(sessionId)
    if (!listeners) return
    this.waiters.delete(sessionId)
    for (const resolve of listeners) resolve()
  }

  waitForChange(sessionId, revision, signal) {
    if (signal.aborted || !this.active || this.document.revision !== revision) return Promise.resolve()
    return new Promise(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', finish)
        const listeners = this.waiters.get(sessionId)
        listeners?.delete(finish)
        if (listeners?.size === 0) this.waiters.delete(sessionId)
        resolve()
      }
      const listeners = this.waiters.get(sessionId) ?? new Set()
      listeners.add(finish)
      this.waiters.set(sessionId, listeners)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted || this.document.revision !== revision) finish()
    })
  }

  snapshot(request) {
    const { sessionId } = this.runSchemas.SnapshotRequest.parse(request)
    const runs = this.document.runs.filter(run => run.sessionId === sessionId).slice().reverse()
    return this.runSchemas.Snapshot.parse({ snapshotJson: JSON.stringify({ version: 1, revision: this.document.revision, sessionId, runs }) })
  }

  listRecent(request) {
    const { limit } = this.runSchemas.RecentRequest.parse(request)
    const runs = recentRuns(this.document, limit).map(({ runId, sessionId, agentId, taskType, title, subject, sourceSeq, messageId, createdAt, status }) =>
      ({ runId, sessionId, agentId, taskType, title, subject, sourceSeq, messageId, createdAt, status }))
    return this.runSchemas.Recent.parse({ runsJson: JSON.stringify({ version: 1, revision: this.document.revision,
      prunedRuns: this.document.prunedRuns, runs }) })
  }

  waitForGlobalChange(revision, signal) {
    if (signal.aborted || !this.active || this.document.revision !== revision) return Promise.resolve()
    return new Promise(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', finish)
        this.globalWaiters.delete(finish)
        resolve()
      }
      this.globalWaiters.add(finish)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted || this.document.revision !== revision) finish()
    })
  }

  async *follow(request, signal) {
    const { sessionId } = this.runSchemas.SnapshotRequest.parse(request)
    let revision = -1
    while (!signal.aborted && this.active) {
      const snapshot = this.snapshot({ sessionId })
      const value = JSON.parse(snapshot.snapshotJson)
      if (value.revision !== revision) { revision = value.revision; yield snapshot }
      await this.waitForChange(sessionId, revision, signal)
    }
  }

  async *followRecent(request, signal) {
    const { limit } = this.runSchemas.RecentRequest.parse(request)
    let revision = -1
    while (!signal.aborted && this.active) {
      const recent = this.listRecent({ limit })
      const value = JSON.parse(recent.runsJson)
      if (value.revision !== revision) { revision = value.revision; yield recent }
      await this.waitForGlobalChange(revision, signal)
    }
  }
}
