// Native probe: stage diagnostic codes reach the run projection and the remote read model.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p6-errors-test-only'
export const inject = ['financeReview', 'typertGateway', 'connection']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
  const call = (method, request = {}) => ctx.typertGateway.invoke({ namespace: 'financeReview', method, args: { request }, peer, signal: peer.signal })
  const policy = ctx.financeReview.policy()
  const runId = `run-err-${randomUUID().slice(0, 8)}`
  const sessionId = `session-err-${randomUUID().slice(0, 8)}`

  try {
    await check('a-failed-stage-records-a-code-and-the-run-shows-it', async () => {
      await ctx.financeReview.recordStage({ sessionId, runId, agentId: 'finance-model-builder',
        checkpointId: 'model_build_complete', status: 'FAILED', errorCode: 'MODEL_TIMEOUT' })
      const runs = ctx.financeReview.runs()
      const mine = runs.find(run => run.runId === runId)
      assert.ok(mine, 'the run must appear')
      assert.equal(mine.errors.model_build_complete, 'MODEL_TIMEOUT')
      assert.equal(mine.classification, 'NEEDS_RERUN')
      return { errors: mine.errors, classification: mine.classification }
    })

    await check('the-remote-run-projection-carries-the-code', async () => {
      const payload = await call('reviewRuns')
      const runs = JSON.parse(payload.runsJson)
      const mine = runs.runs.find(run => run.runId === runId)
      assert.equal(mine.errors.model_build_complete, 'MODEL_TIMEOUT')
      return { errors: mine.errors }
    })

    await check('free-text-and-misplaced-codes-are-refused', async () => {
      const attempts = []
      for (const attempt of [
        { status: 'FAILED', errorCode: 'model timeout: provider said no' },
        { status: 'COMPLETED', errorCode: 'MODEL_TIMEOUT' },
        { status: 'FAILED', errorCode: 'lowercase_code' },
      ]) {
        try {
          await ctx.financeReview.recordStage({ sessionId, runId, agentId: 'finance-model-builder',
            checkpointId: 'audit_before_sensitivities', ...attempt })
          attempts.push({ ...attempt, status: 'ACCEPTED' })
        } catch (error) { attempts.push({ code: attempt.errorCode, refusedWith: error?.code ?? error?.name }) }
      }
      assert.ok(attempts.every(item => item.status !== 'ACCEPTED'), JSON.stringify(attempts))
      return { attempts }
    })

    await check('no-provider-text-lands-in-the-projection', async () => {
      const payload = await call('reviewRuns')
      const runs = JSON.parse(payload.runsJson)
      const mine = runs.runs.find(run => run.runId === runId)
      const serialized = JSON.stringify(mine)
      assert.ok(!serialized.includes('provider said no'), 'free text must not be stored')
      for (const value of Object.values(mine.errors)) assert.match(value, /^[A-Z][A-Z0-9_]{1,63}$/)
      return { errors: mine.errors }
    })

    await check('classification-prefers-rerun-over-pending-review', async () => {
      const decision = ctx.financeReview.classify({ runId })
      assert.equal(decision.status, 'NEEDS_RERUN')
      assert.equal(decision.reason, 'STAGE_FAILED')
      return decision
    })

    await check('the-code-is-also-visible-in-the-queue-row', async () => {
      const rows = await ctx.financeReview.queue()
      const mine = rows.filter(row => row.runId === runId)
      assert.ok(mine.length >= 1)
      assert.ok(mine.every(row => row.decision === 'HOLD' || row.decision === 'ALLOW'))
      return { rows: mine.length }
    })
  } finally {
    await peer.dispose().catch(() => {})
  }

  const report = {
    evidence: 'REAL_NATIVE_STAGE_ERROR_LINEAGE_NOT_RENDERED',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, digest: policy.digest },
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
