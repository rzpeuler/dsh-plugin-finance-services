/** TEST_ONLY native Host dispatcher probe. No model turns, fake tools, manager, adapter or policy edits. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CHALLENGE, TOOL_SCHEMAS, VERSION } from './protocol.js';
import { createObservedConnectionState } from './connection-state.js';
export const name = 'finance-p3-native-mcp-test-only-probe';
export const inject = ['tools', 'agents', 'agentPresets'];
const MODELER = 'finance-pitch-agent-modeler';
const safeError = error => ({ name: error?.name === 'AssertionError' ? 'AssertionError' : 'Error',
  code: error?.code === 'ERR_ASSERTION' ? 'ERR_ASSERTION' : 'TEST_ONLY_PROBE_FAILED', message: 'Exception payload withheld; inspect the named check.' });
const within = (root, target) => { const path = relative(root, target); return path && path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path); };
export async function apply(ctx) {
  const config = JSON.parse(await readFile(new URL('./test-config.json', import.meta.url), 'utf8'));
  assert.match(config.identity, /^[a-f0-9-]{36}$/); assert.match(config.serverName, /^finance_p3_test_[a-f0-9]{12}$/);
  const evidenceRoot = await realpath(config.evidenceRoot), testRoot = await realpath(config.testRoot);
  assert.ok(within(testRoot, evidenceRoot));
  const runId = randomUUID(), workspace = join(evidenceRoot, `workspace-${runId}`), markerPath = join(evidenceRoot, `ownership-${runId}.json`);
  await mkdir(workspace);
  const sessionId = `p3-native-mcp-${randomUUID()}`;
  const marker = { kind: 'TEST_ONLY_P3_NATIVE_MCP', runId, identity: config.identity, workspace, sessionId };
  await writeFile(markerPath, JSON.stringify(marker) + '\n', { flag: 'wx' });
  const names = ['ping', 'financial_statements'].map(tool => `mcp__${config.serverName}__${tool}`);
  const report = { schemaVersion: 1, classification: 'TEST_ONLY_NOT_REAL_COMMERCIAL', identity: config.identity, runId,
    startedAt: new Date().toISOString(), status: 'RUNNING', serverName: config.serverName, nativeEntryId: config.nativeEntryId,
    nativePackage: '@deepseek-ai/dsh-mcp-client', expectedNames: names, checks: [], dispatches: [],
    manager: { status: 'NOT_AVAILABLE', passClaimed: false }, modelCalls: 0, modelTurns: 0, networkCalls: 0,
    policyTouched: false, userFilesTouched: false, historyDeleted: false, adapterRegistered: false,
    bridge: { status: 'UNSUPPORTED_PUBLIC_DELEGATION_CONTRACT',
      reason: 'FinanceData Adapter receives query plus signal/requestId, not Agent/ToolExecutionToken. FinanceRole raw MCP stays hidden. Omitting Agent or changing identity in a role query would bypass policy; no such bridge is implemented.' } };
  const lifetime = new AbortController(), observed = createObservedConnectionState(); let handle;
  async function check(id, operation) {
    try { const detail = await operation(); report.checks.push({ id, status: 'PASS', detail }); return detail; }
    catch (error) { report.checks.push({ id, status: 'FAIL', error: safeError(error) }); return undefined; }
  }
  async function call(index, args, agent) {
    assert.ok(index === 0 || index === 1);
    const exec = { callId: `p3-native-mcp-${randomUUID()}`, name: names[index], arguments: args,
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(5000)]), ...(agent ? { agent } : {}) };
    // Agentless calls below are ONLY the directly human-authorized fixed Host test; never an Adapter/FinanceRole delegation.
    const result = agent ? await ctx.agents.withInitiator(agent, () => ctx.tools.execute(exec)) : await ctx.tools.execute(exec);
    report.dispatches.push({ callId: exec.callId, name: exec.name, origin: agent ? 'EXACT_FINANCE_ROLE_NEGATIVE_TEST' : 'DIRECT_AUTHORIZED_TEST_HOST',
      isError: result.isError, errorCode: result.isError ? result.error.info?.code ?? 'TOOL_ERROR' : null });
    return result;
  }
  function canonical(result) {
    assert.equal(result.isError, false); assert.ok(Buffer.byteLength(JSON.stringify(result.value)) < 4096);
    assert.ok(Array.isArray(result.value.content));
    assert.equal(result.value.structuredContent.classification, 'TEST_ONLY_NOT_REAL_COMMERCIAL');
    assert.deepEqual(JSON.parse(result.value.content[0].text), result.value.structuredContent);
    return result.value.structuredContent;
  }
  try {
    await check('native-namespaced-registration-and-exact-wire-schema', async () => {
      const schemas = ctx.tools.schemas().filter(tool => tool.name.startsWith(`mcp__${config.serverName}__`));
      assert.deepEqual(schemas.map(tool => tool.name).sort(), [...names].sort());
      for (const [index, name] of names.entries()) assert.deepEqual(schemas.find(tool => tool.name === name).parameters, TOOL_SCHEMAS[index].inputSchema);
      return { names, schemas, localToolDefinitionsRegistered: 0, nativeLoaderOwnsRegistration: true };
    });
    await check('actual-stdio-native-ping-and-read-correlation', async () => {
      const pingResult = await call(0, { challenge: CHALLENGE }), ping = canonical(pingResult);
      observed.observe('ping', pingResult); assert.equal(observed.getSnapshot().state, 'NOT_CONFIGURED');
      assert.equal(ping.challenge, CHALLENGE); assert.equal(ping.protocolVersion, VERSION); assert.equal(ping.initialized, true);
      assert.match(ping.instanceId, /^[a-f0-9-]{36}$/);
      const readResult = await call(1, { symbol: 'TOY', fiscalYear: 2024 }), read = canonical(readResult);
      observed.observe('read', readResult); assert.equal(observed.getSnapshot().state, 'READY');
      assert.equal(read.instanceId, ping.instanceId); assert.equal(read.calls, ping.calls + 1);
      assert.equal(read.revenue, 2.2); assert.equal(read.revenue * 1000000, 2200000); assert.equal(read.ebitda, 0.44);
      assert.equal(read.currency, 'USD'); assert.equal(read.scale, 'millions'); assert.equal(read.license, 'TEST_ONLY');
      return { ping, read, connectionStatus: observed.getSnapshot(), financialObservationAdapter: false };
    });
    await check('public-dispatch-retains-monotonic-policy-denial', async () => {
      const release = ctx.effect(() => ctx.tools.guard(exec => exec.name === names[0] ? 'TEST_ONLY_NATIVE_P3_GUARD_DENIAL' : undefined), 'test-only-native-mcp-guard');
      let denied;
      try { denied = await call(0, { challenge: CHALLENGE }); assert.equal(denied.isError, true); }
      finally { await release(); }
      canonical(await call(0, { challenge: CHALLENGE }));
      return { nativePublicDispatcherUsed: true, deniedWhileGuardOwned: true, restoredByExactDisposer: true, approvalBypassImplemented: false };
    });
    await check('observed-native-call-failure-unavailable-and-real-read-recovery', async () => {
      const failed = await call(1, { symbol: 'OTHER', fiscalYear: 2024 }); assert.equal(failed.isError, true);
      observed.observe('read', failed); assert.equal(observed.getSnapshot().state, 'UNAVAILABLE');
      const unavailable = observed.getSnapshot(); assert.ok(Number.isFinite(Date.parse(unavailable.verifiedAt)));
      const ping = await call(0, { challenge: CHALLENGE }); canonical(ping); observed.observe('ping', ping);
      const read = await call(1, { symbol: 'TOY', fiscalYear: 2024 }); canonical(read); observed.observe('read', read);
      assert.equal(observed.getSnapshot().state, 'READY');
      return { unavailable, recovered: observed.getSnapshot(), failureType: 'actual_native_MCP_tool_isError_not_transport_outage', probeLocalStateOnly: true };
    });
    await check('exact-native-finance-role-created-without-model-turn', async () => {
      handle = await ctx.agents.create({ sessionId, meta: { cwd: workspace, agentPreset: MODELER }, signal: lifetime.signal,
        setup: agentCtx => ctx.agentPresets.mount(agentCtx, MODELER).then(() => undefined) });
      assert.equal(ctx.agents.get(sessionId), handle.agent); assert.equal(ctx.agentPresets.composedPreset(handle.agent.ctx), MODELER);
      return { sessionId, preset: MODELER };
    });
    await check('finance-role-raw-native-mcp-and-general-execution-remain-blocked', async () => {
      assert.ok(handle); const agent = handle.agent;
      const schemas = ctx.tools.schemas(agent), forbidden = /^(mcp__|pwsh$|bash$|run_code$|run_js$|read_file$|write$|edit$)/;
      assert.ok(!schemas.some(tool => forbidden.test(tool.name)));
      for (const [index, args] of [[0, { challenge: CHALLENGE }], [1, { symbol: 'TOY', fiscalYear: 2024 }]]) {
        assert.equal(ctx.tools.get(names[index], agent), undefined);
        const denied = await call(index, args, agent); assert.equal(denied.isError, true); // The native denial payload is not guaranteed to expose error.info.code.
      }
      return { tools: schemas.map(tool => tool.name), rawMcpDenied: true, identitySubstitution: false, scopeGrantExpanded: false };
    });
  } finally {
    if (handle) await check('owned-marker-fenced-agent-cleanup-zero-turns', async () => {
      const ownership = JSON.parse(await readFile(markerPath, 'utf8')); assert.deepEqual(ownership, marker);
      assert.equal(ctx.agents.get(sessionId), handle.agent); assert.equal(handle.agent.session.header.cwd, workspace);
      assert.ok(within(evidenceRoot, await realpath(workspace)));
      const events = handle.agent.session.snapshotEvents();
      assert.equal(events.filter(event => ['turn/start', 'step/start', 'request/header', 'assistant/message', 'user/message'].includes(event.type)).length, 0);
      await handle.dispose(); assert.equal(ctx.agents.get(sessionId), undefined);
      return { disposed: sessionId, modelTurns: 0, sessionHistoryRetained: true, filesRetained: true };
    });
    lifetime.abort(); report.connectionStatus = observed.getSnapshot(); report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(check => check.status === 'PASS').length;
    report.checksFailed = report.checks.filter(check => check.status === 'FAIL').length;
    report.status = report.checksFailed ? 'FAIL' : 'PASS';
    await writeFile(join(evidenceRoot, 'connection-result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.info('[TEST_ONLY P3 native MCP]', JSON.stringify({ status: report.status, passed: report.checksPassed, failed: report.checksFailed,
      result: join(evidenceRoot, 'connection-result.json'), manager: 'NOT_AVAILABLE', adapter: 'UNSUPPORTED_PUBLIC_DELEGATION_CONTRACT' }));
  }
}
