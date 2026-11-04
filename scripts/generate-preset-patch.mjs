/** Emit native Preset declarations; only the user-facing Bundle is an installation unit. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'assets/agent-manifest.json'), 'utf8'))
assert.equal(manifest.roles.length, 40)
assert.equal(new Set(manifest.roles.map(role => role.id)).size, 40)
const lines = ['# Generated from audited financial assets. Do not edit the declarations by hand.', '- insert:',
  '    - id: financial-services', "      name: '@local/dsh-financial-services'"]
const quoted = value => JSON.stringify(value)
let order = 1000
for (const role of manifest.roles) {
  const prompt = await readFile(join(root, 'assets', role.prompt.adaptedPath), 'utf8')
  assert.equal(createHash('sha256').update(prompt).digest('hex'), role.prompt.adaptedSha256)
  assert.ok(!prompt.includes('{{'), `Unresolved persona template variable: ${role.id}`)
  lines.push(`    - id: preset-${role.id}`, "      name: '@deepseek-ai/dsh-agent-preset'", '      config:',
    `        id: ${role.id}`, `        name: ${quoted(`${role.kind === 'worker' ? 'Internal Worker · ' : 'Financial Services · '}${role.name}`)}`,
    `        description: ${quoted(role.description)}`, `        order: ${order++}`, '        plugins:',
    '          - id: finance-floor', "            name: '@local/dsh-financial-services/floor'", '            config:',
    `              roleId: ${role.id}`, `              sourceSha256: ${quoted(role.source.sha256)}`, `              adaptedPromptSha256: ${quoted(role.prompt.adaptedSha256)}`,
    '          - id: persona', "            name: '@deepseek-ai/dsh-persona'", '            config:',
    `              prefix: ${quoted(prompt)}`, '              complete: false', '              includeRuntimeContext: true',
    '          - id: finance-skills', '            name: cordis:group', '            group: true',
    '            isolate:', '              skills: true', '            config:',
    '              - id: registry', "                name: '@deepseek-ai/dsh-skill'",
    '              - id: filesystem', "                name: '@deepseek-ai/dsh-skill-filesystem'",
    '                inject: [financeOperations]', '                config:', `                  providerName: ${quoted(role.id)}`,
    '                  includeDefaultRoots: false', '                  watch: false',
    '                  customSkillDirs:', `                    - !!js ctx.financeOperations.skillRoot(${quoted(role.id)})`,
    '              - id: tool-skill', "                name: '@deepseek-ai/dsh-tool-skill'", '                config:',
    '                  catalogDescriptionMaxLength: 240')
  if (role.kind === 'main') {
    assert.equal(role.workerPresetIds.length, 3)
    lines.push('          - id: tool-ask-user', "            name: '@deepseek-ai/dsh-tool-ask-user'", '            config:', '              mode: legacy',
      '          - id: tool-subagent-control', "            name: '@deepseek-ai/dsh-tool-subagent-control'",
      '          - id: tool-subagent-list-agents', "            name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'",
      '          - id: tool-subagent', "            name: '@deepseek-ai/dsh-tool-subagent'", '            config:',
      '              provider: spawn', '              toolName: subagent', '              maxDepth: 1',
      `              agentPreset: ${role.workerPresetIds[0]}`, '              allowedAgentPresets:',
      ...role.workerPresetIds.map(id => `                - ${id}`))
  } else {
    assert.deepEqual(role.workerPresetIds, [])
  }
  lines.push('          - id: finance-role', "            name: '@local/dsh-financial-services/role'", '            config:', `              roleId: ${role.id}`)
}
const patch = lines.join('\n') + '\n'
await writeFile(join(root, 'cordis.patch.yml'), patch, 'utf8')
await writeFile(join(root, 'acceptance/P2-preset-patch.json'), JSON.stringify({
  scope: 'Generated declarations, not native activation evidence',
  patchSha256: createHash('sha256').update(patch).digest('hex'),
  mainIds: manifest.roles.filter(role => role.kind === 'main').map(role => role.id),
  workerIds: manifest.roles.filter(role => role.kind === 'worker').map(role => role.id),
  nativeDelegation: 'spawn with three owned presets and maxDepth=1',
  skillIsolation: 'registry + filesystem provider + native skill tool share one isolated skills realm per preset',
  retainedPermissionFloor: 'A separate tools-only plugin keeps ambient capabilities masked until the native revision releases',
}, null, 2) + '\n', 'utf8')
console.log('Generated one Bundle patch: 10 main + 30 Worker native Presets, no global/default preset overrides.')
