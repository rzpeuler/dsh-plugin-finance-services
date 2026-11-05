// Local tool-executor tests. Backend and exact-Agent grant are explicit doubles, not NativeHost evidence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createRoleTools } from '../src/role/tools.js'
import { CAPABILITIES, createDataSchemas } from '../src/data/contracts.js'
import { makeQuery } from './data-fixtures.js'
const schemas = createDataSchemas(z)
function fixture(backend) {
  const role = { id: 'finance-test-reader', builtinTools: ['read'], allowedMcpServers: ['capiq'], skillNames: [], writer: false }
  const agent = {}, state = { active: true, checks: 0 }
  const filesystem = { check() { state.checks++; if (!state.active) throw new Error('ROLE_REVOKED') } }
  const filesystemFor = candidate => { if (candidate !== agent) throw new Error('EXACT_AGENT_REQUIRED'); return filesystem }
  const tool = createRoleTools(role, filesystemFor, backend).find(value => value.name === 'finance_data_query')
  const signal = new AbortController().signal
  return { role, agent, state, tool, exec: { agent, signal } }
}
const args = () => ({ action: 'query', capability: 'financial.statements', query_json: JSON.stringify(makeQuery()) })

test('all fourteen deferred descriptions give parseable TEST_ONLY examples without claiming Provider coverage', async () => {
  const f = fixture()
  assert.deepEqual(f.tool.parameters.properties.capability.enum, [...CAPABILITIES])
  assert.equal(f.tool.parameters.properties.query_json.type, 'string')
  for (const capability of CAPABILITIES) {
    const output = await f.tool.execute({ action: 'describe', capability }, f.exec)
    assert.equal(output.status, 'DESCRIBED')
    const result = JSON.parse(output.result_json)
    assert.equal(result.exampleClassification, 'TEST_ONLY_NOT_PROVIDER_COVERAGE')
    assert.equal(schemas.Query.safeParse(result.example).success, true)
    assert.equal(result.schema.additionalProperties, false)
    assert.ok(Buffer.byteLength(output.result_json) < 20000)
  }
})

test('query delegates only the exact Agent, validated request and native cancellation signal', async () => {
  let seen
  const f = fixture(async (...input) => { seen = input; return { status: 'NOT_AUTHORIZED', data: null, trace: [{ code: 'SOURCE_BINDING_REQUIRED' }] } })
  const output = await f.tool.execute(args(), f.exec)
  assert.equal(seen[0], f.agent)
  assert.equal(seen[2], f.exec.signal)
  assert.deepEqual(seen[1], makeQuery())
  assert.equal(output.status, 'NOT_AUTHORIZED')
  assert.equal(output.trust, 'UNTRUSTED_DATA')
  assert.equal(JSON.parse(output.result_json).data, null)
  assert.equal(f.state.checks, 2)
})

test('an absent backend reports NOT_CONFIGURED without invented observations', async () => {
  const f = fixture()
  const output = await f.tool.execute(args(), f.exec)
  assert.equal(output.status, 'NOT_CONFIGURED')
  assert.equal(JSON.parse(output.result_json).data, null)
})

test('old free-form source requests and model-supplied identity/permission fields are rejected', async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return { status: 'OK' } })
  for (const input of [
    { source: 'capiq', query: 'arbitrary old free text' },
    { ...args(), roleId: 'finance-test-reader' },
    { ...args(), query_json: JSON.stringify({ ...makeQuery(), agentId: 'forge' }) },
    { ...args(), query_json: JSON.stringify({ ...makeQuery(), credentialRef: 'forge' }) },
    { ...args(), capability: 'company.identity' },
    { action: 'query', capability: 'financial.statements' },
    { action: 'describe', capability: 'financial.statements', query_json: '{}' },
    { ...args(), query_json: '{malformed' },
  ]) await assert.rejects(f.tool.execute(input, f.exec))
  assert.equal(calls, 0)
})

test('held definitions cannot disclose data across Agent identity, role source removal or Writer promotion', async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return { status: 'OK', data: [] } })
  await assert.rejects(f.tool.execute(args(), { ...f.exec, agent: {} }), /EXACT_AGENT_REQUIRED/)
  f.role.writer = true
  await assert.rejects(f.tool.execute(args(), f.exec), error => error.code === 'SOURCE_DENIED')
  f.role.writer = false; f.role.allowedMcpServers = []
  await assert.rejects(f.tool.execute({ action: 'describe', capability: 'company.identity' }, f.exec), error => error.code === 'SOURCE_DENIED')
  assert.equal(calls, 0)
})

test('a grant revoked while the backend awaits prevents disclosure of its late result', async () => {
  let entered, finish
  const started = new Promise(resolve => { entered = resolve })
  const f = fixture(async () => { entered(); return await new Promise(resolve => { finish = resolve }) })
  const pending = f.tool.execute(args(), f.exec)
  await started
  f.state.active = false
  finish({ status: 'OK', data: ['DO_NOT_DISCLOSE'] })
  await assert.rejects(pending, /ROLE_REVOKED/)
})

test('UTF-8 request/result budgets reject rather than silently truncate', async () => {
  const f = fixture(async () => ({ status: 'OK', data: '\u6d4b'.repeat(40000) }))
  await assert.rejects(f.tool.execute(args(), f.exec), error => error.code === 'DATA_RESULT_LIMIT')
  await assert.rejects(f.tool.execute({ ...args(), query_json: '\u6d4b'.repeat(20000) }, f.exec))
})

test('pre-aborted execution never contacts the backend', async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return { status: 'OK' } })
  const controller = new AbortController(); controller.abort()
  await assert.rejects(f.tool.execute(args(), { agent: f.agent, signal: controller.signal }))
  assert.equal(calls, 0)
})
