/** TEST_ONLY: real native Host Services only; no ToolsStub, model turns, Client or commercial claims. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, join, relative, sep } from 'node:path';
import { createProbeRecorder } from '../p2-live/report-io.js';
export const name = 'finance-p3-native-foundation-test-only';
export const inject = ['agents', 'agentPresets', 'tools']; // Finance dependencies are checked in apply so missing Services produce NOT_RUN receipts.
const MODELER = 'finance-pitch-agent-modeler', WRITER = 'finance-model-builder-builder';
const MCP = 'test-mcp-statements', REST = 'test-rest-statements';
const hash = text => createHash('sha256').update(text).digest('hex');
const info = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null, message: String(error?.message ?? error), stack: String(error?.stack ?? error) });
const inside = (root, path) => { const p = relative(root, path); return p && p !== '..' && !p.startsWith('..' + sep) && !isAbsolute(p); };
const tuple = b => JSON.stringify([b.adapterId, b.sourceAllowlistKey, b.roleIds]);
export const sourceQuery = () => ({ capability: 'financial.statements', entity: { scheme: 'ticker', id: 'TOY' }, market: 'US',
  requiredFields: ['revenue', 'ebitda'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z', purpose: 'research', maxAgeSeconds: 3000000,
  targetUnit: { dimension: 'currency', currency: 'USD', scale: 'ones' }, accountingBasis: 'US_GAAP', consolidation: 'consolidated', measurementType: 'actual' });

export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.bundleRoot));
  const root = await realpath(config.bundleRoot), runId = randomUUID();
  const runRoot = join(root, 'tests', 'p3-native', 'runs', `TEST_ONLY-${runId}`), workspace = join(runRoot, 'workspace');
  await mkdir(workspace, { recursive: true });
  const markerPath = join(runRoot, 'TEST_ONLY-ownership.json');
  await writeFile(markerPath, JSON.stringify({ kind: 'TEST_ONLY_P3_NATIVE', runId, runRoot }) + '\n', { flag: 'wx' });
  const canary = `TEST_ONLY NON_USER_DATA ${runId}\n`, canaryPath = join(workspace, 'original-canary.txt');
  await writeFile(canaryPath, canary, { flag: 'wx' });
  const report = { schemaVersion: 1, runId, startedAt: new Date().toISOString(), status: 'RUNNING', mode: 'foundation',
    evidence: 'REAL_NATIVE_HOST_SERVICES_NOT_CLIENT_TOOL_OR_COMMERCIAL', p3Status: 'PARTIAL', noModel: true,
    fixtureRoot: runRoot, workspace, checks: [], sessions: [], queries: [], modelTurns: 0, externalNetworkCalls: 0,
    userState: { defaultWorkspaceBindingTouched: false, clientTouched: false, registrySettingsTouched: false, historyDeleted: false },
    limitations: ['P3 remains partial: FinanceDataTool and Client are not implemented or tested here.',
      'TEST_ONLY independent TOY actual observations, not commercial supplier equivalence, MCP connectivity, an average, or business E2E.',
      'No in-flight cancellation fixture exists; only pre-aborted native query cancellation is exercised.'] };
  const recorder = await createProbeRecorder({ runRoot, latestPath: join(root, 'tests', 'p3-native', 'latest-foundation.json'), report });
  const cancel = new AbortController(), handles = [], owned = new Map(), originals = new Map();
  let data, operations, mcp, rest, ownBindings = [], bindingsApplied = false;
  async function check(id, operation) {
    const start = Date.now(); let item;
    try { item = { id, status: 'PASS', detail: await operation(), elapsedMs: Date.now() - start }; }
    catch (error) { item = { id, status: error.probeStatus ?? 'FAIL', error: info(error), elapsedMs: Date.now() - start }; }
    report.checks.push(item); await recorder.record(item); return item.status === 'PASS' ? item.detail : undefined;
  }
  const catalog = () => JSON.parse(data.catalog({}).catalogJson);
  const save = (revision, bindings) => data.setBindings({ expectedRevision: revision, bindingsJson: JSON.stringify(bindings) });
  async function query(agent, request = sourceQuery(), signal = cancel.signal) {
    assert.equal(owned.get(agent.id), agent, 'Only exact created Agents may be queried');
    const result = await data.queryForAgent(agent, request, signal);
    assert.ok(report.queries.length < 32, 'Bounded query evidence');
    report.queries.push({ agentId: agent.id, request, result });
    if (result.status === 'OK') for (const observation of result.data.observations) {
      assert.equal(observation.measurementType, 'actual'); assert.equal(observation.licenseClass, 'TEST_ONLY');
      assert.equal(observation.provenance.testOnly, true); assert.equal(observation.provenance.licenseClass, 'TEST_ONLY');
      assert.match(observation.observationId, /^sha256:[a-f0-9]{64}$/);
      assert.match(observation.reference.uri, /^urn:finance:test-only:/);
    }
    return result;
  }
  const denied = (result, status) => { assert.equal(result.status, status, JSON.stringify(result)); assert.equal(result.data, null); return result; };
  function selected(result, adapterId, revenue) {
    assert.equal(result.status, 'OK', JSON.stringify(result));
    assert.equal(result.data.observations.find(item => item.field === 'revenue').value, revenue);
    assert.ok(result.data.observations.every(item => item.provenance.adapterId === adapterId));
    assert.ok(result.trace.some(item => item.adapterId === adapterId && item.code === 'SELECTED')); return result;
  }
  try {
    await recorder.checkpoint();
    const ready = await check('required-native-services', async () => {
      const keys = ['financeData', 'financeOperations', 'financeTestMcpAdapter', 'financeTestRestAdapter'];
      const missing = keys.filter(key => !ctx.get(key));
      if (missing.length) throw Object.assign(new Error(`Native Services missing: ${missing.join(', ')}`), { probeStatus: 'NOT_RUN' });
      [data, operations, mcp, rest] = keys.map(key => ctx.get(key)); return { services: keys };
    });
    if (!ready) throw Object.assign(new Error('Native Service prerequisites missing; no synthetic replacement'), { probeStatus: 'NOT_RUN' });
    for (const control of [mcp, rest]) { assert.equal(control.diagnostics().failureArmed, false); originals.set(control, control.getSnapshot()); }
    await check('catalog-two-test-only-sources-fourteen-capabilities-redacted', async () => {
      const c = catalog(); assert.equal(c.capabilities.length, 14); assert.equal(new Set(c.capabilities).size, 14);
      for (const id of [MCP, REST]) { const a = c.adapters.find(a => a.id === id); assert.ok(a); assert.equal(a.testOnly, true); assert.equal(a.licenseClass, 'TEST_ONLY'); }
      assert.equal(c.commercialExecutionVerified, false);
      const inspectKeys = value => { if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
        assert.ok(!/^(?:credentialRef|api[_-]?key|password|access[_-]?token|secret)$/i.test(key), `Sensitive catalog key: ${key}`); inspectKeys(item);
      } }; inspectKeys(c); return c;
    });
    const live = [];
    for (const [index, preset] of [MODELER, MODELER, WRITER].entries()) await check(`create-mount-native-agent:${index}`, async () => {
      const handle = await ctx.agents.create({ sessionId: `p3-native-${randomUUID()}`, meta: { cwd: workspace, agentPreset: preset },
        signal: cancel.signal, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset); } });
      handles.push(handle); const agent = handle.agent; owned.set(agent.id, agent); live[index] = agent;
      assert.equal(ctx.agents.get(agent.id), agent); assert.equal(agent.session.header.cwd, workspace);
      assert.equal(agent.session.header.agentPreset, preset); assert.equal(ctx.agentPresets.composedPreset(agent.ctx), preset);
      const role = await operations.roleDefinition(preset);
      assert.equal(operations.isRoleRuntimeActive(agent, preset, { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 }), true);
      const toolNames = ctx.tools.schemas(agent).map(tool => tool.name);
      for (const name of ['pwsh', 'bash', 'run_code', 'web_fetch']) assert.ok(!toolNames.includes(name));
      report.sessions.push({ id: agent.id, preset, cwd: workspace, historyRetained: true, modelTurns: 0 }); return { id: agent.id, preset, toolNames };
    });
    const [modeler, other, writer] = live; assert.ok(modeler && other && writer, 'All three real Agents required');
    assert.notEqual(modeler.id, other.id);
    await check('installation-is-not-entitlement', async () => denied(await query(modeler), 'NOT_AUTHORIZED'));
    const definition = await operations.roleDefinition(MODELER);
    assert.ok(['capiq', 'daloopa'].every(key => definition.allowedMcpServers.includes(key)));
    ownBindings = [[MCP, 'capiq', 20], [REST, 'daloopa', 10]].map(([adapterId, sourceAllowlistKey, priority]) => ({
      adapterId, sourceAllowlistKey, scopeIds: [modeler.id], roleIds: [MODELER], capabilities: ['financial.statements'], markets: ['US'],
      purposes: ['research'], priority, minQuality: 0, enabled: true, allowTestOnly: true }));
    const applied = await check('append-only-own-scope-bindings-native-durable-save', async () => {
      const before = catalog();
      const result = await save(before.revision, [...before.bindings, ...ownBindings]);
      if (result.status === 'APPLIED') bindingsApplied = true;
      assert.equal(result.status, 'APPLIED', JSON.stringify(result)); assert.equal(result.revision, before.revision + 1);
      const after = catalog(); assert.deepEqual(after.bindings, [...before.bindings, ...ownBindings]); assert.equal(after.revision, result.revision);
      const domain = ctx.get('storageDomain')?.get('financial_data'); assert.ok(domain, 'Public native financial_data diagnostic domain required');
      const stored = domain.table('policy').get('root'); assert.deepEqual(stored, { revision: after.revision, bindings: after.bindings });
      return { beforeRevision: before.revision, afterRevision: after.revision, storedRevision: stored.revision };
    });
    assert.ok(applied && bindingsApplied, 'Policy prerequisite not applied');
    mcp.setState('READY'); rest.setState('READY');
    await check('mcp-first-normalizes-two-million-with-original-provenance', async () => {
      const result = selected(await query(modeler), MCP, 2000000), revenue = result.data.observations.find(o => o.field === 'revenue');
      assert.equal(revenue.provenance.originalValue, 2); assert.equal(revenue.provenance.originalUnit.scale, 'millions');
      assert.equal(revenue.provenance.sourceId, 'test-only-mcp'); return result;
    });
    await check('same-role-distinct-session-denied', async () => denied(await query(other), 'NOT_AUTHORIZED'));
    await check('writer-role-denied', async () => denied(await query(writer), 'ROLE_QUERY_DENIED'));
    await check('real-follow-observes-status-and-rest-fallback', async () => {
      const stop = new AbortController(), signal = AbortSignal.any([stop.signal, AbortSignal.timeout(5000)]), stream = data.follow({}, signal);
      try {
        const initial = await stream.next(); assert.equal(initial.done, false); JSON.parse(initial.value.catalogJson);
        mcp.setState('NOT_AUTHORIZED', 'FIXTURE_NOT_AUTHORIZED');
        const update = await stream.next(); assert.equal(update.done, false);
        const snapshot = JSON.parse(update.value.catalogJson); assert.equal(snapshot.adapters.find(a => a.id === MCP).status.state, 'NOT_AUTHORIZED');
        const result = selected(await query(modeler), REST, 2100000);
        assert.ok(result.trace.some(item => item.adapterId === MCP && item.code === 'NOT_AUTHORIZED'));
        assert.equal(result.data.observations.find(o => o.field === 'revenue').provenance.sourceId, 'test-only-rest');
        return { snapshot, result, notAnAverageOrEquivalent: true };
      } finally { stop.abort(); await stream.return(); }
    });
    await check('fixture-query-failure-falls-back-with-safe-trace', async () => {
      mcp.setState('READY'); mcp.failNextQuery(); const result = selected(await query(modeler), REST, 2100000);
      assert.ok(result.trace.some(item => item.adapterId === MCP && item.code === 'FIXTURE_QUERY_FAILED')); return result;
    });
    await check('strict-model-query-rejects-role-and-session-injection', async () => {
      for (const extra of [{ roleId: MODELER }, { sessionId: modeler.id }, { scopeId: modeler.id }])
        await assert.rejects(() => query(modeler, { ...sourceQuery(), ...extra })); return { rejected: 3 };
    });
    await check('invalid-source-and-writer-policy-rejected-revision-preserved', async () => {
      const before = catalog(), results = [];
      for (const variant of [{ ...ownBindings[0], sourceAllowlistKey: 'not-allowlisted' }, { ...ownBindings[0], roleIds: [WRITER] }]) {
        const result = await save(before.revision, [...before.bindings, variant]); assert.equal(result.status, 'REJECTED');
        assert.equal(result.revision, before.revision); assert.deepEqual(catalog(), before); results.push(result);
      } return results;
    });
    await check('stale-policy-cas-conflict-preserves-current-state', async () => {
      const before = catalog(), result = await save(before.revision - 1, []); assert.equal(result.status, 'CONFLICT');
      assert.equal(result.revision, before.revision); assert.deepEqual(catalog(), before); return result;
    });
    await check('eur-mismatch-no-invented-fx', async () => denied(await query(modeler, { ...sourceQuery(), targetUnit: { dimension: 'currency', currency: 'EUR', scale: 'ones' } }), 'UNAVAILABLE'));
    await check('stale-query-no-invented-freshness', async () => denied(await query(modeler, { ...sourceQuery(), maxAgeSeconds: 1 }), 'UNAVAILABLE'));
    await check('unbound-capability-denied', async () => denied(await query(modeler, { ...sourceQuery(), capability: 'prices.history' }), 'NOT_AUTHORIZED'));
    await check('pre-aborted-native-query-cancellation', async () => {
      const stopped = new AbortController(); stopped.abort(); return denied(await query(modeler, sourceQuery(), stopped.signal), 'CANCELLED');
    });
  } catch (error) { await check('probe-runner', async () => { throw error; }); }
  finally {
    if (bindingsApplied) await check('cleanup-cas-removes-only-owned-scope-tuples', async () => {
      const keys = new Set(ownBindings.map(tuple)), scopes = new Set(handles.map(h => h.agent.id));
      for (let attempt = 0; attempt < 8; attempt++) {
        const before = catalog(), kept = before.bindings.flatMap(binding => {
          if (!keys.has(tuple(binding))) return [binding];
          const scopeIds = binding.scopeIds.filter(id => !scopes.has(id));
          return scopeIds.length === binding.scopeIds.length ? [binding] : scopeIds.length ? [{ ...binding, scopeIds }] : [];
        });
        if (JSON.stringify(kept) === JSON.stringify(before.bindings)) return { alreadyRemoved: true, revision: before.revision };
        const result = await save(before.revision, kept); if (result.status === 'CONFLICT') continue;
        assert.equal(result.status, 'APPLIED', JSON.stringify(result));
        const after = catalog(); assert.ok(!after.bindings.some(b => keys.has(tuple(b)) && b.scopeIds.some(id => scopes.has(id))));
        return { revision: result.revision, otherBindingsPreservedAtCAS: true, noStaleRestore: true };
      } throw new Error('Cleanup CAS conflict persisted; no stale policy overwrite attempted');
    });
    for (const [control, original] of originals) await check('restore-test-only-adapter-original-status', async () => {
      control.setState(original.state, original.code); const restored = control.getSnapshot();
      assert.equal(restored.state, original.state); assert.equal(restored.code, original.code); assert.equal(control.diagnostics().failureArmed, false);
      return { state: restored.state, timestampRefreshed: true };
    });
    await check('canary-sha-and-all-native-agent-model-turns-zero', async () => {
      assert.equal(hash(await readFile(canaryPath, 'utf8')), hash(canary));
      for (const handle of handles) {
        const agent = handle.agent; assert.equal(agent.status, 'idle');
        const forbidden = agent.session.snapshotEvents().filter(e => ['turn/start', 'step/start', 'request/header', 'assistant/message', 'assistant/attempt', 'user/message'].includes(e.type));
        assert.equal(forbidden.length, 0); assert.equal(owned.get(agent.id), agent);
      } return { sha256: hash(canary), sessions: handles.length, allModelTurns: 0 };
    });
    for (const handle of [...handles].reverse()) await check(`dispose-only-marker-fenced-created-agent:${handle.agent.id}`, async () => {
      const marker = JSON.parse(await readFile(markerPath, 'utf8')); assert.equal(marker.kind, 'TEST_ONLY_P3_NATIVE'); assert.equal(marker.runId, runId);
      assert.equal(marker.runRoot, runRoot); assert.equal(owned.get(handle.agent.id), handle.agent);
      assert.equal(handle.agent.session.header.cwd, workspace); assert.ok(inside(await realpath(runRoot), await realpath(workspace)));
      await handle.dispose(); assert.equal(ctx.agents.get(handle.agent.id), undefined); return { filesRetained: true, historyDeleted: false };
    });
    cancel.abort(); report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(c => c.status === 'PASS').length;
    report.checksFailed = report.checks.filter(c => c.status === 'FAIL').length;
    report.checksNotRun = report.checks.filter(c => c.status === 'NOT_RUN').length;
    report.status = report.checksFailed || report.checksNotRun || report.io.failures.length ? 'FAIL' : 'PASS';
    await recorder.finish();
  }
}
