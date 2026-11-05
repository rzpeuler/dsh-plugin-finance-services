/* TEST_ONLY renderless native Client fixture; no feature/runtime imports. */
window.__ModuleLoader__.load({
 id: "@local/dsh-finance-p3-client-481c9b41-057e-4dc7-acbc-9c87101d2d72-test-only",
 factory(require) {
 const createP3ClientContract = (function createP3ClientContract(z, packageName) {
  const Json = z.string().max(300000).refine(s => new TextEncoder().encode(s).byteLength <= 300000)
    .refine(s => { try { JSON.parse(s); return true } catch { return false } })
  const Run = z.strictObject({ runId: z.string().uuid() })
  const schemas = {
    Empty: z.strictObject({}),
    Run,
    Toggle: Run.extend({ state: z.enum(['READY', 'NOT_AUTHORIZED']) }),
    Checkpoint: z.strictObject({ stage: z.string().min(1).max(128).regex(/^[A-Z0-9_:.-]+$/) }),
    Finish: Run.extend({ clientReportJson: Json }),
    JsonResult: z.strictObject({ json: Json }),
  }
  const method = (name, input) => ({ id: `${packageName}#financeP3ClientTestOnly/${name}`,
    service: 'financeP3ClientTestOnly', namespace: 'financeP3ClientTestOnly', method: name,
    invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${packageName}#${input}`, create: () => schemas[input] } }],
    result: { mode: 'strict', typeSymbol: `${packageName}#JsonResult`, create: () => schemas.JsonResult },
    description: `TEST_ONLY disposable owned-scope P3 fixture ${name}; no user Session, credentials, models or navigation.` })
  return { schemas, remote: { package: packageName, descriptors: [method('checkpoint', 'Checkpoint'),
    method('setup', 'Empty'), method('queryOwned', 'Run'), method('toggleToyState', 'Toggle'),
    method('report', 'Empty'), method('finalize', 'Finish')] } }
});
 const createP3ClientFixture = (function createP3ClientFixture(z, createP3ClientContract, packageName) {
  const ADDRESS = 'dsh-resource://finance-data/current', WORKSPACE = 'dsh-resource://finance-workspace/current'
  const MCP = 'test-mcp-statements', REST = 'test-rest-statements', MODELER = 'finance-pitch-agent-modeler'
  const ensure = (yes, code) => { if (!yes) throw Object.assign(new Error(code), { testCode: code }) }
  const safeError = error => error?.testCode ?? 'NATIVE_OPERATION_FAILED_DETAILS_WITHHELD'
  async function bounded(operation, signal, label) {
    let timer, abort
    try {
      signal.throwIfAborted()
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        abort = () => reject(Object.assign(new Error(), { testCode: `${label}_ABORTED` }))
        signal.addEventListener('abort', abort, { once: true })
        timer = setTimeout(() => reject(Object.assign(new Error(), { testCode: `${label}_DEADLINE` })), 15000)
        if (signal.aborted) abort()
      })])
    } finally { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort) }
  }
  function observe(source, predicate, signal, label) {
    let stop = () => {}, timer, done = false
    return new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (done) return; done = true; stop(); clearTimeout(timer); signal.removeEventListener('abort', abort)
        error ? reject(error) : resolve(value)
      }
      const abort = () => finish(Object.assign(new Error(), { testCode: `${label}_ABORTED` }))
      const read = () => { try { const value = source.getSnapshot(); if (predicate(value)) finish(null, value) } catch (error) { finish(error) } }
      signal.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => finish(Object.assign(new Error(), { testCode: `${label}_DEADLINE` })), 15000)
      try { const off = source.subscribe(read); stop = off; if (done) off(); if (signal.aborted) abort(); else read() }
      catch (error) { finish(error) }
    })
  }
  const binding = (adapterId, sourceAllowlistKey, ownedScopeId, priority) => ({ adapterId, sourceAllowlistKey,
    scopeIds: [ownedScopeId], roleIds: [MODELER], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'],
    priority, minQuality: 0, enabled: true, allowTestOnly: true })
  return {
    inject: ['remote', 'cordisInspect'],
    apply(ctx) {
      const lifetime = new AbortController(), state = { packageName, stage: 'APPLY', errorCode: null, runId: null, history: [] }
      const mark = stage => { state.stage = stage; state.history.push(stage); if (state.history.length > 40) state.history.shift() }
      ctx.effect(() => ctx.cordisInspect.register({ manifest: { id: 'FinanceP3ClientFixtureState',
        description: 'TEST_ONLY bounded renderless fixture diagnostics; no user input, drafts or business execution.', methods: [{ name: 'state',
          description: 'Read stages and safe fixture error code only.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, outputSchema: {} }] },
        async query(method) { ensure(method === 'state', 'UNKNOWN_DIAGNOSTIC'); return JSON.parse(JSON.stringify(state)) } }), 'TEST_ONLY P3 diagnostics')
      ctx.effect(() => {
        const task = activate(ctx, lifetime.signal, state, mark).catch(error => { state.errorCode = safeError(error); mark('ACTIVATION_FAILED') })
        return async () => { lifetime.abort(); await task }
      }, 'TEST_ONLY P3 connected Client lifetime')
    },
  }
  async function activate(root, signal, state, mark) {
    let namespaceChild, servicesChild, rpc, setup
    const report = { status: 'RUNNING', checks: [], resourcesReleased: false, userDraftRead: false, navigationChanged: false,
      evidence: 'REAL_CONNECTED_CLIENT_PRODUCTION_CALLBACKS_AND_NATIVE_RESOURCES_NOT_VISUAL', modelTurns: 0 }
    const cleanups = [], pins = new AbortController()
    const check = async (id, operation) => {
      mark(id.toUpperCase().replaceAll('-', '_'))
      try { const detail = await operation(); report.checks.push({ id, status: 'PASS', ...(detail === undefined ? {} : { detail }) }); return detail }
      catch (error) { report.checks.push({ id, status: 'FAIL', errorCode: safeError(error) }); throw error }
    }
    try {
      mark('REMOTE_MOUNT_START')
      await bounded(() => root.remote.$mount(createP3ClientContract(z, packageName).remote), signal, 'REMOTE_MOUNT')
      let accept
      const namespace = new Promise(resolve => { accept = resolve })
      const namespaceLifetime = new AbortController()
      namespaceChild = root.inject(['remote', 'remote.financeP3ClientTestOnly'], ctx => { accept(ctx); return () => namespaceLifetime.abort() })
      let ctx = await bounded(() => namespace, signal, 'REMOTE_NAMESPACE')
      signal = AbortSignal.any([signal, namespaceLifetime.signal])
      rpc = async (method, input, cleanup = false) => {
        const result = await bounded(() => ctx.remote.financeP3ClientTestOnly[method](input), cleanup ? new AbortController().signal : signal, `REMOTE_${method.toUpperCase()}`)
        ensure(result?.ok === true, `REMOTE_${method.toUpperCase()}_FAILED`); return JSON.parse(result.value.json)
      }
      state.runId = (await rpc('checkpoint', { stage: 'CLIENT_REMOTE_NAMESPACE_READY' })).runId
      let acceptServices
      const ready = new Promise(resolve => { acceptServices = resolve }), depLifetime = new AbortController()
      servicesChild = ctx.inject(['slots', 'resources', 'remote', 'remote.financeP3ClientTestOnly'], services => { acceptServices(services); return () => depLifetime.abort() })
      ctx = await bounded(() => ready, signal, 'CLIENT_SERVICES'); signal = AbortSignal.any([signal, depLifetime.signal])
      await rpc('checkpoint', { stage: 'CLIENT_NATIVE_SERVICES_READY' })
      setup = await check('host-owned-native-modeler-setup', () => rpc('setup', {})); state.runId = setup.runId
      const source = ctx.resources.source(ADDRESS), workspace = ctx.resources.source(WORKSPACE)
      for (const address of [ADDRESS, WORKSPACE]) ctx.resources.pin(address, pins.signal)
      const hold = source => { cleanups.push(source.subscribe(() => {})); return source }
      hold(source); hold(workspace)
      const current = () => { const value = source.getSnapshot(); ensure(value.status === 'live', 'DATA_RESOURCE_NOT_LIVE'); return value.value }
      const wait = (predicate, label) => observe(source, snapshot => snapshot.status === 'live' && predicate(snapshot.value), signal, label)
      const callback = await check('actual-production-slot-policy-callback-required', async () => {
        let actual
        for (const [key, identity] of [['main', 'financial-services'], ['plugins.bundle.config', '@local/dsh-financial-services'], ['plugins.bundle.activation', '@local/dsh-financial-services']]) {
          const entries = { getSnapshot: () => ctx.slots.entries(key), subscribe: listener => ctx.slots.subscribe(key, listener) }
          const rows = await observe(entries, rows => rows.some(row => (row.options.key ?? row.options.id) === identity), signal, 'PRODUCTION_SLOT')
          const matching = rows.filter(row => (row.options.key ?? row.options.id) === identity)
          ensure(matching.length === 1 && ctx.slots.entriesOfSlot(key).includes(matching[0]), 'PRODUCTION_SLOT_NOT_UNIQUE_ACTIVE')
          const callbacks = matching[0].inject?.()
          ensure(typeof callbacks?.updateDataPolicy === 'function', 'PRODUCTION_DATA_CALLBACK_MISSING_REFRESH_REQUIRED')
          ensure(callbacks.dataAddress === ADDRESS && typeof callbacks.dataT === 'function', 'PRODUCTION_DATA_INSTALL_PROPS_MISSING')
          ensure(matching[0].inject().updateDataPolicy === callbacks.updateDataPolicy, 'PRODUCTION_CALLBACK_IDENTITY_UNSTABLE')
          if (key === 'main') actual = callbacks.updateDataPolicy
          else ensure(actual === callbacks.updateDataPolicy, 'PRODUCTION_SLOTS_NOT_SHARED_CALLBACK')
        }
        return actual
      })
      // Do not record the function in a report; only its existence and real invocation results.
      report.checks.at(-1).detail = { mainConfigActivationProductionCallback: true, testCallbackInjected: false }
      await check('native-resource-real-host-baseline-and-test-markers', async () => {
        await wait(value => value.revision === setup.catalog.revision, 'DATA_BASELINE')
        const value = current(); ensure(JSON.stringify(value) === JSON.stringify(setup.catalog), 'BASELINE_NOT_HOST_CATALOG')
        ensure(value.capabilities.length === 14 && value.adapters.length === 2, 'BASELINE_EXPECTS_14_CAPABILITIES_2_ADAPTERS')
        for (const adapter of value.adapters) {
          ensure([MCP, REST].includes(adapter.id) && adapter.testOnly && adapter.licenseClass === 'TEST_ONLY', 'MISSING_TEST_ONLY_MARKER')
          ensure(adapter.status.state === 'READY' && adapter.credentialConfigured === false && !('credentialRef' in adapter), 'CREDENTIAL_CONFIGURATION_IS_NOT_AUTHORIZATION')
        }
        ensure(value.commercialExecutionVerified === false, 'COMMERCIAL_EXECUTION_NOT_VERIFIED')
        await observe(workspace, s => s.status === 'live' && s.value.binding === null && s.value.revision === 19, signal, 'WORKSPACE_BASELINE')
        return { revision: value.revision, capabilityDirectory: 14, registeredAdapters: 2, credentialsDoNotImplyReady: true }
      })
      const apply = request => bounded(() => callback(request), signal, 'PRODUCTION_POLICY_CALLBACK')
      const owned = [binding(MCP, 'capiq', setup.ownedScopeId, 20), binding(REST, 'daloopa', setup.ownedScopeId, 10)]
      const hostQuery = () => rpc('queryOwned', { runId: setup.runId })
      const selected = (result, adapterId, revenue) => {
        ensure(result.status === 'OK', 'NATIVE_QUERY_NOT_OK')
        const row = result.observations.find(o => o.field === 'revenue')
        ensure(row?.adapterId === adapterId && row.value === revenue, 'NATIVE_QUERY_WRONG_SOURCE_OR_VALUE')
        ensure(result.observations.every(o => o.licenseClass === 'TEST_ONLY' && o.testOnly), 'NATIVE_QUERY_TEST_MARKERS_MISSING')
      }
      await check('installation-not-entitlement-native-query-denied', async () => { ensure((await hostQuery()).status === 'NOT_AUTHORIZED', 'UNBOUND_AGENT_QUERY_NOT_DENIED') })
      const before = current(), appended = [...before.bindings, ...owned]
      await check('production-callback-two-bindings-host-applied-resource-follows', async () => {
        const result = await apply({ expectedRevision: before.revision, bindings: appended })
        ensure(result.status === 'APPLIED' && !('ok' in result), 'CALLBACK_MUST_RETURN_UNWRAPPED_APPLIED')
        await wait(value => value.revision === result.revision && JSON.stringify(value.bindings) === JSON.stringify(appended), 'APPLIED_NATIVE_RESOURCE')
        const host = await rpc('report', {}); ensure(JSON.stringify(current()) === JSON.stringify(host.catalog), 'APPLIED_RESOURCE_NOT_HOST')
        return { status: result.status, revision: result.revision, authoritativeResourceObserved: true }
      })
      await check('native-tool-mcp-two-million', async () => { const result = await hostQuery(); selected(result, MCP, 2000000); return result })
      await check('host-only-auth-state-resource-and-rest-fallback', async () => {
        const host = await rpc('toggleToyState', { runId: setup.runId, state: 'NOT_AUTHORIZED' })
        await wait(value => value.adapters.find(a => a.id === MCP)?.status.state === 'NOT_AUTHORIZED', 'HOST_AUTH_STATE')
        ensure(JSON.stringify(current()) === JSON.stringify(host.catalog), 'AUTH_RESOURCE_NOT_HOST')
        const result = await hostQuery(); selected(result, REST, 2100000)
        ensure(result.trace.some(t => t.adapterId === MCP && t.code === 'NOT_AUTHORIZED'), 'FALLBACK_MISSING_AUTH_TRACE')
        await rpc('toggleToyState', { runId: setup.runId, state: 'READY' })
        await wait(value => value.adapters.find(a => a.id === MCP)?.status.state === 'READY', 'RESTORED_READY_RESOURCE')
        return { authStateFromHost: true, credentialConfigured: false, fallbackRevenue: 2100000 }
      })
      await check('stale-production-callback-conflict-no-fake-publication', async () => {
        const baseline = JSON.stringify(current()), result = await apply({ expectedRevision: before.revision, bindings: before.bindings })
        ensure(result.status === 'CONFLICT' && !('ok' in result), 'STALE_CALLBACK_NOT_CONFLICT')
        const host = await rpc('report', {}); ensure(JSON.stringify(current()) === baseline && JSON.stringify(host.catalog) === baseline, 'CONFLICT_PUBLISHED_FAKE_STATE')
      })
      await check('writer-policy-rejected-by-host-no-fake-publication', async () => {
        const value = current(), baseline = JSON.stringify(value)
        const result = await apply({ expectedRevision: value.revision, bindings: [...value.bindings, { ...owned[0], roleIds: ['finance-model-builder-builder'] }] })
        ensure(result.status === 'REJECTED', 'WRITER_POLICY_NOT_HOST_REJECTED')
        const host = await rpc('report', {}); ensure(JSON.stringify(current()) === baseline && JSON.stringify(host.catalog) === baseline, 'REJECTED_POLICY_CHANGED_RESOURCE')
      })
      await check('strict-local-unknown-secret-and-scope-fields-rejected', async () => {
        const value = current(), baseline = JSON.stringify(value)
        for (const patch of [{ apiKey: 'TEST_ONLY_NOT_A_SECRET' }, { endpoint: 'TEST_ONLY_NOT_A_URL' }, { scopeIds: ['*'] }, { scopeId: setup.ownedScopeId }]) {
          const result = await apply({ expectedRevision: value.revision, bindings: [...value.bindings, { ...owned[0], ...patch }] })
          ensure(result.status === 'INVALID_REQUEST', 'UNKNOWN_FIELD_NOT_REJECTED_LOCALLY')
        }
        const host = await rpc('report', {}); ensure(JSON.stringify(current()) === baseline && JSON.stringify(host.catalog) === baseline, 'LOCAL_INVALID_INPUT_CHANGED_HOST')
        return { syntheticSecretOnly: true, unknownFieldsRejectedLocally: 4 }
      })
      await check('production-priority-switch-resource-and-native-rest-query', async () => {
        const value = current(), bindings = value.bindings.map(b => b.scopeIds.includes(setup.ownedScopeId) && b.adapterId === REST ? { ...b, priority: 30 } : b)
        const result = await apply({ expectedRevision: value.revision, bindings }); ensure(result.status === 'APPLIED', 'PRIORITY_CALLBACK_NOT_APPLIED')
        await wait(value => value.revision === result.revision && JSON.stringify(value.bindings) === JSON.stringify(bindings), 'PRIORITY_NATIVE_RESOURCE')
        const host = await rpc('report', {}); ensure(JSON.stringify(current()) === JSON.stringify(host.catalog), 'PRIORITY_RESOURCE_NOT_HOST')
        const query = await hostQuery(); selected(query, REST, 2100000); return { revision: result.revision, selectedAdapter: REST, revenue: 2100000 }
      })
    } catch (error) {
      state.errorCode = safeError(error)
      if (!report.checks.some(c => c.errorCode === state.errorCode)) report.checks.push({ id: 'native-client-run', status: 'FAIL', errorCode: state.errorCode })
    } finally {
      pins.abort()
      for (const dispose of cleanups.reverse()) { try { dispose() } catch { report.checks.push({ id: 'release-native-resource', status: 'FAIL' }) } }
      report.resourcesReleased = true; report.status = report.checks.some(c => c.status === 'FAIL') ? 'FAIL' : 'PASS'
      if (rpc && state.runId) {
        try {
          const result = await rpc('finalize', { runId: state.runId, clientReportJson: JSON.stringify(report) }, true)
          ensure(result.cleaned, 'HOST_CLEANUP_INCOMPLETE'); mark(`FINALIZED_${result.status}`)
        } catch (error) { state.errorCode = safeError(error); mark('FINALIZE_FAILED'); await rpc('checkpoint', { stage: 'CLIENT_FINALIZE_FAILED' }, true).catch(() => {}) }
      }
      await servicesChild?.dispose(); await namespaceChild?.dispose()
    }
  }
});
 return createP3ClientFixture(require('zod').z, createP3ClientContract, "@local/dsh-finance-p3-client-481c9b41-057e-4dc7-acbc-9c87101d2d72-test-only");
 }
});
