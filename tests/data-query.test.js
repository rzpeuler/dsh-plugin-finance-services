import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  ASHARE_CAPABILITIES, dataQueryInput, dataQueryOutput,
  describeDataQuery, executeDataQuery,
} from '../src/role/data-query.js'
import { createDataSchemas } from '../src/data/contracts.js'

const schemas = createDataSchemas(z)
const role = { writer: false, allowedMcpServers: ['cn-source'] }
const agent = { id: 'TEST_ONLY-agent' }
const now = () => new Date()
const baseQuery = (overrides = {}) => ({
  capability: 'financial.statements',
  entity: { scheme: 'ticker', id: '600519.SH' },
  market: 'CN',
  requiredFields: ['revenue'],
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  asOf: now().toISOString(),
  purpose: 'research',
  temporalMode: 'current_only',
  maxAgeSeconds: 300,
  ...overrides,
})
const input = (query, capability = query.capability) => ({
  action: 'query', capability, query_json: JSON.stringify(query),
})
const result = status => ({ status, providers: [] })

async function run(query, options = {}) {
  return executeDataQuery(
    options.role ?? role, input(query, options.selectedCapability ?? query.capability),
    options.agent ?? agent, options.signal,
    options.queryForAgent, options.describeForAgent, options.now,
  )
}

test('model-facing schema is limited to A-share capabilities and describes CN ticker restrictions', async () => {
  assert.deepEqual(dataQueryInput.shape.capability.options, [...ASHARE_CAPABILITIES])
  assert.deepEqual(ASHARE_CAPABILITIES, [
    'company.identity', 'financial.statements', 'filings', 'earnings.transcript',
    'earnings.consensus', 'prices.history', 'comps', 'transactions', 'corporate.actions',
  ])
  assert.deepEqual(dataQueryOutput.properties.trust, { type: 'string', const: 'UNTRUSTED_DATA' })

  const availability = { status: 'EXPLICIT_SCOPE_GRANTS_FOUND', providers: [{ adapterId: 'cn-test' }] }
  const described = describeDataQuery('financial.statements', availability)
  const schema = described.querySchema
  assert.deepEqual(schema.properties.capability.enum, [...ASHARE_CAPABILITIES])
  assert.equal(schema.properties.market.const, 'CN')
  assert.equal(schema.properties.entity.properties.scheme.const, 'ticker')
  assert.match(schema.properties.entity.properties.id.pattern, /6\}.*SH\|SZ\|BJ/)
  assert.match(schema.description, /ordinary-share allowlist/i)
  assert.equal(described.scopeAvailability, availability)
  assert.equal(described.exampleClassification, 'TEST_ONLY_NOT_PROVIDER_COVERAGE')
  assert.equal(schemas.Query.safeParse(described.example).success, true)
  assert.equal(described.example.temporalMode, 'current_only')
  assert.ok(Math.abs(Date.now() - Date.parse(described.example.asOf)) < 300000)
  assert.ok(described.runtimeConstraints.some(text => /within 300 seconds/i.test(text)))
})

test('all example capabilities produce valid bounded TEST_ONLY Query examples with a fresh asOf', () => {
  const timestamp = new Date()
  for (const capability of ASHARE_CAPABILITIES) {
    const described = describeDataQuery(capability, result('NOT_CONFIGURED'), timestamp)
    assert.equal(schemas.Query.safeParse(described.example).success, true, capability)
    assert.equal(described.example.capability, capability)
    assert.equal(described.example.market, 'CN')
    assert.equal(described.example.entity.scheme, 'ticker')
    assert.equal(described.example.temporalMode, 'current_only')
    assert.equal(described.example.asOf, timestamp.toISOString())
    assert.ok(Date.now() - Date.parse(described.example.asOf) < 300000)
    assert.equal(described.exampleClassification, 'TEST_ONLY_NOT_PROVIDER_COVERAGE')
  }
})

test('filings schema and query preserve announcement-date range semantics', async () => {
  const described = describeDataQuery('filings')
  assert.ok(described.querySchema.allOf.some(rule => rule.if?.properties?.capability?.const === 'filings' &&
    rule.then?.properties?.period?.properties?.kind?.const === 'range'))
  assert.match(described.querySchema.properties.period.description, /announcement-date range/i)
  assert.equal(described.example.period.kind, 'range')
  assert.equal(described.example.requiredFields[0], 'announcement_date')

  const filings = baseQuery({
    capability: 'filings', requiredFields: ['announcement_date'],
    period: { kind: 'range', start: '2026-11-02', end: '2026-11-08' },
  })
  let seen
  const output = await run(filings, { queryForAgent: async (_agent, request) => { seen = request; return result('OK') } })
  assert.equal(output.status, 'OK')
  assert.equal(seen.period.kind, 'range')
  assert.deepEqual(seen.period, filings.period)
  await assert.rejects(run({ ...filings, period: { kind: 'fiscal_year', start: '2025-01-01', end: '2025-12-31' } }, {
    queryForAgent: async () => { assert.fail('invalid filings period dispatched') },
  }))
})

test('corporate.actions needs a range and explicit date basis; prices default to no adjustment', async () => {
  const actionBase = baseQuery({
    capability: 'corporate.actions', requiredFields: ['cash_dividend'],
    period: { kind: 'range', start: '2026-11-02', end: '2026-11-08' },
  })
  let calls = 0
  await assert.rejects(run(actionBase, { queryForAgent: async () => { calls++; return result('OK') } }))
  const action = { ...actionBase, corporateActionDateBasis: 'announcement_date' }
  const actionOut = await run(action, { queryForAgent: async (_agent, request) => { calls++; assert.equal(request.corporateActionDateBasis, 'announcement_date'); return result('OK') } })
  assert.equal(actionOut.status, 'OK')

  const price = baseQuery({
    capability: 'prices.history', requiredFields: ['close'],
    period: { kind: 'range', start: '2026-11-02', end: '2026-11-08' },
  })
  let adjustment
  const priceOut = await run(price, { queryForAgent: async (_agent, request) => { adjustment = request.priceAdjustment; return result('OK') } })
  assert.equal(priceOut.status, 'OK')
  assert.equal(adjustment, 'none')
  assert.equal(describeDataQuery('prices.history').example.priceAdjustment, 'none')
  assert.equal(calls, 1)
})

test('only CN ticker-shaped requests dispatch; foreign market, scheme, ticker, capability and mismatch are rejected', async () => {
  let calls = 0
  const queryForAgent = async () => { calls++; return result('OK') }
  const valid = await run(baseQuery(), { queryForAgent })
  assert.equal(valid.status, 'OK')
  assert.equal(valid.trust, 'UNTRUSTED_DATA')
  assert.equal(calls, 1)

  for (const invalid of [
    baseQuery({ market: 'US' }),
    baseQuery({ entity: { scheme: 'cusip', id: '037833100' } }),
    baseQuery({ entity: { scheme: 'ticker', id: 'AAPL' } }),
  ]) {
    await assert.rejects(run(invalid, { queryForAgent }))
  }
  await assert.rejects(executeDataQuery(role, { ...input(baseQuery()), capability: 'macro.rates' }, agent, undefined, queryForAgent))
  await assert.rejects(run(baseQuery({ capability: 'macro.rates' }), { selectedCapability: 'financial.statements', queryForAgent }), error => error.code === 'CAPABILITY_UNSUPPORTED')
  await assert.rejects(run(baseQuery(), { selectedCapability: 'prices.history', queryForAgent }), error => error.code === 'CAPABILITY_MISMATCH')
  assert.equal(calls, 1, 'invalid requests never reach the Host callback')
})

test('Host callbacks receive the exact agent/query and return untrusted bounded results', async () => {
  let seen
  const hostResult = { status: 'OK', observations: [{ value: 'TEST_ONLY' }], trace: [] }
  const query = baseQuery()
  const output = await run(query, {
    queryForAgent: async (...args) => { seen = args; return hostResult },
  })
  assert.equal(seen[0], agent)
  assert.deepEqual(seen[1], schemas.Query.parse(query))
  assert.ok(seen[2] === undefined)
  assert.equal(output.status, 'OK')
  assert.equal(output.trust, 'UNTRUSTED_DATA')
  assert.deepEqual(JSON.parse(output.result_json), hostResult)

  const describedAvailability = { status: 'EXPLICIT_SCOPE_GRANTS_FOUND', providers: [] }
  const described = await executeDataQuery(role, { action: 'describe', capability: 'filings' }, agent, undefined,
    undefined, async (...args) => { assert.deepEqual(args, [agent, 'filings']); return describedAvailability })
  assert.equal(described.status, 'DESCRIBED')
  assert.deepEqual(JSON.parse(described.result_json).scopeAvailability, describedAvailability)
  assert.equal(described.trust, 'UNTRUSTED_DATA')
})

test('absent Host callbacks are explicit; empty MCP allowlists still reach Host FinanceData policy', async () => {
  const query = baseQuery()
  const notConfigured = await run(query)
  assert.equal(notConfigured.status, 'NOT_CONFIGURED')
  assert.equal(notConfigured.trust, 'UNTRUSTED_DATA')
  assert.equal(JSON.parse(notConfigured.result_json).status, 'NOT_CONFIGURED')

  let hostCalls = 0
  const denied = await run(query, { role: { writer: false, allowedMcpServers: [] },
    queryForAgent: async (_agent, request) => { hostCalls++; assert.deepEqual(request, schemas.Query.parse(query)); return result('NOT_AUTHORIZED') } })
  assert.equal(denied.status, 'NOT_AUTHORIZED')
  assert.equal(denied.trust, 'UNTRUSTED_DATA')
  assert.equal(hostCalls, 1, 'Host policy, not the MCP allowlist, decides direct financial-source access')

  const describeMissing = await executeDataQuery(role, { action: 'describe', capability: 'prices.history' }, agent)
  assert.equal(describeMissing.status, 'NOT_CONFIGURED')
  assert.equal(JSON.parse(describeMissing.result_json).scopeAvailability.status, 'NOT_CONFIGURED')
  const describeUnconfigured = await executeDataQuery({ writer: false, allowedMcpServers: [] },
    { action: 'describe', capability: 'prices.history' }, agent, undefined,
    undefined, async (...args) => { assert.deepEqual(args, [agent, 'prices.history']); return { status: 'NOT_AUTHORIZED', providers: [] } })
  assert.equal(describeUnconfigured.status, 'DESCRIBED')
  assert.equal(JSON.parse(describeUnconfigured.result_json).scopeAvailability.status, 'NOT_AUTHORIZED')
  const invalidRole = await executeDataQuery({ writer: false }, { action: 'describe', capability: 'prices.history' }, agent)
  assert.equal(invalidRole.status, 'ROLE_QUERY_DENIED')
})

test('abort, input/output byte budgets, and invalid queries never dispatch', async () => {
  let calls = 0
  const queryForAgent = async () => { calls++; return result('OK') }
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(run(baseQuery(), { signal: controller.signal, queryForAgent }))
  await assert.rejects(executeDataQuery(role, { action: 'query', capability: 'financial.statements', query_json: 'x'.repeat(50001) }, agent, undefined, queryForAgent))
  await assert.rejects(run(baseQuery(), {
    queryForAgent: async () => ({ status: 'OK', data: '界'.repeat(34000) }),
  }), error => error.code === 'DATA_RESULT_LIMIT')
  assert.equal(calls, 0)
})
