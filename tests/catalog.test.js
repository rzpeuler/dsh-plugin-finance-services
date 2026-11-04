import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { FinanceCatalog } from '../src/catalog.js'
import { createFinanceContract } from '../src/contract.js'
import { z } from 'zod'
const assetsRoot = fileURLToPath(new URL('../assets/', import.meta.url))
const { schemas } = createFinanceContract(z)
async function fixture({ ready = true, broken = false } = {}) {
  const catalog = new FinanceCatalog({ assetsRoot,
    presets: () => ({ async resolve(id) { return { id, ...(broken ? { broken: 'TEST_ONLY missing provider' } : {}) } } }),
    binding: { async snapshot() { return { workspaceStatus: ready ? 'READY' : 'UNBOUND', binding: ready ? { workspaceId: 'TEST_ONLY_WORKSPACE' } : null } } },
  })
  await catalog.initialize()
  return catalog
}
test('packaged authority-bearing manifest validates 40 roles and exact source ownership', async () => {
  const c = await fixture()
  assert.equal(c.roles.size, 40)
  const main = c.role('finance-pitch-agent')
  assert.deepEqual(main.workerPresetIds, ['finance-pitch-agent-researcher', 'finance-pitch-agent-modeler', 'finance-pitch-agent-deck-writer'])
  assert.equal(main.writer, false)
  assert.equal(main.skillRoots.length, 1)
  assert.match(main.skillRoots[0], /role-skills[\\/]finance-pitch-agent$/)
  assert.throws(() => c.role('standard'), /Unknown financial role/)
  for (const role of c.roles.values()) if (role.writer) assert.deepEqual(role.allowedMcpServers, [])
})
test('asset resolver rejects path traversal and foreign absolute or alternate-data spellings', async () => {
  const c = await fixture()
  for (const path of ['../package.json', '/tmp/a', 'C:\\data', 'file:secret', 'skills\\a', 'skills/../a', 'skills//a']) assert.throws(() => c.resolveAsset(path))
})
test('catalogue exposes ten main roles, thirty internal workers and true source limitations', async () => {
  const c = await fixture()
  const view = schemas.Catalog.parse(await c.catalog())
  assert.equal(view.agents.length, 10)
  assert.equal(view.workers.length, 30)
  assert.equal(view.skills.length, 63)
  assert.equal(view.commands.length, 41)
  assert.equal(view.steering.length, 29)
  assert.ok(view.agents.every(role => role.kind === 'main'))
  assert.ok(view.skills.some(skill => skill.assetStatus.includes('BLOCKED')))
  assert.ok(view.limitations.some(line => line.includes('not yet implemented')))
  assert.ok(!JSON.stringify(view).includes('adaptedPath'))
})
test('draft preparation validates workspace and native preset status without creating sessions', async () => {
  const ready = await fixture()
  const main = ready.manifest.roles.find(role => role.kind === 'main')
  const valid = schemas.PreparedDraft.parse(await ready.prepareDraft(schemas.PrepareDraftRequest.parse({ agentId: main.id, prompt: 'TEST_ONLY task' })))
  assert.equal(valid.status, 'DRAFT_READY')
  assert.equal(valid.agentPreset, main.id)
  assert.equal(valid.autoSubmit, false)
  assert.equal(valid.whenDraftExists, 'keep')
  assert.match(valid.prompt, /not submitted/)
  assert.match(valid.prompt, /TEST_ONLY task/)
  assert.equal((await (await fixture({ ready: false })).prepareDraft({ agentId: main.id })).error.code, 'WORKSPACE_NOT_READY')
  assert.equal((await (await fixture({ broken: true })).prepareDraft({ agentId: main.id })).error.code, 'PRESET_UNAVAILABLE')
  assert.equal((await ready.prepareDraft({ agentId: main.workerPresetIds[0] })).error.code, 'MAIN_AGENT_REQUIRED')
})
test('all command targets require explicit allowed main identity and ambiguous templates stay explicit', async () => {
  const c = await fixture()
  for (const command of c.manifest.commands) {
    const targets = command.targetPresetIds ?? command.targetPresetChoices
    assert.ok(targets.length > 0)
    assert.equal(command.selectionRequired, targets.length > 1)
    if (targets.length > 1) assert.equal(command.targetPresetId, null)
    const result = schemas.PreparedDraft.parse(await c.prepareDraft({ agentId: targets[0], commandId: command.id }))
    assert.equal(result.status, 'DRAFT_READY', command.id)
    assert.ok(result.prompt.length > 300)
  }
  assert.equal((await c.prepareDraft({ agentId: 'finance-pitch-agent', commandId: 'missing' })).error.code, 'COMMAND_ROLE_MISMATCH')
})
test('steering drafts preserve role ownership and template selection is strict at the entry', async () => {
  const c = await fixture()
  for (const entry of c.manifest.steering) {
    const result = await c.prepareDraft({ agentId: entry.targetPresetId, steeringId: entry.id })
    assert.equal(result.status, 'DRAFT_READY')
    assert.ok(result.prompt.includes(entry.prompt))
  }
  assert.throws(() => schemas.PrepareDraftRequest.parse({ agentId: 'finance-pitch-agent', commandId: 'x', prompt: 'y' }))
  assert.throws(() => schemas.PrepareDraftRequest.parse({ agentId: 'finance-pitch-agent', autoSubmit: true }))
})
