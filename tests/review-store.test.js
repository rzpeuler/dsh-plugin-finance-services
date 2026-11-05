import test from 'node:test'
import assert from 'node:assert/strict'
import { ReviewStore } from '../src/review/store.js'
import { resolvePolicy } from '../src/review/policy.js'

const PITCH = 'finance-pitch-agent'
const HASH = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const NOW = '2026-01-15T09:00:00.000Z'
const snapshot = resolvePolicy({ bundle: { policyId: 'original' } })

function memorySeam(initial) {
  const box = { document: initial ? JSON.parse(JSON.stringify(initial)) : undefined, saves: 0, failNext: 0 }
  return {
    box,
    load: async () => (box.document ? JSON.parse(JSON.stringify(box.document)) : undefined),
    save: async next => {
      if (box.failNext > 0) { box.failNext -= 1; throw Object.assign(new Error('disk full'), { code: 'EIO' }) }
      box.saves += 1
      box.document = JSON.parse(JSON.stringify(next))
    },
  }
}

async function store(seam) {
  const instance = new ReviewStore({ snapshot, load: seam.load, save: seam.save, now: () => NOW })
  await instance.open()
  return instance
}

const review = (overrides = {}) => ({
  reviewId: 'review-1', sessionId: 'session-1', runId: 'run-1', agentId: PITCH,
  checkpointId: 'valuation_complete', policyVersion: 'p5-policy-v1',
  artifactRef: { hash: HASH }, status: 'APPROVED', actor: 'analyst@example', decidedAt: NOW, ...overrides,
})

test('a decision survives a reload and stays once-only across restarts', async () => {
  const seam = memorySeam()
  const first = await store(seam)
  assert.equal((await first.settle(review())).status, 'SETTLED')
  const second = await store(seam)
  assert.equal(second.evaluate({ sessionId: 'session-1', runId: 'run-1', agentId: PITCH,
    checkpointId: 'valuation_complete', artifact: { hash: HASH } }).decision, 'ALLOW')
  assert.equal((await second.settle(review())).status, 'IDEMPOTENT_NOOP')
  assert.equal(second.inspect().reviews, 1)
})

test('a failed save never leaves an approval that only exists in memory', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  seam.box.failNext = 1
  await assert.rejects(() => instance.settle(review()), error => error.code === 'STORE_SAVE_FAILED')
  assert.equal(instance.evaluate({ sessionId: 'session-1', runId: 'run-1', agentId: PITCH,
    checkpointId: 'valuation_complete', artifact: { hash: HASH } }).reason, 'REVIEW_REQUIRED')
  assert.equal((await instance.settle(review())).status, 'SETTLED')
  assert.equal(seam.box.document.reviews.length, 1)
})

test('a stage that was running at shutdown becomes an unknown termination, not a resume', async () => {
  const seam = memorySeam()
  const first = await store(seam)
  await first.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'RUNNING' })
  const second = await store(seam)
  const outcome = second.classify('run-1')
  assert.equal(outcome.status, 'UNKNOWN_TERMINATED')
  assert.equal(outcome.reason, 'PROCESS_RESTARTED_WITHOUT_TERMINAL_STAGE_RECORD')
  const persisted = Object.values(seam.box.document.stages)[0]
  assert.equal(persisted.status, 'UNKNOWN_TERMINATED')
  assert.equal(persisted.classifiedAt, NOW)
})

test('open reports how many stages were classified as interrupted', async () => {
  const seam = memorySeam()
  const first = await store(seam)
  await first.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'RUNNING' })
  const reloaded = new ReviewStore({ snapshot, load: seam.load, save: seam.save, now: () => NOW })
  const summary = await reloaded.open()
  assert.equal(summary.interrupted, 1)
  assert.equal(await (async () => (await new ReviewStore({ snapshot, load: seam.load, save: seam.save }).open()).interrupted)(), 0)
})

test('a failed stage and a changed artifact both demand a rerun', async () => {
  const failed = memorySeam()
  const a = await store(failed)
  await a.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'FAILED' })
  assert.equal(a.classify('run-1').status, 'NEEDS_RERUN')
  assert.equal(a.classify('run-1').reason, 'STAGE_FAILED')

  const changed = memorySeam()
  const b = await store(changed)
  await b.settle(review())
  await b.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete',
    status: 'RUNNING', artifact: { hash: HASH_B } })
  const classified = b.classify('run-1')
  assert.equal(classified.status, 'NEEDS_RERUN')
  assert.equal(classified.reason, 'ARTIFACT_CHANGED_SINCE_APPROVAL')
})

test('a run with every required approval and terminal stage is completed', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  await instance.settle(review())
  await instance.settle(review({ reviewId: 'review-2', checkpointId: 'deck_complete' }))
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'deck_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  assert.equal(instance.classify('run-1').status, 'COMPLETED')
})

test('a run waiting on a required review is pending, not completed', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  await instance.settle(review())
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'deck_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  const outcome = instance.classify('run-1')
  assert.equal(outcome.status, 'PENDING_REVIEW')
  assert.equal(outcome.outstanding, 1)
})

test('an unknown run is distinguished from an empty queue', async () => {
  const instance = await store(memorySeam())
  assert.equal(instance.classify('missing-run').status, 'UNKNOWN_RUN')
  assert.equal((await instance.queue()).length, 0)
})

test('the queue keeps two sessions apart and reflects their own decisions', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  await instance.recordStage({ runId: 'run-a', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  await instance.recordStage({ runId: 'run-b', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  await instance.settle(review({ reviewId: 'review-a', sessionId: 'session-a', runId: 'run-a' }))
  const rows = await instance.queue()
  const pending = rows.filter(row => row.decision === 'HOLD')
  const allowed = rows.filter(row => row.decision === 'ALLOW')
  assert.equal(allowed.length, 1)
  assert.equal(allowed[0].runId, 'run-a')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].runId, 'run-b')
  assert.equal(pending[0].reason, 'REVIEW_REQUIRED')
  assert.ok(rows.every(row => Object.isFrozen(row)))
})

test('a required stage that never started keeps the run in progress rather than completed', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  await instance.settle(review())
  await instance.settle(review({ reviewId: 'review-deck', checkpointId: 'deck_complete' }))
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
  const outcome = instance.classify('run-1')
  assert.equal(outcome.status, 'IN_PROGRESS')
  assert.equal(outcome.reason, 'REQUIRED_STAGE_NOT_STARTED')
  assert.equal(outcome.outstanding, 1)
})

test('the persisted document is versioned, monotonic and rejects corruption', async () => {
  const seam = memorySeam()
  const instance = await store(seam)
  await instance.settle(review())
  const firstRevision = seam.box.document.revision
  await instance.recordStage({ runId: 'run-1', agentId: PITCH, checkpointId: 'valuation_complete', status: 'COMPLETED' })
  assert.ok(seam.box.document.revision > firstRevision)
  assert.equal(seam.box.document.version, 1)
  const corrupt = memorySeam({ ...seam.box.document, version: 99 })
  await assert.rejects(() => store(corrupt), error => error.code === 'STORE_CORRUPT')
})
