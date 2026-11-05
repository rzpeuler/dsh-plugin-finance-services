import test from 'node:test'
import assert from 'node:assert/strict'
import { ReviewGate } from '../src/review/gate.js'
import { resolvePolicy } from '../src/review/policy.js'

const PITCH = 'finance-pitch-agent'
const HASH = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const NOW = '2026-01-15T09:00:00.000Z'

const ids = { sessionId: 'session-1', runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete' }

function gate(policyId = 'original', now = () => NOW) {
  return new ReviewGate({ snapshot: resolvePolicy({ bundle: { policyId } }), now })
}

function decision(overrides = {}) {
  return {
    reviewId: 'review-1', ...ids, policyVersion: 'p5-policy-v1',
    artifactRef: { hash: HASH }, status: 'APPROVED', actor: 'analyst@example', decidedAt: NOW, ...overrides,
  }
}

test('a required checkpoint holds until a decision exists', () => {
  const g = gate()
  assert.deepEqual(g.evaluate({ ...ids, artifact: { hash: HASH } }),
    { decision: 'HOLD', reason: 'REVIEW_REQUIRED', agentId: PITCH, checkpointId: 'valuation_complete' })
})

test('a checkpoint the policy does not require allows the stage without any record', () => {
  const g = gate('fast')
  assert.equal(g.evaluate({ ...ids, checkpointId: 'deck_complete', artifact: { hash: HASH } }).reason,
    'NOT_REQUIRED_BY_POLICY')
})

test('an approval for the same artifact allows the stage', () => {
  const g = gate()
  assert.equal(g.settle(decision()).status, 'SETTLED')
  const result = g.evaluate({ ...ids, artifact: { hash: HASH } })
  assert.equal(result.decision, 'ALLOW')
  assert.equal(result.reason, 'APPROVED')
  assert.equal(result.reviewId, 'review-1')
})

test('changing the artifact invalidates the earlier approval', () => {
  const g = gate()
  g.settle(decision())
  const result = g.evaluate({ ...ids, artifact: { hash: HASH_B } })
  assert.equal(result.decision, 'HOLD')
  assert.equal(result.reason, 'ARTIFACT_CHANGED_SINCE_REVIEW')
})

test('a rejection holds the stage and cannot be overwritten by a second decision', () => {
  const g = gate()
  g.settle(decision({ status: 'REJECTED' }))
  assert.equal(g.evaluate({ ...ids, artifact: { hash: HASH } }).reason, 'REVIEW_REJECTED')
  const second = g.settle(decision({ reviewId: 'review-2' }))
  assert.equal(second.status, 'ALREADY_SETTLED')
  assert.equal(g.history().length, 1, 'the first decision stands')
})

test('only one settlement is accepted per session, run, agent and checkpoint', () => {
  const g = gate()
  assert.equal(g.settle(decision()).status, 'SETTLED')
  const retry = g.settle(decision())
  assert.equal(retry.status, 'IDEMPOTENT_NOOP')
  const conflicting = g.settle(decision({ reviewId: 'review-2', actor: 'other@example' }))
  assert.equal(conflicting.status, 'ALREADY_SETTLED')
  assert.equal(conflicting.settled.reviewId, 'review-1')
})

test('concurrent decisions in the same turn settle at most once', () => {
  const g = gate()
  const first = g.settle(decision({ reviewId: 'review-a' }))
  const second = g.settle(decision({ reviewId: 'review-b' }))
  assert.equal(first.status, 'SETTLED')
  assert.equal(second.status, 'ALREADY_SETTLED')
  assert.equal(g.history().length, 1)
})

test('a decision from another policy version is rejected and not stored', () => {
  const g = gate()
  const stale = g.settle(decision({ policyVersion: 'p5-policy-v0' }))
  assert.equal(stale.status, 'STALE_POLICY_VERSION')
  assert.equal(stale.expected, 'p5-policy-v1')
  assert.equal(g.history().length, 0)
  assert.equal(g.evaluate({ ...ids, artifact: { hash: HASH } }).reason, 'REVIEW_REQUIRED')
})

test('an approval taken under one snapshot cannot unlock another snapshot of the same version', () => {
  const fast = gate('fast')
  fast.settle(decision({ checkpointId: 'deck_complete' }))
  const strict = gate('strict')
  assert.equal(strict.evaluate({ ...ids, checkpointId: 'deck_complete', artifact: { hash: HASH } }).reason,
    'REVIEW_REQUIRED')
  const carried = fast.evaluate({ ...ids, checkpointId: 'deck_complete', artifact: { hash: HASH } })
  assert.equal(carried.decision, 'ALLOW')
  assert.equal(strict.identity().digest === fast.identity().digest, false)
})

test('an expired approval no longer opens the gate', () => {
  const g = gate('original', () => '2026-02-01T00:00:00.000Z')
  g.settle(decision({ decidedAt: '2026-01-15T09:00:00.000Z', expiresAt: '2026-01-16T00:00:00.000Z' }))
  assert.equal(g.evaluate({ ...ids, artifact: { hash: HASH } }).reason, 'REVIEW_EXPIRED')
})

test('a decision without a usable artifact identity is refused', () => {
  const g = gate()
  assert.throws(() => g.settle(decision({ artifactRef: {} })), error => error.code === 'ARTIFACT_IDENTITY_REQUIRED')
  assert.throws(() => g.evaluate({ ...ids, artifact: {} }), error => error.code === 'ARTIFACT_IDENTITY_REQUIRED')
  const versioned = gate()
  assert.equal(versioned.settle(decision({ artifactRef: { version: 'v7' } })).status, 'SETTLED')
  assert.equal(versioned.evaluate({ ...ids, artifact: { version: 'v7' } }).decision, 'ALLOW')
  assert.equal(versioned.evaluate({ ...ids, artifact: { version: 'v8' } }).reason, 'ARTIFACT_CHANGED_SINCE_REVIEW')
})

test('records missing mandatory fields are refused', () => {
  const g = gate()
  for (const field of ['reviewId', 'sessionId', 'runId', 'actor', 'decidedAt']) {
    const bad = decision()
    delete bad[field]
    assert.throws(() => g.settle(bad), error => error.code === 'REVIEW_RECORD_INVALID', field)
  }
  assert.throws(() => g.settle(decision({ status: 'MAYBE' })), error => error.code === 'REVIEW_RECORD_INVALID')
  assert.throws(() => g.settle(decision({ decidedAt: 'yesterday' })), error => error.code === 'REVIEW_RECORD_INVALID')
  assert.throws(() => g.settle({ ...decision(), agentId: 'finance-unknown' }), error => error.code === 'POLICY_UNKNOWN_AGENT')
  assert.throws(() => g.settle(decision({ checkpointId: 'nope' })), error => error.code === 'POLICY_UNKNOWN_CHECKPOINT')
})

test('settling a checkpoint the policy does not require records nothing', () => {
  const g = gate('fast')
  const result = g.settle(decision({ checkpointId: 'deck_complete' }))
  assert.equal(result.status, 'NOT_REQUIRED_BY_POLICY')
  assert.equal(g.history().length, 0)
})

test('the pending projection lists required checkpoints and reflects decisions', () => {
  const g = gate()
  const before = g.pending()
  assert.ok(before.every(row => row.status === 'AWAITING_REVIEW'))
  assert.ok(before.some(row => row.agentId === PITCH && row.checkpointId === 'valuation_complete'))
  assert.ok(!before.some(row => row.checkpointId === 'result_review'), 'strict-only nodes are not pending under original')
  g.settle(decision())
  const after = g.pending().find(row => row.agentId === PITCH && row.checkpointId === 'valuation_complete')
  assert.equal(after.status, 'APPROVED')
  assert.equal(after.runId, 'run-1')
  assert.ok(Object.isFrozen(after))
})

test('history is ordered, immutable and carries the record fields the task requires', () => {
  const g = gate()
  g.settle(decision({ reviewId: 'review-a', decidedAt: '2026-01-15T08:00:00.000Z' }))
  g.settle(decision({ reviewId: 'review-b', checkpointId: 'deck_complete', decidedAt: '2026-01-15T09:30:00.000Z' }))
  const history = g.history()
  assert.deepEqual(history.map(row => row.reviewId), ['review-a', 'review-b'])
  for (const row of history) {
    for (const field of ['reviewId', 'sessionId', 'runId', 'agentId', 'checkpointId', 'policyVersion',
                         'status', 'actor', 'decidedAt', 'artifactRef', 'snapshotDigest']) {
      assert.ok(row[field] !== undefined, field)
    }
  }
  assert.ok(Object.isFrozen(history))
  assert.ok(Object.isFrozen(history[0]))
})

test('the gate never widens external side effects or tool authority', () => {
  const g = gate('fast')
  assert.equal(g.identity().policyId, 'fast')
  assert.equal(g.snapshot.externalSideEffects, 'DISABLED')
  g.settle(decision())
  const result = g.evaluate({ ...ids, artifact: { hash: HASH } })
  assert.equal(result.decision, 'ALLOW')
  for (const field of ['publish', 'post', 'trade', 'transfer', 'grant', 'permission']) {
    assert.equal(field in result, false, `${field} must not appear in a gate decision`)
  }
})
