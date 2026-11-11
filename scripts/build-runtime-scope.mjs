/** Validate the pruned active catalogue and rebuild only its selected role Skill roots. */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const refreshPromptHashes = process.argv.slice(2).includes('--refresh-adapted-prompt-hashes')
if (process.argv.slice(2).some(argument => argument !== '--refresh-adapted-prompt-hashes') || process.argv.slice(2).length > 1) {
  throw new Error('Supported option: --refresh-adapted-prompt-hashes (once)')
}
const readJson = async path => JSON.parse(await readFile(join(root, path), 'utf8'))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const scope = await readJson('assets/runtime-scope.json')
const manifestPath = 'assets/runtime-manifest.json'
const manifest = await readJson(manifestPath)
const mainIds = new Set(scope.mainAgentIds)
const skillRoots = scope.skillSourceRoots
const commandRoots = scope.commandSourceRoots

assert.equal(scope.schemaVersion, 1)
assert.deepEqual([...mainIds].sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'])
assert.equal(Object.values(scope.skillsByDomain).flat().length, 22)
assert.equal(new Set(Object.values(scope.skillsByDomain).flat()).size, 22)
assert.deepEqual(manifest.scope.mainAgentIds, scope.mainAgentIds)
assert.deepEqual(manifest.scope.skillsByDomain, scope.skillsByDomain)
assert.deepEqual(manifest.scope.skillSourceRoots, skillRoots)
assert.deepEqual(manifest.scope.commandSourceRoots, commandRoots)
assert.equal(manifest.counts.mainAgents, 3)
assert.equal(manifest.counts.workers, 9)
assert.equal(manifest.counts.skills, 22)
assert.equal(manifest.counts.commands, 16)
assert.equal(manifest.counts.steering, 9)
assert.equal(manifest.roles.length, 12)
assert.equal(manifest.skills.length, 22)
assert.equal(manifest.commands.length, 16)
assert.equal(manifest.steering.length, 9)

const roleIds = new Set(manifest.roles.map(role => role.id))
assert.equal(roleIds.size, 12)
assert.deepEqual([...manifest.roles.filter(role => role.kind === 'main').map(role => role.id)].sort(), [...mainIds].sort())
for (const role of manifest.roles) {
  assert.ok(role.kind === 'main' || role.kind === 'worker')
  assert.ok(role.skillRoot === `runtime-role-skills/${role.id}`)
  assert.ok(role.prompt?.adaptedPath?.startsWith('prompts/'))
  const prompt = await readFile(join(root, 'assets', role.prompt.adaptedPath))
  const promptHash = sha256(prompt)
  if (refreshPromptHashes) {
    assert.ok(!prompt.toString('utf8').includes('finance_data_query_v2'), `Versioned data tool name remains in ${role.id}`)
    role.prompt.adaptedSha256 = promptHash
  } else assert.equal(promptHash, role.prompt.adaptedSha256, `Selected Agent prompt changed: ${role.id}`)
  for (const name of role.skillNames) assert.ok(Object.values(scope.skillsByDomain).flat().includes(name))
}
for (const role of manifest.roles.filter(role => role.kind === 'main')) {
  assert.equal(role.workerPresetIds.length, 3)
  assert.ok(role.workerPresetIds.every(id => roleIds.has(id)))
}

const skillNames = new Set(Object.values(scope.skillsByDomain).flat())
assert.deepEqual([...manifest.skills.map(skill => skill.name)].sort(), [...skillNames].sort())
for (const skill of manifest.skills) {
  skill.origins = skill.origins.filter(origin => skillRoots.some(path => origin.path.startsWith(`${path}/${skill.name}/`)))
  const expectedRoot = skillRoots.find(path => skill.origins.every(origin => origin.path.startsWith(`${path}/${skill.name}/`)))
  assert.ok(skill.origins.length && expectedRoot, `Skill origins must be exclusively within the two retained vertical directories: ${skill.name}`)
  skill.sourceFamilies = [expectedRoot.split('/').at(-1)]
  assert.equal(skill.directory, `runtime-skills/${skill.name}`)
  for (const file of skill.files) {
    const from = join(root, 'assets', skill.directory, file.path)
    let bytes = await readFile(from)
    if (file.path === 'SKILL.md') {
      const text = bytes.toString('utf8').replace(/Original SKILL.md SHA-256:.*complete source directory archived under.*$/gm,
        `Selected vertical Skill origin: ${skill.origins[0].path}; historical source archives are not bundled.`)
      assert.ok(!text.includes('source-archive'), `Removed archive reference remains in ${skill.name}`)
      bytes = Buffer.from(text, 'utf8')
      await writeFile(from, bytes)
    }
    file.sha256 = sha256(bytes)
  }
}

for (const role of manifest.roles) {
  const scopePath = join(root, 'assets', role.skillRoot, '.scope.json')
  await mkdir(dirname(scopePath), { recursive: true })
  await writeFile(scopePath, JSON.stringify({ schemaVersion: 1, roleId: role.id, skillNames: role.skillNames, grantsTools: false }, null, 2) + '\n')
  for (const name of role.skillNames) {
    const skill = manifest.skills.find(entry => entry.name === name)
    assert.ok(skill, `Role ${role.id} references an absent Skill ${name}`)
    for (const file of skill.files) {
      const from = join(root, 'assets', skill.directory, file.path)
      const to = join(root, 'assets', role.skillRoot, name, file.path)
      const bytes = await readFile(from)
      await mkdir(dirname(to), { recursive: true })
      await writeFile(to, bytes)
    }
  }
}
for (const command of manifest.commands) {
  assert.ok(commandRoots.some(path => command.source.path.startsWith(`${path}/`)), `Out-of-scope command source: ${command.id}`)
  assert.ok(command.targetPresetIds.every(id => mainIds.has(id)), `Out-of-scope command target: ${command.id}`)
  assert.ok(command.promptPath.startsWith('runtime-commands/'))
  const bytes = await readFile(join(root, 'assets', command.promptPath))
  const commandHash = sha256(bytes)
  if (refreshPromptHashes) {
    assert.ok(!bytes.toString('utf8').includes('finance_data_query_v2'), `Versioned data tool name remains in command ${command.id}`)
    command.promptSha256 = commandHash
  } else assert.equal(commandHash, command.promptSha256, `Selected command changed: ${command.id}`)
}
assert.ok(manifest.steering.every(item => mainIds.has(item.targetPresetId)))

delete manifest.sourceManifestSha256
delete manifest.sourceTreeSha256
const trackedPaths = new Set([
  ...manifest.roles.map(role => role.prompt.adaptedPath),
  ...manifest.skills.flatMap(skill => skill.files.map(file => `${skill.directory}/${file.path}`)),
  ...manifest.commands.map(command => command.promptPath),
])
const digest = createHash('sha256')
digest.update(JSON.stringify(manifest))
for (const path of [...trackedPaths].sort()) {
  digest.update(`\n${path}\0`)
  digest.update(await readFile(join(root, 'assets', path)))
}
manifest.sourceTreeSha256 = digest.digest('hex')
await writeFile(join(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Validated pruned runtime scope: ${manifest.counts.mainAgents} main Agents, ${manifest.counts.workers} owned Workers, ${manifest.counts.skills} Skills, ${manifest.counts.commands} commands, ${manifest.counts.steering} steering examples.`)
