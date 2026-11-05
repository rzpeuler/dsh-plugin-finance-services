/** TEST_ONLY authoritative companion: native preset/tool dispatch, never substitutes FinanceData. */
import assert from 'node:assert/strict'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, isAbsolute } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { createP3ClientContract } from './contract.js'
import { createProbeRecorder } from './report-io.js'
const MODELER = 'finance-pitch-agent-modeler', MCP = 'test-mcp-statements', REST = 'test-rest-statements'
const info = error => ({ name: error?.name === 'AssertionError' ? 'AssertionError' : 'Error', code: 'TEST_ONLY_CHECK_FAILED', message: 'Exception text withheld; see checkpoint/check ID.' })
const query = () => ({ capability: 'financial.statements', entity: { scheme: 'ticker', id: 'TOY' }, market: 'US',
  requiredFields: ['revenue', 'ebitda'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z', purpose: 'research', maxAgeSeconds: 3000000,
  targetUnit: { dimension: 'currency', currency: 'USD', scale: 'ones' }, accountingBasis: 'US_GAAP', consolidation: 'consolidated', measurementType: 'actual' })
export default class FinanceP3ClientTestOnly extends TypertRemoteService {
  static inject = ['typert', 'financeData', 'financeOperations', 'financeTestMcpAdapter', 'financeTestRestAdapter', 'agents', 'agentPresets', 'tools']
  constructor(ctx, config) {
    super(ctx, 'financeP3ClientTestOnly')
    assert.ok(isAbsolute(config.bundleRoot)); this.root = config.bundleRoot; this.packageName = config.packageName
    this.tail = Promise.resolve(); this.used = false; this.closed = false
  }
  serial(fn) { const task = this.tail.then(fn); this.tail = task.catch(() => {}); return task }
  json(value) { return { json: JSON.stringify(value) } }
  catalog() { return JSON.parse(this.ctx.financeData.catalog({}).catalogJson) }
  async *[Service.init]() {
    this.root = await realpath(this.root); this.runId = randomUUID()
    this.runRoot = join(this.root, 'tests/p3-client/runs', `TEST_ONLY-${this.runId}`)
    await mkdir(this.runRoot, { recursive: true })
    this.marker = join(this.runRoot, 'TEST_ONLY-ownership.json')
    await writeFile(this.marker, JSON.stringify({ kind: 'TEST_ONLY_P3_CLIENT', runId: this.runId, ownedScopeIds: [] }) + '\n', { flag: 'wx' })
    this.evidence = { schemaVersion: 1, packageName: this.packageName, runId: this.runId, status: 'RUNNING',
      evidence: 'REAL_CONNECTED_CLIENT_PRODUCTION_CALLBACKS_AND_NATIVE_RESOURCES_NOT_VISUAL', checks: [], checkpoints: [], dispatches: [],
      modelTurns: 0, modelCalls: 0, noModel: true, actualMouseClick: 'NOT_VERIFIED', visualRendering: 'NOT_VERIFIED', commercialExecution: 'NOT_VERIFIED',
      userDraftRead: false, navigationChanged: false, defaultBindingChanged: false, filesRetained: true, historyRetained: true }
    this.recorder = await createProbeRecorder({ runRoot: this.runRoot, latestPath: join(this.root, 'tests/p3-client/latest.json'), report: this.evidence, checkpointEvery: 1 })
    yield () => this.serial(() => this.finish({ status: 'FAIL', checks: [{ id: 'fixture-unload-before-report', status: 'FAIL' }] }))
    const { remote, schemas } = createP3ClientContract(z, this.packageName); this.schemas = schemas
    yield this.ctx.typert.register({ package: remote.package, face: 'host', model: { services: [], events: [], objects: [] },
      schemas: Object.entries(schemas).map(([name, schema]) => ({ name, create: () => schema })), invocations: remote.descriptors })
    await this.record('HOST_REMOTE_REGISTERED')
    this.deadline = setTimeout(() => { void this.serial(() => this.finish({ status: 'FAIL', checks: [{ id: 'client-report-deadline', status: 'FAIL' }] })).catch(() => {}) }, 180000)
    this.deadline.unref?.(); yield () => clearTimeout(this.deadline)
  }
  async record(stage) {
    this.evidence.checkpoints.push({ stage, at: new Date().toISOString() })
    await this.recorder.record({ id: stage, status: 'CHECKPOINT' })
  }
  checkpoint(request) { const { stage } = this.schemas.Checkpoint.parse(request); return this.serial(async () => { await this.record(stage); return this.json({ recorded: true, runId: this.runId }) }) }
  report(request) {
    this.schemas.Empty.parse(request)
    return this.json({ runId: this.runId, status: this.evidence.status, stage: this.evidence.checkpoints.at(-1)?.stage,
      catalog: this.catalog(), finalized: this.closed, modelTurns: this.evidence.modelTurns })
  }
  setup(request) {
    this.schemas.Empty.parse(request)
    return this.serial(async () => {
      assert.equal(this.used, false); assert.equal(this.closed, false); this.used = true
      await this.record('HOST_SETUP_STARTED')
      const baseline = await this.ctx.financeOperations.snapshot({})
      assert.equal(baseline.binding, null); assert.equal(baseline.revision, 19)
      this.baseline = baseline; this.policyOriginal = this.catalog()
      this.toyOriginal = [this.ctx.financeTestMcpAdapter, this.ctx.financeTestRestAdapter].map(control => control.getSnapshot())
      for (const control of [this.ctx.financeTestMcpAdapter, this.ctx.financeTestRestAdapter]) {
        assert.equal(control.getSnapshot().state, 'READY'); assert.equal(control.diagnostics().failureArmed, false)
      }
      const directory = join(this.runRoot, 'workspace'); await mkdir(directory)
      this.directory = await realpath(directory)
      this.handle = await this.ctx.agents.create({ sessionId: `p3-client-${randomUUID()}`, meta: { cwd: this.directory, agentPreset: MODELER },
        signal: AbortSignal.timeout(15000), setup: async agentCtx => { await this.ctx.agentPresets.mount(agentCtx, MODELER) } })
      this.agent = this.handle.agent
      await writeFile(this.marker, JSON.stringify({ kind: 'TEST_ONLY_P3_CLIENT', runId: this.runId, ownedScopeIds: [this.agent.id] }) + '\n')
      assert.equal(this.ctx.agents.get(this.agent.id), this.agent); assert.equal(this.ctx.agentPresets.composedPreset(this.agent.ctx), MODELER)
      const role = await this.ctx.financeOperations.roleDefinition(MODELER)
      assert.equal(this.ctx.financeOperations.isRoleRuntimeActive(this.agent, MODELER, { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 }), true)
      assert.deepEqual(role.allowedMcpServers, ['capiq', 'daloopa']); assert.ok(this.ctx.tools.get('finance_data_query', this.agent))
      this.evidence.baseline = { binding: null, revision: baseline.revision, dataPolicyRevision: this.policyOriginal.revision, dataPolicyBindings: this.policyOriginal.bindings }
      this.evidence.ownedScopeId = this.agent.id
      await this.record('HOST_SETUP_READY')
      return this.json({ runId: this.runId, ownedScopeId: this.agent.id, roleId: MODELER, status: 'READY', sources: role.allowedMcpServers,
        baseline: { binding: null, revision: baseline.revision }, catalog: this.catalog() })
    })
  }
  requireRun(request, schema = 'Run') {
    const input = this.schemas[schema].parse(request); assert.equal(input.runId, this.runId); assert.equal(this.closed, false)
    assert.ok(this.agent); assert.equal(this.ctx.agents.get(this.agent.id), this.agent); return input
  }
  queryOwned(request) {
    return this.serial(async () => {
      this.requireRun(request)
      const result = await this.ctx.agents.withInitiator(this.agent, () => this.ctx.tools.execute({ agent: this.agent, name: 'finance_data_query',
        arguments: { action: 'query', capability: 'financial.statements', query_json: JSON.stringify(query()) }, callId: `p3-client-query-${randomUUID()}`, signal: AbortSignal.timeout(15000) }))
      assert.equal(result.isError, false); assert.equal(result.value.trust, 'UNTRUSTED_DATA')
      const data = JSON.parse(result.value.result_json)
      const observations = (data.data?.observations ?? []).map(o => ({ field: o.field, value: o.value, licenseClass: o.licenseClass,
        adapterId: o.provenance.adapterId, testOnly: o.provenance.testOnly, originalValue: o.provenance.originalValue }))
      const output = { status: data.status, observations, trace: (data.trace ?? []).map(t => ({ adapterId: t.adapterId, code: t.code })) }
      this.evidence.dispatches.push(output); await this.record('HOST_OWNED_NATIVE_QUERY'); return this.json(output)
    })
  }
  toggleToyState(request) {
    return this.serial(async () => {
      const { state } = this.requireRun(request, 'Toggle')
      this.ctx.financeTestMcpAdapter.setState(state, state === 'NOT_AUTHORIZED' ? 'FIXTURE_NOT_AUTHORIZED' : undefined)
      await this.record(`HOST_TOY_${state}`); return this.json({ state, catalog: this.catalog() })
    })
  }
  finalize(request) {
    const input = this.schemas.Finish.parse(request); assert.equal(input.runId, this.runId)
    const client = JSON.parse(input.clientReportJson)
    assert.ok(['PASS', 'FAIL', 'PARTIAL'].includes(client.status)); assert.ok(Array.isArray(client.checks)); assert.ok(client.checks.length <= 64)
    return this.serial(() => this.finish(client))
  }
  async finish(client) {
    if (this.closed) return this.json(this.receipt)
    clearTimeout(this.deadline)
    const cleanup = [], check = async (id, operation) => {
      try { cleanup.push({ id, status: 'PASS', detail: await operation() }) }
      catch (error) { cleanup.push({ id, status: 'FAIL', error: info(error) }) }
    }
    await check('remove-only-owned-scopes-fresh-cas', async () => {
      const marker = JSON.parse(await readFile(this.marker, 'utf8')); assert.equal(marker.kind, 'TEST_ONLY_P3_CLIENT'); assert.equal(marker.runId, this.runId)
      if (!this.agent) return { noOwnedAgent: true }
      assert.ok(marker.ownedScopeIds.includes(this.agent.id))
      const before = this.catalog(), kept = before.bindings.flatMap(b => {
        if (![MCP, REST].includes(b.adapterId)) return [b]
        const scopeIds = b.scopeIds.filter(id => id !== this.agent.id)
        return scopeIds.length === b.scopeIds.length ? [b] : scopeIds.length ? [{ ...b, scopeIds }] : []
      })
      if (JSON.stringify(kept) !== JSON.stringify(before.bindings)) {
        const result = await this.ctx.financeData.setBindings({ expectedRevision: before.revision, bindingsJson: JSON.stringify(kept) })
        assert.equal(result.status, 'APPLIED') // No stale restore, retry, or overwrite on concurrent CAS conflict.
      }
      const after = this.catalog(); assert.ok(!after.bindings.some(b => [MCP, REST].includes(b.adapterId) && b.scopeIds.includes(this.agent.id)))
      assert.deepEqual(after.bindings, kept); return { revision: after.revision, preservedOthers: true }
    })
    await check('restore-test-only-statuses', async () => {
      if (!this.toyOriginal) return { unchanged: true }
      for (const [index, control] of [this.ctx.financeTestMcpAdapter, this.ctx.financeTestRestAdapter].entries()) {
        const original = this.toyOriginal[index]; control.setState(original.state, original.code); assert.equal(control.getSnapshot().state, original.state)
      }
      return { states: this.toyOriginal.map(o => o.state) }
    })
    await check('zero-model-turns-and-marker-fenced-disposal', async () => {
      if (!this.handle) return { noOwnedAgent: true, modelTurns: 0 }
      const marker = JSON.parse(await readFile(this.marker, 'utf8')); assert.equal(marker.runId, this.runId); assert.ok(marker.ownedScopeIds.includes(this.agent.id))
      assert.equal(this.agent.session.header.cwd, this.directory); assert.equal(await realpath(this.directory), join(await realpath(this.runRoot), 'workspace'))
      assert.equal(this.ctx.agents.get(this.agent.id), this.agent)
      const turns = this.agent.session.snapshotEvents().filter(e => /^(turn\/|step\/|request\/header|assistant\/|user\/message)/.test(e.type)).length
      this.evidence.modelTurns = turns; assert.equal(turns, 0)
      await this.handle.dispose(); assert.equal(this.ctx.agents.get(this.agent.id), undefined)
      return { exactOwnedAgentDisposed: true, modelTurns: turns, historyRetained: true }
    })
    await check('default-binding-still-null-19', async () => {
      const after = await this.ctx.financeOperations.snapshot({}); assert.equal(after.binding, null); assert.equal(after.revision, 19)
      return { binding: null, revision: 19, nativeSnapshotAwaited: true }
    })
    this.evidence.client = client; this.evidence.checks = [...client.checks, ...cleanup]
    this.evidence.status = client.status === 'PASS' && cleanup.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL'
    this.evidence.finishedAt = new Date().toISOString(); this.evidence.checksPassed = this.evidence.checks.filter(c => c.status === 'PASS').length
    this.evidence.checksFailed = this.evidence.checks.filter(c => c.status === 'FAIL').length
    await this.recorder.finish(); this.closed = true
    this.receipt = { runId: this.runId, status: this.evidence.status, cleaned: cleanup.every(c => c.status === 'PASS'),
      reportPath: join(this.runRoot, 'result.json'), latestPath: join(this.root, 'tests/p3-client/latest.json') }
    return this.json(this.receipt)
  }
}
