/** TEST_ONLY native Host probe. No model turns, fake Tools or replacement FinanceData. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, join, relative, sep } from 'node:path';
import { createProbeRecorder } from './report-io.js';
export const name = 'finance-p3-role-native-test-only';
export const inject = ['agents', 'agentPresets', 'tools', 'systemPrompt'];
export const MODELER = 'finance-pitch-agent-modeler', WRITER = 'finance-model-builder-builder';
export const TOOL = 'finance_data_query';
export const hash = text => createHash('sha256').update(text).digest('hex');
export const success = result => { assert.equal(result.isError, false, JSON.stringify(result)); return result.value; };
export const denial = result => { assert.equal(result.isError, true, JSON.stringify(result)); return result; };
const inside = (root, path) => { const p = relative(root, path); return p && p !== '..' && !p.startsWith('..' + sep) && !isAbsolute(p); };
// Exceptions from adversarial providers may contain secrets; never serialize arbitrary exception text.
const info = error => ({ name: error?.name ?? 'Error', code: typeof error?.code === 'string' && /^[A-Z_]{1,64}$/.test(error.code) ? error.code : 'PROBE_ASSERTION',
  assertion: error?.code === 'ERR_ASSERTION', diagnostic: 'Exception text intentionally withheld; inspect failed check id.' });
export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.bundleRoot)); assert.ok(['before', 'after'].includes(config.mode));
  const root = await realpath(config.bundleRoot), runId = randomUUID(), mode = config.mode;
  const runRoot = join(root, 'tests/p3-role-native/runs', `${mode}-${runId}`), workspace = join(runRoot, 'workspace');
  await mkdir(workspace, { recursive: true });
  const markerPath = join(runRoot, 'TEST_ONLY-ownership.json');
  await writeFile(markerPath, JSON.stringify({ kind: 'TEST_ONLY_P3_ROLE_NATIVE', runId, runRoot }) + '\n', { flag: 'wx' });
  const canary = `TEST_ONLY NON_USER_DATA ${runId}\n`, canaryPath = join(workspace, 'original-canary.txt');
  await writeFile(canaryPath, canary, { flag: 'wx' });
  const report = { schemaVersion: 1, runId, mode, startedAt: new Date().toISOString(), status: 'RUNNING',
    evidence: 'REAL_NATIVE_HOST_ROLE_TOOLS_NOT_VISUAL_OR_COMMERCIAL', noModel: true, modelTurns: 0, modelCalls: 0, networkCalls: 0,
    fixtureRoot: runRoot, workspace, checks: [], sessions: [], dispatches: [], tokenBudgets: [],
    userState: { defaultBindingTouched: false, workspaceRegistryTouched: false, navigationTouched: false, historyDeleted: false },
    limitations: ['TEST_ONLY toy data; no commercial, visual, MCP connectivity or business E2E claim.',
      'Native heuristic estimates cover assembled system sections/contexts and tool headers, not complete first turns or Skill catalogue.'] };
  const recorder = await createProbeRecorder({ runRoot, latestPath: join(root, 'tests/p3-role-native', `latest-${mode}.json`), report });
  const cancel = new AbortController(), handles = [], owned = new Map(), live = [], held = [], cleanup = [];
  async function check(id, operation) {
    const start = Date.now(); let item;
    try { item = { id, status: 'PASS', detail: await operation(), elapsedMs: Date.now() - start }; }
    catch (error) { item = { id, status: error.probeStatus ?? 'FAIL', error: info(error), elapsedMs: Date.now() - start }; }
    report.checks.push(item); await recorder.record(item); return item.status === 'PASS' ? item.detail : undefined;
  }
  async function dispatch(agent, name, args, signal = cancel.signal) {
    assert.equal(owned.get(agent.id), agent, 'Only exact owned native Agents');
    const callId = `p3-role-${randomUUID()}`;
    const result = await ctx.agents.withInitiator(agent, () => ctx.tools.execute({ agent, name, arguments: args, callId, signal }));
    // Bounded evidence; no arbitrary input JSON or provider error text is persisted.
    report.dispatches.push({ agentId: agent.id, name, callId, action: args?.action ?? null,
      capability: args?.capability ?? null, isError: result.isError, status: result.isError ? 'NATIVE_DISPATCH_DENIED' : result.value?.status ?? 'OK' });
    return result;
  }
  async function dispose(handle) {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    assert.equal(marker.kind, 'TEST_ONLY_P3_ROLE_NATIVE'); assert.equal(marker.runId, runId); assert.equal(marker.runRoot, runRoot);
    assert.equal(owned.get(handle.agent.id), handle.agent); assert.equal(handle.agent.session.header.cwd, workspace);
    assert.ok(inside(await realpath(runRoot), await realpath(workspace)));
    await handle.dispose(); assert.equal(ctx.agents.get(handle.agent.id), undefined);
    return { id: handle.agent.id, filesRetained: true, historyDeleted: false };
  }
  try {
    await recorder.checkpoint();
    const presets = mode === 'before' ? [MODELER, WRITER] : [MODELER, MODELER, WRITER];
    for (const [index, preset] of presets.entries()) await check(`create-native-agent:${index}:${preset}`, async () => {
      const handle = await ctx.agents.create({ sessionId: `p3-role-${randomUUID()}`, meta: { cwd: workspace, agentPreset: preset },
        signal: cancel.signal, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset); } });
      handles.push(handle); const agent = handle.agent; owned.set(agent.id, agent); live[index] = agent;
      assert.equal(ctx.agents.get(agent.id), agent); assert.equal(agent.session.header.agentPreset, preset);
      assert.equal(ctx.agentPresets.composedPreset(agent.ctx), preset);
      report.sessions.push({ id: agent.id, preset, cwd: workspace, historyRetained: true });
      return { id: agent.id, preset, tools: ctx.tools.schemas(agent).map(t => t.name) };
    });
    for (const index of mode === 'before' ? [0, 1] : [0, 2]) await check(`native-system-tools-budget:${index}`, async () => {
      const agent = live[index]; assert.ok(agent);
      const meter = ctx.get('tokenMeter'), defaultRoute = ctx.get('agentDefaultModel')?.currentSelection();
      if (!meter || !defaultRoute) throw Object.assign(new Error(), { probeStatus: 'NOT_RUN' });
      const assembly = await ctx.systemPrompt.assemble({ scope: agent, agent, signal: cancel.signal });
      const route = { provider: agent.options.provider ?? defaultRoute.provider, model: agent.options.model ?? defaultRoute.model };
      assert.ok(route.provider && route.model);
      const message = { id: `p3-budget-${randomUUID()}`, role: 'system', source: { kind: 'system-prompt' },
        content: [{ type: 'text', text: [...assembly.sections, ...assembly.contexts].map(i => i.text).join('\n\n') }] };
      const withTools = meter.measure(agent.session, { config: route, tools: assembly.tools });
      const withoutTools = meter.measure(agent.session, { config: route, tools: [] });
      const detail = { roleId: ctx.agentPresets.composedPreset(agent.ctx), status: 'NATIVE_HEURISTIC_ESTIMATE', route,
        estimateScope: 'systemPrompt.assemble sections/contexts plus native header tool envelope', completeFirstTurn: false,
        excluded: ['agent/pre-step Skill catalogue', 'user input', 'other pre-step contributions', 'provider usage'],
        modelUsage: 'NOT_MEASURED', promptTokens: meter.estimateMessage(message), toolEnvelopeTokens: withTools.totalTokens - withoutTools.totalTokens,
        toolCount: assembly.tools.length, sectionNames: assembly.sections.map(i => i.name), contextNames: assembly.contexts.map(i => i.name),
        schemas: assembly.tools, measurementWithTools: withTools, measurementWithoutTools: withoutTools };
      assert.ok(detail.promptTokens > 0 && detail.toolEnvelopeTokens > 0); report.tokenBudgets.push(detail); return detail;
    });
    if (mode === 'after') {
      const { runAfter } = await import('./after.js');
      await runAfter({ ctx, root, runRoot, runId, report, check, live, handles, owned, held, cleanup, dispatch, cancel, dispose });
    }
  } catch (error) { await check('probe-runner', async () => { throw error; }); }
  finally {
    for (const action of cleanup.reverse()) await check(action.id, action.run);
    await check('canary-and-zero-native-turns', async () => {
      assert.equal(await readFile(canaryPath, 'utf8'), canary);
      for (const handle of handles) {
        const agent = handle.agent; if (ctx.agents.get(agent.id) === agent) assert.equal(agent.status, 'idle');
        assert.equal(agent.session.snapshotEvents().filter(e => ['turn/start', 'step/start', 'request/header', 'assistant/message', 'assistant/attempt', 'user/message'].includes(e.type)).length, 0);
      } return { sha256: hash(canary), allModelTurns: 0, sessions: handles.length };
    });
    for (const handle of [...handles].reverse()) if (ctx.agents.get(handle.agent.id) === handle.agent)
      await check(`dispose-marker-fenced-agent:${handle.agent.id}`, () => dispose(handle));
    for (const { definition, agent } of held) await check(`disposed-held-definition-denied:${agent.id}`, async () => {
      await assert.rejects(() => definition.execute({ action: 'describe', capability: 'financial.statements' }, { agent, signal: cancel.signal }));
      return { rejected: true };
    });
    cancel.abort(); report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(c => c.status === 'PASS').length;
    report.checksFailed = report.checks.filter(c => c.status === 'FAIL').length;
    report.checksNotRun = report.checks.filter(c => c.status === 'NOT_RUN').length;
    report.status = report.checksFailed || report.io.failures.length ? 'FAIL' : report.checksNotRun ? 'PARTIAL' : 'PASS';
    await recorder.finish();
  }
}
