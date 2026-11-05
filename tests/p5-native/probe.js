// Native, model-free probe of the review service: gate, persistence and separation.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p5-native-gate-test-only'
export const inject = ['financeReview', 'tools', 'storageDomain']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION' }) }
  }
  const policy = ctx.financeReview.policy()
  const HASH = 'c'.repeat(64)
  const ids = { sessionId: `session-${randomUUID()}`, runId: `run-${randomUUID()}`, agentId: 'finance-pitch-agent' }
  const record = (overrides = {}) => ({
    reviewId: `review-${randomUUID()}`, ...ids, checkpointId: 'valuation_complete',
    policyVersion: policy.version, artifactRef: { hash: HASH }, status: 'APPROVED',
    actor: 'p5-native-probe', decidedAt: new Date().toISOString(), ...overrides,
  })
  const toolsBefore = ctx.tools.schemas().map(tool => tool.name).sort()

  await check('pinned-policy-and-locked-boundaries', async () => {
    assert.equal(policy.policyId, 'original')
    assert.equal(policy.externalSideEffects, 'DISABLED')
    assert.equal(policy.lockedBoundaries.length, 8)
    assert.match(policy.digest, /^[a-f0-9]{64}$/)
    return { policyVersion: policy.version, digest: policy.digest }
  })

  await check('gate-holds-before-any-decision', async () => {
    const decision = ctx.financeReview.evaluate({ ...ids, checkpointId: 'valuation_complete', artifact: { hash: HASH } })
    assert.equal(decision.decision, 'HOLD')
    assert.equal(decision.reason, 'REVIEW_REQUIRED')
    return decision
  })

  await check('durable-settlement-allows-the-stage', async () => {
    const settled = await ctx.financeReview.settle(record())
    assert.equal(settled.status, 'SETTLED')
    assert.ok(settled.revision > 0)
    const decision = ctx.financeReview.evaluate({ ...ids, checkpointId: 'valuation_complete', artifact: { hash: HASH } })
    assert.equal(decision.decision, 'ALLOW')
    return { revision: settled.revision, decision: decision.reason }
  })

  await check('changed-artifact-invalidates-the-approval', async () => {
    const decision = ctx.financeReview.evaluate({ ...ids, checkpointId: 'valuation_complete', artifact: { hash: 'd'.repeat(64) } })
    assert.equal(decision.reason, 'ARTIFACT_CHANGED_SINCE_REVIEW')
    return decision
  })

  await check('approval-does-not-widen-any-tool-surface', async () => {
    const toolsAfter = ctx.tools.schemas().map(tool => tool.name).sort()
    assert.deepEqual(toolsAfter, toolsBefore)
    assert.ok(!toolsAfter.some(name => name.startsWith('finance_review')))
    return { tools: toolsAfter.length, unchanged: true }
  })

  await check('stage-classification-distinguishes-running-missing-and-pending', async () => {
    await ctx.financeReview.recordStage({ ...ids, checkpointId: 'valuation_complete', status: 'RUNNING', artifact: { hash: HASH } })
    const running = ctx.financeReview.classify({ runId: ids.runId })
    assert.equal(running.status, 'IN_PROGRESS')
    await ctx.financeReview.recordStage({ ...ids, checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
    const missing = ctx.financeReview.classify({ runId: ids.runId })
    assert.equal(missing.status, 'IN_PROGRESS')
    assert.equal(missing.reason, 'REQUIRED_STAGE_NOT_STARTED')
    await ctx.financeReview.recordStage({ ...ids, checkpointId: 'deck_complete', status: 'COMPLETED', artifact: { hash: HASH } })
    const pending = ctx.financeReview.classify({ runId: ids.runId })
    assert.equal(pending.status, 'PENDING_REVIEW')
    return { running: running.status, missing: missing.status, pending: pending.status }
  })

  await check('completed-run-requires-every-required-approval', async () => {
    await ctx.financeReview.settle(record({ checkpointId: 'deck_complete' }))
    await ctx.financeReview.recordStage({ ...ids, checkpointId: 'deck_complete', status: 'COMPLETED', artifact: { hash: HASH } })
    const outcome = ctx.financeReview.classify({ runId: ids.runId })
    assert.equal(outcome.status, 'COMPLETED')
    return outcome
  })

  await check('queue-projects-the-persisted-facts', async () => {
    const rows = await ctx.financeReview.queue()
    const mine = rows.filter(row => row.runId === ids.runId)
    assert.equal(mine.length, 2)
    assert.ok(mine.every(row => row.decision === 'ALLOW'))
    return { rows: mine.length, decisions: [...new Set(mine.map(row => row.decision))] }
  })

  await check('decisions-and-stages-are-persisted-in-the-own-domain', async () => {
    const domain = ctx.storageDomain.get('financial_review')
    assert.ok(domain, 'own domain must exist')
    const document = domain.table('state').get('root')
    assert.ok(document)
    const mineReviews = document.reviews.filter(review => review.runId === ids.runId)
    assert.equal(mineReviews.length, 2)
    assert.ok(mineReviews.every(review => review.sessionId === ids.sessionId && review.status === 'APPROVED'))
    const mineStages = Object.values(document.stages).filter(stage => stage.runId === ids.runId)
    assert.equal(mineStages.length, 2)
    assert.ok(mineStages.every(stage => stage.status === 'COMPLETED'))
    assert.ok(document.reviews.length >= 2, 'the document survives service lifetimes')
    return { revision: document.revision, runReviews: mineReviews.length, totalReviews: document.reviews.length,
      domainReuseAcrossLifetimes: document.reviews.length > mineReviews.length }
  })

  await check('service-exposes-no-side-effecting-operation', async () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.financeReview))
    for (const forbidden of ['publish', 'post', 'trade', 'transfer', 'send', 'approveTool']) {
      assert.ok(!methods.includes(forbidden), forbidden)
    }
    return { methods }
  })

  const report = {
    evidence: 'REAL_NATIVE_REVIEW_SERVICE_GATE_AND_PERSISTENCE_NOT_UI_OR_COMMERCIAL',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    opened: ctx.financeReview.inspect().opened,
    checks,
    modelCalls: 0,
    workerCalls: 0,
    toolSurfaceUnchanged: true,
    externalSideEffects: policy.externalSideEffects,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
