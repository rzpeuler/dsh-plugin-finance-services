import { z } from 'zod'
import { CAPABILITIES, createDataSchemas } from '../data/contracts.js'
const schemas = createDataSchemas(z)
const jsonText = z.string().min(2).max(50000).refine(value => Buffer.byteLength(value, 'utf8') <= 50000, 'Query exceeds 50000 UTF-8 bytes')
export const dataQueryInput = z.strictObject({ action: z.enum(['describe', 'query']), capability: schemas.Capability, query_json: jsonText.optional() })
export const dataQueryParameters = { type: 'object', properties: {
  action: { type: 'string', enum: ['describe', 'query'], description: 'describe returns the request schema, runtime constraints and a TEST_ONLY example; query executes a configured, explicitly granted source.' },
  capability: { type: 'string', enum: [...CAPABILITIES] },
  query_json: { type: 'string', description: 'For query: full Query JSON matching describe, with the same capability; maximum 50000 UTF-8 bytes. Omit for describe.' },
}, required: ['action', 'capability'], additionalProperties: false }
export const dataQueryOutput = { type: 'object', properties: {
  action: { type: 'string', enum: ['describe', 'query'] }, capability: { type: 'string' }, status: { type: 'string' },
  result_json: { type: 'string' }, trust: { type: 'string', const: 'UNTRUSTED_DATA' },
}, required: ['action', 'capability', 'status', 'result_json', 'trust'], additionalProperties: false }
export const dataQueryDescription = 'Discover a financial data request contract, or query explicitly granted sources for this Session. Returns observations with supplier, unit, period, original availability, revision and license provenance, or an unavailable/denied status. No publication, financial writes or guessed web substitutes.'
const profiles = {
  'company.identity': ['name', 'identity', 'text'], filings: ['filing_title', 'record', 'text'], 'earnings.transcript': ['text', 'record', 'text'],
  'earnings.consensus': ['revenue', 'estimate', 'currency'], 'prices.history': ['close', 'actual', 'currency'], comps: ['ev_ebitda', 'actual', 'ratio'],
  transactions: ['transaction_value', 'actual', 'currency'], 'macro.rates': ['policy_rate', 'actual', 'ratio'], 'portfolio.nav': ['nav', 'actual', 'currency'],
  'accounting.gl': ['balance', 'record', 'currency'], 'accounting.subledger': ['balance', 'record', 'currency'],
  'crm.relationship': ['relationship', 'record', 'text'], 'compliance.screening': ['status', 'screening_result', 'text'],
  'financial.statements': ['revenue', 'actual', 'currency'],
}
export function describeDataQuery(capability) {
  schemas.Capability.parse(capability)
  const [field, measurementType, dimension] = profiles[capability]
  const requiresPeriod = ['financial.statements', 'earnings.consensus', 'prices.history', 'comps', 'macro.rates', 'portfolio.nav', 'accounting.gl', 'accounting.subledger'].includes(capability)
  const example = { capability, entity: { scheme: 'ticker', id: 'TEST_ONLY' }, market: 'US', requiredFields: [field],
    period: requiresPeriod ? { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' } : null,
    asOf: '2025-03-01T00:00:00Z', purpose: capability === 'compliance.screening' ? 'screening' : capability.startsWith('accounting.') ? 'reconciliation' : 'research',
    maxAgeSeconds: 31536000, measurementType,
    targetUnit: { dimension, currency: dimension === 'currency' ? 'USD' : null, scale: dimension === 'currency' ? 'ones' : dimension === 'ratio' ? 'ratio' : 'text' } }
  schemas.Query.parse(example)
  return { contractVersion: '1.0.0', capability, schema: z.toJSONSchema(schemas.Query), example,
    exampleClassification: 'TEST_ONLY_NOT_PROVIDER_COVERAGE',
    availability: 'SCHEMA_IS_NOT_CONFIGURATION_OR_AUTHORIZATION',
    runtimeConstraints: [
      'An explicit current exact-Agent/Session, role, original source key and capability binding is required; sourceIds only filters candidates.',
      'Provider state must be READY; non-TEST_ONLY requests require license, model-processing and logged-session permissions.',
      'Period dates, precise known-offset timestamps, value/unit dimensions and UTF-8 size limits are validated at execution.',
      'sourceAsOf <= availableAt <= retrievedAt <= now; sourceAsOf and availableAt must not exceed requested asOf.',
      'Actuals cannot cover a period ending after sourceAsOf; estimates, accounting bases, revisions and providers are never silently mixed.',
      'No evidenced FX means no cross-currency conversion; missing required fields are not guessed or zero-filled.',
    ] }
}

export async function executeDataQuery(role, input, agent, signal, queryForAgent, describeForAgent) {
  if (role.writer || !role.allowedMcpServers.length) throw Object.assign(new Error('Financial queries are not granted to this role'), { code: 'SOURCE_DENIED' })
  let value, status
  if (input.action === 'describe') {
    if (input.query_json !== undefined) throw Object.assign(new Error('Omit query_json for describe'), { code: 'DATA_INPUT_INVALID' })
    value = describeDataQuery(input.capability)
    value.scopeAvailability = describeForAgent ? await describeForAgent(agent, input.capability) : { status: 'NOT_CONFIGURED', providers: [] }
    status = 'DESCRIBED'
  } else {
    if (input.query_json === undefined) throw Object.assign(new Error('Use describe, then supply the full query_json'), { code: 'DATA_INPUT_REQUIRED' })
    const request = schemas.Query.parse(JSON.parse(input.query_json))
    if (request.capability !== input.capability) throw Object.assign(new Error('Query capability must match the selected capability'), { code: 'CAPABILITY_MISMATCH' })
    if (signal?.aborted) signal.throwIfAborted()
    value = queryForAgent ? await queryForAgent(agent, request, signal) : { status: 'NOT_CONFIGURED', data: null, trace: [] }
    status = value.status
    if (typeof status !== 'string') throw Object.assign(new Error('Data service returned an invalid status'), { code: 'DATA_RESULT_INVALID' })
  }
  const result_json = JSON.stringify(value)
  if (Buffer.byteLength(result_json, 'utf8') > 100000) throw Object.assign(new Error('Reduce required fields or period; result exceeds 100000 UTF-8 bytes'), { code: 'DATA_RESULT_LIMIT' })
  return { action: input.action, capability: input.capability, status, result_json, trust: 'UNTRUSTED_DATA' }
}
