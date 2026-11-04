import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CAPABILITIES, createDataSchemas } from './contracts.js'
import { DataContractError, normalizeObservations } from './normalization.js'
import { SourceBindings, assessSource, compareCandidates } from './policy.js'
const schemas = createDataSchemas(z)
const AdapterState = z.strictObject({ state: z.enum(['READY', 'NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR']), verifiedAt: schemas.Timestamp, code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional() })
const Validation = z.strictObject({ compatible: z.boolean(), code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  licensePermitted: z.boolean().optional(), modelProcessingPermitted: z.boolean().optional(), sessionLoggingPermitted: z.boolean().optional() })
const fault = (code, message) => Object.assign(new Error(message), { code })
const clone = value => structuredClone(value)
const diagnosticCodes = new Set(['NETWORK_UNAVAILABLE', 'TIMEOUT', 'CANCELLED', 'ADAPTER_REMOVED', 'REGISTRY_DISPOSED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE', 'LICENSE_UNAVAILABLE', 'LICENSE_USE_NOT_AUTHORIZED', 'MCP_UNAVAILABLE', 'MCP_NOT_CONFIGURED', 'HTTP_UNAVAILABLE', 'CAPABILITY_UNSUPPORTED', 'MARKET_UNSUPPORTED', 'ENTITY_UNSUPPORTED', 'FIELDS_UNSUPPORTED', 'PERIOD_UNSUPPORTED', 'ADAPTER_INCOMPATIBLE', 'FIXTURE_QUERY_FAILED', 'FIXTURE_UNAVAILABLE', 'FIXTURE_NOT_CONFIGURED', 'FIXTURE_NOT_AUTHORIZED', 'FIXTURE_ERROR', 'FIXTURE_REQUEST_INVALID'])
// Provider exception text and arbitrary vendor codes can contain credentials or client data.
const safeCode = error => diagnosticCodes.has(error?.code) ? error.code : 'ADAPTER_ERROR'

/** A plugin-owned registry, not an MCP manager or a source of financial entitlements. */
export class FinancialDataRegistry {
  constructor({ roles, authorize, now = () => new Date().toISOString(), requestTimeoutMs = 10000, maxConcurrentQueries = 32, initialPolicy = { revision: 0, bindings: [] } }) {
    if (typeof authorize !== 'function') throw new Error('A trusted exact-scope authorizer is required')
    z.number().int().min(1).max(300000).parse(requestTimeoutMs)
    z.number().int().min(1).max(128).parse(maxConcurrentQueries)
    this.roles = new Map(roles.map(role => [role.id, clone(role)]))
    this.authorize = authorize
    this.now = now
    this.requestTimeoutMs = requestTimeoutMs
    this.maxConcurrentQueries = maxConcurrentQueries
    this.adapters = new Map()
    const policy = z.strictObject({ revision: z.number().int().min(0), bindings: SourceBindings }).parse(initialPolicy)
    this.validateBindings(policy.bindings)
    this.bindings = clone(policy.bindings)
    this.policyRevision = policy.revision
    this.policyLifetime = new AbortController()
    this.activeQueries = 0
    this.listeners = new Set()
    this.cachedCatalog = undefined
    this.observerFailures = 0
    this.closed = false
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  changed() {
    this.cachedCatalog = undefined
    for (const listener of this.listeners) {
      try { listener() } catch { this.observerFailures++ } // One observer cannot interrupt revocation or other observers.
    }
  }
  ensureOpen() { if (this.closed) throw fault('REGISTRY_DISPOSED', 'Financial data registry is disposed') }

  /** Adapters supply a real status source, deterministic validation and a read-only query handler. */
  registerAdapter(definition) {
    this.ensureOpen()
    const metadata = schemas.AdapterMetadata.parse(definition.metadata)
    if (this.adapters.size >= 64) throw fault('ADAPTER_LIMIT', 'Adapter registration limit reached')
    if (this.adapters.has(metadata.id)) throw fault('ADAPTER_DUPLICATE', 'Adapter ID is already registered')
    if (typeof definition.query !== 'function' || typeof definition.validate !== 'function'
      || typeof definition.state?.getSnapshot !== 'function' || typeof definition.state?.subscribe !== 'function') throw fault('ADAPTER_INVALID', 'Adapter requires query, validate and an observable status source')
    const record = { metadata, query: definition.query, validate: definition.validate, state: definition.state, lifetime: new AbortController(), disposeState: undefined }
    this.adapters.set(metadata.id, record)
    try {
      this.readState(record)
      record.disposeState = definition.state.subscribe(() => this.changed())
      if (typeof record.disposeState !== 'function') throw fault('ADAPTER_INVALID', 'Status subscription did not return its disposer')
    } catch (error) { this.adapters.delete(metadata.id); throw error }
    this.changed()
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      record.lifetime.abort(fault('ADAPTER_REMOVED', 'Adapter was unregistered'))
      record.disposeState()
      if (this.adapters.get(metadata.id) === record) this.adapters.delete(metadata.id)
      this.changed()
    }
  }

  readState(record) {
    const state = AdapterState.parse(record.state.getSnapshot())
    if (Date.parse(state.verifiedAt) > Date.parse(schemas.Timestamp.parse(this.now()))) throw fault('STATE_INVALID', 'Adapter status verification is in the future')
    return { ...state, ...(state.code ? { code: safeCode(state) } : {}) }
  }

  validateBindings(bindings) {
    for (const binding of bindings) for (const id of binding.roleIds) {
      const role = this.roles.get(id)
      if (!role || role.writer || !role.allowedMcpServers.includes(binding.sourceAllowlistKey)) throw fault('POLICY_ROLE_DENIED', 'Source binding exceeds the original role allowlist')
    }
  }

  /** Validate without publication so the Host can durably save before making a policy visible. */
  prepareBindings(request) {
    this.ensureOpen()
    const input = z.strictObject({ expectedRevision: z.number().int().min(0), bindings: SourceBindings }).parse(request)
    if (input.expectedRevision !== this.policyRevision) throw fault('POLICY_CONFLICT', 'Source policy revision changed')
    this.validateBindings(input.bindings)
    return { revision: this.policyRevision + 1, bindings: clone(input.bindings) }
  }

  /** Publish one saved successor. Host serializes preparation, durable save, and this commit. */
  commitBindings(candidate) {
    this.ensureOpen()
    const input = z.strictObject({ revision: z.number().int().min(1), bindings: SourceBindings }).parse(candidate)
    if (input.revision !== this.policyRevision + 1) throw fault('POLICY_CONFLICT', 'Source policy successor is stale')
    this.validateBindings(input.bindings)
    this.policyLifetime.abort(fault('POLICY_CHANGED', 'Source policy changed during the query'))
    this.policyLifetime = new AbortController()
    this.bindings = clone(input.bindings)
    this.policyRevision = input.revision
    this.changed()
    return { revision: this.policyRevision, bindings: clone(this.bindings) }
  }

  /** Non-persistent core convenience; the Host uses prepare/save/commit instead. */
  setBindings(request) { return this.commitBindings(this.prepareBindings(request)) }

  catalog() {
    if (this.cachedCatalog) return this.cachedCatalog
    const adapters = [...this.adapters.values()].map(record => {
      let state
      try { state = this.readState(record) } catch { state = { state: 'ERROR', code: 'STATE_INVALID', verifiedAt: this.now() } }
      const { credentialRef, ...metadata } = record.metadata
      return { ...clone(metadata), credentialConfigured: Boolean(credentialRef), status: state }
    }).sort((a, b) => a.id.localeCompare(b.id, 'en'))
    this.cachedCatalog = { contractVersion: '1.0.0', revision: this.policyRevision, capabilities: [...CAPABILITIES], adapters, bindings: clone(this.bindings), diagnostics: { observerFailures: this.observerFailures }, commercialExecutionVerified: false }
    return this.cachedCatalog
  }

  /** Query context is created by the Host from the exact Agent, never accepted in model JSON. */
  async query(queryValue, context, signal) {
    this.ensureOpen()
    const query = schemas.Query.parse(queryValue)
    const requestId = randomUUID()
    const trace = []
    const result = (status, data = null) => ({ contractVersion: '1.0.0', requestId, status, policyRevision: this.policyRevision, data, trace })
    const authorized = () => {
      if (this.closed) return false
      try { return this.authorize(context) === true } catch { return false } // A failed scope lookup cannot grant access.
    }
    const role = this.roles.get(context?.roleId)
    if (!authorized() || !role || role.writer || !role.allowedMcpServers.length) return result('ROLE_QUERY_DENIED')
    if (this.activeQueries >= this.maxConcurrentQueries) return result('BUSY')
    const policySignal = this.policyLifetime.signal
    const deadline = AbortSignal.timeout(this.requestTimeoutMs)
    const outerSignal = AbortSignal.any([...(signal ? [signal] : []), deadline, policySignal])
    const candidates = []
    for (const record of this.adapters.values()) {
      const assessment = assessSource(record.metadata, query, role, this.bindings, context.scopeId)
      if (!assessment.accepted) trace.push({ adapterId: record.metadata.id, code: assessment.code })
      else candidates.push({ record, assessment })
    }
    candidates.sort(compareCandidates)
    if (!candidates.length) return result(this.adapters.size === 0 ? 'NOT_CONFIGURED' : trace.some(item => item.code === 'SOURCE_BINDING_REQUIRED') ? 'NOT_AUTHORIZED' : 'UNAVAILABLE')
    this.activeQueries++
    try {
      for (const { record } of candidates) {
        if (!authorized()) return result('SCOPE_REVOKED')
        if (outerSignal.aborted) return result(policySignal.aborted ? 'POLICY_CHANGED' : deadline.aborted ? 'TIMEOUT' : 'CANCELLED')
        const current = () => this.adapters.get(record.metadata.id) === record && !record.lifetime.signal.aborted
        if (!current()) { trace.push({ adapterId: record.metadata.id, code: 'ADAPTER_REMOVED' }); continue }
        let state
        try { state = this.readState(record) } catch { trace.push({ adapterId: record.metadata.id, code: 'STATE_INVALID' }); continue }
        if (state.state !== 'READY') { trace.push({ adapterId: record.metadata.id, code: state.state }); continue }
        const callSignal = AbortSignal.any([outerSignal, record.lifetime.signal])
        const bounded = async operation => {
          callSignal.throwIfAborted()
          let rejectAbort
          const aborted = new Promise((_resolve, reject) => { rejectAbort = () => reject(callSignal.reason ?? fault('CANCELLED', 'Query cancelled')); callSignal.addEventListener('abort', rejectAbort, { once: true }) })
          try { return await Promise.race([Promise.resolve().then(operation), aborted]) }
          finally { callSignal.removeEventListener('abort', rejectAbort) }
        }
        try {
          const validation = Validation.parse(await bounded(() => record.validate(clone(query), { signal: callSignal, requestId })))
          if (!validation.compatible) { trace.push({ adapterId: record.metadata.id, code: validation.code ? safeCode(validation) : 'ADAPTER_INCOMPATIBLE' }); continue }
          if (!record.metadata.testOnly && (!validation.licensePermitted || !validation.modelProcessingPermitted || !validation.sessionLoggingPermitted)) {
            trace.push({ adapterId: record.metadata.id, code: 'LICENSE_USE_NOT_AUTHORIZED' }); continue
          }
          if (!authorized()) return result('SCOPE_REVOKED')
          if (this.readState(record).state !== 'READY') { trace.push({ adapterId: record.metadata.id, code: 'AUTHORIZATION_CHANGED' }); continue }
          const raw = await bounded(() => record.query(clone(query), { signal: callSignal, requestId }))
          if (!authorized()) return result('SCOPE_REVOKED')
          if (outerSignal.aborted) return result(policySignal.aborted ? 'POLICY_CHANGED' : deadline.aborted ? 'TIMEOUT' : 'CANCELLED')
          if (!current()) { trace.push({ adapterId: record.metadata.id, code: 'ADAPTER_REMOVED' }); continue }
          if (this.readState(record).state !== 'READY') { trace.push({ adapterId: record.metadata.id, code: 'AUTHORIZATION_CHANGED' }); continue }
          const data = normalizeObservations(query, raw, record.metadata, this.now())
          trace.push({ adapterId: record.metadata.id, adapterVersion: record.metadata.version, sourceId: record.metadata.sourceId, code: 'SELECTED', testOnly: record.metadata.testOnly })
          return result('OK', data)
        } catch (error) {
          trace.push({ adapterId: record.metadata.id, code: error instanceof DataContractError ? error.code : safeCode(error) })
          // A removed Adapter may fall back; a revoked scope/policy cannot continue.
          if (!authorized()) return result('SCOPE_REVOKED')
          if (outerSignal.aborted) return result(policySignal.aborted ? 'POLICY_CHANGED' : deadline.aborted ? 'TIMEOUT' : 'CANCELLED')
        }
      }
      return result(trace.some(item => ['NOT_AUTHORIZED', 'LICENSE_USE_NOT_AUTHORIZED'].includes(item.code)) ? 'NOT_AUTHORIZED' : 'UNAVAILABLE')
    } finally { this.activeQueries-- }
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    this.policyLifetime.abort(fault('REGISTRY_DISPOSED', 'Registry disposed'))
    for (const record of this.adapters.values()) { record.lifetime.abort(fault('REGISTRY_DISPOSED', 'Registry disposed')); record.disposeState() }
    this.adapters.clear()
    this.changed()
    this.listeners.clear()
  }
}
