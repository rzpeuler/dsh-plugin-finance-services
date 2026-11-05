// Native probe: the review read model is registered as a strict Remote contract.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export const name = 'finance-p5-remote-test-only'
export const inject = ['financeReview', 'typert', 'storageDomain']

const OWNER = '@local/dsh-financial-services/review-api-v1'

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', ...(error?.detail ? { detail: error.detail } : {}) }) }
  }

  const summaryId = `${OWNER}#financeReview/reviewSummary`
  const policyId = `${OWNER}#financeReview/reviewPolicy`

  await check('remote-package-registered-and-resolution-reported', async () => {
    const record = ctx.typert.getPackage(OWNER, 'host')
    if (!record) { const error = new Error('package missing'); error.detail = { owner: OWNER }; throw error }
    let resolution
    try {
      const summary = ctx.typert.resolve(summaryId)
      resolution = { status: 'RESOLVED', keys: Object.keys(summary ?? {}) }
    } catch (error) {
      resolution = { status: 'UNRESOLVED', message: String(error?.message ?? error).slice(0, 160) }
    }
    return { package: record.package, face: record.face, resolution }
  })

  await check('summary-remotely-returns-a-parseable-projection', async () => {
    const payload = await ctx.financeReview.reviewSummary({})
    const projection = JSON.parse(payload.summaryJson)
    assert.equal(projection.source, 'financial_review.domain/state')
    assert.ok(Array.isArray(projection.groups))
    assert.ok(projection.totals && Number.isInteger(projection.totals.items))
    assert.equal(projection.revision, ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0)
    return { revision: projection.revision, groups: projection.groups.length, items: projection.totals.items }
  })

  await check('policy-remotely-returns-the-pinned-identity', async () => {
    const payload = ctx.financeReview.reviewPolicy({})
    const policy = JSON.parse(payload.policyJson)
    assert.match(policy.digest, /^[a-f0-9]{64}$/)
    assert.equal(policy.externalSideEffects, 'DISABLED')
    assert.equal(policy.lockedBoundaries.length, 8)
    assert.equal(Object.keys(policy.requirements).length, 10)
    return { policyId: policy.policyId, version: policy.version, agents: Object.keys(policy.requirements).length }
  })

  await check('strict-schemas-reject-extra-request-fields', async () => {
    let code = null
    try { await ctx.financeReview.reviewSummary({ extra: true }) } catch (error) { code = error?.code ?? error?.name }
    assert.ok(code, 'an extra field must be refused')
    return { refusedWith: code }
  })

  await check('reading-the-queue-does-not-write-to-the-document', async () => {
    const before = ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0
    await ctx.financeReview.reviewSummary({})
    await ctx.financeReview.reviewSummary({})
    ctx.financeReview.reviewPolicy({})
    const after = ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0
    assert.equal(after, before, 'a read must not create a document revision')
    return { revision: after }
  })

  await check('no-remote-endpoint-can-record-a-decision', async () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.financeReview))
    for (const forbidden of ['publish', 'post', 'trade', 'transfer', 'approve']) {
      assert.ok(!methods.includes(forbidden), forbidden)
    }
    const reviewIds = ctx.typert.list({}).map(item => item.key ?? item.id ?? '').filter(key => String(key).includes('#financeReview/'))
    assert.ok(reviewIds.every(key => !/settle|recordStage/i.test(String(key))), 'decisions must stay Host-only')
    return { reviewInvocations: reviewIds.length }
  })

  const report = {
    evidence: 'REAL_NATIVE_REMOTE_READ_MODEL_NOT_CLIENT_RENDERED',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    package: OWNER,
    checks,
    modelCalls: 0,
    clientRendered: false,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
