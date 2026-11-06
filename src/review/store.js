import { createHash } from 'node:crypto'
import { ReviewGate } from './gate.js'
import { requiredCheckpoints } from './policy.js'

const DOCUMENT_VERSION = 1
const STAGE_STATES = new Set(['RUNNING', 'COMPLETED', 'FAILED'])
const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }) }

const emptyDocument = () => ({ version: DOCUMENT_VERSION, revision: 0, reviews: [], stages: {} })
const stageKey = ({ runId, agentId, checkpointId }) => JSON.stringify([runId, agentId, checkpointId])
const digestOf = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * Durable review state over a caller-supplied document seam.
 *
 * `load()` returns the persisted document or undefined; `save(next)` persists it. The store
 * rebuilds its gate from decisions matching the active policy snapshot; older decisions remain
 * immutable history and cannot authorize a new snapshot. There is one fact source and a restart
 * cannot invent approvals. Stage records exist to classify interrupted
 * work; a process that restarted cannot resume a RUNNING stage in place.
 */
export class ReviewStore {
  #snapshot
  #load
  #save
  #now
  #document
  #gate

  constructor({ snapshot, load, save, now = () => new Date().toISOString() }) {
    if (!snapshot?.version || !snapshot.requirements) fail('POLICY_SNAPSHOT_INVALID', 'a resolved policy snapshot is required')
    if (typeof load !== 'function' || typeof save !== 'function') fail('STORE_SEAM_INVALID', 'load and save functions are required')
    this.#snapshot = snapshot
    this.#load = load
    this.#save = save
    this.#now = now
    this.#document = emptyDocument()
    this.#gate = new ReviewGate({ snapshot, now })
  }

  /** Load persisted state and convert any stage that was RUNNING at shutdown into an unknown termination. */
  async open() {
    const persisted = await this.#load()
    const document = persisted ? this.#normalize(persisted) : emptyDocument()
    this.#gate = new ReviewGate({ snapshot: this.#snapshot, now: this.#now })
    for (const review of document.reviews) {
      // Keep decisions from older policy snapshots as immutable audit history, but never replay
      // them into the active gate: a matching policy version alone does not authorize a decision
      // under a different requirements digest.
      if (review.snapshotDigest !== this.#snapshot.digest) continue
      const outcome = this.#gate.settle(review)
      if (outcome.status !== 'SETTLED' && outcome.status !== 'IDEMPOTENT_NOOP') {
        fail('STORE_CORRUPT', `persisted review ${review.reviewId} could not be replayed: ${outcome.status}`)
      }
    }
    let interrupted = 0
    for (const record of Object.values(document.stages)) {
      if (record.status === 'RUNNING') {
        record.status = 'UNKNOWN_TERMINATED'
        record.classifiedAt = this.#now()
        record.reason = 'PROCESS_RESTARTED_WITHOUT_TERMINAL_STAGE_RECORD'
        record.interruptedRevision = document.revision
        interrupted += 1
      }
    }
    this.#document = document
    if (interrupted) await this.#persist({ ...document, revision: document.revision })
    return Object.freeze({ revision: document.revision, reviews: document.reviews.length, stages: Object.keys(document.stages).length, interrupted })
  }

  #normalize(document) {
    if (!document || typeof document !== 'object') fail('STORE_CORRUPT', 'document must be an object')
    if (document.version !== DOCUMENT_VERSION) fail('STORE_CORRUPT', `unsupported document version ${String(document.version)}`)
    if (!Number.isInteger(document.revision) || document.revision < 0) fail('STORE_CORRUPT', 'revision must be a nonnegative integer')
    if (!Array.isArray(document.reviews)) fail('STORE_CORRUPT', 'reviews must be an array')
    if (!document.stages || typeof document.stages !== 'object') fail('STORE_CORRUPT', 'stages must be an object')
    return { version: DOCUMENT_VERSION, revision: document.revision, reviews: [...document.reviews],
      stages: Object.fromEntries(Object.entries(document.stages).map(([key, value]) => [key, { ...value }])) }
  }

  async #persist(document) {
    const next = { ...document, revision: document.revision + 1, savedAt: this.#now() }
    await this.#save(next)
    this.#document = next
    return next.revision
  }

  /** Rebuild the gate after a failed save so memory never claims a decision that was not persisted. */
  #rebuildGate() {
    this.#gate = new ReviewGate({ snapshot: this.#snapshot, now: this.#now })
    for (const review of this.#document.reviews) this.#gate.settle(review)
  }

  /** Record one decision, persisting before it can influence a gate decision. */
  async settle(record) {
    const outcome = this.#gate.settle(record)
    if (outcome.status !== 'SETTLED') return outcome
    const candidate = { ...this.#document, reviews: [...this.#document.reviews, outcome.settled] }
    try {
      const revision = await this.#persist(candidate)
      return Object.freeze({ ...outcome, revision })
    } catch (error) {
      this.#rebuildGate()
      fail('STORE_SAVE_FAILED', `decision was not persisted: ${error?.code ?? 'unknown'}`)
    }
  }

  /** Decision for a stage. Reads only persisted-and-replayed state. */
  evaluate(request) { return this.#gate.evaluate(request) }

  /** Record a stage transition. `RUNNING` is only meaningful within one process lifetime. */
  async recordStage({ sessionId, runId, agentId, checkpointId, status, artifact, errorCode = null }) {
    if (!runId || !agentId || !checkpointId) fail('STAGE_RECORD_INVALID', 'runId, agentId and checkpointId are required')
    if (!STAGE_STATES.has(status)) fail('STAGE_RECORD_INVALID', 'status must be RUNNING, COMPLETED or FAILED')
    if (errorCode !== null) {
      if (typeof errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(errorCode)) {
        fail('STAGE_RECORD_INVALID', 'errorCode must be an uppercase diagnostic code')
      }
      if (status !== 'FAILED') fail('STAGE_RECORD_INVALID', 'errorCode is only meaningful for a FAILED stage')
    }
    const key = stageKey({ runId, agentId, checkpointId })
    const record = { runId, agentId, checkpointId, status, updatedAt: this.#now() }
    if (typeof sessionId === 'string' && sessionId) record.sessionId = sessionId
    if (errorCode !== null) record.errorCode = errorCode
    if (artifact) record.artifact = { hash: artifact.hash ?? null, version: artifact.version ?? null }
    const candidate = { ...this.#document, stages: { ...this.#document.stages, [key]: record } }
    try {
      const revision = await this.#persist(candidate)
      return Object.freeze({ ...record, revision })
    } catch (error) {
      fail('STORE_SAVE_FAILED', `stage was not persisted: ${error?.code ?? 'unknown'}`)
    }
  }

  /** Requirement tier for one checkpoint, or null when the policy does not require it. */
  requirementOf(agentId, checkpointId) {
    return this.#snapshot.requirements?.[agentId]?.[checkpointId] ?? null
  }

  /** Approve-only projection shared by the queue and the recovery view. */
  #requirementOf(agentId, checkpointId) {
    return this.#snapshot.requirements?.[agentId]?.[checkpointId] ?? null
  }

  /**
   * Cross-session queue projection. Each entry is derived from the persisted review fact for its
   * session/run, so two sessions never collapse into one row and no local mirror is consulted.
   */
  async queue() {
    const rows = []
    const reviewsByKey = new Map()
    for (const review of this.#document.reviews) {
      reviewsByKey.set(stageKey(review), review)
    }
    for (const agentId of Object.keys(this.#snapshot.requirements)) {
      for (const checkpointId of requiredCheckpoints(this.#snapshot, agentId)) {
        const requirement = this.#requirementOf(agentId, checkpointId)
        const stages = Object.values(this.#document.stages).filter(record => record.agentId === agentId && record.checkpointId === checkpointId)
        if (!stages.length) continue
        for (const stage of stages) {
          const review = reviewsByKey.get(stageKey(stage))
          const decision = review && review.snapshotDigest !== this.#snapshot.digest
            ? Object.freeze({ decision: 'HOLD', reason: 'SNAPSHOT_MISMATCH', agentId, checkpointId, reviewId: review.reviewId })
            : this.#gate.evaluate({ sessionId: review?.sessionId ?? stage.sessionId ?? '', runId: stage.runId,
              agentId, checkpointId, artifact: stage.artifact ?? { version: 'unrecorded' } })
          rows.push(Object.freeze({
            sessionId: review?.sessionId ?? stage.sessionId ?? null, runId: stage.runId, agentId, checkpointId, requirement,
            reviewId: review?.reviewId ?? null, decision: decision.decision, reason: decision.reason,
            stageStatus: stage.status, updatedAt: stage.updatedAt,
          }))
        }
      }
    }
    return Object.freeze(rows.sort((a, b) => (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0)))
  }

  /**
   * Restart classification for one run: pending review, completed, needs rerun, or unknown
   * termination. It never claims an in-place resume of an interrupted stage.
   */
  classify(runId) {
    const stages = Object.values(this.#document.stages).filter(record => record.runId === runId)
    if (!stages.length) return Object.freeze({ runId, status: 'UNKNOWN_RUN' })
    const reviews = new Map(this.#document.reviews.map(review => [stageKey(review), review]))
    const failed = stages.filter(record => record.status === 'FAILED')
    const interrupted = stages.filter(record => record.status === 'UNKNOWN_TERMINATED')
    const invalidated = []
    for (const stage of stages) {
      const review = reviews.get(stageKey(stage))
      if (!review || !stage.artifact) continue
      const same = review.artifactRef.hash && stage.artifact.hash
        ? review.artifactRef.hash === stage.artifact.hash
        : review.artifactRef.version && stage.artifact.version
          ? review.artifactRef.version === stage.artifact.version
          : false
      if (!same) invalidated.push(stage)
    }
    if (failed.length) return Object.freeze({ runId, status: 'NEEDS_RERUN', reason: 'STAGE_FAILED', stages: failed.length })
    if (invalidated.length) return Object.freeze({ runId, status: 'NEEDS_RERUN', reason: 'ARTIFACT_CHANGED_SINCE_APPROVAL', stages: invalidated.length })
    if (interrupted.length) {
      return Object.freeze({ runId, status: 'UNKNOWN_TERMINATED', reason: 'PROCESS_RESTARTED_WITHOUT_TERMINAL_STAGE_RECORD', stages: interrupted.length })
    }
    const agents = [...new Set(stages.map(record => record.agentId))]
    const awaitingReview = []
    const missingStage = []
    for (const agentId of agents) {
      for (const checkpointId of requiredCheckpoints(this.#snapshot, agentId)) {
        const stage = stages.find(record => record.agentId === agentId && record.checkpointId === checkpointId)
        if (!stage) { missingStage.push({ agentId, checkpointId }); continue }
        const review = reviews.get(stageKey(stage))
        if (!review || review.snapshotDigest !== this.#snapshot.digest || review.status !== 'APPROVED') awaitingReview.push({ agentId, checkpointId })
      }
    }
    if (missingStage.length) {
      return Object.freeze({ runId, status: 'IN_PROGRESS', reason: 'REQUIRED_STAGE_NOT_STARTED', outstanding: missingStage.length })
    }
    if (awaitingReview.length) {
      return Object.freeze({ runId, status: 'PENDING_REVIEW', outstanding: awaitingReview.length })
    }
    const terminal = stages.filter(record => record.status === 'COMPLETED')
    if (terminal.length === stages.length) return Object.freeze({ runId, status: 'COMPLETED', stages: stages.length })
    return Object.freeze({ runId, status: 'IN_PROGRESS', stages: stages.length })
  }

  /** Read-only stage records, used to project run progress without a second store. */
  stageRecords() {
    return Object.freeze(Object.values(this.#document.stages).map(record => Object.freeze({ ...record })))
  }

  /** Read-only snapshot of the persisted document for diagnostics and evidence. */
  inspect() {
    return Object.freeze({ revision: this.#document.revision, documentDigest: digestOf(this.#document),
      reviews: this.#document.reviews.length, stages: Object.keys(this.#document.stages).length })
  }
}
