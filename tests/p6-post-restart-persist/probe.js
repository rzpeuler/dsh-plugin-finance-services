// Post-restart persistence: compare the facts against the values recorded before the restart.
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

export const name = 'finance-p6-post-restart-persist-test-only'
export const inject = ['financeReview', 'typertGateway', 'connection']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }

  await check('the-interrupted-run-still-reads-as-interrupted', async () => {
    const decision = ctx.financeReview.classify({ runId: 'run-running-0de65a7f' })
    assert.equal(decision.status, 'UNKNOWN_TERMINATED')
    assert.equal(decision.reason, 'PROCESS_RESTARTED_WITHOUT_TERMINAL_STAGE_RECORD')
    return decision
  })

  await check('the-review-document-did-not-reset', async () => {
    const projection = await ctx.financeReview.queueProjection()
    assert.ok(projection.revision >= 35, `revision regressed to ${projection.revision}`)
    assert.ok(projection.totals.sessions >= 13, `sessions dropped to ${projection.totals.sessions}`)
    return { revision: projection.revision, sessions: projection.totals.sessions, items: projection.totals.items }
  })

  await check('the-workbook-bytes-are-identical-to-the-pre-restart-build', async () => {
    const payload = await ctx.financeReview.reviewWorkbook({})
    const bytes = Buffer.from(payload.base64, 'base64')
    const sha = createHash('sha256').update(bytes).digest('hex')
    assert.equal(sha, '83df8a7bc06f2e79e29cce35c58933e36cae1a2943ff10cc9e302a7eb7a63173')
    return { bytes: payload.bytes, sha256: sha.slice(0, 16) }
  })

  await check('the-remote-namespace-is-dispatchable-after-the-restart', async () => {
    const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
    try {
      const payload = await ctx.typertGateway.invoke({ namespace: 'financeReview', method: 'reviewRuns', args: { request: {} }, peer, signal: peer.signal })
      const runs = JSON.parse(payload.runsJson)
      assert.ok(runs.runs.length >= 14)
      return { runs: runs.runs.length }
    } finally { await peer.dispose().catch(() => {}) }
  })

  const report = {
    stage: 'P5/P6',
    id: 'P6_POST_RESTART_PERSISTENCE',
    evidence: 'REAL_NATIVE_ACROSS_AN_APPLICATION_RESTART',
    finishedAt: new Date().toISOString(),
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
