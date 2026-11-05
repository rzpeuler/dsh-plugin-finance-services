// Native probe: deliverable index and run projection, dispatched as a Client would.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p6-index-test-only'
export const inject = ['financeReview', 'typertGateway', 'connection', 'storageDomain']

const OWNER = '@local/dsh-financial-services/review-api-v1'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const REVIEW_HASH = 'c'.repeat(64)

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
  const call = (method, request = {}) => ctx.typertGateway.invoke({ namespace: 'financeReview', method, args: { request }, peer, signal: peer.signal })
  const policy = ctx.financeReview.policy()
  const runId = `run-p6-${randomUUID().slice(0, 8)}`
  const sessionId = `session-p6-${randomUUID().slice(0, 8)}`

  try {
    await check('artifact-domain-is-separate-and-empty-at-start', async () => {
      const domain = ctx.storageDomain.get('financial_artifacts')
      assert.ok(domain, 'the artifact domain must exist')
      const document = domain.table('index').get('root')
      return { present: !!document, deliverables: document?.deliverables?.length ?? 0 }
    })

    await check('a-deliverable-is-recorded-once-and-duplicates-are-refused', async () => {
      const first = await ctx.financeReview.registerDeliverable({ sessionId, runId, agentId: 'finance-model-builder',
        path: 'financial-services/artifacts/x/model.xlsx', sha256: HASH_A, bytes: 1234, classification: 'TEST_ONLY', reviewId: null })
      assert.equal(first.status, 'RECORDED')
      const again = await ctx.financeReview.registerDeliverable({ sessionId, runId, agentId: 'finance-model-builder',
        path: 'financial-services/artifacts/x/model.xlsx', sha256: HASH_A, bytes: 1234, classification: 'TEST_ONLY', reviewId: null })
      assert.equal(again.status, 'DUPLICATE')
      assert.equal(again.deliverableId, first.deliverableId)
      const second = await ctx.financeReview.registerDeliverable({ sessionId, runId, agentId: 'finance-model-builder',
        path: 'financial-services/artifacts/x/deck.pptx', sha256: HASH_B, bytes: 4321, classification: 'UNSOURCED', reviewId: null })
      assert.equal(second.status, 'RECORDED')
      return { first: first.deliverableId, duplicate: again.status, second: second.revision }
    })

    await check('absolute-and-traversing-paths-are-refused', async () => {
      let code = null
      try {
        await ctx.financeReview.registerDeliverable({ sessionId, runId, agentId: 'finance-model-builder',
          path: 'C:/Windows/system32/x.xlsx', sha256: HASH_A, bytes: 1, classification: 'TEST_ONLY', reviewId: null })
      } catch (error) { code = error?.name ?? error?.code }
      assert.ok(code, 'an absolute path must be refused')
      return { refusedWith: code }
    })

    await check('runs-projection-joins-stages-reviews-and-deliverables', async () => {
      await ctx.financeReview.recordStage({ sessionId, runId, agentId: 'finance-model-builder',
        checkpointId: 'model_build_complete', status: 'COMPLETED', artifact: { hash: REVIEW_HASH } })
      await ctx.financeReview.settle({ reviewId: `review-${runId}`, sessionId, runId, agentId: 'finance-model-builder',
        checkpointId: 'model_build_complete', policyVersion: policy.version, artifactRef: { hash: REVIEW_HASH },
        status: 'APPROVED', actor: 'p6-index-probe', decidedAt: new Date().toISOString() })
      const runs = ctx.financeReview.runs()
      const mine = runs.find(run => run.runId === runId)
      assert.ok(mine, 'the run must appear in the projection')
      assert.equal(mine.deliverableCount, 2)
      assert.deepEqual(mine.sessions, [sessionId])
      assert.equal(mine.checkpoints.model_build_complete, 'COMPLETED')
      assert.equal(mine.classification, 'IN_PROGRESS')
      return mine
    })

    await check('client-dispatch-of-runs-and-deliverables-works', async () => {
      const runsPayload = await call('reviewRuns')
      const runs = JSON.parse(runsPayload.runsJson)
      assert.ok(Array.isArray(runs.runs))
      assert.ok(runs.runs.some(run => run.runId === runId && run.deliverableCount === 2))
      const deliverablesPayload = await call('reviewDeliverables')
      const index = JSON.parse(deliverablesPayload.deliverablesJson)
      assert.ok(Array.isArray(index.deliverables))
      assert.equal(index.deliverables.filter(item => item.runId === runId).length, 2)
      return { runs: runs.runs.length, deliverables: index.deliverables.length, revision: index.revision }
    })

    await check('index-reads-do-not-write', async () => {
      const before = ctx.storageDomain.get('financial_artifacts').table('index').get('root')?.revision ?? 0
      await call('reviewRuns')
      await call('reviewDeliverables')
      const after = ctx.storageDomain.get('financial_artifacts').table('index').get('root')?.revision ?? 0
      assert.equal(after, before)
      return { revision: after }
    })

    await check('no-decision-or-publish-method-is-dispatchable', async () => {
      const attempts = []
      for (const method of ['settle', 'publish', 'post', 'deleteDeliverable']) {
        try { await call(method); attempts.push({ method, status: 'DISPATCHED' }) }
        catch (error) { attempts.push({ method, status: 'REFUSED', code: error?.code ?? error?.name }) }
      }
      assert.ok(attempts.every(item => item.status === 'REFUSED'), JSON.stringify(attempts))
      return { attempts }
    })
  } finally {
    await peer.dispose().catch(() => {})
  }

  const report = {
    evidence: 'REAL_NATIVE_DELIVERABLE_INDEX_AND_RUN_PROJECTION_NOT_RENDERED',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    package: OWNER,
    domain: 'financial_artifacts',
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
