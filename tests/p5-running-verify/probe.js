// Phase 2: read the stage back after the service lifecycle restarted.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export const name = 'finance-p5-running-verify-test-only'
export const inject = ['financeReview']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const runId = config.runId

  await check('an-interrupted-stage-is-not-reported-as-completed', async () => {
    const runs = ctx.financeReview.runs()
    const mine = runs.find(run => run.runId === runId)
    assert.ok(mine, 'the run must survive the restart')
    assert.equal(mine.checkpoints.model_build_complete, 'UNKNOWN_TERMINATED')
    return { checkpoints: mine.checkpoints }
  })

  await check('the-run-is-reported-as-interrupted-and-never-completed', async () => {
    const decision = ctx.financeReview.classify({ runId })
    // Deliberate design: an interrupted run keeps its own status so callers can tell it apart from a failure.
    assert.equal(decision.status, 'UNKNOWN_TERMINATED')
    assert.equal(decision.reason, 'PROCESS_RESTARTED_WITHOUT_TERMINAL_STAGE_RECORD')
    assert.notEqual(decision.status, 'COMPLETED')
    assert.notEqual(decision.status, 'PENDING_REVIEW')
    return decision
  })

  await check('the-gate-will-not-accept-an-interrupted-stage', async () => {
    const decision = ctx.financeReview.evaluate({ sessionId: `session-running-verify`, runId,
      agentId: 'finance-model-builder', checkpointId: 'model_build_complete', artifact: { hash: 'f'.repeat(64) } })
    assert.equal(decision.decision, 'HOLD')
    return { decision: decision.decision, reason: decision.reason }
  })

  await check('nothing-was-auto-approved-during-recovery', async () => {
    const rows = await ctx.financeReview.queue()
    const mine = rows.filter(row => row.runId === runId)
    assert.ok(mine.every(row => row.decision !== 'ALLOW'), JSON.stringify(mine))
    return { rows: mine.length }
  })

  const report = {
    evidence: 'REAL_NATIVE_RECOVERY_ACROSS_SERVICE_LIFECYCLE_NOT_OS_RESTART',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    runId, checks, modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
