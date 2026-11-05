// Native probe: review questions go through userQuestions, and child Agents are refused.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export const name = 'finance-p5-ask-test-only'
export const inject = ['financeReview', 'agents', 'agentPresets', 'agentLoop', 'userQuestions', 'storageDomain']

const MAIN = 'finance-pitch-agent'
const WORKER = 'finance-pitch-agent-modeler'

export async function apply(ctx, config) {
  const checks = []
  const handles = []
  const creation = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION' }) }
  }
  const cwd = config.workspace
  const policy = ctx.financeReview.policy()
  const runId = `run-p5-ask-${randomUUID().slice(0, 8)}`
  const artifact = { hash: 'f'.repeat(64) }

  async function rootAgent(preset) {
    const sessionId = `p5-ask-${randomUUID()}`
    try {
      const handle = await ctx.agents.create({ sessionId, meta: { cwd, agentPreset: preset },
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset) } })
      handles.push(handle)
      creation.push({ kind: 'root', preset, ok: true })
      return handle
    } catch (error) {
      creation.push({ kind: 'root', preset, ok: false, error: String(error?.message).slice(0, 160) })
      return null
    }
  }

  async function childAgent(parent, preset) {
    const sessionId = `p5-ask-child-${randomUUID()}`
    try {
      const handle = await ctx.agentLoop.createAgent(ctx, {
        sessionId, parentAgent: parent,
        meta: { cwd, agentPreset: preset, parentSession: parent.id, origin: 'subagent', delegationDepth: 1 },
        signal: AbortSignal.timeout(60000),
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset) },
      })
      handles.push(handle)
      creation.push({ kind: 'child', preset, ok: true })
      return handle
    } catch (error) {
      creation.push({ kind: 'child', preset, ok: false, error: String(error?.message).slice(0, 160) })
      return null
    }
  }

  try {
    const main = await rootAgent(MAIN)
    const workerRoot = await rootAgent(WORKER)
    const child = main ? await childAgent(main.agent, WORKER) : null
    const mainChild = main ? await childAgent(main.agent, MAIN) : null

    await check('agents-created-with-expected-shape', async () => {
      assert.ok(main?.agent?.id, 'main agent creation failed')
      assert.ok(workerRoot?.agent?.id, 'worker root creation failed')
      assert.ok(child?.agent?.id, 'owned child creation failed')
      assert.equal(ctx.agents.isOwnedBy(child.agent.id, main.agent), true)
      const roots = ctx.agents.roots().map(agent => agent.id)
      assert.ok(roots.includes(main.agent.id))
      assert.ok(!roots.includes(child.agent.id), 'the owned child must not be a runtime root')
      return { rootPreset: ctx.agentPresets.composedPreset(main.agent.ctx), childOwned: true }
    })

    for (const dependency of [main, workerRoot, child]) {
      if (!dependency?.agent?.id) {
        checks.push({ id: 'creation-diagnostics', status: 'FAIL', detail: creation })
        throw Object.assign(new Error('AGENT_CREATION_FAILED'), { code: 'AGENT_CREATION_FAILED' })
      }
    }

    await check('main-agent-question-waits-boundedly-and-creates-no-approval', async () => {
      const before = ctx.financeReview.inspect().reviews
      const outcome = await ctx.financeReview.requestReview({ sessionId: main.agent.id, runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'PENDING')
      assert.ok(outcome.callId)
      assert.equal(ctx.financeReview.inspect().reviews, before, 'asking must not record a decision')
      const decision = ctx.financeReview.evaluate({ sessionId: main.agent.id, runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact })
      assert.equal(decision.decision, 'HOLD')
      return { status: outcome.status, callId: outcome.callId, timeoutMs: outcome.timeoutMs, gate: decision.reason }
    })

    await check('owned-child-cannot-raise-a-review-question', async () => {
      const outcome = await ctx.financeReview.requestReview({ sessionId: child.agent.id, runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'WORKER_CANNOT_ASK')
      return outcome
    })

    await check('owned-child-with-a-main-role-is-still-refused', async () => {
      assert.ok(mainChild?.agent?.id, 'main-role child creation failed')
      const outcome = await ctx.financeReview.requestReview({ sessionId: mainChild.agent.id, runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'WORKER_CANNOT_ASK')
      assert.equal(outcome.reason, 'OWNED_CHILD')
      return outcome
    })

    await check('worker-role-cannot-ask-even-as-a-runtime-root', async () => {
      const outcome = await ctx.financeReview.requestReview({ sessionId: workerRoot.agent.id, runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'WORKER_CANNOT_ASK')
      assert.equal(outcome.reason, 'ONLY_MAIN_AGENT')
      return outcome
    })

    await check('native-question-service-refuses-a-delegated-caller', async () => {
      let code = null
      try {
        await ctx.userQuestions.ask({ agent: child.agent, questions: [{ id: 'probe', question: 'Should never be asked?' }] })
      } catch (error) { code = error?.code ?? error?.name }
      assert.equal(code, 'DELEGATED_CALLER')
      return { nativeCode: code }
    })

    await check('checkpoint-outside-the-policy-is-not-asked', async () => {
      const outcome = await ctx.financeReview.requestReview({ sessionId: main.agent.id, runId, agentId: MAIN,
        checkpointId: 'assumptions_review', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'NOT_REQUIRED_BY_POLICY')
      return outcome
    })

    await check('unknown-session-is-not-live', async () => {
      const outcome = await ctx.financeReview.requestReview({ sessionId: 'session-absent', runId, agentId: MAIN,
        checkpointId: 'valuation_complete', artifact, timeoutMs: 400 })
      assert.equal(outcome.status, 'CALLER_NOT_LIVE')
      return outcome
    })

    await check('asking-never-creates-a-review-fact', async () => {
      const document = ctx.storageDomain.get('financial_review').table('state').get('root')
      const mine = (document?.reviews ?? []).filter(review => review.runId === runId)
      assert.equal(mine.length, 0)
      return { runReviews: mine.length, totalReviews: document?.reviews?.length ?? 0 }
    })

    await check('policy-identity-is-the-one-used-for-the-question', async () => {
      assert.equal(policy.policyId, 'original')
      assert.equal(policy.externalSideEffects, 'DISABLED')
      return { policyVersion: policy.version, digest: policy.digest }
    })
  } catch (error) {
    if (!checks.some(item => item.id === 'fatal')) {
      checks.push({ id: 'fatal', status: 'FAIL', error: String(error?.code ?? error?.message).slice(0, 120) })
    }
  } finally {
    for (const handle of handles) { try { await handle.dispose() } catch { /* teardown is best effort */ } }
  }

  const disposed = handles.map(handle => ctx.agents.get(handle.agent.id) === undefined)
  const report = {
    evidence: 'REAL_NATIVE_QUESTION_HANDOVER_AND_OWNERSHIP_REFUSAL_NOT_UI_VISUAL',
    status: checks.every(item => item.status === 'PASS') && disposed.every(Boolean) ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    creation,
    agentsDisposed: disposed,
    checks,
    modelCalls: 0,
    modelTurns: 0,
    questionsAnswered: 0,
    approvalsFromQuestions: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
