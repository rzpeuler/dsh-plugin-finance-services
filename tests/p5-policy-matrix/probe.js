// Native probe: the same review module instantiated under four policies side by side.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export const name = 'finance-p5-policy-matrix-test-only'
export const inject = ['financeReview', 'financeReviewFast', 'financeReviewStrict', 'financeReviewCustom', 'storageDomain']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const instances = {
    original: ctx.financeReview, fast: ctx.financeReviewFast,
    strict: ctx.financeReviewStrict, custom: ctx.financeReviewCustom,
  }

  await check('four-instances-hold-four-policies', async () => {
    const policies = Object.fromEntries(Object.entries(instances).map(([name, service]) => {
      const policy = service.policy()
      assert.equal(policy.policyId, name === 'original' ? 'original' : name)
      return [name, { policyId: policy.policyId, digest: policy.digest, locked: policy.lockedBoundaries.length,
        sideEffects: policy.externalSideEffects }]
    }))
    const digests = new Set(Object.values(policies).map(item => item.digest))
    assert.equal(digests.size, 4, `expected four distinct requirement sets, got ${digests.size}`)
    for (const item of Object.values(policies)) {
      assert.equal(item.locked, 8)
      assert.equal(item.sideEffects, 'DISABLED')
    }
    return policies
  })

  await check('fast-drops-the-deck-pause-but-keeps-mandatory-gates', async () => {
    const fast = instances.fast.policy().requirements['finance-pitch-agent']
    assert.equal(fast.valuation_complete, 'MANDATORY')
    assert.equal(fast.deck_complete, undefined)
    const original = instances.original.policy().requirements['finance-pitch-agent']
    assert.equal(original.deck_complete, 'ORIGINAL')
    return { fast: Object.keys(fast), original: Object.keys(original) }
  })

  await check('strict-adds-assumption-and-result-reviews', async () => {
    const strict = instances.strict.policy().requirements['finance-model-builder']
    assert.equal(strict.assumptions_review, 'STRICT')
    assert.equal(strict.result_review, 'STRICT')
    const original = instances.original.policy().requirements['finance-model-builder']
    assert.equal(original.assumptions_review, undefined)
    return { strict: Object.keys(strict).sort(), original: Object.keys(original).sort() }
  })

  await check('custom-enables-only-chosen-nodes-and-keeps-mandatory-ones', async () => {
    const custom = instances.custom.policy().requirements['finance-pitch-agent']
    assert.equal(custom.valuation_complete, 'MANDATORY')
    assert.equal(custom.deck_complete, 'CUSTOM_ENABLED')
    assert.equal(custom.assumptions_review, undefined)
    return { custom: Object.keys(custom).sort() }
  })

  await check('instances-keep-separate-domains-and-decisions', async () => {
    const fastDomain = ctx.storageDomain.get('financial_review_fast')
    const originalDomain = ctx.storageDomain.get('financial_review')
    assert.ok(fastDomain && originalDomain, 'each instance owns its domain')
    const policy = instances.fast.policy()
    const settled = await instances.fast.settle({ reviewId: 'review-fast-1', sessionId: 'session-fast',
      runId: 'run-fast', agentId: 'finance-pitch-agent', checkpointId: 'deck_complete',
      policyVersion: policy.version, artifactRef: { hash: 'd'.repeat(64) }, status: 'APPROVED',
      actor: 'p5-matrix-probe', decidedAt: new Date().toISOString() })
    // fast does not require the deck checkpoint, so nothing is recorded there.
    assert.equal(settled.status, 'NOT_REQUIRED_BY_POLICY')
    const decision = instances.original.evaluate({ sessionId: 'session-fast', runId: 'run-fast',
      agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact: { hash: 'd'.repeat(64) } })
    assert.equal(decision.decision, 'HOLD')
    assert.equal(decision.reason, 'REVIEW_REQUIRED')
    const fastReviews = fastDomain.table('state').get('root')?.reviews?.length ?? 0
    const originalReviews = originalDomain.table('state').get('root')?.reviews?.length ?? 0
    return { fastReviews, originalReviews, originalGate: decision.reason }
  })

  await check('a-mandatory-gate-still-blocks-in-fast-mode', async () => {
    const decision = instances.fast.evaluate({ sessionId: 'session-fast', runId: 'run-fast',
      agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', artifact: { hash: 'e'.repeat(64) } })
    assert.equal(decision.decision, 'HOLD')
    assert.equal(decision.reason, 'REVIEW_REQUIRED')
    return { decision: decision.reason, requirement: 'MANDATORY' }
  })

  await check('no-instance-exposes-an-external-side-effect', async () => {
    for (const service of Object.values(instances)) {
      assert.equal(service.policy().externalSideEffects, 'DISABLED')
      for (const forbidden of ['publish', 'post', 'trade', 'transfer']) {
        assert.ok(!Object.getOwnPropertyNames(Object.getPrototypeOf(service)).includes(forbidden), forbidden)
      }
    }
    return { instances: Object.keys(instances).length }
  })

  const report = {
    evidence: 'REAL_NATIVE_FOUR_POLICY_INSTANCES_NOT_RENDERED',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    policies: Object.fromEntries(Object.entries(instances).map(([name, service]) => [name, service.policy().digest])),
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
