// Native probe: dispatch the review read model exactly as a Client would, through the gateway.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export const name = 'finance-p5-remote-test-only'
export const inject = ['financeReview', 'typert', 'typertGateway', 'connection', 'storageDomain']

const OWNER = '@local/dsh-financial-services/review-api-v1'

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 240), ...(error?.detail ? { detail: error.detail } : {}) }) }
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
  // The descriptor names its single wire argument `request`, so a Client sends { request }.
  const call = (method, request = {}) => ctx.typertGateway.invoke({ namespace: 'financeReview', method, args: { request }, peer, signal: peer.signal })

  try {
    await check('schemas-are-registered-under-the-contract-owner', async () => {
      const keys = ['Summary', 'Policy', 'Empty'].map(name => `${OWNER}#${name}`)
      const resolved = keys.map(key => ctx.typert.resolve(key))
      assert.equal(resolved.length, 3)
      for (const record of resolved) assert.equal(record.package, OWNER)
      return { keys, package: resolved[0].package }
    })

    await check('client-dispatch-of-the-queue-summary-works', async () => {
      const payload = await call('reviewSummary')
      const projection = JSON.parse(payload.summaryJson)
      assert.equal(projection.source, 'financial_review.domain/state')
      assert.ok(Array.isArray(projection.groups))
      const revision = ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0
      assert.equal(projection.revision, revision)
      return { revision: projection.revision, groups: projection.groups.length, items: projection.totals.items }
    })

    await check('client-dispatch-of-the-policy-read-works', async () => {
      const payload = await call('reviewPolicy')
      const policy = JSON.parse(payload.policyJson)
      assert.equal(policy.externalSideEffects, 'DISABLED')
      assert.equal(policy.lockedBoundaries.length, 8)
      assert.deepEqual(Object.keys(policy.requirements).sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'])
      return { policyId: policy.policyId, version: policy.version }
    })

    await check('dispatch-is-read-only', async () => {
      const before = ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0
      await call('reviewSummary')
      await call('reviewSummary')
      await call('reviewPolicy')
      const after = ctx.storageDomain.get('financial_review').table('state').get('root')?.revision ?? 0
      assert.equal(after, before, 'a dispatched read must not create a document revision')
      return { revision: after }
    })

    await check('no-decision-method-is-dispatchable', async () => {
      const attempts = []
      for (const method of ['settle', 'recordStage', 'approve', 'publish']) {
        try { await call(method); attempts.push({ method, status: 'DISPATCHED' }) }
        catch (error) { attempts.push({ method, status: 'REFUSED', code: error?.code ?? error?.name }) }
      }
      assert.ok(attempts.every(item => item.status === 'REFUSED'), JSON.stringify(attempts))
      return { attempts }
    })

    await check('strict-payloads-travel-through-dispatch', async () => {
      let code = null
      try { await call('reviewSummary', { unexpected: true }) } catch (error) { code = error?.code ?? error?.name }
      assert.ok(code, 'an extra wire argument must be refused')
      return { refusedWith: code }
    })
  } finally {
    await peer.dispose().catch(() => {})
  }

  const report = {
    evidence: 'REAL_NATIVE_TYPERT_GATEWAY_DISPATCH_NOT_BROWSER_RENDERED',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    package: OWNER,
    checks,
    modelCalls: 0,
    browserRendered: false,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
