/** Test-only native Loader probe. Never shipped in the Financial Services payload. */
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, isAbsolute } from 'node:path';

export const inject = ['tools', 'workspaceRegistry', 'storageDomain', 'typertGateway', 'connection'];

/** Exercise the installed Host service, native Gateway, Workspace registry and durable domain. */
export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.bundleRoot));
  assert.ok(['initial', 'final'].includes(config.phase));
  const root = await realpath(config.bundleRoot);
  const report = { phase: config.phase, startedAt: new Date().toISOString(),
    evidence: 'REAL_NATIVE_LOADER_HOST', transport: 'in-process-native-owner-peer-not-browser',
    businessE2E: false, checks: [], status: 'RUNNING' };
  const reportPath = join(root, 'acceptance', `P1-live-${config.phase}.json`);
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' });
  const cancel = new AbortController();
  const deadline = setTimeout(() => cancel.abort(), 12000);
  ctx.effect(() => () => { clearTimeout(deadline); cancel.abort(); });
  let follower;
  async function check(id, operation) {
    const start = Date.now();
    try {
      const detail = await operation();
      report.checks.push({ id, status: 'PASS', elapsedMs: Date.now() - start, ...(detail === undefined ? {} : { detail }) });
    } catch (error) {
      report.checks.push({ id, status: 'FAIL', elapsedMs: Date.now() - start, error: String(error?.stack ?? error) });
      throw error;
    }
  }
  const rpc = (method, request) => ctx.typertGateway.invoke({
    namespace: 'financeOperations', method, args: { request }, peer, signal: cancel.signal,
  });
  let svc;
  let initial;
  let testRoot;
  const fixtureWorkspaces = new Map();
  const canary = 'Financial Services P1 canary: user files must survive plugin lifecycle.\n';
  try {
    await check('service-active', async () => {
      svc = ctx.get('financeOperations');
      assert.ok(svc, 'Financial Services did not activate');
      initial = await rpc('snapshot', {});
      assert.equal(initial.stage, 'P1');
      assert.ok(Number.isInteger(initial.revision));
      report.initialSnapshot = initial;
    });
    if (config.phase === 'initial') {
      await check('refuse-to-change-existing-user-binding', async () => {
        assert.equal(initial.binding, null, 'Existing binding found: smoke refuses all mutation');
        assert.equal(initial.workspaceStatus, 'UNBOUND');
      });
      testRoot = join(root, 'acceptance', 'tmp', `p1-${randomUUID()}`);
      const a = join(testRoot, 'a');
      const b = join(testRoot, 'b');
      await mkdir(a, { recursive: true });
      await mkdir(b, { recursive: true });
      await writeFile(join(a, 'original-canary.txt'), canary, 'utf8');
      await writeFile(join(b, 'original-canary.txt'), canary, 'utf8');
      report.fixtureRoot = testRoot;
      await check('strict-gateway-rejects-wrong-type-and-extra-fields', async () => {
        for (const request of [{ path: 17, expectedRevision: initial.revision },
          { path: a, expectedRevision: initial.revision, approve: true }]) {
          await assert.rejects(() => rpc('bindWorkspace', request), error => /^gateway\/(arguments|input)-invalid$/.test(error?.code));
        }
        assert.equal((await rpc('snapshot', {})).revision, initial.revision);
      });
      await check('relative-missing-and-file-paths-rejected-without-state-change', async () => {
        for (const path of ['relative-finance', join(testRoot, 'missing'), join(a, 'original-canary.txt')]) {
          const result = await rpc('bindWorkspace', { path, expectedRevision: initial.revision });
          assert.equal(result.status, 'REJECTED');
          assert.ok(result.error?.code);
          assert.equal(result.snapshot.revision, initial.revision);
          assert.equal(result.snapshot.binding, null);
        }
      });
      let bound;
      await check('canonical-native-workspace-binding', async () => {
        const result = await rpc('bindWorkspace', { path: a, expectedRevision: initial.revision });
        assert.equal(result.status, 'BOUND', JSON.stringify(result));
        bound = result.snapshot;
        assert.equal(bound.workspaceStatus, 'READY');
        assert.equal(bound.binding.path, await realpath(a));
        const workspace = ctx.workspaceRegistry.get(bound.binding.workspaceId);
        assert.equal(workspace.path, bound.binding.path);
        fixtureWorkspaces.set(workspace.id, workspace.path);
        assert.deepEqual(await svc.snapshot({}), bound);
      });
      await check('native-tool-dispatch-uses-same-service-operation', async () => {
        const result = await ctx.tools.execute({ name: 'finance_workspace', callId: `finance-smoke-${randomUUID()}`,
          arguments: { action: 'status' }, signal: cancel.signal });
        assert.equal(result.isError, false, JSON.stringify(result));
        assert.ok(result.content.length > 0);
        assert.ok(JSON.stringify(result.value).includes(bound.binding.workspaceId));
      });
      await check('host-domain-contains-committed-binding', async () => {
        const domain = ctx.storageDomain.get('financial_services');
        assert.ok(domain);
        const saved = domain.table('state').get('root');
        assert.equal(saved.binding.workspaceId, bound.binding.workspaceId);
        assert.equal(saved.revision, bound.revision);
      });
      await check('follow-starts-with-complete-native-baseline', async () => {
        follower = (await ctx.typertGateway.stream({ namespace: 'financeOperations', method: 'follow',
          args: { request: {} }, peer, signal: cancel.signal }))[Symbol.asyncIterator]();
        const frame = await follower.next();
        assert.equal(frame.done, false);
        assert.equal(frame.value.revision, bound.revision);
        assert.equal(frame.value.binding.workspaceId, bound.binding.workspaceId);
      });
      let switched;
      await check('switch-commits-new-default-without-moving-files', async () => {
        const result = await rpc('bindWorkspace', { path: b, expectedRevision: bound.revision });
        assert.equal(result.status, 'BOUND', JSON.stringify(result));
        switched = result.snapshot;
        assert.equal(switched.binding.path, await realpath(b));
        fixtureWorkspaces.set(switched.binding.workspaceId, switched.binding.path);
        assert.equal(await readFile(join(a, 'original-canary.txt'), 'utf8'), canary);
        assert.equal(await readFile(join(b, 'original-canary.txt'), 'utf8'), canary);
        let frame;
        do { frame = await follower.next(); } while (!frame.done && frame.value.revision < switched.revision);
        assert.equal(frame.done, false);
        assert.equal(frame.value.binding.workspaceId, switched.binding.workspaceId);
      });
      await check('stale-revision-rejected', async () => {
        const result = await rpc('bindWorkspace', { path: a, expectedRevision: bound.revision });
        assert.equal(result.status, 'REJECTED');
        assert.equal(result.snapshot.binding.workspaceId, switched.binding.workspaceId);
        assert.equal(result.snapshot.revision, switched.revision);
      });
      await check('concurrent-revision-writers-cannot-overwrite', async () => {
        const results = await Promise.all([a, b].map(path => rpc('bindWorkspace', { path, expectedRevision: switched.revision })));
        assert.equal(results.filter(result => result.status === 'BOUND').length, 1);
        assert.equal(results.filter(result => result.status === 'REJECTED').length, 1);
        for (const result of results) if (result.snapshot.binding) fixtureWorkspaces.set(result.snapshot.binding.workspaceId, result.snapshot.binding.path);
      });
      await check('leave-owned-binding-for-lifecycle-persistence-test', async () => {
        const now = await rpc('snapshot', {});
        const result = await rpc('bindWorkspace', { path: b, expectedRevision: now.revision });
        assert.equal(result.status, 'BOUND');
        report.lifecycleExpectedSnapshot = result.snapshot;
        report.fixtureWorkspaces = [...fixtureWorkspaces].map(([workspaceId, path]) => ({ workspaceId, path }));
        report.cleanup = 'PENDING_NATIVE_DISABLE_ENABLE_REMOVE_REINSTALL_THEN_FINAL_PROBE';
      });
    } else {
      const prior = JSON.parse(await readFile(join(root, 'acceptance/P1-live-initial.json'), 'utf8'));
      assert.equal(prior.status, 'PASS');
      testRoot = prior.fixtureRoot;
      const expected = prior.lifecycleExpectedSnapshot;
      await check('binding-survived-native-disable-enable-and-remove-reinstall', async () => {
        assert.deepEqual(initial.binding, expected.binding);
        assert.equal(initial.revision, expected.revision);
        assert.equal(initial.workspaceStatus, 'READY');
        for (const item of prior.fixtureWorkspaces) {
          const registered = ctx.workspaceRegistry.get(item.workspaceId);
          assert.ok(registered, 'Uninstall removed a user Workspace registration');
          assert.equal(registered.path, item.path);
          assert.equal(await readFile(join(item.path, 'original-canary.txt'), 'utf8'), canary);
        }
      });
      await check('unbind-clears-only-default-and-retains-onboarding-version', async () => {
        const result = await rpc('unbindWorkspace', { expectedRevision: initial.revision });
        assert.equal(result.status, 'UNBOUND');
        assert.equal(result.snapshot.binding, null);
        assert.equal(result.snapshot.workspaceStatus, 'UNBOUND');
        assert.equal(result.snapshot.onboardingVersion, initial.onboardingVersion);
        assert.ok(result.snapshot.revision > initial.revision);
        report.restoredSnapshot = result.snapshot;
      });
      await check('remove-only-owned-test-registrations-and-preserve-directories', async () => {
        assert.equal((await rpc('snapshot', {})).binding, null);
        const canonicalTestRoot = await realpath(testRoot);
        for (const item of prior.fixtureWorkspaces) {
          const native = ctx.workspaceRegistry.get(item.workspaceId);
          assert.ok(native);
          assert.equal(native.path, item.path);
          const canonical = await realpath(item.path);
          assert.ok(canonical.startsWith(canonicalTestRoot + '\\') || canonical.startsWith(canonicalTestRoot + '/'));
          await ctx.workspaceRegistry.delete(item.workspaceId);
          assert.ok((await stat(item.path)).isDirectory());
          assert.equal(await readFile(join(item.path, 'original-canary.txt'), 'utf8'), canary);
        }
        report.cleanup = 'COMPLETE_REGISTRATIONS_REMOVED_FILES_RETAINED';
      });
    }
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.error = String(error?.stack ?? error);
    report.cleanup = report.cleanup ?? 'INSPECT_OWNED_FIXTURE_STATE_BEFORE_RETRY';
  } finally {
    cancel.abort();
    clearTimeout(deadline);
    if (follower) await follower.return?.();
    await peer.dispose();
    report.finishedAt = new Date().toISOString();
    report.checksPassed = report.checks.filter(item => item.status === 'PASS').length;
    report.checksFailed = report.checks.filter(item => item.status === 'FAIL').length;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
}
