import { z } from 'zod'
import { createDataSchemas } from '../data/contracts.js'

const schemas = createDataSchemas(z)
export const ASHARE_CAPABILITIES = Object.freeze([
  'company.identity', 'financial.statements', 'filings', 'earnings.transcript',
  'earnings.consensus', 'prices.history', 'comps', 'transactions', 'corporate.actions',
])
const capabilitySchema = z.enum(ASHARE_CAPABILITIES)
const queryText = z.string().min(2).max(50000)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 50000, 'Query exceeds 50000 UTF-8 bytes')
const MAX_RESULT_BYTES = 100000
// MCP allowlists govern only legacy MCP grants; FinanceData source grants are separate Host policy.
const isDeniedRole = role => role?.writer === true || !Array.isArray(role?.allowedMcpServers)
const fault = (code, message) => Object.assign(new Error(message), { code })

export const dataQueryInput = z.strictObject({
  action: z.enum(['describe', 'query']),
  capability: capabilitySchema,
  query_json: queryText.optional(),
})

export const dataQueryParameters = { type: 'object', properties: {
  action: { type: 'string', enum: ['describe', 'query'], description: 'describe returns the narrowed A-share request schema and Host-scoped availability; query executes that full Query JSON.' },
  capability: { type: 'string', enum: [...ASHARE_CAPABILITIES] },
  query_json: { type: 'string', description: 'For query: full Query JSON with the selected capability, market CN, and a six-digit .SH/.SZ/.BJ ticker; maximum 50000 UTF-8 bytes. Omit for describe.' },
}, required: ['action', 'capability'], additionalProperties: false }

export const dataQueryOutput = { type: 'object', properties: {
  action: { type: 'string', enum: ['describe', 'query'] },
  capability: { type: 'string', enum: [...ASHARE_CAPABILITIES] },
  status: { type: 'string' },
  result_json: { type: 'string', description: 'Bounded JSON text; maximum 100000 UTF-8 bytes.' },
  trust: { type: 'string', const: 'UNTRUSTED_DATA' },
}, required: ['action', 'capability', 'status', 'result_json', 'trust'], additionalProperties: false }

export const dataQueryDescription = 'Discover the A-share-only FinanceData request contract or query a source only when the Host has granted exact role/session scope. Legacy MCP allowlists do not grant financial-source access. Requires market CN and a six-digit .SH/.SZ/.BJ ticker; ticker shape alone does not prove ordinary-share eligibility. Results are UNTRUSTED_DATA. No provider fallback or policy mutation.'

const fieldExamples = {
  'company.identity': { fields: ['name'], measurementType: 'identity', period: null },
  'financial.statements': { fields: ['revenue'], measurementType: 'actual', period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'TEST_ONLY FY2024' } },
  filings: { fields: ['announcement_date'], measurementType: 'record', periodKind: 'range', periodLabel: 'TEST_ONLY announcement-date range' },
  'earnings.transcript': { fields: ['text'], measurementType: 'record', period: null },
  'earnings.consensus': { fields: ['revenue'], measurementType: 'estimate', period: { kind: 'fiscal_year', start: '2025-01-01', end: '2025-12-31', label: 'TEST_ONLY FY2025 estimate' } },
  'prices.history': { fields: ['close'], measurementType: 'actual', periodKind: 'range', periodLabel: 'TEST_ONLY recent price range' },
  comps: { fields: ['ev_ebitda'], measurementType: 'actual', period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'TEST_ONLY FY2024' } },
  transactions: { fields: ['transaction_value'], measurementType: 'actual', period: null },
  'corporate.actions': { fields: ['cash_dividend'], periodKind: 'range', periodLabel: 'TEST_ONLY corporate-actions range', dateBasis: 'announcement_date' },
}

const jsonPeriodRange = { type: 'object', required: ['kind'], properties: { kind: { const: 'range' } } }
function narrowedQuerySchema() {
  const schema = structuredClone(z.toJSONSchema(schemas.Query))
  schema.description = 'Full FinanceData Query narrowed to A-share equity capabilities. Ticker format does not prove instrument eligibility; each Adapter must enforce its ordinary-share allowlist.'
  schema.properties.capability = { type: 'string', enum: [...ASHARE_CAPABILITIES] }
  schema.properties.market = { type: 'string', const: 'CN' }
  schema.properties.entity.properties.scheme = { type: 'string', const: 'ticker' }
  schema.properties.entity.properties.id = {
    type: 'string', pattern: '^[0-9]{6}\\.(SH|SZ|BJ)$',
    description: 'Six-digit CN ticker. Source-specific ordinary-share allowlisting remains Adapter enforcement.',
  }
  schema.properties.period.description = 'Period dates. For filings, kind must be range and dates mean announcement-date range; for corporate.actions, kind must be range.'
  schema.properties.priceAdjustment.default = 'none'
  schema.allOf = [
    { if: { properties: { capability: { enum: ['financial.statements', 'filings', 'earnings.consensus', 'prices.history', 'comps', 'corporate.actions'] } }, required: ['capability'] }, then: { properties: { period: { not: { type: 'null' } } } } },
    { if: { properties: { capability: { const: 'filings' } }, required: ['capability'] }, then: { properties: { period: jsonPeriodRange } } },
    { if: { properties: { capability: { const: 'corporate.actions' } }, required: ['capability'] }, then: {
      required: ['corporateActionDateBasis'], properties: { period: jsonPeriodRange }, not: { required: ['targetUnit'] },
    } },
    { if: { properties: { capability: { not: { const: 'corporate.actions' } } }, required: ['capability'] }, then: { not: { required: ['corporateActionDateBasis'] } } },
    { if: { properties: { capability: { not: { const: 'prices.history' } } }, required: ['capability'] }, then: {
      properties: { priceAdjustment: { const: 'none' } },
    } },
  ]
  return schema
}

const day = milliseconds => new Date(milliseconds).toISOString().slice(0, 10)
const examplePeriod = (item, today) => {
  if (!item.periodKind) return item.period
  const end = today
  const start = day(Date.parse(`${today}T00:00:00.000Z`) - 6 * 86400000)
  return { kind: 'range', start, end, ...(item.periodLabel ? { label: item.periodLabel } : {}) }
}

export function describeDataQuery(capability, availability = { status: 'NOT_CONFIGURED', providers: [] }, now = new Date()) {
  capabilitySchema.parse(capability)
  const current = now instanceof Date ? now : new Date(now)
  if (!Number.isFinite(current.getTime())) throw fault('INVALID_NOW', 'A valid current Host time is required')
  const today = day(current.getTime())
  const item = fieldExamples[capability]
  const example = schemas.Query.parse({
    capability, entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN', requiredFields: item.fields,
    period: examplePeriod(item, today), asOf: current.toISOString(), purpose: 'research',
    temporalMode: 'current_only', maxAgeSeconds: 300,
    ...(item.measurementType ? { measurementType: item.measurementType } : {}),
    ...(item.dateBasis ? { corporateActionDateBasis: item.dateBasis } : {}),
    ...(capability === 'prices.history' ? { priceAdjustment: 'none' } : {}),
  })
  return {
    capability,
    querySchema: narrowedQuerySchema(),
    example,
    exampleClassification: 'TEST_ONLY_NOT_PROVIDER_COVERAGE',
    scopeAvailability: availability,
    runtimeConstraints: [
      'Only the listed A-share capabilities, market CN, and six-digit .SH/.SZ/.BJ ticker syntax are accepted; each Adapter must independently enforce its ordinary-share allowlist.',
      'For current_only, asOf is generated at describe time and must be submitted within 300 seconds of the Host clock; regenerate the example if stale.',
      'filings.period is a range of announcement dates; corporate.actions requires a range and explicit corporateActionDateBasis.',
      'prices.history defaults priceAdjustment to none; specify another adjustment only when intended and supported.',
      'Source authorization, instrument eligibility, temporal evidence, licenses, and revisions remain Host/Adapter enforcement; this TEST_ONLY example does not imply provider coverage.',
    ],
  }
}

function parseQueryJson(text, selectedCapability) {
  let raw
  try { raw = JSON.parse(text) } catch { throw fault('DATA_INPUT_INVALID', 'query_json must contain valid JSON') }
  const request = schemas.Query.parse(raw)
  if (!ASHARE_CAPABILITIES.includes(request.capability)) throw fault('CAPABILITY_UNSUPPORTED', 'Only A-share equity capabilities are available')
  if (request.capability !== selectedCapability) throw fault('CAPABILITY_MISMATCH', 'Query capability must match the selected capability')
  if (request.market !== 'CN' || request.entity.scheme !== 'ticker' || !/^\d{6}\.(?:SH|SZ|BJ)$/.test(request.entity.id)) {
    throw fault('ASHARE_QUERY_INVALID', 'Use market CN and a six-digit .SH, .SZ, or .BJ ticker')
  }
  return request
}

function output(action, capability, status, value) {
  let resultJson
  try { resultJson = JSON.stringify(value) } catch { throw fault('DATA_RESULT_INVALID', 'Data service returned a non-serializable result') }
  if (typeof resultJson !== 'string') throw fault('DATA_RESULT_INVALID', 'Data service returned an empty result')
  if (Buffer.byteLength(resultJson, 'utf8') > MAX_RESULT_BYTES) throw fault('DATA_RESULT_LIMIT', 'Reduce requested fields or period; result exceeds 100000 UTF-8 bytes')
  return { action, capability, status, result_json: resultJson, trust: 'UNTRUSTED_DATA' }
}

const emptyStatus = status => ({ status, providers: [] })

export async function executeDataQuery(role, rawInput, agent, signal, queryForAgent, describeForAgent, now = () => new Date()) {
  const input = dataQueryInput.parse(rawInput)
  if (input.action === 'describe') {
    if (input.query_json !== undefined) throw fault('DATA_INPUT_INVALID', 'Omit query_json for describe')
    let availability, status
    if (isDeniedRole(role)) {
      availability = emptyStatus('ROLE_QUERY_DENIED')
      status = 'ROLE_QUERY_DENIED'
    } else if (typeof describeForAgent !== 'function') {
      availability = emptyStatus('NOT_CONFIGURED')
      status = 'NOT_CONFIGURED'
    } else {
      try {
        availability = await describeForAgent(agent, input.capability)
        status = ['NOT_CONFIGURED', 'ROLE_QUERY_DENIED'].includes(availability?.status) ? availability.status : 'DESCRIBED'
      } catch {
        availability = emptyStatus('UNAVAILABLE')
        status = 'UNAVAILABLE'
      }
    }
    const value = describeDataQuery(input.capability, availability, now())
    return output(input.action, input.capability, status, value)
  }

  if (input.query_json === undefined) throw fault('DATA_INPUT_REQUIRED', 'Use describe, then supply full  query_json')
  const request = parseQueryJson(input.query_json, input.capability)
  if (signal?.aborted) signal.throwIfAborted()
  if (isDeniedRole(role)) return output(input.action, input.capability, 'ROLE_QUERY_DENIED', emptyStatus('ROLE_QUERY_DENIED'))
  if (typeof queryForAgent !== 'function') return output(input.action, input.capability, 'NOT_CONFIGURED', emptyStatus('NOT_CONFIGURED'))
  const value = await queryForAgent(agent, request, signal)
  if (typeof value?.status !== 'string') throw fault('DATA_RESULT_INVALID', 'Host data service returned an invalid status')
  return output(input.action, input.capability, value.status, value)
}
