// Phase 1: leave an explicitly RUNNING stage behind, then disappear.
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p5-running-record-test-only'
export const inject = ['financeReview']

export async function apply(ctx, config) {
  const runId = `run-running-${randomUUID().slice(0, 8)}`
  const sessionId = `session-running-${randomUUID().slice(0, 8)}`
  const outcome = await (async () => {
    try {
      await ctx.financeReview.recordStage({ sessionId, runId, agentId: 'finance-model-builder',
        checkpointId: 'model_build_complete', status: 'RUNNING' })
      const runs = ctx.financeReview.runs()
      const mine = runs.find(run => run.runId === runId)
      return { status: 'RECORDED', runId, sessionId, checkpoint: 'model_build_complete',
        stageStatus: mine?.checkpoints?.model_build_complete ?? 'MISSING',
        classification: mine?.classification ?? 'MISSING' }
    } catch (error) {
      return { status: 'FAILED', runId, error: error?.code ?? error?.name, message: String(error?.message ?? '').slice(0, 160) }
    }
  })()
  await writeFile(config.reportPath, JSON.stringify({ evidence: 'REAL_NATIVE_RUNNING_STAGE_LEFT_BEHIND', ...outcome,
    note: 'This service instance is removed next; the store must not treat the stage as completed.' }, null, 2) + '\n', { flag: 'w' })
}
