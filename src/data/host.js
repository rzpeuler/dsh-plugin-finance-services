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
function demoteUntrustedPersistedReviews(policy) {
  return { ...policy, bindings: policy.bindings.map(binding => {
    const assessment = binding.sourceId ? binding.licenseAssessment : undefined
    if (!assessment || assessment.assessmentStatus !== 'VERIFIED') return binding
    // Earlier UI builds could persist a self-asserted VERIFIED status. The current
    // Host has no trusted reviewer-principal API, so retain the evidence fields but
    // fail closed until an authenticated Host review flow exists.
    return { ...binding, licenseAssessment: { ...assessment, assessmentStatus: 'REVIEW_REQUIRED', reviewedAt: null } }
  }) }
}
const registryKey = Symbol('financeDataRegistry')
const authorityContextsKey = Symbol('financeDataAuthorityContexts')

function requireRegistry(service) {
  if (!service.active || !service[registryKey]) throw Object.assign(new Error('Financial data service is not active'), { code: 'DATA_SERVICE_UNAVAILABLE' })
  return service[registryKey]
}

async function contextForAgent(service, agent) {
  const exact = await service.contextForAgent(agent)
  const context = { scopeId: exact.scopeId, roleId: exact.roleId, agentId: agent.id }
  service[authorityContextsKey].set(context, exact)
  return context
}
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
    this[registryKey] = undefined
    this[authorityContextsKey] = new WeakMap()
  }

  async* [Service.init]() {
    const manifest = JSON.parse(await readFile(assetUrl('runtime-manifest.json'), 'utf8'))
    const roles = this.rolesFromManifest(manifest)
    const domain = await this.ctx.storageDomain.open(defineDomain({
      name: 'financial_data_current', version: 1, tables: { policy: domainTable(Policy) },
    }))
    this.domain = domain
    yield async () => {
      this.active = false
      for (const controllers of this.queries.values()) for (const controller of controllers) controller.abort(new Error('DATA_SERVICE_DISPOSED'))
      this.queries.clear()
      this[registryKey]?.dispose()
      await this.policyTail
      await domain.close()
    }
    const table = domain.table('policy')
    const initialPolicy = demoteUntrustedPersistedReviews(Policy.parse(table.get('root') ?? { revision: 0, bindings: [] }))
    this.table = table
    this[registryKey] = new FinancialDataRegistry({
      roles, ...this.config, initialPolicy: initialPolicy,
      authorize: context => {
        const exact = context && this[authorityContextsKey].get(context)
        return this.active && Boolean(exact) &&
          this.ctx.get('financeOperations')?.isRoleRuntimeActive(exact.agent, exact.roleId, exact.expectedRevision) === true
      },
    })

    this.active = true
    this.ctx.on('agent/disposed', ({ agent }) => {
      const controllers = this.queries.get(agent)
      if (controllers) for (const controller of controllers) controller.abort(new Error('DATA_SCOPE_DISPOSED'))
    })
    const remoteContract = createDataRemoteContract(z)
    this.schemas = remoteContract.schemas
    yield this.ctx.typert.register({ package: remoteContract.remote.package, face: 'host',
      schemas: Object.entries(remoteContract.schemas).map(([name, value]) => ({ name, create: () => value })),
      model: { services: [], events: [], objects: [] }, invocations: remoteContract.remote.descriptors })
  }

  /** Registry role source; subclasses may supply isolated TEST_ONLY roles in tests. */
  rolesFromManifest(manifest) { return manifest.roles }

  /** Same-process Adapter seam; callers own its exact disposer with ctx.effect. */
  registerAdapter(definition) { return requireRegistry(this).registerAdapter(definition) }

  /** Read current state without credentials or financial payloads. */
  catalog(request) {
    this.schemas.Empty.parse(request)
    return this.schemas.Catalog.parse({ catalogJson: JSON.stringify(requireRegistry(this).catalog()) })
  }

  /** Policy writes use a serialized CAS queue and independent durable domain. */
  setBindings(request) {
    const input = this.schemas.PolicyRequest.parse(request)
    const operation = this.policyTail.then(async () => {
      let registry
      try { registry = requireRegistry(this) }
      catch {
        return this.schemas.PolicyResult.parse({ status: 'DISPOSED', revision: 0,
          error: { code: 'DATA_SERVICE_UNAVAILABLE', message: 'Financial data service is not active.' } })
      }
      let candidate
      try {
        const bindings = JSON.parse(input.bindingsJson)
        if (!Array.isArray(bindings)) throw new Error('Policy bindings must be an array')
        if (bindings.some(binding => binding?.sourceId && binding.licenseAssessment?.assessmentStatus === 'VERIFIED')) {
          // A Client-entered status, URI, permission flag or timestamp is not a
          // trusted legal review. No Host reviewer identity API is available here.
          throw Object.assign(new Error('Trusted Host review is unavailable'), { code: 'LICENSE_REVIEW_REQUIRED' })
        }
        candidate = registry.prepareBindings({ expectedRevision: input.expectedRevision, bindings })
      } catch (error) {
        const conflict = error.code === 'POLICY_CONFLICT'
        const disposed = error.code === 'REGISTRY_DISPOSED'
        const reviewRequired = error.code === 'LICENSE_REVIEW_REQUIRED'
        return this.schemas.PolicyResult.parse({
          status: conflict ? 'CONFLICT' : disposed ? 'DISPOSED' : 'REJECTED',
          revision: registry.policyRevision,
          error: { code: conflict ? 'POLICY_CONFLICT' : disposed ? 'REGISTRY_DISPOSED' :
            reviewRequired ? 'LICENSE_REVIEW_REQUIRED' : 'POLICY_INVALID',
            message: conflict ? 'Source policy changed; read a fresh catalogue.' :
              disposed ? 'Financial data service is not active.' : reviewRequired ?
                'No trusted Host reviewer identity is available; client-entered licensing claims cannot enable a source.' :
                'Policy exceeds the source role, Session or capability constraints.' },
        })
      }
      const stored = Policy.parse({ revision: candidate.revision, bindings: candidate.bindings })
      try { await this.table.put('root', stored) }
      catch {
        return this.schemas.PolicyResult.parse({ status: 'REJECTED', revision: registry.policyRevision,
          error: { code: 'POLICY_SAVE_FAILED', message: 'Policy was not durably saved; current grants are unchanged.' } })
      }
      if (!this.active) return this.schemas.PolicyResult.parse({ status: 'DISPOSED', revision: candidate.revision,
        error: { code: 'POLICY_SAVED_NOT_PUBLISHED', message: 'Policy was saved during disposal; reconnect and read authoritative state.' } })
      try { registry.commitBindings(candidate) }
      catch {
        return this.schemas.PolicyResult.parse({ status: 'DISPOSED', revision: registry.policyRevision,
          error: { code: 'POLICY_NOT_PUBLISHED', message: 'Policy was saved but not published; reconnect and read authoritative state.' } })
      }
      return this.schemas.PolicyResult.parse({ status: 'APPLIED', revision: candidate.revision, error: null })
    })
    this.policyTail = operation.then(() => undefined, () => undefined)
    return operation
  }

  async describeForAgent(agent, capability) {
    return requireRegistry(this).describeCapability(capability, await contextForAgent(this, agent))
  }

  /** Track and abort queries owned by this exact Agent. */
  async trackAgentQuery(agent, signal, operation) {
    const controller = new AbortController()
    const controllers = this.queries.get(agent) ?? new Set()
    this.queries.set(agent, controllers)
    controllers.add(controller)
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    try { return await operation(combined) }
    finally {
      controllers.delete(controller)
      if (!controllers.size) this.queries.delete(agent)
    }
  }

  /** Model queries stay Host/plugin-only and use a Host-created exact role context. */
  async queryForAgent(agent, request, signal) {
    const registry = requireRegistry(this)
    return this.trackAgentQuery(agent, signal, async querySignal => {
      const context = await contextForAgent(this, agent)
      return registry.query(request, context, querySignal)
    })
  }

  /** Coalescing stream of the sole FinanceData catalog, policy and registry state. */
  async* follow(request, signal) {
    this.schemas.Empty.parse(request)
    const registry = requireRegistry(this)
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
