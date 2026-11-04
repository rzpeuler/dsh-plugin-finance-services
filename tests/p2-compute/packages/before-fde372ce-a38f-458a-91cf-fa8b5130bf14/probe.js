/** Disposable TEST_ONLY controlled-compute native Host probe. NEVER starts a model. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { join, isAbsolute, relative, sep } from 'node:path';
import { createProbeRecorder } from './report-io.js';

export const name = 'finance-p2-controlled-compute-test-only';
export const inject = ['tools', 'agentPresets', 'agents', 'systemPrompt'];
export const TARGETS = ['finance-pitch-agent-modeler', 'finance-model-builder-builder'];
export const CALCULATOR = 'finance_model_calculate';
const hash = value => createHash('sha256').update(value).digest('hex');
const info = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null, message: String(error?.message ?? error), stack: String(error?.stack ?? error) });
const inside = (root, path) => { const suffix = relative(root, path); return suffix !== '' && suffix !== '..' && !suffix.startsWith('..' + sep) && !isAbsolute(suffix); };
const sorted = values => [...values].sort();
const success = result => { assert.equal(result.isError, false, JSON.stringify(result)); return result.value; };
const denial = result => { assert.equal(result.isError, true, JSON.stringify(result)); return result; };

export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.bundleRoot));
  assert.ok(['before', 'after'].includes(config.mode));
  const root = await realpath(config.bundleRoot);
  const mode = config.mode;
  const runId = randomUUID();
  const runRoot = join(root, 'tests', 'p2-compute', 'runs', `${mode}-${runId}`);
  const workspace = join(runRoot, 'workspace');
  await mkdir(workspace, { recursive: true });
  const markerPath = join(runRoot, 'TEST_ONLY-ownership.json');
  await writeFile(markerPath, JSON.stringify({ kind: 'TEST_ONLY_CONTROLLED_COMPUTE', runId, runRoot }) + '\n', { flag: 'wx' });
  const canary = `TEST_ONLY UNSOURCED NON_USER_DATA ${runId}\n`;
  await writeFile(join(workspace, 'original-canary.txt'), canary, { flag: 'wx' });
  const report = { schemaVersion: 1, mode, runId, startedAt: new Date().toISOString(), status: 'RUNNING',
    evidence: 'REAL_NATIVE_LOADER_HOST', noModel: true, modelCalls: 0, networkCalls: 0, businessE2E: false,
    fixtureRoot: runRoot, workspace, checks: [], sessions: [], dispatches: [], tokenBudgets: [],
    userState: { bindingTouched: false, navigationTouched: false, registryTouched: false, historyDeleted: false },
    limitations: ['TEST_ONLY/UNSOURCED numeric fixtures, not financial advice or business E2E.',
      'Native token estimates are heuristic; incomplete first turn; excludes agent/pre-step Skill catalogue and provider usage.',
      'Root authority unload/source drift are covered by separate scoped regression tests; live product root is not mutated.'] };
  const recorder = await createProbeRecorder({ runRoot, latestPath: join(root, 'acceptance', `P2-controlled-compute-${mode}.json`), report });
  const cancel = new AbortController();
  const handles = [];
  const live = new Map();
  const owned = new Map();
  const held = [];
  async function check(id, operation) {
    const started = Date.now();
    let item;
    try { item = { id, status: 'PASS', detail: await operation(), elapsedMs: Date.now() - started }; }
    catch (error) { item = { id, status: error.probeStatus ?? 'FAIL', error: info(error), elapsedMs: Date.now() - started }; }
    report.checks.push(item);
    await recorder.record(item); // recorder contains I/O failures; never controls cleanup
    return item.status === 'PASS' ? item.detail : undefined;
  }
  const need = id => { const agent = live.get(id); assert.ok(agent, `Native Agent prerequisite missing: ${id}`); return agent; };
  async function dispatch(agent, name, args) {
    assert.equal(owned.get(agent.id), agent, 'Only exact owned Agents may be dispatched');
    const callId = `p2-compute-${randomUUID()}`;
    const result = await ctx.agents.withInitiator(agent, () => ctx.tools.execute({ agent, name, arguments: args, callId, signal: cancel.signal }));
    report.dispatches.push({ agentId: agent.id, preset: ctx.agentPresets.composedPreset(agent.ctx), name, callId, arguments: args, result });
    return result;
  }
  try {
    await recorder.checkpoint();
    const manifest = JSON.parse(await readFile(join(root, 'assets', 'agent-manifest.json'), 'utf8'));
    assert.equal(manifest.roles.length, 40);
    const roles = mode === 'before' ? TARGETS.map(id => manifest.roles.find(role => role.id === id)) : manifest.roles;
    assert.ok(roles.every(Boolean));
    for (const role of roles) await check(`native-session:${role.id}`, async () => {
      const handle = await ctx.agents.create({ sessionId: `p2-compute-${randomUUID()}`, meta: { cwd: workspace, agentPreset: role.id },
        signal: cancel.signal, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, role.id); } });
      handles.push(handle);
      const agent = handle.agent;
      owned.set(agent.id, agent); live.set(role.id, agent);
      assert.equal(agent.session.header.cwd, workspace);
      assert.equal(agent.session.header.agentPreset, role.id);
      assert.equal(ctx.agents.get(agent.id), agent);
      assert.equal(ctx.agentPresets.composedPreset(agent.ctx), role.id);
      report.sessions.push({ id: agent.id, roleId: role.id, cwd: workspace, retainedHistory: true });
      return { id: agent.id, roleId: role.id };
    });
    for (const role of roles) await check(`native-tools:${role.id}`, async () => {
      const agent = need(role.id);
      const schemas = ctx.tools.schemas(agent);
      const names = schemas.map(tool => tool.name);
      const expected = [...role.builtinTools.filter(tool => ['read', 'grep', 'glob', 'write', 'edit'].includes(tool)),
        ...role.allowedMcpServers.length && !role.writer ? ['finance_data_query'] : [], 'skill',
        ...role.kind === 'main' ? ['ask_user_question', 'send_message', 'list_agents', 'interrupt_agent', 'subagent'] : [],
        ...mode === 'after' && TARGETS.includes(role.id) ? [CALCULATOR] : []];
      assert.deepEqual(sorted(names), sorted(expected));
      if (mode === 'before' || !TARGETS.includes(role.id)) denial(await dispatch(agent, CALCULATOR, { action: 'describe', model: 'dcf' }));
      if (role.id === TARGETS[1]) assert.ok(!names.includes('finance_data_query'));
      return { schemas };
    });
    for (const id of TARGETS) await check(`native-system-assembly-tool-envelope-estimate:${id}`, async () => {
      const agent = need(id);
      const meter = ctx.get('tokenMeter');
      if (!meter) throw Object.assign(new Error('Native tokenMeter unavailable'), { probeStatus: 'NOT_RUN' });
      const assembly = await ctx.systemPrompt.assemble({ scope: agent, agent, signal: cancel.signal });
      const message = { id: `p2-budget-${randomUUID()}`, role: 'system', source: { kind: 'system-prompt' },
        content: [{ type: 'text', text: [...assembly.sections, ...assembly.contexts].map(item => item.text).join('\n\n') }] };
      const promptTokens = meter.estimateMessage(message);
      // Directly created idle Workers need not have AgentOptions route; read the public native default selection, without saving it.
      const defaultRoute = ctx.get('agentDefaultModel')?.currentSelection();
      const configRoute = { provider: agent.options.provider ?? defaultRoute?.provider, model: agent.options.model ?? defaultRoute?.model };
      assert.ok(configRoute.provider && configRoute.model, 'Native Agent/default route unavailable');
      const withTools = meter.measure(agent.session, { config: configRoute, tools: assembly.tools });
      const withoutTools = meter.measure(agent.session, { config: configRoute, tools: [] });
      const detail = { roleId: id, status: 'NATIVE_HEURISTIC_ESTIMATE', modelUsage: 'NOT_MEASURED', route: configRoute,
        estimateScope: 'systemPrompt.assemble sections/contexts and header tool envelope only', completeFirstTurn: false, incompleteFirstTurn: true,
        excluded: ['agent/pre-step skill catalogue', 'user input', 'other pre-step contributions', 'provider usage measurement'],
        promptTokens, toolEnvelopeTokens: withTools.totalTokens - withoutTools.totalTokens, toolCount: assembly.tools.length,
        sectionNames: assembly.sections.map(item => item.name), contextNames: assembly.contexts.map(item => item.name),
        measurementWithTools: withTools, measurementWithoutTools: withoutTools };
      assert.ok(Number.isFinite(promptTokens) && promptTokens > 0); assert.ok(detail.toolEnvelopeTokens > 0);
      report.tokenBudgets.push(detail); return detail;
    });
    if (mode === 'after') await runAfter({ ctx, root, manifest, need, dispatch, check, report, cancel, held, workspace, canary });
    await check('no-model-and-original-canary-unchanged', async () => {
      assert.equal(await readFile(join(workspace, 'original-canary.txt'), 'utf8'), canary);
      for (const agent of live.values()) {
        assert.equal(agent.status, 'idle');
        const forbidden = agent.session.snapshotEvents().filter(event => ['turn/start', 'step/start', 'request/header', 'assistant/message', 'assistant/attempt', 'user/message'].includes(event.type));
        assert.equal(forbidden.length, 0, 'No model or user turn may start');
      }
      return { noModel: true, originalSha256: hash(canary), sessions: live.size };
    });
  } catch (error) {
    report.checks.push({ id: 'probe-runner', status: 'FAIL', error: info(error) });
  } finally {
    // No deletion, registry mutation, global role unmount, binding or Client actions.
    for (const handle of handles.reverse()) await check(`dispose-owned-agent:${handle.agent.id}`, async () => {
      const marker = JSON.parse(await readFile(markerPath, 'utf8'));
      assert.equal(marker.runId, runId); assert.equal(marker.kind, 'TEST_ONLY_CONTROLLED_COMPUTE');
      assert.equal(owned.get(handle.agent.id), handle.agent);
      assert.equal(handle.agent.session.header.cwd, workspace);
      assert.ok(inside(await realpath(runRoot), await realpath(workspace)));
      await handle.dispose();
      return { id: handle.agent.id, historyDeleted: false, filesRetained: true };
    });
    for (const { definition, agent } of held) await check(`late-held-calculator-denied:${agent.id}`, async () => {
      await assert.rejects(() => definition.execute({ action: 'describe', model: 'dcf' }, { agent, signal: cancel.signal }), /ROLE_AGENT_REQUIRED|ROLE_AUTHORITY_UNAVAILABLE/);
      return { disposedAgentRejected: true };
    });
    cancel.abort();
    report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(item => item.status === 'PASS').length;
    report.checksFailed = report.checks.filter(item => item.status === 'FAIL').length;
    report.checksNotRun = report.checks.filter(item => item.status === 'NOT_RUN').length;
    report.status = report.checksFailed || report.io.failures.length ? 'FAIL' : report.checksNotRun ? 'PARTIAL' : 'PASS';
    await recorder.finish();
  }
}

async function runAfter() { throw new Error('AFTER probe not yet authored; BEFORE is independently ready.'); }
