// Two-phase native probe: separation matrix (phase A) and post-restart durability (phase B).
// The same package decides its phase from the persisted document, so a restart is real.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const name = 'finance-p5-separation-test-only'
export const inject = ['financeReview', 'tools', 'approval', 'storageDomain']

const RUN = 'run-p5-separation-fixed'
const SESSION = 'session-p5-separation-fixed'
const HASH = 'e'.repeat(64)

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function surface(ctx) {
  const schemas = ctx.tools.schemas()
  return {
    names: schemas.map(tool => tool.name).sort(),
    hash: digest(schemas.map(tool => ({ name: tool.name, parameters: tool.parameters, description: tool.description }))),
    mcp: schemas.filter(tool => tool.name.startsWith('mcp__')).map(tool => tool.name).sort(),
  }
}

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION' }) }
  }

  const domain = ctx.storageDomain.get('financial_review')
  const document = domain?.table('state').get('root') ?? null
  const persisted = document?.reviews?.filter(review => review.runId === RUN) ?? []
  const phase = persisted.length ? 'B' : 'A'
  const policy = ctx.financeReview.policy()
  const artifact = { hash: HASH }

  if (phase === 'A') {
    const before = surface(ctx)
    const calls = { register: 0, guard: 0, restrict: 0, execute: 0, approvalRequest: 0, approvalSetPolicy: 0, toPdf: 0 }
    const restore = []
    const spy = (object, method, key) => {
      const original = object[method]
      object[method] = function (...args) { calls[key] += 1; return original.apply(this, args) }
      restore.push(() => { object[method] = original })
    }
    spy(ctx.tools, 'register', 'register')
    spy(ctx.tools, 'guard', 'guard')
    spy(ctx.tools, 'restrict', 'restrict')
    spy(ctx.tools, 'execute', 'execute')
    spy(ctx.approval, 'request', 'approvalRequest')
    spy(ctx.approval, 'setPolicy', 'approvalSetPolicy')
    try {
      await check('policy-pinned-with-locked-boundaries', async () => {
        assert.equal(policy.externalSideEffects, 'DISABLED')
        assert.equal(policy.lockedBoundaries.length, 8)
        return { policyId: policy.policyId, digest: policy.digest }
      })

      await check('gate-holds-before-decision', async () => {
        const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', artifact })
        assert.equal(decision.reason, 'REVIEW_REQUIRED')
        return decision
      })

      await check('review-operations-touch-no-tool-or-approval-service', async () => {
        await ctx.financeReview.recordStage({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', status: 'COMPLETED', artifact })
        await ctx.financeReview.settle({ reviewId: 'review-separation-1', sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent',
          checkpointId: 'valuation_complete', policyVersion: policy.version, artifactRef: artifact, status: 'APPROVED',
          actor: 'p5-separation-probe', decidedAt: new Date().toISOString() })
        await ctx.financeReview.recordStage({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', status: 'COMPLETED', artifact })
        await ctx.financeReview.settle({ reviewId: 'review-separation-2', sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent',
          checkpointId: 'deck_complete', policyVersion: policy.version, artifactRef: artifact, status: 'APPROVED',
          actor: 'p5-separation-probe', decidedAt: new Date().toISOString() })
        ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact })
        ctx.financeReview.classify({ runId: RUN })
        await ctx.financeReview.queue()
        assert.deepEqual(calls, { register: 0, guard: 0, restrict: 0, execute: 0, approvalRequest: 0, approvalSetPolicy: 0, toPdf: 0 })
        return calls
      })

      await check('tool-surface-identical-across-approval', async () => {
        const after = surface(ctx)
        assert.deepEqual(after.names, before.names)
        assert.equal(after.hash, before.hash)
        assert.deepEqual(after.mcp, before.mcp)
        return { tools: after.names.length, schemaHash: after.hash, mcpTools: after.mcp.length }
      })

      await check('approved-run-classifies-completed', async () => {
        const outcome = ctx.financeReview.classify({ runId: RUN })
        assert.equal(outcome.status, 'COMPLETED')
        return outcome
      })

      await check('document-records-the-approval-for-the-next-epoch', async () => {
        const current = ctx.storageDomain.get('financial_review').table('state').get('root')
        assert.ok(current.reviews.some(review => review.runId === RUN && review.checkpointId === 'deck_complete'))
        return { revision: current.revision, reviews: current.reviews.length }
      })
    } finally {
      for (const undo of restore) undo()
    }
  } else {
    await check('service-epoch-observes-the-persisted-approval', async () => {
      const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact })
      assert.equal(decision.decision, 'ALLOW')
      assert.equal(decision.reason, 'APPROVED')
      return decision
    })

    await check('restart-keeps-human-decisions-and-stage-outcomes', async () => {
      const outcome = ctx.financeReview.classify({ runId: RUN })
      assert.equal(outcome.status, 'COMPLETED')
      const current = ctx.storageDomain.get('financial_review').table('state').get('root')
      const mine = current.reviews.filter(review => review.runId === RUN)
      assert.equal(mine.length, 2)
      assert.ok(mine.every(review => review.status === 'APPROVED' && review.actor.endsWith('probe')))
      return { status: outcome.status, reviews: mine.length, revision: current.revision, totalReviews: current.reviews.length }
    })

    await check('policy-identity-survives-a-service-restart', async () => {
      assert.equal(policy.policyId, 'original')
      const stored = ctx.storageDomain.get('financial_review').table('state').get('root').reviews
        .find(review => review.runId === RUN)
      assert.equal(stored.policyVersion, policy.version)
      assert.match(stored.snapshotDigest, /^[a-f0-9]{64}$/)
      return { policyVersion: stored.policyVersion, snapshotDigest: stored.snapshotDigest }
    })

    await check('non-required-checkpoint-is-not-treated-as-approved', async () => {
      const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent',
        checkpointId: 'assumptions_review', artifact })
      assert.equal(decision.decision, 'ALLOW')
      assert.equal(decision.reason, 'NOT_REQUIRED_BY_POLICY')
      return decision
    })

    await check('another-run-cannot-inherit-the-approval', async () => {
      const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: 'run-p5-separation-other',
        agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact })
      assert.equal(decision.decision, 'HOLD')
      assert.equal(decision.reason, 'REVIEW_REQUIRED')
      return decision
    })
  }

  const report = {
    evidence: 'REAL_NATIVE_REVIEW_SERVICE_SEPARATION_AND_RESTART_DURABILITY_NOT_COMMERCIAL',
    phase,
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    checks,
    modelCalls: 0,
    workerCalls: 0,
    externalSideEffects: policy.externalSideEffects,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
