import { readFile } from 'node:fs/promises'
import { assetUrl } from '../asset-location.js'
import schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { FinancialDataRegistry } from './registry.js'
import { SourceBindings } from './policy.js'
import { createDataRemoteContract } from './remote.js'

const Policy = z.strictObject({ revision: z.number().int().min(0), bindings: SourceBindings })
const ConfigInput = z.strictObject({ requestTimeoutMs: z.number().int().min(1).max(300000).default(10000), maxConcurrentQueries: z.number().int().min(1).max(128).default(32) })

/** Public injected financeData service; only control-plane methods have Remote descriptors. */
export default class FinanceData extends TypertRemoteService {
  static inject = ['financeOperations', 'agentPresets', 'typert', 'storageDomain']
  static Config = schema.object({ requestTimeoutMs: schema.number().min(1).max(300000).default(10000), maxConcurrentQueries: schema.number().min(1).max(128).default(32) })

  constructor(ctx, config) {
    super(ctx, 'financeData')
    this.config = ConfigInput.parse(config ?? {})
    this.active = false
    this.policyTail = Promise.resolve()
    this.queries = new Map()
  }

  async* [Service.init]() {
    const manifest = JSON.parse(await readFile(assetUrl('agent-manifest.json'), 'utf8'))
    const domain = await this.ctx.storageDomain.open(defineDomain({ name: 'financial_data', version: 1, tables: { policy: domainTable(Policy) } }))
    this.domain = domain
    yield async () => {
      this.active = false
      for (const controllers of this.queries.values()) for (const controller of controllers) controller.abort(new Error('DATA_SERVICE_DISPOSED'))
      this.queries.clear()
      this.registry?.dispose()
      await this.policyTail
      await domain.close()
    }
    const table = domain.table('policy')
    const initialPolicy = table.get('root') ?? { revision: 0, bindings: [] }
    this.registry = new FinancialDataRegistry({ roles: manifest.roles, ...this.config, initialPolicy,
      authorize: context => this.active && this.ctx.get('financeOperations')?.isRoleRuntimeActive(context.agent, context.roleId, context.expectedRevision) === true })
    this.table = table
    this.active = true
    this.ctx.on('agent/disposed', ({ agent }) => {
      const controllers = this.queries.get(agent)
      if (controllers) for (const controller of controllers) controller.abort(new Error('DATA_SCOPE_DISPOSED'))
    })
    const { remote, schemas } = createDataRemoteContract(z)
    this.schemas = schemas
    yield this.ctx.typert.register({ package: remote.package, face: 'host',
      schemas: Object.entries(schemas).map(([name, value]) => ({ name, create: () => value })),
      model: { services: [], events: [], objects: [] }, invocations: remote.descriptors })
  }

  requireRegistry() {
    if (!this.active || !this.registry) throw Object.assign(new Error('Financial data service is not active'), { code: 'DATA_SERVICE_UNAVAILABLE' })
    return this.registry
  }

  /** Same-process Adapter seam; callers own its exact disposer with ctx.effect. */
  registerAdapter(definition) { return this.requireRegistry().registerAdapter(definition) }

  /** Read actual state without credentials or financial payloads. */
  catalog(request) {
    this.schemas.Empty.parse(request)
    return this.schemas.Catalog.parse({ catalogJson: JSON.stringify(this.requireRegistry().catalog()) })
  }

  /** Persist first, then publish; stale expected revisions cannot mutate current policy. */
  setBindings(request) {
    const input = this.schemas.PolicyRequest.parse(request)
    const operation = this.policyTail.then(async () => {
      const registry = this.requireRegistry()
      let candidate
      try { candidate = registry.prepareBindings({ expectedRevision: input.expectedRevision, bindings: JSON.parse(input.bindingsJson) }) }
      catch (error) {
        const conflict = error.code === 'POLICY_CONFLICT'
        return { status: conflict ? 'CONFLICT' : 'REJECTED', revision: registry.policyRevision,
          error: { code: conflict ? 'POLICY_CONFLICT' : 'POLICY_INVALID', message: conflict ? 'Source policy changed; read a fresh catalogue.' : 'Policy exceeds the source role, Session or capability constraints.' } }
      }
      try { await this.table.put('root', candidate) }
      catch {
        return { status: 'REJECTED', revision: registry.policyRevision, error: { code: 'POLICY_SAVE_FAILED', message: 'Source policy was not durably saved; current grants are unchanged.' } }
      }
      if (!this.active) return { status: 'DISPOSED', revision: candidate.revision, error: { code: 'POLICY_SAVED_NOT_PUBLISHED', message: 'Policy saved during disposal; reconnect and read authoritative state.' } }
      registry.commitBindings(candidate)
      return { status: 'APPLIED', revision: candidate.revision, error: null }
    })
    this.policyTail = operation.then(() => undefined, () => undefined)
    return operation
  }

  /** Only an existing exact-role Agent creates this query context; it is never a Remote/model parameter. */
  async queryForAgent(agent, request, signal) {
    const registry = this.requireRegistry()
    const roleId = this.ctx.agentPresets.composedPreset(agent.ctx)
    const role = await this.ctx.financeOperations.roleDefinition(roleId)
    const context = { agent, roleId, scopeId: agent.id,
      expectedRevision: { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 } }
    const controller = new AbortController()
    const controllers = this.queries.get(agent) ?? new Set()
    this.queries.set(agent, controllers)
    controllers.add(controller)
    try { return await registry.query(request, context, signal ? AbortSignal.any([signal, controller.signal]) : controller.signal) }
    finally {
      controllers.delete(controller)
      if (!controllers.size) this.queries.delete(agent)
    }
  }

  /** Coalescing stream of real registration/auth/policy state, not a poll or a second manager. */
  async* follow(request, signal) {
    this.schemas.Empty.parse(request)
    const registry = this.requireRegistry()
    let dirty = true
    let wake
    const changed = () => { dirty = true; wake?.(); wake = undefined }
    const unsubscribe = registry.subscribe(changed)
    const aborted = () => { wake?.(); wake = undefined }
    signal.addEventListener('abort', aborted, { once: true })
    try {
      while (!signal.aborted && this.active) {
        if (dirty) { dirty = false; yield this.catalog({}); continue }
        await new Promise(resolve => { wake = resolve; if (signal.aborted || dirty || !this.active) resolve() })
      }
    } finally { unsubscribe(); signal.removeEventListener('abort', aborted) }
  }
}
