/** Disposable TEST_ONLY companion. No HTTP routes, tools, model turns or product navigation. */
import assert from 'node:assert/strict'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { createP2ClientContract } from './contract.js'

export default class FinanceP2ClientTestOnly extends TypertRemoteService {
  static inject = ['typert', 'financeOperations', 'workspaceRegistry', 'sessionController']

  constructor(ctx, config) {
    super(ctx, 'financeP2ClientTestOnly')
    assert.ok(isAbsolute(config.bundleRoot), 'TEST_ONLY bundleRoot must be absolute')
    this.root = config.bundleRoot
    this.run = undefined
    this.used = false
    this.finished = false
    this.tail = Promise.resolve()
    this.diagnosticTail = Promise.resolve()
    this.diagnostic = { schemaVersion: 1, package: '@local/dsh-financial-services-p2-client-retry-3',
      status: 'NOT_RUN', financialExecution: 'NOT_RUN', diagnosticOperationsMutateBinding: false, checkpoints: [] }
  }

  async* [Service.init]() {
    await this.recordDiagnostic('HOST_INIT_ENTERED')
    const { remote, schemas } = createP2ClientContract(z)
    this.schemas = schemas
    yield () => this.cleanupOnUnload()
    try {
      yield this.ctx.typert.register({
        package: remote.package, face: 'host',
        schemas: Object.entries(schemas).map(([name, schema]) => ({ name, create: () => schema })),
        model: { services: [], events: [], objects: [] }, invocations: remote.descriptors,
      })
      await this.recordDiagnostic('HOST_REMOTE_REGISTERED')
    } catch (error) {
      await this.recordDiagnostic('HOST_REMOTE_REGISTRATION_FAILED')
      throw error
    }
    // One deadline, not polling. It writes evidence only and never touches binding or registry.
    this.noReportTimer = setTimeout(() => {
      void this.serial(async () => {
        if (this.run || this.finished) return
        await this.recordDiagnostic('NO_CLIENT_REPORT_WITHIN_45_SECONDS')
        await this.writeNoRunReport('No Client finish/begin received; inspect P2-client-diagnostic.json. Activation is not verified.')
      }).catch(error => this.ctx.logger.error('TEST_ONLY diagnostic write failed: %s', String(error)))
    }, 45_000)
    this.noReportTimer.unref?.()
    yield () => clearTimeout(this.noReportTimer)
  }

  recordDiagnostic(stage, services = []) {
    const task = this.diagnosticTail.then(async () => {
      this.diagnostic.checkpoints.push({ stage, at: new Date().toISOString(), services })
      this.diagnostic.lastStage = stage
      await mkdir(join(this.root, 'acceptance'), { recursive: true })
      await writeFile(join(this.root, 'acceptance', 'P2-client-diagnostic.json'), JSON.stringify(this.diagnostic, null, 2) + '\n')
    })
    this.diagnosticTail = task.catch(() => {})
    return task
  }

  async writeNoRunReport(reason) {
    await mkdir(join(this.root, 'acceptance'), { recursive: true })
    await writeFile(join(this.root, 'acceptance', 'P2-live-client.json'), JSON.stringify({
      schemaVersion: 1, status: 'NOT_RUN', reason, noWorkspaceAllocated: !this.used,
      actualMouseClick: 'NOT_VERIFIED', visualRendering: 'NOT_VERIFIED', financialExecution: 'NOT_RUN',
      diagnostic: 'P2-client-diagnostic.json',
    }, null, 2) + '\n')
  }

  async checkpoint(request) {
    const input = this.schemas.CheckpointRequest.parse(request)
    await this.recordDiagnostic(input.stage, input.services)
    return { recorded: true }
  }

  async baseline(request) {
    this.schemas.BaselineRequest.parse(request)
    const snapshot = await this.ctx.financeOperations.snapshot({})
    return { snapshotJson: JSON.stringify(snapshot) }
  }

  begin(request) {
    const input = this.schemas.BeginRequest.parse(request)
    return this.serial(async () => {
      assert.equal(this.used, false, 'One run per fixture activation; reinstall/reload deliberately to rerun')
      this.used = true
      await this.recordDiagnostic('HOST_BEGIN_RECEIVED')
      const root = await realpath(this.root)
      const directory = join(root, 'tests', 'p2-client', 'runs', `TEST_ONLY-${input.runId}`)
      // A UUID-owned new directory cannot contain a pre-existing user Workspace or draft.
      await mkdir(directory, { recursive: false }).catch(async error => {
        if (error.code !== 'ENOENT') throw error
        await mkdir(join(root, 'tests', 'p2-client', 'runs'), { recursive: true })
        await mkdir(directory, { recursive: false })
      })
      await writeFile(join(directory, 'TEST_ONLY-ownership.json'), JSON.stringify({ runId: input.runId, kind: 'TEST_ONLY_NON_FINANCIAL' }) + '\n', { flag: 'wx' })
      const original = await this.ctx.financeOperations.snapshot({})
      assert.ok(original.binding === null || original.workspaceStatus === 'READY', 'Original binding is not restorable: refuse test binding mutation')
      const existing = new Set(this.ctx.workspaceRegistry.list().map(item => item.id))
      assert.equal(await this.ctx.workspaceRegistry.resolveByPath(directory), undefined)
      const workspace = await this.ctx.workspaceRegistry.create(directory, `TEST_ONLY P2 Client ${input.runId}`)
      assert.ok(!existing.has(workspace.id))
      const run = this.run = {
        runId: input.runId, directory, workspaceId: workspace.id, original,
        baselineSessionIds: new Set(workspace.sessionIds), inspections: [],
        restoredBinding: false, removedOwnedRegistry: false,
      }
      // Deadline is teardown, never polling; an abandoned browser cannot leave a test binding indefinitely.
      run.watchdog = setTimeout(() => {
        void this.serial(() => this.finishRun(run, { status: 'FAIL', reason: 'Client did not finish within 180 seconds', checks: [] }))
          .catch(error => this.ctx.logger.error('TEST_ONLY cleanup failed: %s', String(error)))
      }, 180_000)
      run.watchdog.unref?.()
      return { runId: run.runId, workspaceId: run.workspaceId, path: workspace.path, baselineJson: JSON.stringify(original) }
    })
  }

  inspect(request) {
    const input = this.schemas.InspectRequest.parse(request)
    return this.serial(async () => {
      const run = this.requireRun(input.runId)
      const workspace = this.ctx.workspaceRegistry.get(run.workspaceId)
      assert.ok(workspace?.sessionIds.includes(input.sessionId), 'Refuse inspection outside the owned Workspace')
      assert.ok(!run.baselineSessionIds.has(input.sessionId), 'Expected a newly created Session')
      const inspected = await this.ctx.sessionController.inspect(input.sessionId, AbortSignal.timeout(15_000))
      assert.equal(inspected.meta.cwd, workspace.path)
      assert.equal(inspected.meta.agentPreset, input.agentPreset)
      assert.equal(inspected.meta.origin, undefined)
      const eventTypes = inspected.events.map(event => event.type)
      assert.ok(!eventTypes.some(type => /^(turn\/|step\/|user\/message|assistant\/|tool\/|request\/)/.test(type)), 'Draft unexpectedly submitted or model activity present')
      const result = { sessionId: input.sessionId, agentPreset: input.agentPreset, cwd: workspace.path, blank: true, modelTurns: 0, eventTypes }
      run.inspections.push(result)
      return result
    })
  }

  finish(request) {
    const input = this.schemas.FinishRequest.parse(request)
    return this.serial(async () => {
      clearTimeout(this.noReportTimer)
      await this.recordDiagnostic('HOST_FINISH_RECEIVED')
      if (this.run) return this.finishRun(this.requireRun(input.runId), JSON.parse(input.clientReportJson))
      assert.equal(this.finished, false, 'Finished run cannot be overwritten')
      this.used = true
      this.finished = true
      const reportPath = join(this.root, 'acceptance', 'P2-live-client.json')
      const client = JSON.parse(input.clientReportJson)
      await mkdir(join(this.root, 'acceptance'), { recursive: true })
      await writeFile(reportPath, JSON.stringify({ schemaVersion: 1, runId: input.runId, status: client.status ?? 'PARTIAL',
        evidence: 'PROGRAMMATIC_PRODUCTION_CALLBACK_AND_NATIVE_UI_DOMAIN',
        actualMouseClick: 'NOT_VERIFIED', visualRendering: 'NOT_VERIFIED', financialExecution: 'NOT_RUN',
        client, noWorkspaceAllocated: true,
      }, null, 2) + '\n')
      return { reportPath, restoredBinding: true, removedOwnedRegistry: true }
    })
  }

  serial(operation) {
    const task = this.tail.then(operation)
    this.tail = task.catch(() => {})
    return task
  }

  requireRun(runId) {
    assert.equal(this.run?.runId, runId, 'No matching active TEST_ONLY run')
    return this.run
  }

  async finishRun(run, clientReport) {
    clearTimeout(run.watchdog)
    const cleanup = []
    try {
      const current = await this.ctx.financeOperations.snapshot({})
      const stillOriginal = current.revision === run.original.revision
        && JSON.stringify(current.binding) === JSON.stringify(run.original.binding)
      if (current.binding?.workspaceId === run.workspaceId || stillOriginal) {
        // A CAS write of the original binding also fences a delayed bind callback still carrying
        // the pre-run revision. An external rebind, even to our path, is never overwritten.
        assert.equal(current.revision, run.original.revision + (stillOriginal ? 0 : 1), 'Concurrent binding change: leave user state untouched')
        const result = run.original.binding
          ? await this.ctx.financeOperations.bindWorkspace({ path: run.original.binding.path, expectedRevision: current.revision })
          : await this.ctx.financeOperations.unbindWorkspace({ expectedRevision: current.revision })
        assert.equal(result.status, run.original.binding ? 'BOUND' : 'UNBOUND')
        assert.equal(result.snapshot.binding?.workspaceId ?? null, run.original.binding?.workspaceId ?? null)
        assert.equal(result.snapshot.binding?.path ?? null, run.original.binding?.path ?? null)
        run.restoredSnapshot = result.snapshot
        run.restoredBinding = true
      } else {
        // No fixture bind (or an external change) is not permission to overwrite the current binding.
        run.restoredBinding = current.revision === run.original.revision
          && JSON.stringify(current.binding) === JSON.stringify(run.original.binding)
        if (!run.restoredBinding) cleanup.push({ status: 'FAIL', reason: 'External binding change; no overwrite attempted' })
      }
    } catch (error) { cleanup.push({ status: 'FAIL', reason: String(error) }) }
    try {
      const owner = JSON.parse(await readFile(join(run.directory, 'TEST_ONLY-ownership.json'), 'utf8'))
      assert.equal(owner.runId, run.runId)
      assert.equal(owner.kind, 'TEST_ONLY_NON_FINANCIAL')
      const current = await this.ctx.financeOperations.snapshot({})
      assert.notEqual(current.binding?.workspaceId, run.workspaceId, 'Do not remove a still-bound Workspace')
      const workspace = this.ctx.workspaceRegistry.get(run.workspaceId)
      if (workspace) {
        assert.equal(workspace.path, await realpath(run.directory))
        assert.equal(await this.ctx.workspaceRegistry.delete(run.workspaceId), true)
      }
      run.removedOwnedRegistry = true
    } catch (error) { cleanup.push({ status: 'FAIL', reason: String(error) }) }
    const reportPath = join(this.root, 'acceptance', 'P2-live-client.json')
    const report = {
      schemaVersion: 1, runId: run.runId, finishedAt: new Date().toISOString(),
      evidence: 'PROGRAMMATIC_PRODUCTION_CALLBACK_AND_NATIVE_UI_DOMAIN',
      actualMouseClick: 'NOT_VERIFIED', visualRendering: 'NOT_VERIFIED', financialExecution: 'NOT_RUN',
      client: clientReport, hostInspections: run.inspections,
      cleanup: { restoredBinding: run.restoredBinding, removedOwnedRegistry: run.removedOwnedRegistry, issues: cleanup },
      bindingRestore: { before: run.original.binding, beforeRevision: run.original.revision,
        after: run.restoredSnapshot?.binding ?? null, afterRevision: run.restoredSnapshot?.revision ?? null },
      ownership: { directory: run.directory, workspaceId: run.workspaceId, filesRetained: true, historyRetained: true },
    }
    report.status = cleanup.length || clientReport.status === 'FAIL' ? 'FAIL' : clientReport.status ?? 'PARTIAL'
    await mkdir(join(this.root, 'acceptance'), { recursive: true })
    await writeFile(join(run.directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
    this.run = undefined
    this.finished = true
    return { reportPath, restoredBinding: run.restoredBinding, removedOwnedRegistry: run.removedOwnedRegistry }
  }

  async cleanupOnUnload() {
    await this.serial(async () => {
      clearTimeout(this.noReportTimer)
      if (this.run) await this.finishRun(this.run, { status: 'FAIL', reason: 'Fixture unloaded before Client completion', checks: [] })
      else if (!this.finished) await this.writeNoRunReport('Fixture unloaded without a Client report; no binding operation performed.')
      await this.recordDiagnostic('HOST_UNLOADED')
    })
  }
}
