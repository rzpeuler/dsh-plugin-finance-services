import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

test('active runtime scope is exactly the requested Agents and vertical Skills', async () => {
  const [scope, manifest] = await Promise.all([
    readJson('../assets/runtime-scope.json'), readJson('../assets/runtime-manifest.json'),
  ])
  const expectedMainIds = ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder']
  const expectedSkillNames = Object.values(scope.skillsByDomain).flat().sort()
  const mains = manifest.roles.filter(role => role.kind === 'main')
  const workers = manifest.roles.filter(role => role.kind === 'worker')
  assert.deepEqual(mains.map(role => role.id).sort(), expectedMainIds)
  assert.equal(workers.length, 9)
  assert.equal(manifest.roles.length, 12)
  assert.deepEqual(manifest.skills.map(skill => skill.name).sort(), expectedSkillNames)
  assert.deepEqual(manifest.counts, { mainAgents: 3, workers: 9, skills: 22, commands: 16, steering: 9 })
  for (const skill of manifest.skills) {
    assert.ok(skill.origins.some(origin => scope.skillSourceRoots.some(root => origin.path.startsWith(`${root}/${skill.name}/`))), skill.name)
    assert.equal(skill.directory, `runtime-skills/${skill.name}`)
  }
  for (const worker of workers) assert.ok(mains.some(main => main.id === worker.parentId && main.workerPresetIds.includes(worker.id)))
  for (const command of manifest.commands) {
    assert.ok(scope.commandSourceRoots.some(root => command.source.path.startsWith(`${root}/`)), command.id)
    assert.ok(command.targetPresetIds.length > 0 && command.targetPresetIds.every(id => expectedMainIds.includes(id)), command.id)
  }
  assert.ok(manifest.steering.every(item => expectedMainIds.includes(item.targetPresetId)))
})
