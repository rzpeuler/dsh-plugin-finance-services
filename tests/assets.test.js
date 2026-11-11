import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
const assets = new URL('../assets/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('../assets/runtime-manifest.json', import.meta.url), 'utf8'))
const scope = JSON.parse(await readFile(new URL('../assets/runtime-scope.json', import.meta.url), 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const expectedMainIds = ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder']
const expectedSkills = Object.values(scope.skillsByDomain).flat().sort()

async function walk(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)
    const status = await lstat(path)
    assert.equal(status.isSymbolicLink(), false, `symlink/junction forbidden: ${path.href}`)
    if (status.isDirectory()) output.push(...await walk(path))
    else { assert.ok(status.isFile()); output.push(path) }
  }
  return output
}

 test('the active manifest contains only the selected Agents, Workers, and vertical Skills', () => {
  assert.deepEqual(manifest.scope.mainAgentIds.slice().sort(), expectedMainIds)
  assert.deepEqual(manifest.counts, { mainAgents: 3, workers: 9, skills: 22, commands: 16, steering: 9 })
  assert.equal(manifest.roles.length, 12)
  assert.deepEqual(manifest.roles.filter(role => role.kind === 'main').map(role => role.id).sort(), expectedMainIds)
  assert.equal(manifest.roles.filter(role => role.kind === 'worker').length, 9)
  assert.deepEqual(manifest.skills.map(skill => skill.name).sort(), expectedSkills)
  assert.ok(manifest.commands.every(command => command.targetPresetIds.every(id => expectedMainIds.includes(id))))
  assert.ok(manifest.steering.every(item => expectedMainIds.includes(item.targetPresetId)))
})

test('each Skill has only retained vertical-directory origins and verified files', async () => {
  for (const skill of manifest.skills) {
    assert.ok(skill.origins.length)
    assert.ok(skill.origins.every(origin => scope.skillSourceRoots.some(root => origin.path.startsWith(`${root}/${skill.name}/`))))
    const directory = new URL(`../assets/${skill.directory}/`, import.meta.url)
    const actual = (await walk(directory)).map(file => file.pathname.slice(directory.pathname.length)).sort()
    assert.deepEqual(actual, skill.files.map(file => file.path).sort(), skill.name)
    for (const file of skill.files) assert.equal(sha256(await readFile(new URL(file.path, directory))), file.sha256)
  }
})

test('selected prompts, command assets and role-isolated roots are complete', async () => {
  const roleIds = new Set(manifest.roles.map(role => role.id))
  for (const role of manifest.roles) {
    const prompt = await readFile(new URL(`../assets/${role.prompt.adaptedPath}`, import.meta.url))
    assert.equal(sha256(prompt), role.prompt.adaptedSha256, role.id)
    const root = new URL(`../assets/${role.skillRoot}/`, import.meta.url)
    const marker = JSON.parse(await readFile(new URL('.scope.json', root), 'utf8'))
    assert.equal(marker.roleId, role.id)
    assert.equal(marker.grantsTools, false)
    assert.deepEqual(marker.skillNames, role.skillNames)
    assert.deepEqual((await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(), role.skillNames.slice().sort())
  }
  for (const command of manifest.commands) {
    assert.ok(command.targetPresetIds.every(id => roleIds.has(id)))
    const prompt = await readFile(new URL(`../assets/${command.promptPath}`, import.meta.url))
    assert.equal(sha256(prompt), command.promptSha256, command.id)
  }
})

test('the full historical manifest, four-domain skill trees and source archive are absent', async () => {
  for (const relative of ['assets/agent-manifest.json', 'assets/asset-references.json', 'assets/.migration-owned.json', 'assets/source-snapshot.zip', 'assets/source-archive', 'assets/skills', 'assets/role-skills', 'assets/commands']) {
    await assert.rejects(lstat(new URL(`../${relative}`, import.meta.url)), { code: 'ENOENT' }, relative)
  }
  const assetFiles = (await walk(assets)).map(file => file.pathname)
  assert.ok(assetFiles.every(file => !file.includes('/source-archive/')))
  assert.ok(assetFiles.every(file => !file.includes('/finance-pitch-agent') && !file.includes('/finance-meeting-prep-agent') && !file.includes('/finance-gl-reconciler') && !file.includes('/finance-kyc-screener') && !file.includes('/finance-valuation-reviewer') && !file.includes('/finance-month-end-closer') && !file.includes('/finance-statement-auditor')))
})
