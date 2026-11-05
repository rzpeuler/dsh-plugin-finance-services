/** Controlled TEST_ONLY adversarial provider, registered into the actual native data registry. */
import assert from 'node:assert/strict';
import { MODELER, TOOL, denial } from './probe.js';
import { sourceQuery, argsFor, parseEnvelope } from './after.js';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function controlledProvider(id, sourceId, throwingUnsubscribe = true) {
  let state = 'READY', listener, gate;
  const verifiedAt = new Date().toISOString();
  const raw = query => ({ observations: query.requiredFields.map(field => ({ field, entity: { ...query.entity }, value: field === 'revenue' ? 2200000 : 440000,
    unit: { dimension: 'currency', currency: 'USD', scale: 'ones' }, period: { ...query.period }, accountingBasis: 'US_GAAP', consolidation: 'consolidated',
    measurementType: 'actual', sourceAsOf: '2025-02-01T00:00:00Z', availableAt: '2025-02-02T00:00:00Z', retrievedAt: new Date().toISOString(),
    revision: 'TEST_ONLY-r1', reference: { uri: 'urn:finance:test-only:controlled:toy:fy2024:r1', label: 'TEST_ONLY adversarial lifecycle fixture' }, licenseClass: 'TEST_ONLY' })),
    warnings: ['TEST_ONLY controlled adversarial fixture, not a commercial source.'] });
  async function wait(stage) { if (gate?.stage === stage) { const current = gate; current.entered.resolve(); await current.release.promise; } }
  const definition = { metadata: { id, sourceId, version: '1.0.0', label: 'TEST_ONLY controlled in-flight lifecycle fixture', testOnly: true, licenseClass: 'TEST_ONLY',
    capabilities: [{ id: 'financial.statements', markets: ['US'], fields: ['revenue', 'ebitda'], priority: 100, quality: 100, pointInTime: true }] },
    state: { getSnapshot: () => ({ state, verifiedAt }), subscribe: callback => { listener = callback; return () => { if (throwingUnsubscribe) throw new Error('TEST_ONLY_SECRET'); listener = undefined; }; } },
    async validate() { await wait('validate'); return { compatible: true }; },
    async query(query) { await wait('query'); return raw(query); },
  };
  return { definition, state(value, notify = true) { state = value; if (notify) listener?.(); }, lateCallback() { listener?.(); },
    arm(stage) { assert.ok(!gate); gate = { stage, entered: deferred(), release: deferred() }; return gate; },
    release() { gate?.release.resolve(); gate = undefined; } };
}
export async function runInflight(env) {
  const { ctx, live, handles, runId, check, data, operations, catalog, save, bindings, ownAdapters, cleanup, dispatch, dispose, definition, cancel, expected } = env;
  const [modeler, other] = live;
  const adapterId = `test-only-held-${runId}`, sourceId = `test-only-held-source-${runId}`;
  ownAdapters.add(adapterId);
  let provider = controlledProvider(adapterId, sourceId), unregister = data.registerAdapter(provider.definition), active = true;
  const providers = [provider];
  cleanup.push({ id: 'cleanup-own-controlled-provider-only', run: async () => {
    for (const fixture of providers) fixture.release();
    if (active) { unregister(); active = false; }
    assert.ok(!catalog().adapters.some(a => a.id === adapterId)); return { adapterId, removed: true, privateErrorTextReturned: false };
  } });
  const before = catalog(), ownedBinding = { ...bindings[0], adapterId, scopeIds: [modeler.id, other.id], priority: 100 };
  const applied = await save(before.revision, [...before.bindings, ownedBinding]); assert.equal(applied.status, 'APPLIED');
  const request = () => ({ ...sourceQuery(), sourceIds: [sourceId] });
  const start = (agent, signal = cancel.signal) => dispatch(agent, TOOL, argsFor(request()), signal);
  async function entered(gate) {
    // Bounded wait: native validation failure must fail the probe rather than hang activation.
    await Promise.race([gate.entered.promise, new Promise((_resolve, reject) => {
      const signal = AbortSignal.timeout(5000); signal.addEventListener('abort', () => reject(new Error('Controlled provider was not entered')), { once: true });
    })]);
  }
  function noPublication(result) {
    if (result.isError) return { nativeToolDenied: true };
    const parsed = parseEnvelope(result); assert.notEqual(parsed.status, 'OK'); assert.equal(parsed.data, null);
    return { nativeToolDenied: false, status: parsed.status, data: null, trace: parsed.trace };
  }
  await check('native-provider-state-rechecked-after-awaited-validation', async () => {
    const gate = provider.arm('validate'); let pending;
    try {
      pending = start(modeler); await entered(gate); provider.state('NOT_AUTHORIZED'); provider.release();
      const result = noPublication(await pending); return { ...result, adversarialProvider: 'TEST_ONLY', recheckedAfterAwait: true };
    } finally { provider.release(); if (pending) await pending; provider.state('READY'); }
  });
  await check('native-provider-state-rechecked-after-awaited-query', async () => {
    const gate = provider.arm('query'); let pending;
    try {
      pending = start(modeler); await entered(gate); provider.state('NOT_AUTHORIZED'); provider.release();
      return { ...noPublication(await pending), recheckedAfterAwait: true };
    } finally { provider.release(); if (pending) await pending; provider.state('READY'); }
  });
  await check('native-held-query-cancellation-no-late-publication', async () => {
    const stop = new AbortController(), gate = provider.arm('query'); let pending;
    try {
      pending = start(modeler, stop.signal); await entered(gate); stop.abort();
      const result = noPublication(await pending); provider.release(); await Promise.resolve();
      return { ...result, heldProviderReleasedAfterCancellation: true };
    } finally { stop.abort(); provider.release(); if (pending) await pending; }
  });
  await check('native-throwing-unsubscribe-removes-source-counts-safe-diagnostic', async () => {
    const before = catalog(); assert.ok(Number.isInteger(before.diagnostics.disposalFailures));
    const gate = provider.arm('query'); let pending;
    try {
      pending = start(modeler); await entered(gate); unregister(); active = false;
      const removed = catalog(); assert.ok(!removed.adapters.some(a => a.id === adapterId));
      assert.equal(removed.diagnostics.disposalFailures, before.diagnostics.disposalFailures + 1);
      assert.ok(!JSON.stringify(removed).includes('TEST_ONLY_SECRET'));
      const result = noPublication(await pending); provider.release();
      return { ...result, sourceRemoved: true, beforeDisposalFailures: before.diagnostics.disposalFailures,
        afterDisposalFailures: removed.diagnostics.disposalFailures, errorTextExposed: false };
    } finally { provider.release(); if (pending) await pending; }
  });
  await check('native-old-state-callback-ignored-after-same-id-reuse', async () => {
    const retired = provider; provider = controlledProvider(adapterId, sourceId, false); providers.push(provider);
    unregister = data.registerAdapter(provider.definition); active = true;
    const signal = AbortSignal.timeout(75), stream = data.follow({}, signal);
    try {
      const initial = await stream.next(); assert.equal(initial.done, false);
      const next = stream.next(); retired.state('NOT_AUTHORIZED', false); retired.lateCallback();
      const update = await next; assert.equal(update.done, true, 'Retired callback must not publish an update to native follow');
      assert.equal(catalog().adapters.find(a => a.id === adapterId).status.state, 'READY');
      return { adapterIdReused: true, retiredCallbackIgnored: true, replacementState: 'READY', nativeFollowPublishedStaleEvent: false };
    } finally { await stream.return(); }
  });
  await check('native-owned-agent-disposal-cancels-held-query-no-stale-publish', async () => {
    const gate = provider.arm('query'); let pending;
    try {
      pending = start(other); await entered(gate);
      const handle = handles.find(h => h.agent === other); assert.ok(handle);
      await dispose(handle); // Native Agent disposal revokes grant and triggers FinanceData scope abort.
      const result = noPublication(await pending); provider.release();
      assert.equal(operations.isRoleRuntimeActive(other, MODELER, expected), false);
      return { ...result, nativeAgentDisposed: true, lateRawNeverPublished: true, filesAndHistoryRetained: true };
    } finally { provider.release(); if (pending) await pending; }
  });
  await check('current-exact-grant-revoked-during-await-held-definition-and-dispatch-denied', async () => {
    const gate = provider.arm('query'); let pending;
    try {
      pending = start(modeler); await entered(gate);
      // Public trusted admission creates a current grant only for our exact owned Agent; its disposer revokes that grant.
      const revokeCurrent = operations.registerRoleRuntime(modeler, MODELER); revokeCurrent();
      assert.equal(operations.isRoleRuntimeActive(modeler, MODELER, expected), false); provider.release();
      denial(await pending); // RoleFilesystem post-await check must prevent even a non-success payload escaping a revoked role.
      await assert.rejects(() => definition.execute({ action: 'describe', capability: 'financial.statements' }, { agent: modeler, signal: cancel.signal }));
      denial(await dispatch(modeler, TOOL, { action: 'describe', capability: 'financial.statements' }));
      return { currentGrantRevoked: true, nativeDispatchDenied: true, heldDefinitionDenied: true, postAwaitNativeGuardPreserved: true };
    } finally { provider.release(); if (pending) await pending; }
  });
}
