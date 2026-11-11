import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CAPABILITIES, createDataSchemas } from './contracts.js'
import { DataContractError, normalizeObservations } from './normalization.js'
import {
  SourceBindings, assessSource, compareCandidates, explicitPermissionsPermitted,
} from './policy.js'

const schemas = createDataSchemas(z)
const RoleId = z.string().min(1).max(128).regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)
const Role = z.object({
  id: RoleId,
  writer: z.boolean(),
  allowedMcpServers: z.array(schemas.Entity.shape.id).max(128),
}).refine(role => new Set(role.allowedMcpServers).size === role.allowedMcpServers.length,
  'Role source allowlist entries must be unique')
const RoleCatalog = z.array(Role).max(128).refine(roles =>
  new Set(roles.map(role => role.id)).size === roles.length, 'Role IDs must be unique')
const HostExecutionContext = z.object({
  scopeId: schemas.Entity.shape.id,
  roleId: RoleId,
  agentId: schemas.Entity.shape.id.optional(),
})
const AdapterState = z.strictObject({
  state: z.enum(['READY', 'NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR']),
  verifiedAt: schemas.Timestamp,
  authenticationStatus: z.enum(['UNKNOWN', 'NOT_REQUIRED', 'AUTHENTICATION_OK', 'AUTHENTICATION_FAILED', 'CREDENTIAL_SERVICE_UNAVAILABLE']).optional(),
  connectionStatus: z.enum(['UNKNOWN', 'CONNECTED', 'DISCONNECTED', 'UNAVAILABLE']).optional(),
  code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional(),
})
const Validation = schemas.AdapterValidation
const PolicyInput = z.strictObject({ revision: z.number().int().min(0), bindings: SourceBindings })
const BindingRequest = z.strictObject({ expectedRevision: z.number().int().min(0), bindings: SourceBindings })
const BindingCandidate = z.strictObject({
  revision: z.number().int().min(1),
  bindings: SourceBindings,
})
const fault = (code, message) => Object.assign(new Error(message), { code })
const clone = value => structuredClone(value)
const DATA_ERRORS = new Set([
  'INVALID_QUERY', 'INVALID_METADATA', 'INVALID_RESULT', 'INVALID_NOW', 'INVALID_NORMALIZED_RESULT',
  'NUMERIC_PRECISION_UNSUPPORTED', 'UNIT_INCOMPATIBLE', 'CURRENCY_INCOMPATIBLE', 'CHRONOLOGY_INVALID',
  'PIT_VIOLATION', 'TEMPORAL_MODE_UNSUPPORTED', 'REVISION_EVIDENCE_INCOMPLETE', 'TEMPORAL_EVIDENCE_INVALID',
  'STALE_DATA', 'CAPABILITY_MISMATCH', 'COVERAGE_MISMATCH', 'PRICE_ADJUSTMENT_UNSUPPORTED',
  'INVALID_CORPORATE_ACTION_RESULT', 'ENTITY_MISMATCH', 'PERIOD_MISMATCH', 'MEASUREMENT_INCOMPATIBLE',
  'ACCOUNTING_BASIS_INCOMPATIBLE', 'CONSOLIDATION_INCOMPATIBLE', 'LICENSE_MISMATCH',
  'PERIOD_NOT_AVAILABLE', 'MISSING_FIELDS', 'CORPORATE_ACTION_DATE_MISSING',
  'CORPORATE_ACTION_DATE_OUT_OF_RANGE', 'CURRENT_ONLY_REQUEST_STALE',
])
const POLICY_CODES = new Set([
  'ROLE_QUERY_DENIED', 'INVALID_POLICY_INPUT', 'CAPABILITY_UNAVAILABLE', 'SOURCE_BINDING_REQUIRED',
  'SOURCE_NOT_SELECTED', 'COVERAGE_INCOMPLETE', 'LICENSE_REVIEW_REQUIRED', 'LICENSE_ASSESSMENT_EXPIRED',
  'PRICE_ADJUSTMENT_UNSUPPORTED',
  'TEMPORAL_MODE_UNSUPPORTED', 'TEMPORAL_QUALITY_UNSUPPORTED', 'CORPORATE_ACTION_DATE_BASIS_UNSUPPORTED',
  'TEST_ONLY_NOT_ALLOWED', 'QUALITY_INSUFFICIENT',
])
const SAFE_ADAPTER_CODES = new Set([
  'NETWORK_UNAVAILABLE', 'TIMEOUT', 'CANCELLED', 'ADAPTER_REMOVED', 'REGISTRY_DISPOSED',
  'NOT_AUTHORIZED', 'UNAVAILABLE', 'NOT_CONFIGURED', 'CREDENTIAL_UNAVAILABLE', 'LICENSE_UNAVAILABLE',
  'LICENSE_USE_NOT_AUTHORIZED', 'MCP_UNAVAILABLE', 'MCP_NOT_CONFIGURED', 'HTTP_UNAVAILABLE',
  'CAPABILITY_UNSUPPORTED', 'MARKET_UNSUPPORTED', 'ENTITY_UNSUPPORTED', 'FIELDS_UNSUPPORTED',
  'PERIOD_UNSUPPORTED', 'ADAPTER_INCOMPATIBLE', 'FIXTURE_QUERY_FAILED', 'FIXTURE_UNAVAILABLE',
  'FIXTURE_NOT_CONFIGURED', 'FIXTURE_NOT_AUTHORIZED', 'FIXTURE_ERROR', 'FIXTURE_REQUEST_INVALID',
])
const safeErrorCode = error => {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (error instanceof DataContractError && DATA_ERRORS.has(code)) return code
  if (POLICY_CODES.has(code)) return code
  return SAFE_ADAPTER_CODES.has(code) ? code : 'ADAPTER_ERROR'
}
const statusCode = state => state.state === 'ERROR' ? safeErrorCode(state) : state.state
const MAX_ADAPTERS = 64
const MAX_TRACE = 64

/** Sole FinanceData registry; Host policy and authorization remain authoritative. */
export class FinancialDataRegistry {
  constructor({
    roles, authorize, now = () => new Date().toISOString(), requestTimeoutMs = 10000,
    maxConcurrentQueries = 32, initialPolicy = { revision: 0, bindings: [] },
  }) {
    if (typeof authorize !== 'function') throw new Error('A trusted exact-scope authorizer is required')
    if (typeof now !== 'function') throw new Error('A trusted Host clock is required')
    z.number().int().min(1).max(300000).parse(requestTimeoutMs)
    z.number().int().min(1).max(128).parse(maxConcurrentQueries)
    const parsedRoles = RoleCatalog.parse(roles)
    this.roles = new Map(parsedRoles.map(role => [role.id, clone(role)]))
    this.authorize = authorize
    this.now = now
    this.requestTimeoutMs = requestTimeoutMs
    this.maxConcurrentQueries = maxConcurrentQueries
    this.adapters = new Map()
    const policy = PolicyInput.parse(initialPolicy)
    this.validateBindings(policy.bindings)
    this.bindings = clone(policy.bindings)
    this.policyRevision = policy.revision
    this.policyLifetime = new AbortController()
    this.activeQueries = 0
    this.listeners = new Set()
    this.cachedCatalog = undefined
    this.observerFailures = 0
    this.disposalFailures = 0
    this.closed = false
    this.clockNow()
  }

  clockNow() {
    return schemas.Timestamp.parse(this.now())
  }

  ensureOpen() {
    if (this.closed) throw fault('REGISTRY_DISPOSED', 'Financial data registry is disposed')
  }

  subscribe(listener) {
    this.ensureOpen()
    if (typeof listener !== 'function') throw fault('SUBSCRIBER_INVALID', 'A change listener is required')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  changed() {
    this.cachedCatalog = undefined
    for (const listener of this.listeners) {
      try { listener() } catch { this.observerFailures++ }
    }
  }

  registerAdapter(definition) {
    this.ensureOpen()
    const parsedMetadata = schemas.AdapterMetadata.safeParse(definition?.metadata)
    if (!parsedMetadata.success) throw fault('ADAPTER_INVALID', 'Adapter metadata did not satisfy the data contract')
    const metadata = clone(parsedMetadata.data)
    if (this.adapters.size >= MAX_ADAPTERS) throw fault('ADAPTER_LIMIT', 'Adapter registration limit reached')
    if (this.adapters.has(metadata.id)) throw fault('ADAPTER_DUPLICATE', 'Adapter ID is already registered')
    if (typeof definition.query !== 'function' || typeof definition.validate !== 'function' ||
      typeof definition.state?.getSnapshot !== 'function' || typeof definition.state?.subscribe !== 'function') {
      throw fault('ADAPTER_INVALID', 'Adapter requires query, validate and an observable status source')
    }
    const record = {
      metadata, query: definition.query, validate: definition.validate, state: definition.state,
      lifetime: new AbortController(), disposeState: undefined, disposed: false,
    }
    this.adapters.set(metadata.id, record)
    try {
      this.readState(record)
      const disposeState = definition.state.subscribe(() => {
        if (!this.closed && !record.disposed && this.adapters.get(metadata.id) === record) this.changed()
      })
      if (typeof disposeState !== 'function') throw fault('ADAPTER_INVALID', 'Status subscription did not return its disposer')
      record.disposeState = disposeState
      // subscribe() may synchronously notify; a registry observer can then retire
      // this record before subscribe() returns its disposer. Detach that late handle.
      if (record.disposed || this.closed || this.adapters.get(metadata.id) !== record) {
        record.disposeState = undefined
        try { disposeState() } catch { this.disposalFailures++ }
        throw fault('ADAPTER_INVALID', 'Adapter was retired while its status subscription was being attached')
      }
    } catch (error) {
      this.retireRecord(record, 'ADAPTER_REMOVED')
      this.changed()
      throw error?.code ? fault(safeErrorCode(error), 'Adapter registration failed') : fault('ADAPTER_INVALID', 'Adapter registration failed')
    }
    this.changed()
    return () => {
      if (this.retireRecord(record, 'ADAPTER_REMOVED')) this.changed()
    }
  }

  /** Revoke internal access before invoking adapter-owned cleanup. */
  retireRecord(record, code) {
    if (record.disposed) return false
    record.disposed = true
    record.lifetime.abort(fault(code, 'Financial Adapter lifetime ended'))
    if (this.adapters.get(record.metadata.id) === record) this.adapters.delete(record.metadata.id)
    try { record.disposeState?.() } catch { this.disposalFailures++ }
    return true
  }

  readState(record) {
    const parsed = AdapterState.safeParse(record.state.getSnapshot())
    if (!parsed.success) throw fault('STATE_INVALID', 'Adapter status did not satisfy the safe state schema')
    const state = parsed.data
    if (Date.parse(state.verifiedAt) > Date.parse(this.clockNow())) {
      throw fault('STATE_INVALID', 'Adapter status verification is in the future')
    }
    const code = state.code ? (SAFE_ADAPTER_CODES.has(state.code) ? state.code : 'ADAPTER_ERROR') : undefined
    return { state: state.state, verifiedAt: state.verifiedAt,
      ...(state.authenticationStatus ? { authenticationStatus: state.authenticationStatus } : {}),
      ...(state.connectionStatus ? { connectionStatus: state.connectionStatus } : {}),
      ...(code ? { code } : {}) }
  }

  validateBindings(bindings) {
    for (const binding of bindings) {
      for (const id of binding.roleIds) {
        const role = this.roles.get(id)
        if (!role || role.writer || (binding.sourceAllowlistKey !== undefined &&
          !role.allowedMcpServers.includes(binding.sourceAllowlistKey)) ||
          (binding.sourceId !== undefined && binding.licenseAssessment?.sourceId !== binding.sourceId) ||
          (binding.licenseAssessment && binding.licenseAssessment.capabilityIds.some(id => !binding.capabilities.includes(id))) ||
          (binding.licenseAssessment && binding.licenseAssessment.allowedPurposes.some(purpose => !binding.purposes.includes(purpose)))) {
          throw fault('POLICY_ROLE_DENIED', 'Source binding exceeds the role or assessed source boundary')
        }
      }
    }
  }

  prepareBindings(request) {
    this.ensureOpen()
    const parsed = BindingRequest.safeParse(request)
    if (!parsed.success) throw fault('POLICY_INVALID', 'Source policy request did not satisfy the policy schema')
    const input = parsed.data
    if (input.expectedRevision !== this.policyRevision) throw fault('POLICY_CONFLICT', 'Source policy revision changed')
    this.validateBindings(input.bindings)
    return { revision: this.policyRevision + 1, bindings: clone(input.bindings) }
  }

  commitBindings(candidate) {
    this.ensureOpen()
    const parsed = BindingCandidate.safeParse(candidate)
    if (!parsed.success) throw fault('POLICY_INVALID', 'Source policy candidate did not satisfy the policy schema')
    const input = parsed.data
    if (input.revision !== this.policyRevision + 1) throw fault('POLICY_CONFLICT', 'Source policy successor is stale')
    this.validateBindings(input.bindings)
    this.policyLifetime.abort(fault('POLICY_CHANGED', 'Source policy changed during the query'))
    this.policyLifetime = new AbortController()
    this.bindings = clone(input.bindings)
    this.policyRevision = input.revision
    this.changed()
    return { revision: this.policyRevision, bindings: clone(this.bindings) }
  }

  setBindings(request) {
    return this.commitBindings(this.prepareBindings(request))
  }

  catalog() {
    if (this.cachedCatalog) return clone(this.cachedCatalog)
    const adapters = [...this.adapters.values()].map(record => {
      let state
      try { state = this.readState(record) } catch { state = { state: 'ERROR', code: 'STATE_INVALID', verifiedAt: this.clockNow() } }
      const { credentialRef, ...metadata } = record.metadata
      const authMode = metadata.authenticationMode ?? 'OTHER'
      const assessmentStatuses = [...new Set(this.bindings
        .filter(binding => binding.adapterId === record.metadata.id && binding.sourceId === record.metadata.sourceId)
        .map(binding => binding.licenseAssessment?.assessmentStatus ?? 'UNKNOWN'))]
      return {
        ...clone(metadata), credentialConfigured: Boolean(credentialRef), status: state,
        registrationStatus: 'REGISTERED', connectionStatus: state.connectionStatus ?? 'UNKNOWN',
        authenticationMode: authMode,
        authenticationStatus: state.authenticationStatus ?? (authMode === 'NONE' ? 'NOT_REQUIRED' : 'UNKNOWN'),
        licenseAssessmentStatuses: assessmentStatuses.length ? assessmentStatuses : ['UNKNOWN'],
      }
    }).sort((left, right) => left.id.localeCompare(right.id, 'en'))
    this.cachedCatalog = {
      revision: this.policyRevision,
      capabilities: [...CAPABILITIES],
      adapters,
      bindings: clone(this.bindings),
      diagnostics: { observerFailures: this.observerFailures, disposalFailures: this.disposalFailures },
      commercialExecutionVerified: false,
    }
    return clone(this.cachedCatalog)
  }

  describeCapability(capabilityValue, context) {
    const capabilityParsed = schemas.Capability.safeParse(capabilityValue)
    const denied = status => ({ status, providers: [] })
    if (this.closed) return denied('REGISTRY_DISPOSED')
    if (!capabilityParsed.success) return denied('INVALID_CAPABILITY')
    const capability = capabilityParsed.data
    const role = this.roles.get(context?.roleId)
    let granted = false
    try { granted = this.authorize(context) === true } catch { /* failed exact-scope lookup denies discovery */ }
    if (!granted || !role || role.writer || !this.validExecutionContext(context)) {
      return denied('ROLE_QUERY_DENIED')
    }
    const providers = []
    for (const record of this.adapters.values()) {
      const coverage = record.metadata.capabilities.find(item => item.id === capability)
      if (!coverage) continue
      const bindings = this.bindings.filter(binding => binding.enabled && binding.adapterId === record.metadata.id &&
        binding.roleIds.includes(role.id) && binding.scopeIds.includes(context.scopeId) &&
        (binding.sourceId !== undefined ? binding.sourceId === record.metadata.sourceId :
          binding.sourceAllowlistKey !== undefined && role.allowedMcpServers.includes(binding.sourceAllowlistKey)) &&
        binding.capabilities.includes(capability) &&
        (!record.metadata.testOnly || binding.allowTestOnly) && coverage.quality >= binding.minQuality)
      if (!bindings.length) continue
      const markets = coverage.markets.filter(market => bindings.some(binding => binding.markets.includes(market)))
      const purposes = [...new Set(bindings.flatMap(binding => binding.purposes))].sort()
      const temporalModes = coverage.temporalModes.filter(mode => bindings.some(binding => binding.temporalModes.includes(mode)))
      if (!markets.length || !purposes.length || !temporalModes.length) continue
      const provider = {
        adapterId: record.metadata.id,
        adapterVersion: record.metadata.version,
        sourceId: record.metadata.sourceId,
        label: record.metadata.label,
        testOnly: record.metadata.testOnly,
        licenseClass: record.metadata.licenseClass,
        authenticationMode: record.metadata.authenticationMode ?? 'OTHER',
        licenseAssessmentStatuses: [...new Set(bindings.map(binding => binding.sourceId !== undefined
          ? binding.licenseAssessment?.assessmentStatus ?? 'UNKNOWN' : 'REVIEW_REQUIRED'))],
        fields: [...coverage.fields],
        markets,
        purposes,
        temporalModes,
        pitQualities: [...(coverage.pitQualities ?? coverage.temporalModes.map(mode =>
          mode === 'current_only' ? 'CURRENT_OBSERVED' : 'STRICT_HISTORICAL'))],
        quality: coverage.quality,
        status: (() => { try { return this.readState(record) } catch { return { state: 'ERROR', code: 'STATE_INVALID', verifiedAt: this.clockNow() } } })(),
        licenseUse: 'PER_REQUEST_VALIDATION_REQUIRED',
      }
      if (capability === 'corporate.actions') {
        provider.corporateActionDateBases = coverage.corporateActionDateBases.filter(dateBasis =>
          bindings.some(binding => binding.corporateActionDateBases?.includes(dateBasis)))
        if (!provider.corporateActionDateBases.length) continue
      }
      if (capability === 'prices.history') {
        // Price adjustments are declared by the capability; bindings do not add this dimension.
        provider.priceAdjustments = [...coverage.priceAdjustments]
      }
      providers.push(provider)
    }
    providers.sort((left, right) => left.adapterId.localeCompare(right.adapterId, 'en'))
    return {
      status: !this.adapters.size ? 'NOT_CONFIGURED' : providers.length ? 'EXPLICIT_SCOPE_GRANTS_FOUND' : 'NOT_AUTHORIZED',
      providers,
    }
  }

  validExecutionContext(context) {
    return HostExecutionContext.safeParse(context).success
  }

  async query(queryValue, context, signal) {
    this.ensureOpen()
    const requestId = randomUUID()
    const queryPolicyRevision = this.policyRevision
    const trace = []
    const result = (status, data = null) => ({
      requestId, status,
      policyRevision: queryPolicyRevision, data, trace: clone(trace.slice(0, MAX_TRACE)),
    })
    const parsedQuery = schemas.Query.safeParse(queryValue)
    if (!parsedQuery.success) return result('INVALID_QUERY')
    const query = parsedQuery.data
    const authorized = () => {
      if (this.closed) return false
      try { return this.authorize(context) === true } catch { return false }
    }
    const hostContext = HostExecutionContext.safeParse(context)
    const role = this.roles.get(context?.roleId)
    if (!hostContext.success || !authorized() || !role || role.writer) {
      return result('ROLE_QUERY_DENIED')
    }
    if (signal !== undefined && !(signal instanceof AbortSignal)) return result('INVALID_SIGNAL')
    if (this.activeQueries >= this.maxConcurrentQueries) return result('BUSY')
    const policyLifetime = this.policyLifetime
    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(fault('TIMEOUT', 'Query deadline elapsed')), this.requestTimeoutMs)
    timeout.unref?.()
    const outerSignal = AbortSignal.any([
      ...(signal ? [signal] : []), timeoutController.signal, policyLifetime.signal,
    ])
    const executionContext = clone(hostContext.data)
    const candidates = []
    for (const record of this.adapters.values()) {
      const assessment = assessSource(record.metadata, query, role, this.bindings, context.scopeId, this.clockNow())
      if (!assessment.accepted) this.appendTrace(trace, { adapterId: record.metadata.id, code: this.publicCode(assessment.code) })
      else candidates.push({ record, assessment })
    }
    candidates.sort(compareCandidates)
    if (!candidates.length) {
      clearTimeout(timeout)
      const deniedCodes = new Set(trace.map(item => item.code))
      const status = this.adapters.size === 0 ? 'NOT_CONFIGURED' :
        [...deniedCodes].some(code => ['ROLE_QUERY_DENIED', 'SOURCE_BINDING_REQUIRED', 'TEST_ONLY_NOT_ALLOWED', 'QUALITY_INSUFFICIENT',
          'LICENSE_REVIEW_REQUIRED', 'LICENSE_ASSESSMENT_EXPIRED', 'LICENSE_USE_NOT_AUTHORIZED'].includes(code))
          ? 'NOT_AUTHORIZED' : 'UNAVAILABLE'
      return result(status)
    }
    this.activeQueries++
    try {
      for (const { record, assessment: sourceAssessment } of candidates) {
        if (!authorized()) return result(this.closed ? 'REGISTRY_DISPOSED' : 'SCOPE_REVOKED')
        if (outerSignal.aborted) return result(this.signalStatus(outerSignal, policyLifetime))
        if (!this.isCurrent(record)) {
          this.appendTrace(trace, { adapterId: record.metadata.id, code: 'ADAPTER_REMOVED' })
          continue
        }
        let state
        try { state = this.readState(record) } catch { this.appendTrace(trace, { adapterId: record.metadata.id, code: 'STATE_INVALID' }); continue }
        if (state.state !== 'READY') {
          this.appendTrace(trace, { adapterId: record.metadata.id, code: statusCode(state) })
          continue
        }
        const callSignal = AbortSignal.any([outerSignal, record.lifetime.signal])
        const execution = () => ({ signal: callSignal, requestId, context: clone(executionContext) })
        const bounded = operation => this.boundedCall(operation, callSignal)
        try {
          const validationValue = await bounded(() => record.validate(clone(query), execution()))
          const parsedValidation = Validation.safeParse(validationValue)
          if (!parsedValidation.success) {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'ADAPTER_INCOMPATIBLE' })
            continue
          }
          const validation = parsedValidation.data
          if (!validation.compatible) {
            this.appendTrace(trace, { adapterId: record.metadata.id,
              code: validation.code ? this.publicCode(validation.code) : 'ADAPTER_INCOMPATIBLE' })
            continue
          }
          if (!record.metadata.testOnly && !sourceAssessment.directSourceGrant && !explicitPermissionsPermitted(validation)) {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'LICENSE_USE_NOT_AUTHORIZED' })
            continue
          }
          if (!authorized()) return result(this.closed ? 'REGISTRY_DISPOSED' : 'SCOPE_REVOKED')
          if (outerSignal.aborted) return result(this.signalStatus(outerSignal, policyLifetime))
          if (!this.isCurrent(record)) {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'ADAPTER_REMOVED' })
            continue
          }
          try { state = this.readState(record) } catch { this.appendTrace(trace, { adapterId: record.metadata.id, code: 'STATE_INVALID' }); continue }
          if (state.state !== 'READY') {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'AUTHORIZATION_CHANGED' })
            continue
          }
          const raw = await bounded(() => record.query(clone(query), execution()))
          if (!authorized()) return result(this.closed ? 'REGISTRY_DISPOSED' : 'SCOPE_REVOKED')
          if (outerSignal.aborted) return result(this.signalStatus(outerSignal, policyLifetime))
          if (!this.isCurrent(record)) {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'ADAPTER_REMOVED' })
            continue
          }
          try { state = this.readState(record) } catch { this.appendTrace(trace, { adapterId: record.metadata.id, code: 'STATE_INVALID' }); continue }
          if (state.state !== 'READY') {
            this.appendTrace(trace, { adapterId: record.metadata.id, code: 'AUTHORIZATION_CHANGED' })
            continue
          }
          const data = normalizeObservations(query, raw, record.metadata, this.clockNow())
          this.appendTrace(trace, {
            adapterId: record.metadata.id, adapterVersion: record.metadata.version,
            sourceId: record.metadata.sourceId, code: 'SELECTED', testOnly: record.metadata.testOnly,
          })
          return result('OK', data)
        } catch (error) {
          this.appendTrace(trace, { adapterId: record.metadata.id, code: safeErrorCode(error) })
          if (!authorized()) return result(this.closed ? 'REGISTRY_DISPOSED' : 'SCOPE_REVOKED')
          if (outerSignal.aborted) return result(this.signalStatus(outerSignal, policyLifetime))
          if (!this.isCurrent(record) || record.lifetime.signal.aborted) continue
          // Only an authorized, unchanged scope and policy may reach a lower-ranked candidate.
        }
      }
      const codes = new Set(trace.map(item => item.code))
      return result([...codes].some(code => ['NOT_AUTHORIZED', 'LICENSE_USE_NOT_AUTHORIZED', 'LICENSE_REVIEW_REQUIRED',
        'LICENSE_ASSESSMENT_EXPIRED', 'TEST_ONLY_NOT_ALLOWED'].includes(code))
        ? 'NOT_AUTHORIZED' : 'UNAVAILABLE')
    } finally {
      clearTimeout(timeout)
      this.activeQueries--
    }
  }

  appendTrace(trace, entry) {
    if (trace.length >= MAX_TRACE) return
    const safe = { code: this.publicCode(entry.code) }
    if (typeof entry.adapterId === 'string') safe.adapterId = entry.adapterId
    if (typeof entry.adapterVersion === 'string') safe.adapterVersion = entry.adapterVersion
    if (typeof entry.sourceId === 'string') safe.sourceId = entry.sourceId
    if (typeof entry.testOnly === 'boolean') safe.testOnly = entry.testOnly
    trace.push(safe)
  }

  publicCode(code) {
    if (POLICY_CODES.has(code) || DATA_ERRORS.has(code) || SAFE_ADAPTER_CODES.has(code) ||
      ['POLICY_CHANGED', 'POLICY_CONFLICT', 'POLICY_ROLE_DENIED', 'SCOPE_REVOKED', 'AUTHORIZATION_CHANGED',
        'STATE_INVALID', 'ADAPTER_REMOVED', 'REGISTRY_DISPOSED', 'ADAPTER_ERROR'].includes(code)) return code
    return 'ADAPTER_ERROR'
  }

  signalStatus(signal, policyLifetime) {
    if (this.closed) return 'REGISTRY_DISPOSED'
    if (policyLifetime.signal.aborted) return 'POLICY_CHANGED'
    const reasonCode = signal.reason?.code
    if (reasonCode === 'TIMEOUT') return 'TIMEOUT'
    if (reasonCode === 'ADAPTER_REMOVED') return 'CANCELLED'
    return 'CANCELLED'
  }

  isCurrent(record) {
    return this.adapters.get(record.metadata.id) === record && !record.disposed && !record.lifetime.signal.aborted
  }

  async boundedCall(operation, signal) {
    if (signal.aborted) throw signal.reason ?? fault('CANCELLED', 'Query cancelled')
    let rejectAbort
    const aborted = new Promise((_resolve, reject) => {
      rejectAbort = () => reject(signal.reason ?? fault('CANCELLED', 'Query cancelled'))
      signal.addEventListener('abort', rejectAbort, { once: true })
    })
    try { return await Promise.race([Promise.resolve().then(operation), aborted]) }
    finally { signal.removeEventListener('abort', rejectAbort) }
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    this.policyLifetime.abort(fault('REGISTRY_DISPOSED', 'Registry disposed'))
    for (const record of this.adapters.values()) this.retireRecord(record, 'REGISTRY_DISPOSED')
    this.adapters.clear()
    this.changed()
    this.listeners.clear()
  }
}
