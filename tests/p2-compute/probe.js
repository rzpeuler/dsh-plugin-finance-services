/** Disposable TEST_ONLY controlled-compute native Host probe. NEVER starts a model. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { join, isAbsolute, relative, sep } from 'node:path';
import { createProbeRecorder } from '../p2-live/report-io.js';
import { assertGolden, goldenRequest, near } from './golden.js';

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

async function runAfter({ ctx, manifest, need, dispatch, check, report, cancel, held }) {
  const modeler = need(TARGETS[0]), builder = need(TARGETS[1]);
  const descriptors = new Map(), requests = new Map(), results = new Map();
  function parseEnvelope(result, action, model) {
    const value = success(result);
    assert.equal(value.action, action); assert.equal(value.model, model); assert.equal(typeof value.result_json, 'string');
    const parsed = JSON.parse(value.result_json);
    assert.equal(parsed.model, model); assert.equal(parsed.officeStatus, 'NOT_IMPLEMENTED_P4');
    return parsed;
  }
  async function calculate(agent, model, request) {
    return parseEnvelope(await dispatch(agent, CALCULATOR, { action: 'calculate', model, input_json: JSON.stringify(request) }), 'calculate', model);
  }
  for (const id of TARGETS) await check(`native-calculator-schema:${id}`, async () => {
    const agent = need(id), schema = ctx.tools.schemas(agent).find(tool => tool.name === CALCULATOR);
    assert.ok(schema);
    assert.equal(schema.parameters.additionalProperties, false);
    assert.deepEqual(schema.parameters.properties.model.enum, id === TARGETS[0] ? ['dcf', 'lbo'] : ['dcf', 'lbo', 'three_statement', 'comps']);
    assert.deepEqual(sorted(Object.keys(schema.parameters.properties)), ['action', 'input_json', 'model']);
    const definition = ctx.tools.get(CALCULATOR, agent);
    assert.ok(definition); held.push({ definition, agent });
    const other = id === TARGETS[0] ? builder : modeler;
    // A captured native executor must reject another exact live Agent, even one authorized for its own calculator.
    await assert.rejects(() => definition.execute({ action: 'describe', model: 'dcf' }, { agent: other, signal: cancel.signal }), /ROLE_AGENT_REQUIRED/);
    return { schema, crossRoleHeldExecutorDenied: true };
  });
  await check('only-two-of-forty-have-native-calculator', async () => {
    const admitted = manifest.roles.filter(role => ctx.tools.schemas(need(role.id)).some(tool => tool.name === CALCULATOR)).map(role => role.id);
    assert.deepEqual(sorted(admitted), sorted(TARGETS));
    return { roles: 40, admitted, otherThirtyEightDispatchDenied: true };
  });
  for (const model of ['dcf', 'lbo', 'three_statement', 'comps']) await check(`native-describe-and-hand-golden:${model}`, async () => {
    const descriptor = parseEnvelope(await dispatch(builder, CALCULATOR, { action: 'describe', model }), 'describe', model);
    assert.equal(descriptor.inputSchema.additionalProperties, false);
    assert.ok(descriptor.example && descriptor.inputSchema.properties.inputs);
    assert.equal(descriptor.example.model, model);
    assert.equal(descriptor.example.provenance.classification, 'TEST_ONLY');
    descriptors.set(model, descriptor);
    // Always execute the actual native descriptor example before the independent nontrivial hand fixture.
    const exampleResult = await calculate(builder, model, descriptor.example);
    assert.ok(Object.values(exampleResult.checks).every(value => value === true));
    const request = goldenRequest(model, descriptor.example);
    requests.set(model, request);
    const result = await calculate(builder, model, request);
    assertGolden(model, result); results.set(model, result);
    return { descriptor, request, result, oracle: 'Independent hand arithmetic; no calculation-core import', exampleNativeCalculated: true };
  });
  for (const model of ['dcf', 'lbo']) await check(`native-modeler-readonly-json:${model}`, async () => {
    const descriptor = parseEnvelope(await dispatch(modeler, CALCULATOR, { action: 'describe', model }), 'describe', model);
    const result = await calculate(modeler, model, goldenRequest(model, descriptor.example));
    assertGolden(model, result);
    return { result, writes: false };
  });
  for (const model of ['three_statement', 'comps']) await check(`native-modeler-model-denied:${model}`, async () => {
    const rejected = [];
    for (const action of ['describe', 'calculate']) rejected.push(denial(await dispatch(modeler, CALCULATOR,
      { action, model, ...action === 'calculate' ? { input_json: JSON.stringify(requests.get(model)) } : {} })));
    return rejected;
  });
  await check('native-modeler-write-and-builder-mcp-denied', async () => {
    const rejected = [denial(await dispatch(modeler, 'write', { file_path: `financial-services/artifacts/${modeler.id}/forbidden.json`, content: 'TEST_ONLY' })),
      denial(await dispatch(modeler, 'edit', { file_path: 'original-canary.txt', old_string: 'TEST_ONLY', new_string: 'FORBIDDEN', expected_sha256: '0'.repeat(64) })),
      denial(await dispatch(builder, 'finance_data_query', { source: 'capiq', query: 'TEST_ONLY no network' }))];
    for (const name of ['pwsh', 'bash', 'run_code', 'web_fetch']) for (const agent of [modeler, builder]) rejected.push(denial(await dispatch(agent, name, {})));
    return rejected;
  });
  await check('native-strict-input-negative-matrix', async () => {
    const base = requests.get('dcf'); assert.ok(base, 'Native describe prerequisite unavailable');
    const mutated = change => { const value = structuredClone(base); change(value); return JSON.stringify(value); };
    const variants = [
      ['code-property', { action: 'calculate', model: 'dcf', input_json: JSON.stringify(base), code: 'return 1' }],
      ['path-property', { action: 'calculate', model: 'dcf', input_json: JSON.stringify(base), file_path: 'original-canary.txt' }],
      ['request-unknown-property', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.unexpected = true; }) }],
      ['input-unknown-property', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.inputs.shell = 'do-not-execute'; }) }],
      ['model-mismatch', { action: 'calculate', model: 'lbo', input_json: JSON.stringify(base) }],
      ['invalid-json-nan', { action: 'calculate', model: 'dcf', input_json: '{"model":"dcf","inputs":{"revenue":NaN}}' }],
      ['invalid-json-syntax', { action: 'calculate', model: 'dcf', input_json: '{' }],
      ['wrong-unit', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.unit = 'bananas'; }) }],
      ['wrong-currency', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.currency = 'US Dollars'; }) }],
      ['terminal-growth-equal-wacc', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.inputs.terminal.growth = 11.125 / 130; }) }],
      ['terminal-growth-above-wacc', { action: 'calculate', model: 'dcf', input_json: mutated(v => { v.inputs.terminal.growth = 0.15; }) }],
      ['missing-input-json', { action: 'calculate', model: 'dcf' }],
      ['describe-unexpected-input', { action: 'describe', model: 'dcf', input_json: '{}' }],
    ];
    const observations = [];
    for (const [id, args] of variants) observations.push({ id, result: denial(await dispatch(builder, CALCULATOR, args)) });
    const comps = structuredClone(requests.get('comps')); assert.ok(comps);
    for (const [field, value] of [['currency', 'EUR'], ['unit', 'thousands']]) {
      const bad = structuredClone(comps); bad.inputs.peers[0][field] = value;
      observations.push({ id: `comps-mixed-${field}`, result: denial(await dispatch(builder, CALCULATOR, { action: 'calculate', model: 'comps', input_json: JSON.stringify(bad) })) });
    }
    return observations;
  });
  await check('native-builder-own-json-write-and-native-read-hash', async () => {
    const result = results.get('dcf'); assert.ok(result);
    const file_path = `financial-services/artifacts/${builder.id}/TEST_ONLY-controlled-dcf.json`;
    const content = JSON.stringify(result, null, 2) + '\n';
    const written = success(await dispatch(builder, 'write', { file_path, content }));
    assert.equal(written.sha256, hash(content));
    const read = success(await dispatch(builder, 'read', { file_path, limit: 500 }));
    assert.equal(read.sha256, hash(content)); assert.equal(read.text, content); assert.equal(read.truncated, false);
    assert.equal(JSON.parse(read.text).officeStatus, 'NOT_IMPLEMENTED_P4');
    return { file_path, sha256: written.sha256, nativeReadSha256: read.sha256, artifactKind: 'NUMERIC_RESULT_NOT_OFFICE', noOtherProductWrite: true };
  });
  await check('native-dcf-and-lbo-sensitivity-center-consistency', async () => {
    const details = [];
    for (const model of ['dcf', 'lbo']) {
      const request = structuredClone(requests.get(model)); assert.ok(request); request.section = 'sensitivity';
      const result = await calculate(builder, model, request);
      const b = result.calculations.base;
      const grids = model === 'dcf' ? Object.values(result.calculations.sensitivity) : [result.calculations.sensitivity];
      for (const grid of grids) {
        assert.equal(grid.cells.length, 5); assert.ok(grid.cells.every(row => row.length === 5));
        const center = grid.cells[2][2]; assert.equal(center.valid, true);
        if (model === 'dcf') near(center.enterpriseValue, b.enterpriseValue); else near(center.moic, b.moic);
      }
      details.push({ model, gridCount: grids.length, centerMatchesBase: true });
    }
    return details;
  });
  await check('native-resource-chain-assigned-reference-and-cross-role-denial', async () => {
    // This actual assigned skill has a real bundled reference, not a fabricated registry-only positive.
    const role = manifest.roles.find(item => item.id === TARGETS[1]);
    assert.ok(role.skillNames.includes('3-statement-model'));
    const loaded = success(await dispatch(builder, 'skill', { name: '3-statement-model' }));
    assert.equal(loaded.provider, role.id); assert.equal(loaded.resourceBase?.kind, 'directory');
    assert.ok(isAbsolute(loaded.resourceBase.path));
    const reference = 'references/formulas.md';
    assert.ok(loaded.content.includes(reference), 'Actual native Skill body must reference the chosen file');
    const path = join(loaded.resourceBase.path, ...reference.split('/'));
    assert.ok(inside(loaded.resourceBase.path, path));
    const allowed = success(await dispatch(builder, 'read', { file_path: path, limit: 200 }));
    assert.ok(allowed.text.trim().length > 0); assert.match(allowed.sha256, /^[a-f0-9]{64}$/); assert.equal(allowed.trust, 'UNTRUSTED_DATA');
    // Even the same skill name in another role has a separate absolute resource root; it is not cross-role authority.
    const sibling = manifest.roles.find(item => item.id !== role.id && item.id !== TARGETS[0] && item.skillNames.includes('3-statement-model'));
    assert.ok(sibling);
    const siblingLoad = success(await dispatch(need(sibling.id), 'skill', { name: '3-statement-model' }));
    assert.equal(siblingLoad.resourceBase?.kind, 'directory');
    const siblingPath = join(siblingLoad.resourceBase.path, ...reference.split('/'));
    assert.notEqual(siblingPath, path);
    const siblingPositive = success(await dispatch(need(sibling.id), 'read', { file_path: siblingPath, limit: 1 }));
    assert.match(siblingPositive.sha256, /^[a-f0-9]{64}$/);
    const forbidden = denial(await dispatch(builder, 'read', { file_path: siblingPath, limit: 1 }));
    assert.match(JSON.stringify(forbidden), /PATH_DENIED/);
    return { skill: loaded.name, nativeProvider: loaded.provider, resourceBase: loaded.resourceBase, reference, resolvedPath: path,
      allowedSha256: allowed.sha256, siblingRoleId: sibling.id, siblingResourceBase: siblingLoad.resourceBase, siblingSha256: siblingPositive.sha256, forbidden };
  });
  report.numericOracle = 'Native describe schema/example and independent hand arithmetic; no model/core direct invocation';
}
