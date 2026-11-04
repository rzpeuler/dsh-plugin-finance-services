import { readFile } from 'node:fs/promises'
import { createControl, fault } from './control.js'
export const inject = ['financeData']
const FIELDS = ['revenue', 'ebitda']
const ITEM_CODES = { revenue: 'TOTAL_REVENUE', ebitda: 'EBITDA' }
const PERIOD = Object.freeze({ kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' })
const SOURCE_AS_OF = '2025-02-01T00:00:00Z'
const AVAILABLE_AT = '2025-02-02T00:00:00Z'
// This path is package-owned and fixed. No arbitrary endpoint, user file path or HTTP request.
const FIXTURE = new URL('./fixture.json', import.meta.url)

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
  if (query.sourceIds && !query.sourceIds.includes('test-only-rest')) return no('SOURCE_NOT_SELECTED')
  return { compatible: true }
}

export function createAdapter() {
  const lifecycle = createControl('READY')
  const definition = {
    metadata: {
      id: 'test-rest-statements', version: '1.0.0', sourceId: 'test-only-rest',
      label: 'TEST_ONLY REST/file-style distinct toy observation (not commercial data)', testOnly: true, licenseClass: 'TEST_ONLY',
      capabilities: [{ id: 'financial.statements', markets: ['US'], fields: [...FIELDS], priority: 10, quality: 50, pointInTime: true }],
    },
    state: lifecycle.state,
    validate: validateCoverage,
    async query(query, options = {}) {
      lifecycle.beforeQuery(options.signal)
      const validation = validateCoverage(query, options)
      if (!validation.compatible) throw fault(validation.code)
      // Real packaged-file read on every call; HTTP-shaped JSON only, never external HTTP.
      const envelope = JSON.parse(await readFile(FIXTURE, { encoding: 'utf8', signal: options.signal }))
      lifecycle.beforeQuery(options.signal, false)
      const raw = envelope?.body?.report
      if (envelope.status !== 200 || envelope.headers?.['x-fixture'] !== 'TEST_ONLY'
        || envelope.body?.security?.ticker !== 'TOY' || envelope.body.security.market !== 'US'
        || raw?.currency !== 'USD' || raw.scale !== 'ones' || raw.basis !== 'US_GAAP' || raw.scope !== 'consolidated'
        || raw.fiscal_period?.type !== 'annual' || raw.fiscal_period.from !== PERIOD.start || raw.fiscal_period.to !== PERIOD.end
        || raw.source_as_of !== SOURCE_AS_OF || raw.publicly_available_at !== AVAILABLE_AT
        || raw.measurement_type !== 'actual' || raw.revision !== 'rest-toy-r1' || !Array.isArray(raw.line_items)) throw fault('FIXTURE_INVALID')
      const retrievedAt = new Date().toISOString()
      return {
        observations: query.requiredFields.map(field => {
          const matches = raw.line_items.filter(item => item.code === ITEM_CODES[field])
          if (matches.length !== 1 || !Number.isFinite(matches[0].amount)) throw fault('FIXTURE_INVALID')
          return {
            field, entity: { scheme: 'ticker', id: envelope.body.security.ticker }, value: matches[0].amount,
            unit: { dimension: 'currency', currency: raw.currency, scale: raw.scale },
            period: { kind: 'fiscal_year', start: raw.fiscal_period.from, end: raw.fiscal_period.to, label: 'FY2024' },
            accountingBasis: raw.basis, consolidation: raw.scope, measurementType: raw.measurement_type,
            sourceAsOf: raw.source_as_of, availableAt: raw.publicly_available_at, retrievedAt, revision: raw.revision,
            reference: { uri: 'urn:finance:test-only:rest:toy:fy2024:r1', label: 'Packaged synthetic REST/file observation; distinct from MCP toy and all commercial sources' },
            licenseClass: 'TEST_ONLY',
          }
        }),
        warnings: ['TEST_ONLY separately invented REST/file observation; 2100000 is not equivalent to MCP toy revenue and must not be averaged with it.'],
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
      unprovide = ctx.provide('financeTestRestAdapter', adapter.control)
    } catch (error) { try { unregister?.() } finally { adapter.dispose() }; throw error }
    return () => { try { unregister() } finally { try { unprovide() } finally { adapter.dispose() } } }
  }, 'finance-test-rest-adapter')
}
