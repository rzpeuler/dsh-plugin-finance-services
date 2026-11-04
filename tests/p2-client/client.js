/** TEST_ONLY renderless Client; runs against registrations already owned by production. */
export function createP2ClientFixture(z, createP2ClientContract) {
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

  return {
    inject: ['slots', 'resources', 'remote', 'sessions', 'uiWorkspace', 'layout', 'conversation'],
    async apply(ctx) {
      await ctx.remote.$mount(createP2ClientContract(z).remote)
      const lifetime = new AbortController()
      // Activation must settle so the real renderer can mount; the owned task is not an apply barrier.
      ctx.effect(() => {
        const task = run(ctx, lifetime.signal).catch(error => {
          console.error('TEST_ONLY P2 Client fixture failed:', error)
        })
        return async () => { lifetime.abort(new Error('TEST_ONLY fixture disposed')); await task }
      }, 'TEST_ONLY P2 Client run')
    },
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
        }, () => {}).catch(error => console.error('TEST_ONLY late navigation cancellation failed:', errorText(error)))
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
      } catch (error) { console.error('TEST_ONLY Host result/cleanup failed:', errorText(error)) }
    }
  }
}
