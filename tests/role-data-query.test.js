// Local tool-executor tests. Backend and exact-Agent grant are explicit doubles, not NativeHost evidence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createRoleTools, roleToolNames } from '../src/role/tools.js'
import { createDataSchemas } from '../src/data/contracts.js'
const schemas = createDataSchemas(z)
const makeQuery = (overrides = {}) => schemas.Query.parse({
  capability: 'financial.statements', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
  requiredFields: ['revenue'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
  asOf: new Date().toISOString(), purpose: 'research', temporalMode: 'current_only', maxAgeSeconds: 300,
  ...overrides,
})
const args = (query = makeQuery()) => ({ action: 'query', capability: query.capability, query_json: JSON.stringify(query) })
function fixture({ role: overrides = {}, queryForAgent, describeForAgent } = {}) {
  const role = { id: 'finance-test-reader', builtinTools: ['read'], allowedMcpServers: [], skillNames: [], writer: false, ...overrides }
  const agent = {}, state = { active: true, checks: 0 }
  const filesystem = { check() { state.checks++; if (!state.active) throw new Error('ROLE_REVOKED') } }
  const filesystemFor = candidate => { if (candidate !== agent) throw new Error('EXACT_AGENT_REQUIRED'); return filesystem }
  const tools = createRoleTools(role, filesystemFor, queryForAgent, describeForAgent)
  const tool = tools.find(value => value.name === 'finance_data_query')
  return { role, agent, state, filesystem, filesystemFor, tools, tool, exec: { agent, signal: new AbortController().signal } }
}

test('one canonical data query is registered for every non-writer', () => {
  const empty = { id: 'finance-empty-reader', builtinTools: ['read'], allowedMcpServers: [], skillNames: [], writer: false }
  const allowed = { ...empty, id: 'finance-allowed-reader', allowedMcpServers: ['cn-source'] }
  const writer = { ...empty, id: 'finance-writer', writer: true }
  assert.deepEqual(roleToolNames(empty).filter(name => name.startsWith('finance_data_')), ['finance_data_query'])
  assert.deepEqual(roleToolNames(allowed).filter(name => name.startsWith('finance_data_')), ['finance_data_query'])
  assert.deepEqual(roleToolNames(writer).filter(name => name.startsWith('finance_data_')), [])
  const writerTools = createRoleTools(writer, () => ({}))
  assert.equal(writerTools.some(tool => tool.name === 'finance_data_query'), false)
})

test('empty MCP allowlists do not disable FinanceData; role denial stays separate', async () => {
  const unconfigured = fixture()
  assert.equal((await unconfigured.tool.execute(args(), unconfigured.exec)).status, 'NOT_CONFIGURED')
  const unconfiguredDescription = await unconfigured.tool.execute({ action: 'describe', capability: 'financial.statements' }, unconfigured.exec)
  assert.equal(unconfiguredDescription.status, 'NOT_CONFIGURED')
  assert.equal(JSON.parse(unconfiguredDescription.result_json).scopeAvailability.status, 'NOT_CONFIGURED')

  const denied = fixture({ role: { allowedMcpServers: undefined } })
  assert.equal((await denied.tool.execute(args(), denied.exec)).status, 'ROLE_QUERY_DENIED')
  const deniedDescription = await denied.tool.execute({ action: 'describe', capability: 'financial.statements' }, denied.exec)
  assert.equal(deniedDescription.status, 'ROLE_QUERY_DENIED')
  assert.equal(JSON.parse(deniedDescription.result_json).scopeAvailability.status, 'ROLE_QUERY_DENIED')

  const dataTools = unconfigured.tools.filter(tool => tool.name.startsWith('finance_data_'))
  assert.deepEqual(dataTools.map(tool => tool.name), ['finance_data_query'])
  assert.deepEqual(Object.keys(unconfigured.tool.parameters.properties), ['action', 'capability', 'query_json'])
  assert.equal(dataTools.some(tool => /catalog|binding|policy|grant|set/i.test(tool.name)), false)
})

test('query forwards only the exact Agent, validated CN Query and execution signal; it renders as fetch', async () => {
  let seen
  const f = fixture({
    role: { allowedMcpServers: ['cn-source'] },
    queryForAgent: async (...args) => { seen = args; return { status: 'OK', providers: [], observations: [] } },
  })
  const request = makeQuery()
  const output = await f.tool.execute(args(request), f.exec)
  assert.equal(seen[0], f.agent)
  assert.deepEqual(seen[1], request)
  assert.equal(seen[2], f.exec.signal)
  assert.equal(output.status, 'OK')
  assert.equal(output.trust, 'UNTRUSTED_DATA')
  assert.equal(f.tool.isConcurrencySafe(), true)
  assert.equal(f.tool.presentCall(args(request)).kind, 'fetch')
  assert.equal(f.state.checks, 2)
})

test('invalid foreign or non-CN queries never reach the Host callback', async () => {
  let calls = 0
  const f = fixture({ role: { allowedMcpServers: ['cn-source'] }, queryForAgent: async () => { calls++; return { status: 'OK' } } })
  const valid = makeQuery()
  for (const invalid of [
    { ...valid, market: 'US' },
    { ...valid, entity: { scheme: 'cusip', id: '037833100' } },
    { ...valid, entity: { scheme: 'ticker', id: 'AAPL' } },
  ]) await assert.rejects(f.tool.execute(args(invalid), f.exec))
  assert.equal(calls, 0)
})

test('role filesystem authority is rechecked after the Host callback awaits', async () => {
  let entered, finish
  const started = new Promise(resolve => { entered = resolve })
  const f = fixture({ role: { allowedMcpServers: ['cn-source'] }, queryForAgent: async () => {
    entered()
    return await new Promise(resolve => { finish = resolve })
  } })
  const pending = f.tool.execute(args(), f.exec)
  await started
  f.state.active = false
  finish({ status: 'OK', providers: [], observations: ['DO_NOT_DISCLOSE'] })
  await assert.rejects(pending, /ROLE_REVOKED/)
})
