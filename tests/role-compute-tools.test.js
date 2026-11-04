import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRoleTools, roleToolNames, calculationModels } from '../src/role/tools.js'
import { describeCalculation } from '../src/role/calculation.js'
const roles = JSON.parse(await readFile(new URL('../assets/agent-manifest.json', import.meta.url), 'utf8')).roles
const modeler = roles.find(role => role.id === 'finance-pitch-agent-modeler')
const builder = roles.find(role => role.id === 'finance-model-builder-builder')
const toolFor = (role, filesystemFor) => createRoleTools(role, filesystemFor).find(tool => tool.name === 'finance_model_calculate')

test('only exact source Bash exception roles with assigned financial skills acquire bounded computation', () => {
  assert.deepEqual(roles.filter(role => roleToolNames(role).includes('finance_model_calculate')).map(role => role.id), [modeler.id, builder.id])
  assert.deepEqual(calculationModels({ ...modeler, builtinTools: ['read'] }), [])
  assert.deepEqual(calculationModels({ ...builder, skillNames: ['dcf-model'] }), [])
  assert.deepEqual(calculationModels({ ...modeler, id: 'finance-other' }), [])
  assert.ok(!roles.some(role => roleToolNames(role).includes('bash')))
  assert.deepEqual(toolFor(modeler).parameters.properties.model.enum, ['dcf', 'lbo'])
  assert.deepEqual(toolFor(builder).parameters.properties.model.enum, ['dcf', 'lbo', 'three_statement', 'comps'])
})

test('progressive contracts and fixed numeric results remain bounded and role-attributed', async () => {
  let checks = 0
  const tool = toolFor(builder, () => ({ check() { checks++ } }))
  for (const model of calculationModels(builder)) {
    const described = await tool.execute({ action: 'describe', model }, {})
    const contract = JSON.parse(described.result_json)
    assert.ok(contract.inputSchema)
    const result = await tool.execute({ action: 'calculate', model, input_json: JSON.stringify(contract.example) }, {})
    const data = JSON.parse(result.result_json)
    assert.equal(data.roleId, builder.id)
    assert.equal(data.commercialReady, false)
    assert.equal(data.officeStatus, 'NOT_IMPLEMENTED_P4')
    assert.ok(Buffer.byteLength(result.result_json) <= 100000)
    assert.equal(tool.presentCall({ action: 'describe', model }).kind, 'other')
  }
  assert.equal(checks, 8)
})

test('modeler cannot calculate unassigned models or inject code/path fields', async () => {
  const tool = toolFor(modeler, () => ({ check() {} }))
  await assert.rejects(tool.execute({ action: 'describe', model: 'three_statement' }, {}), /MODEL_DENIED/)
  await assert.rejects(tool.execute({ action: 'describe', model: 'comps' }, {}), /MODEL_DENIED/)
  await assert.rejects(tool.execute({ action: 'describe', model: 'dcf', input_json: '{}' }, {}), /omit/)
  await assert.rejects(tool.execute({ action: 'calculate', model: 'dcf' }, {}), /CALC_INPUT_REQUIRED/)
  await assert.rejects(tool.execute({ action: 'calculate', model: 'dcf', input_json: '{"model":"lbo"}' }, {}), /MODEL_MISMATCH/)
  const request = describeCalculation('dcf').example
  await assert.rejects(tool.execute({ action: 'calculate', model: 'dcf', input_json: JSON.stringify({ ...request, code: 'process.exit()', file_path: '../original' }) }, {}))
  await assert.rejects(tool.execute({ action: 'calculate', model: 'dcf', input_json: JSON.stringify(request), command: 'python' }, {}))
})

test('both describe and calculate require the existing exact Agent admission even through a held definition', async () => {
  const owner = {}
  let active = true
  const tool = toolFor(modeler, agent => {
    assert.equal(agent, owner, 'Wrong Agent')
    return { check() { if (!active) throw new Error('ROLE_AUTHORITY_UNAVAILABLE') } }
  })
  await tool.execute({ action: 'describe', model: 'dcf' }, { agent: owner })
  await assert.rejects(tool.execute({ action: 'describe', model: 'dcf' }, { agent: {} }), /Wrong Agent/)
  active = false
  await assert.rejects(tool.execute({ action: 'describe', model: 'dcf' }, { agent: owner }), /ROLE_AUTHORITY_UNAVAILABLE/)
  await assert.rejects(tool.execute({ action: 'calculate', model: 'dcf', input_json: JSON.stringify(describeCalculation('dcf').example) }, { agent: owner }), /ROLE_AUTHORITY_UNAVAILABLE/)
})
