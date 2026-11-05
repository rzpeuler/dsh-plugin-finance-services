import schema from '@deepseek-ai/schemastery'
import { Service } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { EXTERNAL_SIDE_EFFECTS, LOCKED_BOUNDARIES, POLICY_IDS, resolvePolicy } from './policy.js'
import { ReviewStore } from './store.js'

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
  runId: z.string().min(1).max(128), agentId: z.string().min(1).max(128), checkpointId: z.string().min(1).max(96),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'UNKNOWN_TERMINATED']),
  updatedAt: z.string().min(1).max(40), artifact: Artifact.optional(),
  classifiedAt: z.string().max(40).optional(), reason: z.string().max(160).optional(),
  interruptedRevision: z.number().int().min(0).optional(),
})
const Document = z.object({
  version: z.literal(1), revision: z.number().int().min(0),
  reviews: z.array(Review), stages: z.record(z.string(), Stage), savedAt: z.string().max(40).optional(),
})
const ConfigInput = z.strictObject({
  policyId: z.enum(POLICY_IDS).default('original'),
  customJson: z.string().max(20000).default(''),
})
const Custom = z.record(z.string(), z.record(z.string(), z.boolean()))

/**
 * Host review service: one durable own-domain document, one policy snapshot, no tool or
 * external-side-effect authority. Decisions are recorded; nothing here publishes or posts.
 */
export default class FinanceReview extends Service {
  static inject = ['storageDomain']
  static Config = schema.object({
    policyId: schema.string().default('original'),
    customJson: schema.string().default(''),
  })

  constructor(ctx, config) {
    super(ctx, 'financeReview')
    this.config = ConfigInput.parse(config ?? {})
    this.active = false
    this.tail = Promise.resolve()
  }

  async* [Service.init]() {
    const custom = this.config.customJson ? Custom.parse(JSON.parse(this.config.customJson)) : undefined
    this.snapshot = resolvePolicy({ bundle: { policyId: this.config.policyId, ...(custom ? { custom } : {}) } })
    this.domain = await this.ctx.storageDomain.open(defineDomain({
      name: 'financial_review', version: 1, tables: { state: domainTable(Document) },
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
    this.opened = await this.store.open()
    this.active = true
    yield async () => {
      this.active = false
      await this.tail
      await this.domain.close()
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

  /** Diagnostics for evidence: persisted revision, document digest and replay counts. */
  inspect() {
    this.requireStore()
    return { ...this.store.inspect(), policyVersion: this.snapshot.version, policyDigest: this.snapshot.digest,
      opened: { ...this.opened }, pinnedPolicyId: this.config.policyId }
  }
}
