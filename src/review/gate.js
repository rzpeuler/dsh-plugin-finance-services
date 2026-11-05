import { createHash } from 'node:crypto'
import { CHECKPOINTS, requiredCheckpoints } from './policy.js'

const STATUSES = new Set(['APPROVED', 'REJECTED'])
const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }) }

const text = (value, name, max = 128) => {
  if (typeof value !== 'string' || !value || value.length > max) fail('REVIEW_RECORD_INVALID', `${name} must be a nonempty string of at most ${max} characters`)
  return value
}

const hashPattern = /^[a-f0-9]{64}$/

/** An artifact is identified by content hash when available, otherwise by a version token. */
function artifactIdentity(artifact, name = 'artifact') {
  if (!artifact || typeof artifact !== 'object') fail('REVIEW_RECORD_INVALID', `${name} is required`)
  const hash = artifact.hash ?? null
  const version = artifact.version ?? null
  if (hash !== null && !hashPattern.test(String(hash))) fail('REVIEW_RECORD_INVALID', `${name}.hash must be a lowercase sha256`)
  if (version !== null && (typeof version !== 'string' || !version || version.length > 128)) fail('REVIEW_RECORD_INVALID', `${name}.version must be a bounded string`)
  if (hash === null && version === null) fail('ARTIFACT_IDENTITY_REQUIRED', `${name} needs a hash or a version`)
  return { hash, version }
}

const canonical = value => JSON.stringify(value)

/**
 * Deterministic review gate over one immutable policy snapshot.
 *
 * It records human decisions and answers "may this stage proceed"; it never grants tool,
 * filesystem, MCP or external-side-effect authority, and it never posts or publishes.
 */
export class ReviewGate {
  #settlements = new Map()

  constructor({ snapshot, now = () => new Date().toISOString() } = {}) {
    if (!snapshot?.version || !snapshot.requirements) fail('POLICY_SNAPSHOT_INVALID', 'a resolved policy snapshot is required')
    this.snapshot = snapshot
    this.now = now
  }

  #key({ sessionId, runId, agentId, checkpointId }) { return canonical([sessionId, runId, agentId, checkpointId]) }

  #requirement(agentId, checkpointId) {
    const catalogue = CHECKPOINTS[agentId]
    if (!catalogue) fail('POLICY_UNKNOWN_AGENT', `unknown agent ${String(agentId)}`)
    if (!catalogue.some(item => item.id === checkpointId)) fail('POLICY_UNKNOWN_CHECKPOINT', `${agentId} has no checkpoint ${checkpointId}`)
    return this.snapshot.requirements?.[agentId]?.[checkpointId] ?? null
  }

  /**
   * Record one human decision. The first valid decision for (session, run, agent, checkpoint)
   * wins; repeats are rejected and an identical retry is a no-op.
   */
  settle(record) {
    const reviewId = text(record?.reviewId, 'reviewId', 96)
    const sessionId = text(record?.sessionId, 'sessionId')
    const runId = text(record?.runId, 'runId')
    const agentId = text(record?.agentId, 'agentId')
    const checkpointId = text(record?.checkpointId, 'checkpointId', 96)
    const policyVersion = text(record?.policyVersion, 'policyVersion', 64)
    const actor = text(record?.actor, 'actor')
    const decidedAt = text(record?.decidedAt, 'decidedAt', 40)
    if (!STATUSES.has(record?.status)) fail('REVIEW_RECORD_INVALID', 'status must be APPROVED or REJECTED')
    if (!/^\d{4}-\d{2}-\d{2}T/.test(decidedAt) || Number.isNaN(Date.parse(decidedAt))) fail('REVIEW_RECORD_INVALID', 'decidedAt must be an ISO timestamp')
    const artifactRef = artifactIdentity(record?.artifactRef, 'artifactRef')
    const checkpoint = this.#requirement(agentId, checkpointId)
    if (!checkpoint) {
      return Object.freeze({ status: 'NOT_REQUIRED_BY_POLICY', reviewId, agentId, checkpointId })
    }
    if (policyVersion !== this.snapshot.version) {
      return Object.freeze({ status: 'STALE_POLICY_VERSION', reviewId, expected: this.snapshot.version, received: policyVersion })
    }
    const key = this.#key({ sessionId, runId, agentId, checkpointId })
    const payload = canonical({ status: record.status, actor, artifactRef })
    const existing = this.#settlements.get(key)
    if (existing) {
      if (existing.reviewId === reviewId && existing.payload === payload) {
        return Object.freeze({ status: 'IDEMPOTENT_NOOP', reviewId, settled: existing.summary })
      }
      return Object.freeze({ status: 'ALREADY_SETTLED', reviewId, settled: existing.summary })
    }
    const expiresAt = record.expiresAt ?? null
    if (expiresAt !== null && (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt)))) {
      fail('REVIEW_RECORD_INVALID', 'expiresAt must be an ISO timestamp when supplied')
    }
    const summary = Object.freeze({
      reviewId, sessionId, runId, agentId, checkpointId, policyVersion,
      snapshotDigest: this.snapshot.digest,
      status: record.status, actor, decidedAt, expiresAt, artifactRef,
    })
    this.#settlements.set(key, { reviewId, payload, summary, key })
    return Object.freeze({ status: 'SETTLED', reviewId, settled: summary })
  }

  /** Decide whether a stage may proceed. Fails closed on any identity, version or expiry mismatch. */
  evaluate({ sessionId, runId, agentId, checkpointId, artifact } = {}) {
    const requirement = this.#requirement(agentId, checkpointId)
    if (!requirement) return Object.freeze({ decision: 'ALLOW', reason: 'NOT_REQUIRED_BY_POLICY', agentId, checkpointId })
    const current = artifactIdentity(artifact)
    const settlement = this.#settlements.get(this.#key({ sessionId, runId, agentId, checkpointId }))
    if (!settlement) return Object.freeze({ decision: 'HOLD', reason: 'REVIEW_REQUIRED', agentId, checkpointId })
    const record = settlement.summary
    if (record.policyVersion !== this.snapshot.version || record.snapshotDigest !== this.snapshot.digest) {
      return Object.freeze({ decision: 'HOLD', reason: 'SNAPSHOT_MISMATCH', agentId, checkpointId })
    }
    if (record.status !== 'APPROVED') {
      return Object.freeze({ decision: 'HOLD', reason: 'REVIEW_REJECTED', agentId, checkpointId, reviewId: record.reviewId })
    }
    const sameArtifact = current.hash !== null && record.artifactRef.hash !== null
      ? current.hash === record.artifactRef.hash
      : current.version !== null && record.artifactRef.version !== null
        ? current.version === record.artifactRef.version
        : false
    if (!sameArtifact) {
      return Object.freeze({ decision: 'HOLD', reason: 'ARTIFACT_CHANGED_SINCE_REVIEW', agentId, checkpointId, reviewId: record.reviewId })
    }
    if (record.expiresAt && Date.parse(this.now()) > Date.parse(record.expiresAt)) {
      return Object.freeze({ decision: 'HOLD', reason: 'REVIEW_EXPIRED', agentId, checkpointId, reviewId: record.reviewId })
    }
    return Object.freeze({ decision: 'ALLOW', reason: 'APPROVED', agentId, checkpointId, reviewId: record.reviewId })
  }

  /** Required checkpoints that have no usable approval yet, across every session this gate saw. */
  pending() {
    const rows = []
    for (const agentId of Object.keys(CHECKPOINTS)) {
      for (const checkpointId of requiredCheckpoints(this.snapshot, agentId)) {
        rows.push({ agentId, checkpointId, requirement: this.snapshot.requirements[agentId][checkpointId], status: 'AWAITING_REVIEW' })
      }
    }
    for (const settlement of this.#settlements.values()) {
      const record = settlement.summary
      const row = rows.find(item => item.agentId === record.agentId && item.checkpointId === record.checkpointId)
      if (row) Object.assign(row, { status: record.status, reviewId: record.reviewId, runId: record.runId, sessionId: record.sessionId })
    }
    return Object.freeze(rows.map(row => Object.freeze(row)))
  }

  /** Immutable decision history for audit; no approval is implied by presence in this list. */
  history() {
    return Object.freeze([...this.#settlements.values()].map(item => item.summary).sort((a, b) => a.decidedAt < b.decidedAt ? -1 : a.decidedAt > b.decidedAt ? 1 : a.reviewId < b.reviewId ? -1 : 1))
  }

  /** Digest binding the snapshot a decision was taken under, for records that must be self-describing. */
  identity() {
    return Object.freeze({ policyVersion: this.snapshot.version, policyId: this.snapshot.policyId, digest: this.snapshot.digest })
  }
}

export { artifactIdentity }
