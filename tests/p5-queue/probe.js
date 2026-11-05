// Native probe: cross-session review queue projection and error-code discipline.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p5-queue-test-only'
export const inject = ['financeReview', 'agents', 'agentPresets', 'storageDomain']

const HASH = '3'.repeat(64)
const SENTINEL = 'SECRET_PROBE_VALUE'

export async function apply(ctx, config) {
  const checks = []
  const handles = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', ...(error?.detail ? { detail: error.detail } : {}) }) }
  }
  const policy = ctx.financeReview.policy()
  const observedCodes = []

  async function createAgent(preset) {
    const handle = await ctx.agents.create({ sessionId: `p5-queue-${randomUUID()}`,
      meta: { cwd: config.workspace, agentPreset: preset },
      setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset) } })
    handles.push(handle)
    return handle
  }

  const review = (sessionId, runId, checkpointId, agentId, status = 'APPROVED') => ({
    reviewId: `review-${randomUUID()}`, sessionId, runId, agentId, checkpointId,
    policyVersion: policy.version, artifactRef: { hash: HASH }, status, actor: 'p5-queue-probe',
    decidedAt: new Date().toISOString(),
  })

  try {
    const pitch = await createAgent('finance-pitch-agent')
    const research = await createAgent('finance-market-researcher')
    const runPitch = `run-pitch-${randomUUID().slice(0, 8)}`
    const runResearch = `run-research-${randomUUID().slice(0, 8)}`

    await check('two-sessions-produce-two-live-groups', async () => {
      await ctx.financeReview.recordStage({ sessionId: pitch.agent.id, runId: runPitch, agentId: 'finance-pitch-agent',
        checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
      await ctx.financeReview.settle(review(pitch.agent.id, runPitch, 'valuation_complete', 'finance-pitch-agent'))
      await ctx.financeReview.recordStage({ sessionId: research.agent.id, runId: runResearch, agentId: 'finance-market-researcher',
        checkpointId: 'comps_spread_complete', status: 'COMPLETED', artifact: { hash: HASH } })
      const projection = await ctx.financeReview.queueProjection()
      const mine = projection.groups.filter(group => [pitch.agent.id, research.agent.id].includes(group.sessionId))
      assert.equal(mine.length, 2)
      assert.ok(mine.every(group => group.live === true && group.status === 'LIVE_SESSION'))
      assert.equal(mine.find(group => group.sessionId === pitch.agent.id).preset, 'finance-pitch-agent')
      return { groups: mine.length, presets: mine.map(group => group.preset) }
    })

    await check('decisions-and-pending-counts-come-from-persisted-facts', async () => {
      const projection = await ctx.financeReview.queueProjection()
      const pitchGroup = projection.groups.find(group => group.sessionId === pitch.agent.id)
      const researchGroup = projection.groups.find(group => group.sessionId === research.agent.id)
      assert.equal(pitchGroup.decided, 1)
      assert.equal(pitchGroup.pending, 0)
      assert.equal(researchGroup.decided, 0)
      assert.ok(researchGroup.pending >= 1)
      const pendingItem = researchGroup.items.find(item => item.decision === 'HOLD')
      assert.equal(pendingItem.reason, 'REVIEW_REQUIRED')
      return { pitchDecided: pitchGroup.decided, researchPending: researchGroup.pending, reason: pendingItem.reason }
    })

    await check('projection-reads-the-single-persisted-revision', async () => {
      const projection = await ctx.financeReview.queueProjection()
      const document = ctx.storageDomain.get('financial_review').table('state').get('root')
      assert.equal(projection.revision, document.revision)
      assert.equal(projection.source, 'financial_review.domain/state')
      assert.match(projection.documentDigest, /^[a-f0-9]{64}$/)
      const frozen = Object.isFrozen(projection) && Object.isFrozen(projection.groups)
        && projection.groups.every(group => Object.isFrozen(group) && Object.isFrozen(group.items))
      assert.ok(frozen, 'projection must be read-only')
      return { revision: projection.revision, frozen }
    })

    await check('a-new-decision-moves-the-projection-revision', async () => {
      const before = await ctx.financeReview.queueProjection()
      await ctx.financeReview.settle(review(research.agent.id, runResearch, 'comps_spread_complete', 'finance-market-researcher'))
      const after = await ctx.financeReview.queueProjection()
      assert.ok(after.revision > before.revision)
      const researchGroup = after.groups.find(group => group.sessionId === research.agent.id)
      assert.equal(researchGroup.decided, 1)
      return { before: before.revision, after: after.revision }
    })

    await check('a-disposed-session-stays-listed-as-not-live', async () => {
      await handles[1].dispose()
      const projection = await ctx.financeReview.queueProjection()
      const researchGroup = projection.groups.find(group => group.sessionId === research.agent.id)
      assert.ok(researchGroup, 'a finished session must remain visible')
      assert.equal(researchGroup.live, false)
      assert.equal(researchGroup.status, 'SESSION_NOT_LIVE')
      return { status: researchGroup.status, items: researchGroup.items.length }
    })

    await check('invalid-records-return-a-code-without-leaking-values', async () => {
      let error
      try {
        await ctx.financeReview.settle({ reviewId: `${SENTINEL}-review`, sessionId: `${SENTINEL}-session`,
          runId: runPitch, agentId: 'finance-pitch-agent', checkpointId: 'deck_complete',
          policyVersion: policy.version, artifactRef: { hash: HASH }, status: 'APPROVED', actor: '', decidedAt: new Date().toISOString() })
      } catch (thrown) { error = thrown; observedCodes.push(thrown.code) }
      assert.ok(error, 'an invalid record must be refused')
      assert.equal(error.code, 'REVIEW_RECORD_INVALID')
      assert.ok(!String(error.message).includes(SENTINEL), 'the message must not echo record values')
      return { code: error.code, message: String(error.message).slice(0, 80) }
    })

    await check('unknown-session-and-missing-artifact-fail-closed-with-codes', async () => {
      const notLive = await ctx.financeReview.requestReview({ sessionId: 'session-absent', runId: runPitch,
        agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact: { hash: HASH }, timeoutMs: 250 })
      assert.equal(notLive.status, 'CALLER_NOT_LIVE')
      let code = null
      try { ctx.financeReview.evaluate({ sessionId: pitch.agent.id, runId: runPitch,
        agentId: 'finance-pitch-agent', checkpointId: 'deck_complete', artifact: {} }) } catch (error) { code = error?.code }
      assert.equal(code, 'ARTIFACT_IDENTITY_REQUIRED')
      return { notLive: notLive.status, missingArtifact: code }
    })

    await check('all-observed-codes-are-in-the-expected-catalogue', async () => {
      const catalogue = new Set(['REVIEW_RECORD_INVALID', 'CALLER_NOT_LIVE', 'ARTIFACT_IDENTITY_REQUIRED',
        'REVIEW_REQUEST_INVALID', 'POLICY_UNKNOWN_AGENT', 'POLICY_UNKNOWN_CHECKPOINT', 'REVIEW_SERVICE_UNAVAILABLE'])
      const unknown = observedCodes.filter(code => !catalogue.has(code))
      if (!observedCodes.length || unknown.length) {
        const error = new Error('error-code discipline not exercised')
        error.detail = { observed: observedCodes, unknown }
        throw error
      }
      return { observed: [...new Set(observedCodes)] }
    })
  } catch (error) {
    checks.push({ id: 'fatal', status: 'FAIL', error: String(error?.code ?? error?.message).slice(0, 120) })
  } finally {
    for (const handle of handles) { try { await ctx.agents.get(handle.agent.id) && await handle.dispose() } catch { /* teardown */ } }
  }

  const disposed = handles.map(handle => ctx.agents.get(handle.agent.id) === undefined)
  const report = {
    evidence: 'REAL_NATIVE_QUEUE_PROJECTION_AND_ERROR_DISCIPLINE_NOT_UI_VISUAL',
    status: checks.every(item => item.status === 'PASS') && disposed.every(Boolean) ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    agentsDisposed: disposed,
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
