/* Disposable TEST_ONLY native Client fixture. No React/DOM or feature value imports. */
window.__ModuleLoader__.load({
  id: "@local/dsh-financial-services-p2-client-retry-4",
  factory(require) {
    const createP2ClientContract = (function createP2ClientContract(z) {
  const packageName = '@local/dsh-financial-services-p2-client-retry-4'
  const RunId = z.string().uuid()
  const JsonText = z.string().max(2_000_000)
    .refine(text => new TextEncoder().encode(text).byteLength <= 2_000_000, 'Serialized JSON exceeds 2,000,000 UTF-8 bytes')
    .refine(text => {
      try { JSON.parse(text); return true } catch { return false }
    }, 'Expected serialized JSON')
  const schemas = {
    CheckpointRequest: z.strictObject({
      stage: z.enum(['CLIENT_APPLY', 'REMOTE_MOUNTED', 'DEPENDENCIES_WAITING', 'DEPENDENCIES_READY', 'DEPENDENCIES_TIMEOUT', 'CLIENT_RUN_STARTED', 'CLIENT_RUN_FAILED', 'CLIENT_FINISH_FAILED', 'CLIENT_DISPOSED', 'LATE_NAVIGATION_FAILED']),
      services: z.array(z.strictObject({ key: z.string().min(1).max(64), present: z.boolean() })).max(8),
    }),
    CheckpointResult: z.strictObject({ recorded: z.literal(true) }),
    BeginRequest: z.strictObject({ runId: RunId, allowNavigation: z.literal(true) }),
    BeginResult: z.strictObject({ runId: RunId, workspaceId: z.string(), path: z.string(), baselineJson: JsonText }),
    InspectRequest: z.strictObject({ runId: RunId, sessionId: z.string().min(1), agentPreset: z.string().regex(/^finance-[a-z0-9-]+$/) }),
    InspectResult: z.strictObject({ sessionId: z.string(), agentPreset: z.string(), cwd: z.string(), blank: z.literal(true), modelTurns: z.literal(0), eventTypes: z.array(z.string()) }),
    FinishRequest: z.strictObject({ runId: RunId, clientReportJson: JsonText }),
    FinishResult: z.strictObject({ reportPath: z.string(), restoredBinding: z.boolean(), removedOwnedRegistry: z.boolean() }),
    BaselineRequest: z.strictObject({}),
    BaselineResult: z.strictObject({ snapshotJson: JsonText }),
  }
  const descriptor = (method, input, output, description) => ({
    id: `${packageName}#financeP2ClientTestOnly/${method}`,
    service: 'financeP2ClientTestOnly', namespace: 'financeP2ClientTestOnly', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: {
      mode: 'strict', typeSymbol: `${packageName}#${input}`, create: () => schemas[input],
    } }],
    result: { mode: 'strict', typeSymbol: `${packageName}#${output}`, create: () => schemas[output] }, description,
  })
  const descriptors = [
    descriptor('checkpoint', 'CheckpointRequest', 'CheckpointResult', 'TEST_ONLY record bounded activation stage and service-presence booleans in the fixture diagnostic only; never read drafts or mutate binding.'),
    descriptor('baseline', 'BaselineRequest', 'BaselineResult', 'TEST_ONLY read the real Host finance snapshot without mutation.'),
    descriptor('begin', 'BeginRequest', 'BeginResult', 'TEST_ONLY allocate one uniquely owned directory and Workspace after the Client navigation safety gate; do not create a Session.'),
    descriptor('inspect', 'InspectRequest', 'InspectResult', 'TEST_ONLY inspect an owned native Session header and event types without activating or prompting it.'),
    descriptor('finish', 'FinishRequest', 'FinishResult', 'TEST_ONLY receive bounded JSON evidence, CAS-restore the old binding and unregister only the owned Workspace; retain files and Session history.'),
  ]
  return { remote: { package: packageName, descriptors }, schemas }
});
    const createP2ClientFixture = (function createP2ClientFixture(z, createP2ClientContract) {
  const PACKAGE = '@local/dsh-financial-services'
  const PANEL = 'financial-services'
  const catalogAddress = 'dsh-resource://finance-catalog/current'
  const workspaceAddress = 'dsh-resource://finance-workspace/current'
  const timeoutMs = 15_000
  const fail = message => { throw new Error(message) }
  const ensure = (condition, message) => { if (!condition) fail(message) }
  const notRun = message => { throw Object.assign(new Error(message), { status: 'NOT_RUN' }) }
  const errorText = error => String(error?.message ?? error)
  const selected = ctx => Object.values(ctx.sessions.list.getSnapshot().byId)
    .filter(row => (row.retainedBy.mainView ?? 0) > 0)

  // Every wait has one subscription, deadline and abort listener; no sleeps or polling.
  function observe(source, predicate, signal, label) {
    let stop = () => {}
    let timer
    let done = false
    const promise = new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (done) return
        done = true
        stop()
        clearTimeout(timer)
        signal.removeEventListener('abort', aborted)
        error ? reject(error) : resolve(value)
      }
      const aborted = () => finish(signal.reason ?? new Error(`${label}: aborted`))
      const read = () => {
        try {
          const value = source.getSnapshot()
          if (predicate(value)) finish(undefined, value)
        } catch (error) { finish(error) }
      }
      signal.addEventListener('abort', aborted, { once: true })
      timer = setTimeout(() => finish(new Error(`${label}: timed out`)), timeoutMs)
      // Native subscribes are allowed to publish synchronously while acquiring their first holder.
      try {
        const unsubscribe = source.subscribe(read)
        stop = unsubscribe
        if (done) unsubscribe()
        if (signal.aborted) aborted()
        else read()
      } catch (error) { finish(error) }
    })
    return promise
  }

  async function bounded(operation, signal, label) {
    let timer
    let abort
    try {
      signal.throwIfAborted()
      return await Promise.race([
        Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }),
        new Promise((resolve, reject) => {
          abort = () => reject(signal.reason ?? new Error(`${label}: aborted`))
          signal.addEventListener('abort', abort, { once: true })
          timer = setTimeout(() => reject(new Error(`${label}: timed out`)), timeoutMs)
          if (signal.aborted) abort()
        }),
      ])
    } finally {
      clearTimeout(timer)
      if (abort) signal.removeEventListener('abort', abort)
    }
  }

  const dependencies = ['slots', 'resources', 'sessions', 'uiWorkspace', 'layout', 'conversation']
  const presence = ctx => dependencies.map(key => ({ key, present: ctx.get(key) !== undefined }))
  async function checkpoint(ctx, stage, recordResult) {
    const result = await bounded(() => ctx.remote.financeP2ClientTestOnly.checkpoint({ stage, services: presence(ctx) }),
      new AbortController().signal, `TEST_ONLY checkpoint ${stage}`)
    recordResult?.(stage, result)
    if (!result.ok) throw Object.assign(new Error(errorText(result.error)), {
      name: result.error?.name ?? 'RemoteError', code: result.error?.code,
      details: result.error?.details, remoteStack: result.error?.stack,
    })
    return result.value
  }

  return {
    // Bootstrap cannot wait for the business dependencies it is meant to diagnose.
    inject: ['remote', 'cordisInspect'],
    apply(ctx) {
      // This read-only channel is registered synchronously, before contract construction or $mount.
      const state = { package: '@local/dsh-financial-services-p2-client-retry-3', stage: 'APPLY_ENTERED',
        error: null, checkpointResult: null, history: [], userDraftExported: false }
      const boundedText = (value, limit) => String(value ?? '').slice(0, limit)
      const detailsText = value => {
        try { return boundedText(JSON.stringify(value) ?? '', 8192) }
        catch { return '[unserializable error details]' }
      }
      const recordResult = (stage, result) => {
        if (state.checkpointResult?.ok === false) return
        state.checkpointResult = { stage, ok: result.ok, ...(result.ok
          ? { value: result.value }
          : { error: { name: boundedText(result.error?.name, 256), code: boundedText(result.error?.code, 256),
            message: boundedText(result.error?.message ?? result.error, 4096), detailsJson: detailsText(result.error?.details),
            stack: boundedText(result.error?.stack, 12288) } }) }
      }
      const mark = (stage, error) => {
        const operation = state.stage
        state.stage = stage
        if (error !== undefined && state.error === null) {
          const text = (value, limit) => String(value ?? '').slice(0, limit)
          state.error = { operation, name: text(error?.name, 256), code: text(error?.code, 256),
            message: text(error?.message ?? error, 4096), stack: text(error?.stack, 12288),
            detailsJson: detailsText(error?.details), remoteStack: text(error?.remoteStack, 12288) }
        }
        state.history.push({ stage, at: new Date().toISOString() })
        if (state.history.length > 32) state.history.shift()
      }
      ctx.effect(() => ctx.cordisInspect.register({
        manifest: { id: 'FinanceP2ClientFixtureState', description: 'TEST_ONLY fixture-local startup diagnostics independent of Remote mount.',
          methods: [{ name: 'state', description: 'Read bounded startup stages and original error fields; no drafts, Sessions or business operation.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            outputSchema: { description: 'Fixture-local stage/error/history only; never user draft fields.' } }] },
        async query(method) {
          if (method !== 'state') throw new Error('Unknown fixture diagnostic method')
          return JSON.parse(JSON.stringify(state))
        },
      }), 'TEST_ONLY fixture-local Inspect')
      mark('INSPECT_REGISTERED')
      const lifetime = new AbortController()
      ctx.effect(() => {
        const task = activate(ctx, lifetime.signal, mark, recordResult)
        return async () => { lifetime.abort(new Error('TEST_ONLY fixture disposed')); await task }
      }, 'TEST_ONLY P2 Client activation')
    },
  }

  async function activate(ctx, signal, mark, recordResult) {
    let namespaceReady = false
    let namespaceChild
    let child
    const tracedCheckpoint = async stage => {
      mark(`CHECKPOINT_${stage}_START`)
      await checkpoint(ctx, stage, recordResult)
      mark(`CHECKPOINT_${stage}_END`)
    }
    try {
      mark('CONTRACT_CREATE_START')
      const { remote } = createP2ClientContract(z)
      mark('CONTRACT_CREATE_END')
      mark('REMOTE_MOUNT_START')
      await bounded(() => ctx.remote.$mount(remote), signal, 'Full native Remote mount')
      mark('REMOTE_MOUNT_END')
      // $mount provides a distinct child Service; injecting `remote` alone does not grant its namespace.
      mark('REMOTE_NAMESPACE_INJECT_START')
      const namespaceLifetime = new AbortController()
      let acceptNamespace
      const namespace = new Promise(resolve => { acceptNamespace = resolve })
      namespaceChild = ctx.inject(['remote', 'remote.financeP2ClientTestOnly'], scopedCtx => {
        acceptNamespace(scopedCtx)
        return () => namespaceLifetime.abort(new Error('TEST_ONLY Remote namespace scope disposed'))
      })
      ctx = await bounded(() => namespace, signal, 'Native Remote namespace activation')
      signal = AbortSignal.any([signal, namespaceLifetime.signal])
      namespaceReady = true
      mark('REMOTE_NAMESPACE_INJECT_END')
      await tracedCheckpoint('CLIENT_APPLY')
      await tracedCheckpoint('REMOTE_MOUNTED')
      await tracedCheckpoint('DEPENDENCIES_WAITING')
      const dependencyLifetime = new AbortController()
      let accept
      const ready = new Promise(resolve => { accept = resolve })
      child = ctx.inject([...dependencies, 'remote', 'remote.financeP2ClientTestOnly'], services => {
        accept(services)
        return () => dependencyLifetime.abort(new Error('TEST_ONLY native dependency scope disposed'))
      })
      let services
      try { services = await bounded(() => ready, signal, 'Native dependency activation') }
      catch (error) {
        mark('DEPENDENCIES_WAIT_FAILED', error)
        await tracedCheckpoint('DEPENDENCIES_TIMEOUT')
        const result = await bounded(() => ctx.remote.financeP2ClientTestOnly.finish({ runId: crypto.randomUUID(),
          clientReportJson: JSON.stringify({ status: 'PARTIAL', checks: [{ id: 'native-dependencies', status: 'NOT_RUN',
            error: 'Required native Client services did not activate within deadline; no navigation/binding attempted' }],
          resourcesReleased: true, financialExecution: 'NOT_RUN' }) }), new AbortController().signal, 'Missing dependencies report')
        ensure(result.ok, 'Missing dependencies report rejected')
        return
      }
      await tracedCheckpoint('DEPENDENCIES_READY')
      await tracedCheckpoint('CLIENT_RUN_STARTED')
      mark('RUN_START')
      await run(services, AbortSignal.any([signal, dependencyLifetime.signal]))
      mark('RUN_SETTLED')
    } catch (error) {
      // Only startup errors are exported verbatim; user input is never inspected on this path.
      mark('ACTIVATION_FAILED', error)
      if (namespaceReady) await checkpoint(ctx, 'CLIENT_RUN_FAILED', recordResult).catch(checkpointError => {
        mark('FAILURE_CHECKPOINT_FAILED', checkpointError)
      })
      // The Host-owned NoReport deadline is the evidence if even bootstrap RPC is unavailable.
      console.error('TEST_ONLY Client activation failed; inspect Host diagnostic (no user draft exported)')
    } finally {
      await child?.dispose()
      await namespaceChild?.dispose()
    }
  }

  async function run(ctx, signal) {
    const runId = crypto.randomUUID()
    const report = { runId, startedAt: new Date().toISOString(), status: 'RUNNING', checks: [],
      evidence: 'PROGRAMMATIC_PRODUCTION_CALLBACK_AND_NATIVE_UI_DOMAIN',
      actualMouseClick: 'NOT_VERIFIED', visualRendering: 'NOT_VERIFIED',
      composer: 'NOT_VERIFIED', originalDraftUnchanged: 'NOT_VERIFIED',
      resourcesReleased: false, sessions: [],
    }
    const cleanups = []
    const ownedIds = new Set()
    let original
    let originalRef
    let originalInput
    let originalDraft
    let workspace
    let touchedNavigation = false
    let pendingCallback
    const rpc = async (method, request, cleanup = false) => {
      const result = await bounded(() => ctx.remote.financeP2ClientTestOnly[method](request),
        cleanup ? new AbortController().signal : signal, `TEST_ONLY Remote ${method}`)
      ensure(result.ok, `TEST_ONLY Remote ${method}: ${JSON.stringify(result.error)}`)
      return result.value
    }
    const check = async (id, operation) => {
      try {
        const detail = await operation()
        report.checks.push({ id, status: 'PASS', ...(detail === undefined ? {} : { detail }) })
        return detail
      } catch (error) {
        report.checks.push({ id, status: error.status ?? 'FAIL', error: errorText(error) })
        throw error
      }
    }
    const resource = async address => {
      const source = ctx.resources.source(address)
      // Explicit hold retained across the entire run, separately from each bounded waiter.
      cleanups.push(source.subscribe(() => {}))
      const snapshot = await observe(source, value => value.status === 'live' || value.status === 'failed', signal, address)
      ensure(snapshot.status === 'live', `${address}: ${JSON.stringify(snapshot.failure)}`)
      return { source, snapshot }
    }
    const sourceForSlot = key => ({
      getSnapshot: () => ctx.slots.entries(key),
      subscribe: listener => ctx.slots.subscribe(key, listener),
    })
    const mainRow = () => {
      const rows = selected(ctx)
      ensure(rows.length === 1, 'Expected exactly one mainView reference')
      return rows[0]
    }
    const inputFor = sessionId => {
      const binding = ctx.sessions.binding(sessionId)
      ensure(binding !== undefined, 'No retained native Session binding')
      return ctx.conversation.input.for(binding.ctx)
    }
    const assertStillOwnedView = () => {
      const row = mainRow()
      ensure(row.id === original.id || ownedIds.has(row.id), 'Concurrent user navigation: stop testing')
      ensure(ctx.layout.panelInfo.getSnapshot().activePanelId === null, 'User selected a global panel: stop testing')
    }
    try {
      await check('public-api-availability', async () => {
        for (const [target, key] of [[ctx.slots, 'entries'], [ctx.slots, 'entriesOfSlot'], [ctx.slots, 'subscribe'],
          [ctx.resources, 'source'], [ctx.sessions, 'binding'], [ctx.sessions, 'retain'], [ctx.sessions, 'subagentAddress'],
          [ctx.uiWorkspace, 'openSession'], [ctx.conversation.input, 'for']]) {
          if (typeof target?.[key] !== 'function') notRun(`Public ${key} API unavailable; no internal fallback`)
        }
        return { source: 'Public SlotRegistry/Resources/ISessions/ILayout/IConversation declarations' }
      })
      await observe(ctx.sessions.list, state => state.phase === 'ready', signal, 'Native Session list baseline')
      const catalogResource = await resource(catalogAddress)
      const catalog = catalogResource.snapshot.value
      await check('finite-native-catalog-resource', async () => {
        const counts = [catalog.agents.length, catalog.workers.length, catalog.skills.length, catalog.commands.length, catalog.steering.length]
        ensure(JSON.stringify(counts) === '[10,30,63,41,29]', `Wrong live resource counts: ${counts}`)
        ensure(catalogResource.source.getSnapshot().status === 'live', 'Finite generator must remain live, not done')
        return { counts, status: 'live', generatorCompletionIsNotASeparateResourceStatus: true }
      })
      const workspaceResource = await resource(workspaceAddress)
      await check('workspace-resource-real-host-baseline', async () => {
        const host = JSON.parse((await rpc('baseline', {})).snapshotJson)
        const current = workspaceResource.source.getSnapshot()
        report.workspaceBaselineObservation = { hostKeys: Object.keys(host), hostRevision: host.revision,
          resourceStatus: current.status, resourceValueKeys: Object.keys(current.value ?? {}), resourceRevision: current.value?.revision,
          resourceRemoteOk: current.value?.ok, nestedRevision: current.value?.value?.revision }
        await observe(workspaceResource.source, value => value.status === 'live' && value.value.revision === host.revision, signal, 'Workspace Host baseline')
        ensure(JSON.stringify(workspaceResource.source.getSnapshot().value) === JSON.stringify(host), 'Resource baseline differs from real Host')
        return { revision: host.revision, workspaceStatus: host.workspaceStatus, matchesHost: true }
      })
      let main
      await check('one-production-registration-per-slot', async () => {
        const detail = []
        for (const [key, identity] of [['main', PANEL], ['sidebar.panellist', PANEL], ['plugins.bundle.config', PACKAGE], ['plugins.bundle.activation', PACKAGE]]) {
          const rows = await observe(sourceForSlot(key), entries => entries.some(entry => (entry.options.key ?? entry.options.id) === identity), signal, `Production slot ${key}`)
          const matches = rows.filter(entry => (entry.options.key ?? entry.options.id) === identity)
          ensure(matches.length === 1, `Duplicate production ${key} entries`)
          ensure(ctx.slots.entriesOfSlot(key).includes(matches[0]), `Production ${key} entry is shadowed/abdicated`)
          if (key === 'main') main = matches[0]
          detail.push({ slot: key, identity, count: matches.length })
        }
        return detail
      })
      const callbacks = main.inject?.()
      ensure(typeof callbacks?.startDraft === 'function' && typeof callbacks.bindWorkspace === 'function', 'Production main inject callbacks missing')
      const startDraft = callbacks.startDraft
      ensure(main.inject().startDraft === startDraft, 'Stored production inject did not return the same callback')
      await check('capture-safe-original-navigation-and-draft', async () => {
        const bindingBaseline = workspaceResource.source.getSnapshot().value
        if (bindingBaseline.binding !== null && bindingBaseline.workspaceStatus !== 'READY') notRun('Original default binding is not publicly restorable; no binding mutation')
        if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) notRun('Global panel selected; do not navigate or change panel configuration')
        const rows = selected(ctx)
        if (rows.length !== 1 || rows[0].origin === 'subagent' || ctx.sessions.subagentAddress(rows[0].id)) notRun('No unique ordinary mainView target; automatic navigation forbidden')
        original = { id: rows[0].id }
        // Pin only the already selected generation. Preserve its input scope while mainView changes.
        originalRef = ctx.sessions.retain(original.id, { source: 'workspaceOperation' })
        await bounded(() => originalRef.ready, signal, 'Original native Session pin')
        originalInput = inputFor(original.id)
        if (typeof originalInput?.state?.getSnapshot !== 'function') notRun('Public composer read unavailable: composer NOT_VERIFIED; no navigation')
        const state = originalInput.state.getSnapshot()
        if (typeof state.draft !== 'string') notRun('Public composer draft unavailable: composer NOT_VERIFIED; no navigation')
        if (state.phase !== 'plain') notRun('Original composer is not plain (claim or submission pending); do not navigate')
        // Private user text stays in this closure, never in Remote JSON, console, or report.
        originalDraft = JSON.stringify({ draft: state.draft, attachmentIds: state.attachmentIds, occurrences: state.occurrences, claim: state.claim })
        return { targetCapturedFromPublicDomain: true, scopePinned: true, userDraftExported: false }
      })
      workspace = await rpc('begin', { runId, allowNavigation: true })
      const baseline = JSON.parse(workspace.baselineJson)
      await check('production-callback-bind-owned-workspace-cas', async () => {
        const result = await bounded(() => callbacks.bindWorkspace({ path: workspace.path, expectedRevision: baseline.revision }), signal, 'Production bindWorkspace callback')
        ensure(result.ok && result.value.status === 'BOUND', 'Production binding failed')
        ensure(result.value.snapshot.binding.workspaceId === workspace.workspaceId, 'Bound wrong Workspace')
        await observe(workspaceResource.source, value => value.status === 'live' && value.value.binding?.workspaceId === workspace.workspaceId, signal, 'Native workspace resource binding update')
        return { workspaceId: workspace.workspaceId, revision: result.value.snapshot.revision }
      })
      const mains = catalog.agents.filter(role => role.kind === 'main' && role.mountStatus === 'AVAILABLE')
      ensure(mains.length >= 2, 'Need two available main roles')
      const multi = catalog.commands.find(command => command.selectionRequired && command.targetPresetIds.length > 1
        && command.targetPresetIds.some(id => mains.some(role => role.id === id)))
      ensure(multi, 'No multi-target command available')
      const commandRole = mains.find(role => multi.targetPresetIds.includes(role.id))
      const firstRole = mains.find(role => role.id !== commandRole.id)
      async function invoke(request, expectNew = true) {
        assertStillOwnedView()
        const before = mainRow().id
        const waitController = new AbortController()
        const waitSignal = AbortSignal.any([signal, waitController.signal])
        // Subscribe before the void UI action can publish selection.
        const navigation = observe(ctx.sessions.list, state => {
          const rows = Object.values(state.byId).filter(row => (row.retainedBy.mainView ?? 0) > 0)
          return rows.length === 1 && (expectNew ? rows[0].id !== before : rows[0].id === before)
            && rows[0].cwd === workspace.path
        }, waitSignal, 'Native uiWorkspace void selection')
        // Prevent an unhandled waiter rejection if the Remote callback rejects first.
        navigation.catch(() => {})
        try {
          touchedNavigation = true
          pendingCallback = Promise.resolve().then(() => startDraft(request))
          const intent = await bounded(() => pendingCallback, signal, 'Production startDraft callback')
          pendingCallback = undefined
          ensure(intent.status === 'DRAFT_READY' && intent.autoSubmit === false && intent.whenDraftExists === 'keep', 'Production draft intent rejected')
          ensure(intent.agentPreset === request.agentId && intent.workspaceId === workspace.workspaceId, 'Production draft targets wrong role/Workspace')
          await navigation
          const row = mainRow()
          ownedIds.add(row.id)
          const state = inputFor(row.id).state.getSnapshot()
          ensure(state.phase === 'plain', 'Native composer unexpectedly submitting/claimed')
          return { row, intent, state }
        } finally { waitController.abort(new Error('Step settled')) }
      }
      const first = await check('production-main-one-native-session-and-real-composer', async () => {
        const value = await invoke({ agentId: firstRole.id, prompt: `TEST_ONLY NON_FINANCIAL unsent draft ${runId}` })
        ensure(value.state.draft === value.intent.prompt, 'Actual public composer draft does not equal prepared prompt')
        const host = await rpc('inspect', { runId, sessionId: value.row.id, agentPreset: firstRole.id })
        report.sessions.push(host)
        report.composer = 'VERIFIED_NATIVE_UI_DOMAIN_NOT_VISUAL'
        return { sessionId: value.row.id, preset: firstRole.id, actualComposerRead: true, autoSubmitted: false }
      })
      // Capture only our own draft before changing mainView; the next keep check navigates
      // back from a different preset so its observable selection is an actual completion witness.
      const firstOwnedDraft = inputFor(first.sessionId).state.getSnapshot().draft
      await check('explicit-multitarget-command-second-native-main', async () => {
        const value = await invoke({ agentId: commandRole.id, commandId: multi.id })
        ensure(value.row.id !== first.sessionId, 'Different main presets reused the same Session')
        ensure(value.state.draft === value.intent.prompt && value.state.draft.length > 0, 'Command did not fill actual public composer draft')
        const host = await rpc('inspect', { runId, sessionId: value.row.id, agentPreset: commandRole.id })
        report.sessions.push(host)
        return { sessionId: value.row.id, preset: commandRole.id, commandId: multi.id, selectionExplicit: true, actualComposerRead: true }
      })
      await check('same-production-callback-keeps-existing-draft', async () => {
        const value = await invoke({ agentId: firstRole.id, prompt: `TEST_ONLY replacement must not overwrite ${runId}` })
        ensure(value.row.id === first.sessionId, 'Same preset did not reuse its owned blank')
        ensure(value.state.draft === firstOwnedDraft && value.state.draft !== value.intent.prompt, 'keep replaced the existing actual draft')
        return { sameSession: true, actualDraftPreserved: true, nativeSelectionObserved: true }
      })
      await check('production-worker-rejection-does-not-navigate', async () => {
        assertStillOwnedView()
        const before = mainRow().id
        const beforeIds = Object.keys(ctx.sessions.list.getSnapshot().byId)
        const draft = inputFor(before).state.getSnapshot().draft
        pendingCallback = Promise.resolve().then(() => startDraft({ agentId: catalog.workers[0].id, prompt: 'TEST_ONLY worker must not open' }))
        const rejected = await bounded(() => pendingCallback, signal, 'Production Worker rejection')
        pendingCallback = undefined
        ensure(rejected.status === 'REJECTED' && rejected.error?.code === 'MAIN_AGENT_REQUIRED', 'Wrong Worker rejection')
        ensure(mainRow().id === before && inputFor(before).state.getSnapshot().draft === draft, 'Rejected Worker changed navigation or draft')
        ensure(JSON.stringify(Object.keys(ctx.sessions.list.getSnapshot().byId)) === JSON.stringify(beforeIds), 'Worker rejection added a Session')
        return { status: rejected.status, code: rejected.error.code, selectionUnchanged: true, draftUnchanged: true }
      })
      // Inspect both exact native Sessions again after all callbacks; no model or user turn may appear.
      await check('all-owned-sessions-remain-unsent', async () => {
        for (const item of report.sessions) await rpc('inspect', { runId, sessionId: item.sessionId, agentPreset: item.agentPreset })
        return { nativeSessions: report.sessions.length, modelTurns: 0 }
      })
    } catch (error) {
      if (!report.checks.some(item => item.error === errorText(error))) report.checks.push({ id: 'fixture-run', status: error.status ?? 'FAIL', error: errorText(error) })
    } finally {
      // Invalidate any in-flight void uiWorkspace navigation before freeing the original scope.
      const restore = async () => {
        if (!touchedNavigation || !original) return
        const rows = selected(ctx)
        const current = rows.length === 1 ? rows[0] : undefined
        const ownedCwd = workspace && current?.cwd === workspace.path
        if (current?.id !== original.id && !ownedIds.has(current?.id) && !ownedCwd) {
          report.checks.push({ id: 'restore-original-navigation', status: 'NOT_RUN', error: 'External user navigation detected; no overwrite attempted' })
          return
        }
        if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) {
          report.checks.push({ id: 'restore-original-navigation', status: 'NOT_RUN', error: 'External panel change detected; no overwrite attempted' })
          return
        }
        ctx.uiWorkspace.openSession(original.id)
        ensure(mainRow().id === original.id, 'Original target was not restored synchronously')
        const state = originalInput.state.getSnapshot()
        report.originalDraftUnchanged = JSON.stringify({ draft: state.draft, attachmentIds: state.attachmentIds, occurrences: state.occurrences, claim: state.claim }) === originalDraft
        ensure(report.originalDraftUnchanged, 'Original user draft changed; fixture never rewrites it')
        report.checks.push({ id: 'restore-original-navigation-and-preserve-user-draft', status: 'PASS', detail: { originalTargetRestored: true, originalDraftUnchanged: true, userDraftExported: false } })
      }
      try { await restore() } catch (error) { report.checks.push({ id: 'restore-original-navigation', status: 'FAIL', error: errorText(error) }) }
      // Production callback has no AbortSignal parameter. Its settlement continuation owns no
      // subscriptions/timers or Session reference. It only cancels a late native navigation into
      // this unique test Workspace; it never follows the user elsewhere or reads a disposed input.
      if (pendingCallback) {
        report.checks.push({ id: 'production-callback-settlement', status: 'FAIL', error: 'Callback exceeded deadline; late owned-navigation cancellation armed' })
        const originalId = original?.id
        const ownedPath = workspace?.path
        pendingCallback.then(() => {
          if (!originalId || ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return
          const rows = selected(ctx)
          if (rows.length === 1 && (rows[0].id === originalId || rows[0].cwd === ownedPath)) ctx.uiWorkspace.openSession(originalId)
        }, () => {}).catch(() => checkpoint(ctx, 'LATE_NAVIGATION_FAILED').catch(() => {}))
      }
      let released = true
      for (const dispose of cleanups.reverse()) {
        try { dispose() } catch (error) {
          released = false
          report.checks.push({ id: 'resource-release', status: 'FAIL', error: errorText(error) })
        }
      }
      report.resourcesReleased = released
      try { originalRef?.release(); report.originalPinReleased = true }
      catch (error) { report.checks.push({ id: 'original-scope-release', status: 'FAIL', error: errorText(error) }) }
      originalRef = undefined
      originalInput = undefined
      originalDraft = undefined
      report.finishedAt = new Date().toISOString()
      report.status = report.checks.some(item => item.status === 'FAIL') ? 'FAIL'
        : report.checks.some(item => item.status === 'NOT_RUN') ? 'PARTIAL' : 'PASS'
      try {
        const result = await rpc('finish', { runId, clientReportJson: JSON.stringify(report) }, true)
        ensure(result.restoredBinding && result.removedOwnedRegistry, 'Host cleanup incomplete; inspect TEST_ONLY report')
      } catch (error) {
        await checkpoint(ctx, 'CLIENT_FINISH_FAILED').catch(() => {})
        console.error('TEST_ONLY Host finish failed; inspect Host diagnostic (no user draft exported)')
      }
    }
  }
});
    return createP2ClientFixture(require('zod').z, createP2ClientContract);
  }
});
