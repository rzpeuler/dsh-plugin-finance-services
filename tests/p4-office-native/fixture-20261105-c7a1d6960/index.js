import { createHash } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'p4-office-native-20261105-c7a1d6960-technical-only'
export const inject = ['agents', 'fs', 'workingDirectory', 'sandboxPolicy', 'sandbox', 'subprocess']
const RUN = '20261105-c7a1d6960'
const SHA = '001bcd435acc63db72fc795be66c5fac3ae8a7d4940be813fecefb3583b58002'
const TRUST = 'TECHNICAL_TEST_ONLY'
const CAP = 16 * 1024 * 1024
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const requireThat = (value, message) => { if (!value) throw new Error(message) }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Parent installs this unique fixture; authoring/syntax checks never invoke apply. */
export function apply(ctx, config) {
  const lifetime = new AbortController()
  const handles = new Set()
  const report = { runId: RUN, trust: TRUST, businessE2E: false, financeRolePermissionsTested: false, publicLibraryResolutionProved: false, bindingRoute: 'EXPLICIT_AUTHOR_LOCAL_TOOL_AND_SKILL_FACTS',
    status: 'RUNNING', startedAt: new Date().toISOString(), operations: {}, outputs: [] }
  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'producerHash', 'createAndReopen',
    'recalculate', 'verifyCached42', 'pdfConvert', 'pdfPublish', 'cancelTerminateJoin']) report.operations[key] = { status: 'NOT_RUN' }
  let actor, originalPolicy, originalCwd, root, rootTarget, script, input, dependencies, kit, task
  const signal = lifetime.signal
  const check = () => {
    signal.throwIfAborted()
    requireThat(actor && ctx.agents.get(actor.id) === actor, 'Exact native author Agent is no longer live')
    requireThat(ctx.workingDirectory.get(actor.session) === originalCwd, 'Author effective cwd changed')
    const current = ctx.sandboxPolicy.resolve({ session: actor.session })
    requireThat(current.mode === originalPolicy.mode && current.workspaceRoot === originalPolicy.workspaceRoot,
      'Author native policy changed; no escalation/rebinding')
    requireThat(current.mode !== 'read-only', 'Author native policy is read-only')
  }
  async function noLinks(path) {
    const base = actor.session.header.cwd
    const rel = relative(base, path)
    requireThat(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'Outside native author cwd')
    let current = base
    for (const part of ['', ...rel.split(sep)]) {
      if (part) current = join(current, part)
      const info = await ctx.fs.lstat(current, { cwd: base }, signal)
      requireThat(!info || ['file', 'directory'].includes(info.type), 'Linked/special ancestor denied')
    }
    check()
  }
  async function target(name) {
    check()
    requireThat(!/[\\/]/.test(name) && name !== '..', 'Fixed basename required')
    const path = join(root, name)
    await noLinks(path)
    const resolved = await ctx.fs.resolve(path, { signal })
    requireThat(ctx.fs.contains(rootTarget, resolved), 'Canonical target outside marked root')
    check()
    return resolved
  }
  const policy = () => { check(); return { ...originalPolicy, mode: 'workspace-write', workspaceRoot: root, sessionId: actor.id } }
  async function text(name, value) {
    const item = await target(name)
    await ctx.fs.writeText(item, typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      { kind: 'createIfAbsent' }, signal, policy())
    check()
    return ctx.fs.processPath(item)
  }
  async function bytes(name, upstream = signal, limit = CAP) {
    const item = await target(name)
    const before = await ctx.fs.stat(item, upstream)
    requireThat(before?.type === 'file', 'Expected regular output')
    const data = await ctx.fs.readBytes(item, upstream, limit)
    const after = await ctx.fs.stat(item, upstream)
    requireThat(before.version === after?.version, 'File changed during bounded read')
    check()
    return { item, data, version: before.version }
  }
  async function operation(name, fn) {
    try { const details = await fn(); report.operations[name] = { status: 'PASSED', ...(details ?? {}) }; return true }
    catch (error) { report.operations[name] = { status: String(error?.message).startsWith('NOT_RUN:') ? 'NOT_RUN' : 'FAILED', error: String(error?.stack ?? error) }; return false }
  }
  async function spawn(argv, extraSignal = AbortSignal.any([signal, AbortSignal.timeout(90000)])) {
    check()
    const confined = await ctx.sandbox.confine(argv, policy(), extraSignal)
    check()
    requireThat(['full', 'partial'].includes(confined.enforcement), 'Unknown native enforcement')
    report.nativeBoundary = { enforcement: confined.enforcement, strictOnlyRunRootProved: false,
      residual: 'Native Windows ACL: provider-owned private temp, standing workspace ACE, hardlink aliases/read caveats; no extra caller grants.' }
    requireThat(config.acceptNativeProviderPrivateTempAndPartial === true || confined.enforcement === 'full',
      'NOT_RUN: native partial/private-temp boundary needs explicit parent acceptance; no unconfined fallback')
    report.processes ??= []
    const row = { argv, confinedArgv: confined.argv, policy: policy(), enforcement: confined.enforcement,
      denialSignatures: confined.denialSignatures, runnerFailureRules: confined.runnerFailureRules }
    report.processes.push(row)
    const handle = ctx.subprocess.spawn({ argv: confined.argv, cwd: root, graceMs: 1000,
      stdio: { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }, signal: extraSignal,
      env: { TEMP: join(root, 'tmp'), TMP: join(root, 'tmp'), TMPDIR: join(root, 'tmp'), PYTHONDONTWRITEBYTECODE: '1',
        PYTHONPATH: '', PYTHONHOME: '', NODE_OPTIONS: '', NODE_PATH: '' } })
    handles.add(handle)
    try {
      const outcome = await handle.done
      row.outcome = outcome
      requireThat(await handle.waitForExit(), 'Managed process did not become quiescent')
      extraSignal.throwIfAborted()
      check()
      requireThat(outcome.exitCode === 0, `Native process exit ${outcome.exitCode}; inspect inherited native logs`)
    } finally {
      handle.terminate()
      requireThat(await handle.waitForExit(), 'Process termination did not join')
      handles.delete(handle)
    }
  }
  async function python(action, request = input) {
    const source = await bytes('technical_producer.py')
    requireThat(hash(source.data) === SHA, 'Fixed script SHA changed before native execution')
    return spawn([dependencies.python, '-I', '-B', script, request, action])
  }
  async function run() {
    if (!await operation('author', async () => {
      requireThat(typeof config?.authorSessionId === 'string' && !config.authorSessionId.startsWith('PARENT_BIND'),
        'NOT_CONFIGURED: parent must bind actual managed DSH_SESSION_ID, not harness delegation UUID')
      actor = ctx.agents.get(config.authorSessionId)
      requireThat(actor?.session?.header?.cwd && isAbsolute(actor.session.header.cwd), 'NOT_RUN: exact native author Session not live')
      originalPolicy = ctx.sandboxPolicy.resolve({ session: actor.session })
      originalCwd = ctx.workingDirectory.get(actor.session)
      check()
      return { sessionId: actor.id, nativeHeaderCwd: actor.session.header.cwd, effectiveCwd: originalCwd, originalPolicy }
    })) return
    if (!await operation('root', async () => {
      root = resolve(config.runRoot)
      requireThat(basename(root) === RUN && basename(dirname(root)) === 'runs' && basename(dirname(dirname(root))) === 'p4-office-native',
        'Only this unique marked test runRoot is admitted')
      await noLinks(root)
      requireThat(!await ctx.fs.lstat(root, { cwd: actor.session.header.cwd }, signal), 'Run root already exists; preserve history and use a new identity')
      rootTarget = await ctx.fs.resolve(root, { signal })
      requireThat(ctx.fs.contains(await ctx.fs.resolve(originalPolicy.workspaceRoot, { signal }), rootTarget), 'Run root outside original native policy')
      await text('RUN_ROOT.json', { runId: RUN, trust: TRUST, authorSessionId: actor.id, root, noBusinessClaims: true })
      await ctx.fs.writeText(await ctx.fs.resolve(join(root, 'tmp', 'OWNED.json'), { signal }), TRUST,
        { kind: 'createIfAbsent' }, signal, policy())
      return { root, policy: policy() }
    })) return
    if (!await operation('authorRuntimeBinding', async () => {
      requireThat(config.bindings?.source === 'CREATOR_TOOL_AND_SKILL_SUPPLIED', 'Trusted author binding required')
      const manifest = JSON.parse(new TextDecoder().decode(await ctx.fs.readBytes(await ctx.fs.resolve(join(config.primaryRuntimeSource, 'runtime.json'), { signal }), signal, 8000)))
      requireThat(manifest.payloadDigest === config.bindings.payloadDigest && manifest.platform === 'win32' && manifest.arch === 'x64', 'Selected payload manifest changed')
      dependencies = {}
      for (const key of ['python', 'node']) {
        const mapped = ctx.fs.processPathFromHostPath(config.bindings[key])
        requireThat(mapped, 'Author executable has no execution-world mapping')
        dependencies[key] = await ctx.subprocess.resolveExecutable(mapped, undefined, signal)
      }
      check()
      return { resolved: dependencies, bindingSource: config.bindings.source, publicPackageResolverVerified: false, payloadDigest: manifest.payloadDigest }
    })) return
    await operation('authorKitBinding', async () => {
      kit = { cliPath: ctx.fs.processPathFromHostPath(config.bindings.kitCli), bindingSource: 'OFFICE_RECALCULATE_SKILL_EXACT_PATH', discoverRuntimeVerified: false }
      requireThat(kit.cliPath && (await ctx.fs.stat(await ctx.fs.resolve(kit.cliPath, { signal }), signal))?.type === 'file', 'Skill-supplied installed Kit CLI unavailable')
      check()
      return kit
    })
    if (!await operation('producerHash', async () => {
      const host = fileURLToPath(new URL('./technical_producer.py', import.meta.url))
      const mapped = ctx.fs.processPathFromHostPath(host)
      requireThat(mapped, 'Fixed producer asset has no interpreter-readable mapping')
      const source = await ctx.fs.readBytes(await ctx.fs.resolve(mapped, { signal }), signal, 32000)
      requireThat(hash(source) === SHA, 'Packaged fixed producer SHA mismatch')
      script = await text('technical_producer.py', new TextDecoder('utf-8', { fatal: true }).decode(source))
      input = await text('input.json', { root, runId: RUN, trust: TRUST, inputs: [17, 25], pdfBase64: null })
      return { sha256: SHA, script }
    })) return
    const created = await operation('createAndReopen', async () => {
      await python('create')
      return { structure: JSON.parse(new TextDecoder().decode((await bytes('structure-check.json')).data)) }
    })
    if (created && kit) {
      const recalc = await operation('recalculate', async () => {
        await spawn([dependencies.node, kit.cliPath, 'recalculate', '--input', join(root, 'technical-source.xlsx'),
          '--output', join(root, 'technical-recalculated.xlsx')])
      })
      if (recalc) await operation('verifyCached42', async () => {
        await python('verify-recalc')
        return JSON.parse(new TextDecoder().decode((await bytes('recalculation-check.json')).data))
      })
    }
    let pdf
    if (created) await operation('pdfConvert', async () => {
      const service = ctx.get('officeToPdf')
      requireThat(service, 'Native officeToPdf is not configured')
      const source = await bytes('technical.docx')
      pdf = await service.convert({ extension: 'docx', priority: 'foreground', source: {
        key: JSON.stringify([actor.id, root, source.item.targetKey]), version: source.version,
        bytes: source.data.length, read: async (upstream, maxBytes) => {
          check()
          const fresh = await bytes('technical.docx', upstream, maxBytes)
          requireThat(fresh.version === source.version, 'PDF source changed')
          return { bytes: fresh.data, version: fresh.version }
        } } }, signal)
      check()
      requireThat(pdf.pdf.length > 5 && pdf.pdf.length <= CAP && new TextDecoder().decode(pdf.pdf.subarray(0, 5)) === '%PDF-', 'Invalid native PDF')
      return { bytes: pdf.pdf.length, sha256: hash(pdf.pdf), missingFonts: pdf.missingFonts, generation: pdf.generation }
    })
    if (pdf) await operation('pdfPublish', async () => {
      const request = await text('pdf-input.json', { root, runId: RUN, trust: TRUST, inputs: [17, 25], pdfBase64: Buffer.from(pdf.pdf).toString('base64') })
      await python('publish-pdf', request)
    })
    await operation('cancelTerminateJoin', async () => {
      requireThat(hash((await bytes('technical_producer.py')).data) === SHA, 'Fixed cancellation script SHA changed')
      const cancel = new AbortController()
      const stopped = AbortSignal.any([signal, cancel.signal])
      const promise = spawn([dependencies.python, '-I', '-B', script, input, 'cancel'], stopped)
      const settled = promise.then(() => ({ resolved: true }), error => ({ error: String(error) }))
      let ready = false
      for (let count = 0; count < 100; count++) {
        if (await ctx.fs.stat(await target('cancellation.started.json'), signal)) { ready = true; break }
        await pause(50)
      }
      cancel.abort(new Error('TECHNICAL_TEST_ONLY intentional cancellation'))
      const outcome = await settled
      requireThat(ready && !outcome.resolved && handles.size === 0, 'Cancellation did not start/reject/join as expected')
      requireThat(!await ctx.fs.stat(await target('cancellation.UNEXPECTED.json'), signal), 'Late cancellation write occurred')
      return { started: ready, joined: true, outcome }
    })
  }
  task = run().catch(error => { report.unhandledError = String(error?.stack ?? error) }).finally(async () => {
    for (const handle of handles) { handle.terminate(); await handle.waitForExit().catch(() => false) }
    report.status = Object.values(report.operations).every(row => row.status === 'PASSED') ? 'PASSED' : 'FAILED_OR_NOT_RUN'
    report.finishedAt = new Date().toISOString()
    report.authorAfter = actor ? { liveExact: ctx.agents.get(actor.id) === actor,
      effectiveCwd: ctx.workingDirectory.get(actor.session), policy: ctx.sandboxPolicy.resolve({ session: actor.session }) } : null
    if (rootTarget && !signal.aborted) {
      for (const entry of await ctx.fs.listDir(rootTarget, signal)) if (entry.type === 'file') {
        const data = await bytes(entry.name).catch(() => undefined)
        if (data) report.outputs.push({ path: ctx.fs.processPath(data.item), bytes: data.data.length, sha256: hash(data.data) })
      }
      await text('report.json', report)
    } else console.warn('P4 Office technical probe has no report target:', JSON.stringify(report))
  })
  ctx.effect(() => async () => { lifetime.abort(new Error('Technical fixture unloaded')); for (const handle of handles) handle.terminate(); await task })
}
