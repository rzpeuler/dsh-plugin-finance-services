import { readFile } from 'node:fs/promises'
import schema from '@deepseek-ai/schemastery'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { EXTERNAL_SIDE_EFFECTS, LOCKED_BOUNDARIES, POLICY_IDS, resolvePolicy } from './policy.js'
import { ReviewStore } from './store.js'
import { createReviewRemoteContract } from './remote.js'
import { assetUrl } from '../asset-location.js'

const Artifact = z.object({ hash: z.string().nullable(), version: z.string().nullable() })
const Review = z.object({
  reviewId: z.string().min(1).max(96), sessionId: z.string().min(1).max(128), runId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(128), checkpointId: z.string().min(1).max(96),
  policyVersion: z.string().min(1).max(64), snapshotDigest: z.string().min(1).max(64),
  status: z.enum(['APPROVED', 'REJECTED']), actor: z.string().min(1).max(128),
  decidedAt: z.string().min(1).max(40), expiresAt: z.string().max(40).nullable(),
  artifactRef: Artifact,
})
const Stage = z.object({
  sessionId: z.string().min(1).max(128).optional(),
  runId: z.string().min(1).max(128), agentId: z.string().min(1).max(128), checkpointId: z.string().min(1).max(96),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN_TERMINATED']),
  errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/).optional(),
  updatedAt: z.string().min(1).max(40), artifact: Artifact.optional(),
  classifiedAt: z.string().max(40).optional(), reason: z.string().max(160).optional(),
  interruptedRevision: z.number().int().min(0).optional(),
})
const Document = z.object({
  version: z.literal(1), revision: z.number().int().min(0),
  reviews: z.array(Review), stages: z.record(z.string(), Stage), savedAt: z.string().max(40).optional(),
})
const Deliverable = z.object({
  deliverableId: z.string().min(1).max(96), sessionId: z.string().min(1).max(128),
  runId: z.string().min(1).max(128), agentId: z.string().min(1).max(128),
  path: z.string().min(1).max(512), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(0).max(1073741824),
  classification: z.enum(['TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED', 'LICENSED']),
  reviewId: z.string().max(96).nullable(), recordedAt: z.string().min(1).max(40),
})
const ArtifactDocument = z.object({
  version: z.literal(1), revision: z.number().int().min(0),
  deliverables: z.array(Deliverable).max(2000), savedAt: z.string().max(40).optional(),
})
const DeliverableInput = z.strictObject({
  sessionId: z.string().min(1).max(128), runId: z.string().min(1).max(128), agentId: z.string().min(1).max(128),
  path: z.string().min(1).max(512).refine(value => !value.startsWith('/') && !value.includes('..') && !/^[a-z]:/i.test(value), 'path must be a relative workspace path'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().min(0).max(1073741824),
  classification: z.enum(['TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED', 'LICENSED']),
  reviewId: z.string().min(1).max(96).nullable().default(null),
})
const ConfigInput = z.strictObject({
  policyId: z.enum(POLICY_IDS).default('original'),
  customJson: z.string().max(20000).default(''),
  serviceKey: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/).default('financeReview'),
  domainSuffix: z.string().max(32).regex(/^[A-Za-z0-9_]*$/).default(''),
  remote: z.boolean().default(true),
})
const Custom = z.record(z.string(), z.record(z.string(), z.boolean()))

/**
 * Host review service: one durable own-domain document, one policy snapshot, no tool or
 * external-side-effect authority. Decisions are recorded; nothing here publishes or posts.
 */
export default class FinanceReview extends TypertRemoteService {
  static inject = ['storageDomain', 'typert']
  static Config = schema.object({
    policyId: schema.string().default('original'),
    customJson: schema.string().default(''),
    serviceKey: schema.string().default('financeReview'),
    domainSuffix: schema.string().default(''),
    remote: schema.boolean().default(true),
  })

  constructor(ctx, config) {
    const parsed = ConfigInput.parse(config ?? {})
    // A separate instance (for example a strict policy check) uses its own service key and domain.
    super(ctx, parsed.serviceKey)
    this.config = parsed
    this.active = false
    this.tail = Promise.resolve()
  }

  async* [Service.init]() {
    const manifest = JSON.parse(await readFile(assetUrl('agent-manifest.json'), 'utf8'))
    this.roleKinds = new Map(manifest.roles.map(role => [role.id, role.kind]))
    const custom = this.config.customJson ? Custom.parse(JSON.parse(this.config.customJson)) : undefined
    this.snapshot = resolvePolicy({ bundle: { policyId: this.config.policyId, ...(custom ? { custom } : {}) } })
    this.domain = await this.ctx.storageDomain.open(defineDomain({
      name: `financial_review${this.config.domainSuffix}`, version: 1, tables: { state: domainTable(Document) },
    }))
    const table = this.domain.table('state')
    this.table = table
    this.store = new ReviewStore({
      snapshot: this.snapshot,
      load: async () => {
        const document = table.get('root')
        return document ? { ...document } : undefined
      },
      save: async document => { await table.put('root', document) },
    })
    this.artifactsDomain = await this.ctx.storageDomain.open(defineDomain({
      name: `financial_artifacts${this.config.domainSuffix}`, version: 1, tables: { index: domainTable(ArtifactDocument) },
    }))
    this.artifactsTable = this.artifactsDomain.table('index')
    this.opened = await this.store.open()
    const { remote, schemas } = createReviewRemoteContract(z)
    this.reviewSchemas = schemas
    this.active = true
    if (this.config.remote) {
      yield this.ctx.typert.register({ package: remote.package, face: 'host',
        schemas: Object.entries(schemas).map(([name, value]) => ({ name, create: () => value })),
        model: { services: [], events: [], objects: [] }, invocations: remote.descriptors })
    }
    yield async () => {
      this.active = false
      await this.tail
      await this.domain.close()
      await this.artifactsDomain.close()
    }
  }

  requireStore() {
    if (!this.active || !this.store) throw Object.assign(new Error('Review service is not active'), { code: 'REVIEW_SERVICE_UNAVAILABLE' })
    return this.store
  }

  serialize(operation) {
    const run = this.tail.then(operation, operation)
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }

  artifacts() {
    const document = this.artifactsTable?.get('root')
    if (!document) return { revision: 0, deliverables: [] }
    return document
  }

  /** Record one deliverable. Duplicates by run, path and hash are refused, never merged. */
  registerDeliverable(request) {
    this.requireStore()
    const input = DeliverableInput.parse(request)
    const document = this.artifacts()
    if (document.deliverables.length >= 2000) return Object.freeze({ status: 'LIMIT', revision: document.revision })
    const duplicate = document.deliverables.find(item => item.runId === input.runId && item.path === input.path && item.sha256 === input.sha256)
    if (duplicate) return Object.freeze({ status: 'DUPLICATE', revision: document.revision, deliverableId: duplicate.deliverableId })
    const record = { ...input, deliverableId: `deliverable-${document.revision + 1}-${input.sha256.slice(0, 12)}`,
      recordedAt: new Date().toISOString() }
    const next = { version: 1, revision: document.revision + 1,
      deliverables: [...document.deliverables, record], savedAt: new Date().toISOString() }
    // Persist before publish, like the review store: a failed save cannot leave a phantom index entry.
    const table = this.artifactsTable
    return table.put('root', next).then(() => Object.freeze({ status: 'RECORDED', revision: next.revision, deliverableId: record.deliverableId }))
  }

  /** Run projection from persisted stage and review facts, joined with the deliverable index. */
  runs() {
    this.requireStore()
    const stages = this.store.stageRecords()
    const deliverables = this.artifacts().deliverables
    const grouped = new Map()
    for (const stage of stages) {
      if (!grouped.has(stage.runId)) grouped.set(stage.runId, { runId: stage.runId, agents: new Set(), sessions: new Set(), checkpoints: {}, deliverableCount: 0 })
      const run = grouped.get(stage.runId)
      run.agents.add(stage.agentId)
      if (stage.sessionId) run.sessions.add(stage.sessionId)
      run.checkpoints[stage.checkpointId] = stage.status
      if (stage.errorCode) { run.errors ??= {}; run.errors[stage.checkpointId] = stage.errorCode }
    }
    for (const item of deliverables) {
      const run = grouped.get(item.runId)
      if (run) run.deliverableCount += 1
    }
    const runsList = [...grouped.values()].map(run => ({
      runId: run.runId, agents: [...run.agents].sort(), sessions: [...run.sessions].sort(),
      checkpoints: run.checkpoints, errors: run.errors ?? {}, classification: this.store.classify(run.runId).status,
      deliverableCount: run.deliverableCount,
    })).sort((a, b) => (a.runId < b.runId ? -1 : 1)).slice(0, 200)
    return Object.freeze(runsList.map(run => Object.freeze({ ...run })))
  }

  /** Remote read model: the run projection as bounded JSON. */
  reviewRuns(request) {
    this.reviewSchemas.Empty.parse(request)
    const runsJson = JSON.stringify({ runs: this.runs(), deliverableRevision: this.artifacts().revision })
    return this.reviewSchemas.Runs.parse({ runsJson })
  }

  /** Remote read model: the deliverable index as bounded JSON. */
  reviewDeliverables(request) {
    this.reviewSchemas.Empty.parse(request)
    const document = this.artifacts()
    const items = [...document.deliverables].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)).slice(0, 200)
    return this.reviewSchemas.Deliverables.parse({ deliverablesJson: JSON.stringify({ revision: document.revision, deliverables: items }) })
  }

  /** Remote read model: the queue projection as bounded JSON. Read-only; no decision endpoint. */
  async reviewSummary(request) {
    this.reviewSchemas.Empty.parse(request)
    const projection = await this.queueProjection()
    const summaryJson = JSON.stringify(projection)
    if (Buffer.byteLength(summaryJson, 'utf8') > 1900000) {
      throw Object.assign(new Error('Review summary exceeds the wire limit'), { code: 'REVIEW_SUMMARY_TOO_LARGE' })
    }
    return this.reviewSchemas.Summary.parse({ summaryJson })
  }

  /** Remote read model: the pinned policy identity and requirement matrix. */
  reviewPolicy(request) {
    this.reviewSchemas.Empty.parse(request)
    return this.reviewSchemas.Policy.parse({ policyJson: JSON.stringify(this.policy()) })
  }

  /** The resolved snapshot is fixed at service start; a new policy needs a new service lifetime. */
  policy() {
    this.requireStore()
    return {
      policyId: this.snapshot.policyId, version: this.snapshot.version, digest: this.snapshot.digest,
      appliedLevels: [...this.snapshot.appliedLevels], lockedBoundaries: [...LOCKED_BOUNDARIES.map(item => item.id)],
      externalSideEffects: EXTERNAL_SIDE_EFFECTS, requirements: this.snapshot.requirements,
    }
  }

  settle(record) { return this.serialize(() => this.requireStore().settle(record)) }
  recordStage(record) { return this.serialize(() => this.requireStore().recordStage(record)) }
  evaluate(request) { return this.requireStore().evaluate(request) }
  classify(request) { return this.requireStore().classify(request?.runId) }
  async queue() { return this.requireStore().queue() }

  requirementOf({ agentId, checkpointId } = {}) { return this.requireStore().requirementOf(agentId, checkpointId) }

  /**
   * Host projection for a cross-session review queue. Every row comes from the persisted review
   * facts; the projection only adds whether the owning native Session is still live.
   */
  async queueProjection() {
    const store = this.requireStore()
    const rows = await store.queue()
    const agents = this.ctx.get('agents')
    const presets = this.ctx.get('agentPresets')
    const groups = new Map()
    for (const row of rows) {
      const key = row.sessionId ?? 'UNSCOPED'
      if (!groups.has(key)) {
        const agent = row.sessionId && agents ? agents.get(row.sessionId) : undefined
        groups.set(key, {
          sessionId: row.sessionId, live: !!agent,
          preset: agent && presets ? presets.composedPreset(agent.ctx) ?? null : null,
          status: row.sessionId ? (agent ? 'LIVE_SESSION' : 'SESSION_NOT_LIVE') : 'UNSCOPED_RUN',
          items: [],
        })
      }
      groups.get(key).items.push(row)
    }
    const list = [...groups.values()].map(group => ({
      ...group,
      pending: group.items.filter(item => item.decision === 'HOLD').length,
      decided: group.items.filter(item => item.decision === 'ALLOW').length,
    })).sort((a, b) => (a.sessionId ?? '') < (b.sessionId ?? '') ? -1 : 1)
    const inspected = store.inspect()
    return Object.freeze({
      source: 'financial_review.domain/state', revision: inspected.revision, documentDigest: inspected.documentDigest,
      groups: Object.freeze(list.map(group => Object.freeze({ ...group, items: Object.freeze(group.items) }))),
      totals: Object.freeze({ sessions: list.length, items: rows.length,
        pending: rows.filter(row => row.decision === 'HOLD').length,
        decided: rows.filter(row => row.decision === 'ALLOW').length }),
    })
  }

  /**
   * Ask a human through the native question service about a required checkpoint.
   *
   * The runtime ownership boundary decides who may ask: an owned child has no human answerer, so
   * it is refused before the question is raised. An answer never becomes an approval; the caller
   * must still record an explicit decision.
   */
  async requestReview(request = {}) {
    const store = this.requireStore()
    const agents = this.ctx.get('agents')
    const questions = this.ctx.get('userQuestions')
    if (!agents || !questions) return Object.freeze({ status: 'NOT_CONFIGURED' })
    const { sessionId, runId, agentId, checkpointId } = request
    for (const [name, value] of Object.entries({ sessionId, runId, agentId, checkpointId })) {
      if (typeof value !== 'string' || !value || value.length > 128) {
        throw Object.assign(new Error(`REVIEW_REQUEST_INVALID: ${name} is required`), { code: 'REVIEW_REQUEST_INVALID' })
      }
    }
    const agent = agents.get(sessionId)
    if (!agent) return Object.freeze({ status: 'CALLER_NOT_LIVE', agentId })
    const preset = this.ctx.get('agentPresets')?.composedPreset(agent.ctx)
    if (!preset || this.roleKinds.get(preset) !== 'main') {
      return Object.freeze({ status: 'WORKER_CANNOT_ASK', agentId, reason: 'ONLY_MAIN_AGENT', role: preset ?? null })
    }
    if (!agents.roots().includes(agent)) {
      return Object.freeze({ status: 'WORKER_CANNOT_ASK', agentId, reason: 'OWNED_CHILD', role: preset })
    }
    if (!store.requirementOf(agentId, checkpointId)) return Object.freeze({ status: 'NOT_REQUIRED_BY_POLICY', agentId, checkpointId })
    const timeoutMs = Math.min(Math.max(Number.isInteger(request.timeoutMs) ? request.timeoutMs : 5000, 250), 60000)
    const callId = `finance-review-${this.snapshot.digest.slice(0, 8)}-${checkpointId}`.slice(0, 96)
    const question = {
      id: checkpointId,
      header: 'Financial review',
      question: request.question ?? `Approve the ${checkpointId.replaceAll('_', ' ')} checkpoint for ${agentId}?`,
      options: [{ label: 'Approve' }, { label: 'Reject' }],
      multiSelect: false,
    }
    try {
      const result = await questions.askTimed({ agent, questions: [question], wait: { callId, timed: true } }, callId, timeoutMs)
      if (result?.pending) return Object.freeze({ status: 'PENDING', callId, timeoutMs })
      return Object.freeze({ status: 'ANSWERED', callId, answers: result?.answers ?? [], approvalCreated: false })
    } catch (error) {
      const code = error?.code
      if (code === 'DELEGATED_CALLER') return Object.freeze({ status: 'WORKER_CANNOT_ASK', agentId, nativeCode: code })
      if (code === 'CALLER_NOT_LIVE') return Object.freeze({ status: 'CALLER_NOT_LIVE', agentId, nativeCode: code })
      if (code === 'ASK_ABORTED') return Object.freeze({ status: 'CANCELLED', agentId, nativeCode: code })
      return Object.freeze({ status: 'QUESTION_FAILED', agentId, nativeCode: typeof code === 'string' ? code.slice(0, 64) : 'UNKNOWN' })
    }
  }

  /** Diagnostics for evidence: persisted revision, document digest and replay counts. */
  inspect() {
    this.requireStore()
    return { ...this.store.inspect(), policyVersion: this.snapshot.version, policyDigest: this.snapshot.digest,
      opened: { ...this.opened }, pinnedPolicyId: this.config.policyId }
  }
}
