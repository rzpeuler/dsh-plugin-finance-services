// Seed one TEST_ONLY deliverable tied to a live session, so the open-session button can be exercised.
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

export const name = 'finance-p6-seed-deliverable-test-only'
export const inject = ['financeReview', 'agents']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  let seeded = null

  await check('a-live-session-is-available', async () => {
    const live = ctx.agents.list()
    assert.ok(live.length >= 1, 'no live agent to link a deliverable to')
    const chosen = live[live.length - 1]
    seeded = { sessionId: String(chosen.id) }
    return { liveAgents: live.length, chosen: seeded.sessionId.slice(0, 12) }
  })

  await check('the-deliverable-is-recorded-against-that-session', async () => {
    const body = 'TECHNICAL_TEST_ONLY seed deliverable for the open-session check\n'
    const sha256 = createHash('sha256').update(body).digest('hex')
    const result = await ctx.financeReview.registerDeliverable({
      sessionId: seeded.sessionId, runId: `run-seed-${sha256.slice(0, 8)}`, agentId: 'finance-pitch-agent',
      path: `artifacts/open-session-seed-${sha256.slice(0, 8)}.txt`, sha256, bytes: Buffer.byteLength(body),
      classification: 'TEST_ONLY', reviewId: null,
    })
    assert.ok(['RECORDED', 'DUPLICATE'].includes(result.status), result.status)
    seeded.deliverableId = result.deliverableId
    seeded.status = result.status
    return { status: result.status, deliverableId: result.deliverableId }
  })

  await check('the-run-projection-lists-that-deliverable-with-its-session', async () => {
    const runs = ctx.financeReview.runs()
    const mine = runs.find(run => run.runId === `run-seed-${String(seeded.deliverableId ?? '').slice(-8)}`) ?? null
    const projection = await ctx.financeReview.queueProjection()
    assert.ok(projection.revision >= 1)
    return { runs: runs.length, seededRunSeen: Boolean(mine), session: seeded.sessionId.slice(0, 12) }
  })

  const report = {
    stage: 'P6',
    id: 'P6_SEEDED_DELIVERABLE_FOR_OPEN_SESSION',
    evidence: 'REAL_SESSION_ID_FROM_THE_LIVE_REGISTRY',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    seeded, checks, modelCalls: 0,
    note: 'TEST_ONLY. The row exists so a person can click open-session and observe the navigation.',
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
