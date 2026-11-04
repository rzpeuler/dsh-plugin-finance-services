/** TEST_ONLY one-run evidence recovery. Never creates/resumes Agents, executes a model, or disposes borrowed Agents. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { createProbeRecorder, ioErrorInfo } from './report-io.js';

export const name = 'finance-p2-test-only-recovery';
export const inject = ['agents', 'workspaceRegistry', 'typertGateway', 'connection'];
const sha = value => createHash('sha256').update(value).digest('hex');
const inside = (root, path) => { const part = relative(root, path); return part !== '' && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); };

/** Observe source-owned identities and unregister only the proven unbound TEST_ONLY Workspace. */
export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.bundleRoot));
  assert.equal(config.sourceRunId, '6e45108d-0dbe-49a4-92a7-7a17683b9363');
  assert.equal(config.sourceWorkspaceId, '7ff62cd0-bc67-488d-a9e3-dba58eef8215');
  const root = await realpath(config.bundleRoot);
  const sourceRoot = await realpath(join(root, 'acceptance', 'tmp', `p2-${config.sourceRunId}`));
  const recoveryId = randomUUID();
  const runRoot = join(root, 'acceptance', 'tmp', `p2-recovery-${recoveryId}`);
  await mkdir(runRoot, { recursive: true });
  await writeFile(join(runRoot, 'TEST_ONLY-ownership.json'), JSON.stringify({ kind: 'TEST_ONLY_RECOVERY', recoveryId, sourceRunId: config.sourceRunId }) + '\n', { flag: 'wx' });
  const report = { schemaVersion: 1, runId: recoveryId, sourceRunId: config.sourceRunId, startedAt: new Date().toISOString(),
    status: 'FAIL', originalAttemptStatus: 'FAILED_INSTALLATION_REPORT_IO', overallOriginalAttemptPassed: false,
    validationScope: 'TEST_ONLY_RECOVERY_NOT_A_RERUN_OR_RECLASSIFICATION', businessE2E: false, modelInvoked: false,
    sessionsResumed: false, sessionsDeleted: false, filesDeleted: false, checks: [], observedSessions: [], recoveryStatus: 'RUNNING' };
  const recorder = await createProbeRecorder({ runRoot, latestPath: join(root, 'acceptance', 'P2-live-host-recovery-004.json'), report });
  async function check(id, operation) {
    const start = Date.now();
    let item;
    try { item = { id, status: 'PASS', timing: { startedAt: new Date(start).toISOString(), elapsedMs: 0 }, detail: await operation() }; }
    catch (error) { item = { id, status: error.probeStatus ?? 'FAIL', timing: { startedAt: new Date(start).toISOString(), elapsedMs: 0 }, error: ioErrorInfo(error) }; }
    item.timing.elapsedMs = Date.now() - start;
    report.checks.push(item);
    await recorder.record(item);
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' });
  const cancel = new AbortController();
  ctx.effect(() => () => { cancel.abort(); });
  const rpc = (method, request) => ctx.typertGateway.invoke({ namespace: 'financeOperations', method, args: { request }, peer, signal: cancel.signal });
  let source;
  let journal;
  let owned;
  let validated = false;
  const requireSource = () => assert.ok(validated, 'Source ownership/evidence validation did not PASS; no native mutation is allowed');
  try {
    await check('validate-immutable-source-and-owner', async () => {
      const marker = JSON.parse(await readFile(join(sourceRoot, 'TEST_ONLY-ownership.json'), 'utf8'));
      assert.equal(marker.kind, 'TEST_ONLY_NON_FINANCIAL'); assert.equal(marker.runId, config.sourceRunId);
      assert.equal(await realpath(marker.root), sourceRoot);
      const documents = {};
      for (const [key, basename] of Object.entries({ partial: 'P2-live-host-partial-004.json', journal: 'P2-live-host-journal-004.jsonl', infrastructure: 'P2-live-host-infrastructure-failure-004.json' })) {
        const bytes = await readFile(join(root, 'acceptance', basename));
        assert.equal(sha(bytes), config.sourceHashes[key], `Immutable source changed: ${basename}`);
        documents[key] = bytes.toString('utf8');
      }
      source = JSON.parse(documents.partial);
      const infrastructure = JSON.parse(documents.infrastructure);
      journal = documents.journal.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
      assert.equal(source.runId, config.sourceRunId); assert.equal(infrastructure.runId, config.sourceRunId);
      assert.equal(infrastructure.nativeManagerResult.application, 'failed'); assert.equal(infrastructure.overallAttemptPassed, false);
      assert.equal(source.initialSnapshot.binding, null);
      assert.equal(source.fixtureOwnership.workspaces.length, 1);
      owned = source.fixtureOwnership.workspaces[0];
      assert.equal(owned.workspaceId, config.sourceWorkspaceId);
      assert.ok(inside(sourceRoot, await realpath(owned.path)));
      assert.equal(await realpath(owned.path), await realpath(join(sourceRoot, 'workspace')));
      assert.equal(source.sessions.length, 41); assert.equal(new Set(source.sessions.map(item => item.sessionId)).size, 41);
      assert.equal(source.sessions.filter(item => item.creation === 'sessionController.create').length, 5);
      assert.equal(source.sessions.filter(item => item.creation === 'agents.create + public setup.mount').length, 36);
      report.originalInfrastructureFailure = infrastructure;
      report.sourceJournal = { totalChecks: journal.length, counts: Object.fromEntries(['PASS', 'FAIL', 'NOT_RUN'].map(status => [status, journal.filter(item => item.status === status).length])),
        lastItem: journal.at(-1), sourceHashes: config.sourceHashes, finalSummaryAbsent: !source.finishedAt,
        successfulExplicitHandleDisposals: journal.filter(item => item.id.startsWith('dispose-owned-native-agent:') && item.status === 'PASS').map(item => item.detail.sessionId) };
      report.sourceInitialBinding = { binding: source.initialSnapshot.binding, revision: source.initialSnapshot.revision };
      report.sourceRestoredBinding = source.restoredSnapshot;
      report.sourceModel = journal.find(item => item.id === 'native-worker-model-smoke');
      report.sourceStartedRootLock = journal.find(item => item.id === 'native-started-root-rejects-preset-selection');
      report.ownedWorkspace = owned;
      validated = true;
      return { sourceRunId: source.runId, initialRevision: source.initialSnapshot.revision, ownedWorkspaceId: owned.workspaceId, journalItems: journal.length,
        originalNativeManagerApplication: 'failed', originalAttemptReclassified: false };
    });
    if (validated) {
      // list/get only. An absent Agent is NOT cold-resumed to manufacture retained-floor evidence.
      const listed = new Map(ctx.agents.list().map(agent => [agent.id, agent]));
      for (const item of source.sessions) await check(`source-agent-liveness:${item.sessionId}`, async () => {
        const agent = ctx.agents.get(item.sessionId);
        assert.equal(Boolean(listed.get(item.sessionId)), Boolean(agent), 'Native list/get disagree');
        const evidence = { sessionId: item.sessionId, agentPreset: item.agentPreset, creation: item.creation, live: Boolean(agent) };
        report.observedSessions.push(evidence);
        if (agent) {
          assert.equal(agent.session.header.cwd, owned.path, 'A live identity no longer belongs to the owned UUID Workspace');
          assert.equal(agent.session.header.agentPreset, item.agentPreset);
          evidence.cwd = agent.session.header.cwd; evidence.status = agent.status;
        }
        if (item.creation === 'agents.create + public setup.mount') {
          if (agent) throw Object.assign(new Error('Original borrowed Agent is still live; recovery has no public owned handle and will not invent dispose(agent)'), { code: 'OWNED_HANDLE_UNAVAILABLE' });
          return { ...evidence, releasedByOriginalOwner: true, evidenceLimit: 'Absence now confirms release, not an invented per-Agent disposal timestamp.' };
        }
        assert.ok(agent, 'Controller-owned test Agent is absent; do not resume it for retained-floor testing');
        assert.equal(agent.status, 'idle');
        return { ...evidence, intentionallyRetainedForDisabledFloor: true };
      });
      await check('source-child-remains-disposed', async () => {
        const childId = source.modelSmoke.subagentId;
        assert.equal(source.modelSmoke.disposed, true);
        assert.equal(ctx.agents.get(childId), undefined, 'Model child unexpectedly live; no broad cancellation is attempted');
        return { childId, live: false, modelRerun: false };
      });
    }
    await check('restore-binding-only-if-still-source-owned', async () => {
      requireSource();
      const current = await rpc('snapshot', {});
      report.bindingBeforeRecovery = { revision: current.revision, bindingWorkspaceId: current.binding?.workspaceId ?? null };
      if (current.binding === null) return { status: 'ALREADY_RESTORED', revision: current.revision, mutated: false };
      if (current.binding.workspaceId !== owned.workspaceId) throw Object.assign(new Error('Concurrent external binding detected; recovery refuses to overwrite it'), { code: 'RECOVERY_EXTERNAL_BINDING', probeStatus: 'NOT_RUN' });
      assert.equal(current.binding.path, owned.path);
      const cleared = await rpc('unbindWorkspace', { expectedRevision: current.revision });
      assert.equal(cleared.status, 'UNBOUND'); assert.equal(cleared.snapshot.binding, null);
      return { status: 'RESTORED_BY_CAS', snapshot: cleared.snapshot };
    });
    await check('unregister-only-unbound-owned-workspace', async () => {
      requireSource();
      const marker = JSON.parse(await readFile(join(sourceRoot, 'TEST_ONLY-ownership.json'), 'utf8'));
      assert.equal(marker.kind, 'TEST_ONLY_NON_FINANCIAL'); assert.equal(marker.runId, config.sourceRunId);
      assert.equal(await realpath(marker.root), sourceRoot);
      const native = ctx.workspaceRegistry.get(owned.workspaceId);
      const current = await rpc('snapshot', {});
      assert.notEqual(current.binding?.workspaceId, owned.workspaceId, 'Owned Workspace is still bound; do not unregister it');
      assert.ok(inside(sourceRoot, await realpath(owned.path)));
      if (native) {
        assert.equal(native.path, owned.path);
        assert.equal(await ctx.workspaceRegistry.delete(owned.workspaceId), true);
        assert.equal(ctx.workspaceRegistry.get(owned.workspaceId), undefined);
      }
      assert.ok((await stat(owned.path)).isDirectory());
      const canary = await readFile(join(owned.path, 'original-canary.txt'));
      const expected = journal.find(item => item.id === 'post-model-original-canary-unchanged').detail.originalSha256;
      assert.equal(sha(canary), expected);
      return { workspaceId: owned.workspaceId, status: native ? 'UNREGISTERED' : 'ALREADY_UNREGISTERED', filesRetained: true, sessionHistoryRetained: true, canarySha256: expected };
    });
  } catch (error) {
    const item = { id: 'recovery-runner', status: 'FAIL', timing: { elapsedMs: 0 }, error: ioErrorInfo(error) };
    report.checks.push(item); await recorder.record(item);
  } finally {
    await check('dispose-recovery-peer', async () => { await peer.dispose(); return { disposed: true }; });
    cancel.abort();
    report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(item => item.status === 'PASS').length;
    report.checksFailed = report.checks.filter(item => item.status === 'FAIL').length;
    report.checksNotRun = report.checks.filter(item => item.status === 'NOT_RUN').length;
    report.recoveryStatus = report.checksFailed || report.io.failures.length ? 'FAIL' : report.checksNotRun ? 'PARTIAL' : 'COMPLETE';
    report.status = 'FAIL'; // The original native installation failed. Recovery never rewrites that fact as PASS.
    await recorder.finish();
  }
}
