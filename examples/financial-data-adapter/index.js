import { createControl, fault } from './control.js'
import { createFakeClient } from './client.js'
export const inject = ['financeData']
const PERIOD = Object.freeze({ kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' })
const FIELDS = ['revenue', 'ebitda']

/** Query coverage; ticker syntax does not establish ordinary-share eligibility. */
export function validateCoverage(query, { signal } = {}, ordinaryEquitySymbols = []) {
  signal?.throwIfAborted()
  const no = code => ({ compatible: false, code })
  if (query?.capability !== 'financial.statements') return no('CAPABILITY_UNAVAILABLE')
  if (query.temporalMode !== 'current_only') return no('TEMPORAL_MODE_UNSUPPORTED')
  if (query.market !== 'CN') return no('MARKET_UNSUPPORTED')
  if (query.entity?.scheme !== 'ticker' || !/^\d{6}\.(?:SH|SZ|BJ)$/.test(query.entity.id ?? '')) return no('ENTITY_UNSUPPORTED')
  if (!ordinaryEquitySymbols.includes(query.entity.id)) return no('ENTITY_UNSUPPORTED')
  if (!Array.isArray(query.requiredFields) || !query.requiredFields.length
    || query.requiredFields.some(field => !FIELDS.includes(field))) return no('FIELDS_UNSUPPORTED')
  if (!query.period || query.period.kind !== PERIOD.kind || query.period.start !== PERIOD.start || query.period.end !== PERIOD.end) return no('PERIOD_UNSUPPORTED')
  if (!Number.isFinite(Date.parse(query.asOf)) || Math.abs(Date.now() - Date.parse(query.asOf)) > 300_000) return no('CURRENT_ONLY_REQUEST_STALE')
  if (!Number.isFinite(query.maxAgeSeconds) || query.maxAgeSeconds < 0) return no('STALE_DATA')
  if (query.measurementType !== undefined && query.measurementType !== 'actual') return no('MEASUREMENT_TYPE_UNSUPPORTED')
  if (query.accountingBasis !== undefined && query.accountingBasis !== 'PRC_GAAP') return no('ACCOUNTING_BASIS_INCOMPATIBLE')
  if (query.consolidation !== undefined && query.consolidation !== 'consolidated') return no('CONSOLIDATION_INCOMPATIBLE')
  if (query.targetUnit && (query.targetUnit.dimension !== 'currency' || query.targetUnit.currency !== 'CNY'
    || !['ones', 'thousands', 'millions', 'billions'].includes(query.targetUnit.scale))) return no('UNIT_INCOMPATIBLE')
  if (query.sourceIds && !query.sourceIds.includes('test-only-template')) return no('SOURCE_NOT_SELECTED')
  return { compatible: true }
}

/** ordinaryEquitySymbols is trusted Host configuration and intentionally defaults empty. */
export function createAdapter({ ordinaryEquitySymbols = [] } = {}) {
  if (!Array.isArray(ordinaryEquitySymbols) || ordinaryEquitySymbols.some(symbol =>
    typeof symbol !== 'string' || !/^\d{6}\.(?:SH|SZ|BJ)$/.test(symbol))) throw fault('INVALID_ORDINARY_EQUITY_ALLOWLIST')
  const symbols = [...new Set(ordinaryEquitySymbols)]
  const lifecycle = createControl('NOT_CONFIGURED')
  const client = createFakeClient()
  const definition = {
    metadata: {
      id: 'example-financial-statements', version: '1.0.0', sourceId: 'test-only-template',
      label: 'TEST_ONLY synthetic A-share-shaped adapter template (not real security data)', testOnly: true, licenseClass: 'TEST_ONLY',
      capabilities: [{ id: 'financial.statements', markets: ['CN'], fields: [...FIELDS], temporalModes: ['current_only'], priority: 20, quality: 0 }],
    },
    state: lifecycle.state,
    validate(query, execution = {}) { return validateCoverage(query, execution, symbols) },
    async query(query, options = {}) {
      lifecycle.beforeQuery(options.signal)
      const validation = validateCoverage(query, options, symbols)
      if (!validation.compatible) throw fault(validation.code)
      const { structuredContent: raw } = await client.tools.call({ name: 'financial_statements', arguments: {
        symbol: query.entity.id, period: 'FY2024', market: query.market, fields: [...query.requiredFields], asOf: query.asOf,
      } }, options)
      lifecycle.beforeQuery(options.signal, false)
      if (raw.symbol !== query.entity.id) throw fault('FIXTURE_REQUEST_INVALID')
      const retrievedAt = new Date().toISOString()
      const evidence = { uri: 'urn:finance:test-only:template:toy:fy2024:r1', label: 'Synthetic local fixture; not a provider record' }
      return {
        observations: query.requiredFields.map(field => ({
          field, entity: { scheme: 'ticker', id: raw.symbol }, value: raw.metrics[field],
          unit: { dimension: 'currency', currency: 'CNY', scale: 'ones' }, period: { ...PERIOD },
          accountingBasis: 'PRC_GAAP', consolidation: 'consolidated', measurementType: 'actual',
          availabilityEvidence: { type: 'current_snapshot', capturedAt: retrievedAt }, retrievedAt, revision: null,
          revisionEvidence: {
            chainId: null, chainStatus: 'unknown', supersedes: [], changeType: 'synthetic_current_snapshot',
            sourceRecordId: null, capturedAt: retrievedAt, evidence,
          },
          reference: evidence, licenseClass: 'TEST_ONLY',
        })),
        corporateActions: [], filings: [],
        warnings: ['TEST_ONLY synthetic current snapshot; no real issuer, provider source, source revision chain, or commercial permission is represented.'],
      }
    },
  }
  return { definition, control: lifecycle.control, dispose: lifecycle.dispose }
}

export function apply(ctx) {
  ctx.effect(() => {
    const adapter = createAdapter()
    let unregister, unprovide
    try {
      unregister = ctx.financeData.registerAdapter(adapter.definition)
      unprovide = ctx.provide('financeExampleDataAdapter', adapter.control)
    } catch (error) { try { unregister?.() } finally { adapter.dispose() }; throw error }
    return () => { try { unregister() } finally { try { unprovide() } finally { adapter.dispose() } } }
  }, 'finance-example-data-adapter')
}
