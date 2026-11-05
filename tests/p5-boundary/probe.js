// Two-phase native probe: policy matrix around an approval, and an uninstall negative test.
import { readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p5-boundary-test-only'
export const inject = ['financeReview', 'agents', 'agentPresets', 'approval', 'sandboxPolicy', 'storageDomain', 'tools']

const RUN = 'run-p5-boundary-fixed'
const SESSION = 'session-p5-boundary-fixed'
const HASH = '2'.repeat(64)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

export async function apply(ctx, config) {
  const checks = []
  const handles = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', ...(error?.detail ? { detail: error.detail } : {}) }) }
  }

  const policy = ctx.financeReview.policy()
  const sentinelPath = join(config.workspace, 'sentinel.json')
  const markerPath = join(config.workspace, 'marker.json')
  const sentinel = JSON.stringify({ purpose: 'P5_UNINSTALL_SENTINEL', run: RUN, policyDigest: policy.digest })
  const sentinelSha = sha(Buffer.from(sentinel, 'utf8'))
  const phase = await stat(markerPath).then(() => 'B', () => 'A')

  try {
    const handle = await ctx.agents.create({ sessionId: `p5-boundary-${randomUUID()}`,
      meta: { cwd: config.workspace, agentPreset: 'finance-pitch-agent' },
      setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, 'finance-pitch-agent') } })
    handles.push(handle)
    const agent = handle.agent

    const observe = () => ({
      sandbox: ctx.sandboxPolicy.resolve({ session: agent.session }),
      approvalOverride: ctx.approval.overrideOf(agent.session) ?? null,
      tools: ctx.tools.schemas(agent).map(tool => tool.name).sort(),
    })
    const before = observe()

    if (phase === 'A') {
      await check('approval-policy-and-sandbox-unchanged-across-an-approval', async () => {
        const settled = await ctx.financeReview.settle({ reviewId: 'review-boundary-1', sessionId: agent.id, runId: RUN,
          agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', policyVersion: policy.version,
          artifactRef: { hash: HASH }, status: 'APPROVED', actor: 'p5-boundary-probe', decidedAt: new Date().toISOString() })
        assert.equal(settled.status, 'SETTLED')
        ctx.financeReview.evaluate({ sessionId: agent.id, runId: RUN, agentId: 'finance-pitch-agent',
          checkpointId: 'valuation_complete', artifact: { hash: HASH } })
        await ctx.financeReview.queue()
        const after = observe()
        assert.deepEqual(after.sandbox, before.sandbox, 'sandbox policy changed')
        assert.deepEqual(after.tools, before.tools, 'tool set changed')
        assert.equal(JSON.stringify(after.approvalOverride), JSON.stringify(before.approvalOverride),
          'approval mode changed')
        return { sandboxMode: before.sandbox.mode, approvalOverride: before.approvalOverride,
          toolCount: before.tools.length, unchanged: true }
      })

      await check('write-a-user-sentinel-and-a-comparison-marker', async () => {
        await writeFile(sentinelPath, sentinel, 'utf8')
        await writeFile(markerPath, JSON.stringify({ sentinelSha, sandbox: before.sandbox,
          approvalOverride: before.approvalOverride, tools: before.tools }, null, 2), 'utf8')
        const info = await stat(sentinelPath)
        return { sentinelBytes: info.size, sentinelSha }
      })
    } else {
      const marker = JSON.parse(await readFile(markerPath, 'utf8'))
      await check('user-sentinel-survives-a-full-uninstall', async () => {
        const bytes = await readFile(sentinelPath)
        assert.equal(sha(bytes), marker.sentinelSha, 'sentinel content changed')
        return { bytes: bytes.length, sha: marker.sentinelSha }
      })

      await check('persisted-approval-survives-a-full-uninstall', async () => {
        const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN,
          agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', artifact: { hash: HASH } })
        // The approval was recorded for the probe-owned session, not the fixed label; look it up.
        const reviews = ctx.storageDomain.get('financial_review').table('state').get('root')?.reviews ?? []
        const mine = reviews.filter(review => review.runId === RUN)
        assert.equal(mine.length, 1)
        const sessionScoped = ctx.financeReview.evaluate({ sessionId: mine[0].sessionId, runId: RUN,
          agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', artifact: { hash: HASH } })
        assert.equal(sessionScoped.decision, 'ALLOW')
        return { decision: sessionScoped.reason, reviews: mine.length, unrelatedSession: decision.reason }
      })

      await check('runtime-policies-match-the-pre-uninstall-marker', async () => {
        const after = observe()
        const shape = value => JSON.stringify({ mode: value.mode, workspaceRoot: value.workspaceRoot })
        const sandboxEqual = shape(after.sandbox) === shape(marker.sandbox)
        const approvalEqual = JSON.stringify(after.approvalOverride) === JSON.stringify(marker.approvalOverride)
        const toolsEqual = JSON.stringify(after.tools) === JSON.stringify(marker.tools)
        if (!(sandboxEqual && approvalEqual && toolsEqual)) {
          const error = new Error('policy drift')
          error.detail = { sandboxEqual, approvalEqual, toolsEqual,
            marker: { sandbox: marker.sandbox, approvalOverride: marker.approvalOverride, tools: marker.tools },
            after: { sandbox: after.sandbox, approvalOverride: after.approvalOverride, tools: after.tools } }
          throw error
        }
        return { sandboxMode: after.sandbox.mode, approvalMode: after.approvalOverride, toolCount: after.tools.length, identical: true }
      })
    }
  } finally {
    for (const handle of handles) { try { await handle.dispose() } catch { /* teardown is best effort */ } }
  }

  const disposed = handles.map(handle => ctx.agents.get(handle.agent.id) === undefined)
  const report = {
    evidence: 'REAL_NATIVE_POLICY_MATRIX_AND_UNINSTALL_NEGATIVE_TEST_NOT_COMMERCIAL',
    phase,
    status: checks.every(item => item.status === 'PASS') && disposed.every(Boolean) ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    agentsDisposed: disposed,
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
