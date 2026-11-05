// Armed before a restart: once DSH restarts, this probe runs by itself and writes the report.
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

export const name = 'finance-p6-post-restart-test-only'
export const inject = ['financeOperations', 'financeData', 'financeReview']

export async function apply(ctx, config) {
  const startedAt = new Date().toISOString()
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }

  await check('all-three-services-are-mounted', async () => {
    assert.equal(typeof ctx.financeOperations.snapshot, 'function')
    assert.equal(typeof ctx.financeData.catalog, 'function')
    assert.equal(typeof ctx.financeReview.policy, 'function')
    return { services: ['financeOperations', 'financeData', 'financeReview'] }
  })

  await check('the-review-policy-is-the-default-original', async () => {
    const policy = ctx.financeReview.policy()
    assert.equal(policy.policyId, 'original')
    assert.equal(policy.externalSideEffects, 'DISABLED')
    assert.equal(policy.lockedBoundaries.length, 8)
    return { version: policy.version, digest: policy.digest.slice(0, 16) }
  })

  await check('the-workspace-binding-is-readable', async () => {
    const snapshot = await ctx.financeOperations.snapshot({})
    assert.ok(snapshot && typeof snapshot === 'object')
    return { status: snapshot.workspaceStatus ?? 'UNKNOWN' }
  })

  await check('the-workbook-read-model-returns-valid-bytes', async () => {
    const payload = await ctx.financeReview.reviewWorkbook({})
    const bytes = Buffer.from(payload.base64, 'base64')
    assert.equal(bytes.length, payload.bytes)
    assert.equal(bytes[0], 0x50)
    assert.equal(bytes[1], 0x4b)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), payload.sha256)
    return { bytes: payload.bytes, filename: payload.filename }
  })

  await check('the-run-projection-is-readable', async () => {
    const runs = ctx.financeReview.runs()
    assert.ok(Array.isArray(runs))
    return { runs: runs.length }
  })

  await check('the-review-service-exposes-no-side-effect', async () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.financeReview))
    for (const forbidden of ['publish', 'post', 'trade', 'transfer', 'placeOrder']) {
      assert.ok(!methods.includes(forbidden), forbidden)
    }
    return { methods: methods.length }
  })

  const report = {
    stage: 'P6',
    id: 'P6_POST_RESTART_SMOKE',
    evidence: 'REAL_NATIVE_AFTER_RESTART',
    startedAt,
    finishedAt: new Date().toISOString(),
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    modelCalls: 0,
    note: 'This report exists only if the bundle was loaded after a restart.',
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
