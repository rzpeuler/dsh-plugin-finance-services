import { createControl, fault } from './control.js'
import { createFakeClient } from './client.js'
export const inject = ['financeData']
const PERIOD = Object.freeze({ kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' })
const AVAILABLE_AT = '2025-02-02T00:00:00Z'
const SOURCE_AS_OF = '2025-02-01T00:00:00Z'
const FIELDS = ['revenue', 'ebitda']

/** Parent owns strict Query parsing; this explicitly proves only the toy fixture's coverage. */
export function validateCoverage(query, { signal } = {}) {
  signal?.throwIfAborted()
  const no = code => ({ compatible: false, code })
  if (query?.capability !== 'financial.statements') return no('CAPABILITY_UNAVAILABLE')
  if (query.measurementType !== undefined && query.measurementType !== 'actual') return no('MEASUREMENT_TYPE_UNSUPPORTED')
  if (query.market !== 'US') return no('MARKET_UNSUPPORTED')
  if (query.entity?.scheme !== 'ticker' || query.entity.id !== 'TOY') return no('ENTITY_UNSUPPORTED')
  if (!Array.isArray(query.requiredFields) || !query.requiredFields.length
    || query.requiredFields.some(field => !FIELDS.includes(field))) return no('FIELDS_UNSUPPORTED')
  if (!query.period || query.period.kind !== PERIOD.kind || query.period.start !== PERIOD.start || query.period.end !== PERIOD.end) return no('PERIOD_UNSUPPORTED')
  if (!Number.isFinite(Date.parse(query.asOf)) || Date.parse(query.asOf) < Date.parse(AVAILABLE_AT)) return no('PIT_UNAVAILABLE')
  if (!Number.isFinite(query.maxAgeSeconds) || (Date.parse(query.asOf) - Date.parse(SOURCE_AS_OF)) / 1000 > query.maxAgeSeconds) return no('STALE_DATA')
  if (query.accountingBasis !== undefined && query.accountingBasis !== 'US_GAAP') return no('ACCOUNTING_BASIS_INCOMPATIBLE')
  if (query.consolidation !== undefined && query.consolidation !== 'consolidated') return no('CONSOLIDATION_INCOMPATIBLE')
  if (query.targetUnit && (query.targetUnit.dimension !== 'currency' || query.targetUnit.currency !== 'USD'
    || !['ones', 'thousands', 'millions', 'billions'].includes(query.targetUnit.scale))) return no('UNIT_INCOMPATIBLE')
  if (query.sourceIds && !query.sourceIds.includes('test-only-mcp')) return no('SOURCE_NOT_SELECTED')
  return { compatible: true }
}

export function createAdapter() {
  const lifecycle = createControl('READY')
  const client = createFakeClient()
  const definition = {
    metadata: {
      id: 'test-mcp-statements', version: '1.0.0', sourceId: 'test-only-mcp',
      label: 'TEST_ONLY MCP-style toy observation (not commercial data)', testOnly: true, licenseClass: 'TEST_ONLY',
      capabilities: [{ id: 'financial.statements', markets: ['US'], fields: [...FIELDS], priority: 20, quality: 50, pointInTime: true }],
    },
    state: lifecycle.state,
    validate: validateCoverage,
    async query(query, options = {}) {
      lifecycle.beforeQuery(options.signal)
      const validation = validateCoverage(query, options)
      if (!validation.compatible) throw fault(validation.code)
      const { structuredContent: raw } = await client.tools.call({ name: 'financial_statements', arguments: {
        symbol: query.entity.id, period: 'FY2024', market: query.market, fields: [...query.requiredFields], asOf: query.asOf,
      } }, options)
      lifecycle.beforeQuery(options.signal, false)
      const retrievedAt = new Date().toISOString()
      return {
        observations: query.requiredFields.map(field => ({
          field, entity: { scheme: 'ticker', id: raw.symbol }, value: raw.metrics[field],
          unit: { dimension: 'currency', currency: raw.currencyCode, scale: raw.magnitude }, period: { ...PERIOD },
          accountingBasis: raw.accounting, consolidation: raw.group, measurementType: raw.measurementType,
          sourceAsOf: raw.statementDate, availableAt: raw.firstPublished, retrievedAt, revision: raw.revisionId,
          reference: { uri: 'urn:finance:test-only:mcp:toy:fy2024:r1', label: 'Original synthetic MCP-style observation; not a commercial-source equivalent' },
          licenseClass: 'TEST_ONLY',
        })),
        warnings: ['TEST_ONLY synthetic MCP-style observation; independently invented values, not commercial equivalence and never a supplier average.'],
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
      unprovide = ctx.provide('financeTestMcpAdapter', adapter.control)
    } catch (error) { try { unregister?.() } finally { adapter.dispose() }; throw error }
    return () => { try { unregister() } finally { try { unprovide() } finally { adapter.dispose() } } }
  }, 'finance-test-mcp-adapter')
}
