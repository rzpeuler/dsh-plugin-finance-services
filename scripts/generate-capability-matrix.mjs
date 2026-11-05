/**
 * Deterministic capability matrix: one machine-readable table plus one document.
 * Run `node scripts/generate-capability-matrix.mjs` after changing assets or capabilities;
 * tests/capability-matrix.test.js fails when the committed output drifts.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPABILITIES, DATA_CONTRACT_VERSION } from '../src/data/contracts.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export function buildMatrix(manifest, capabilities = CAPABILITIES) {
  const mains = manifest.roles.filter(role => role.kind === 'main')
  const workers = manifest.roles.filter(role => role.kind === 'worker')
  const roleById = new Map(manifest.roles.map(role => [role.id, role]))
  const skillsUsing = new Map()
  for (const role of manifest.roles) {
    for (const name of role.skillNames) skillsUsing.set(name, (skillsUsing.get(name) ?? 0) + 1)
  }
  const matrix = {
    schemaVersion: 1,
    sourceTreeSha256: manifest.sourceTreeSha256,
    contractVersion: DATA_CONTRACT_VERSION,
    counts: {
      mains: mains.length, workers: workers.length, skills: manifest.skills.length,
      commands: manifest.commands.length, capabilities: capabilities.length,
    },
    mains: mains.map(role => ({
      id: role.id,
      workers: role.workerPresetIds,
      writer: role.writer,
      builtinTools: role.builtinTools,
      allowedMcpServers: role.allowedMcpServers,
      skills: role.skillNames.length,
      reviewCheckpoints: role.reviewCheckpoints ?? [],
    })),
    workers: workers.map(role => ({
      id: role.id, parentId: role.parentId, writer: role.writer,
      builtinTools: role.builtinTools, allowedMcpServers: role.allowedMcpServers,
      skills: role.skillNames.length,
    })),
    skills: manifest.skills.map(skill => ({
      name: skill.name,
      assetStatus: skill.assetStatus,
      issues: skill.issues?.length ?? 0,
      boundRoles: skillsUsing.get(skill.name) ?? 0,
    })),
    capabilities: capabilities.map(id => ({
      id,
      contract: true,
      // Production registers no provider; the two TEST_ONLY adapters were removed after their checks.
      registeredProviders: 0,
      status: 'CONTRACT_ONLY',
    })),
  }
  // Referential integrity is part of the matrix, not only of the test.
  for (const main of matrix.mains) {
    if (main.workers.length !== 3) throw new Error(`${main.id} must own exactly three workers`)
    for (const worker of main.workers) {
      const found = roleById.get(worker)
      if (!found || found.parentId !== main.id) throw new Error(`${worker} does not belong to ${main.id}`)
    }
  }
  return matrix
}

export function renderDocument(matrix) {
  const lines = [
    '# 能力与角色映射（生成文件，请勿手改）',
    '',
    `- 契约版本：\`${matrix.contractVersion}\`；源树 \`${matrix.sourceTreeSha256}\``,
    `- 主 Agent ${matrix.counts.mains}、Worker ${matrix.counts.workers}、Skill ${matrix.counts.skills}、命令 ${matrix.counts.commands}、能力 ${matrix.counts.capabilities}`,
    '',
    '## 主 Agent 与 Worker 归属',
    '',
    '| 主 Agent | Worker | 写权限 | 允许来源 | 技能数 |',
    '|---|---|---|---|---:|',
    ...matrix.mains.map(main => `| \`${main.id}\` | ${main.workers.map(id => `\`${id}\``).join('<br>')} | ${main.writer ? 'yes' : 'no'} | ${main.allowedMcpServers.join(', ') || '—'} | ${main.skills} |`),
    '',
    '## 14 个能力现状',
    '',
    '生成时不注册任何 Provider：两个 TEST_ONLY Adapter 在验收后已移除，因此全部为契约层。',
    '',
    '| 能力 | 契约 | 生产 Provider | 状态 |',
    '|---|---|---:|---|',
    ...matrix.capabilities.map(item => `| \`${item.id}\` | yes | ${item.registeredProviders} | ${item.status} |`),
    '',
    '## Skill 资产状态',
    '',
    '| Skill | 资产状态 | 告警数 | 绑定角色数 |',
    '|---|---|---:|---:|',
    ...matrix.skills.map(skill => `| \`${skill.name}\` | ${skill.assetStatus} | ${skill.issues} | ${skill.boundRoles} |`),
    '',
  ]
  return lines.join('\n')
}

if (process.argv[1] && process.argv[1].endsWith('generate-capability-matrix.mjs')) {
  const manifest = JSON.parse(await readFile(join(root, 'assets/agent-manifest.json'), 'utf8'))
  const matrix = buildMatrix(manifest)
  await mkdir(join(root, 'acceptance'), { recursive: true })
  await writeFile(join(root, 'acceptance/CAPABILITY_MATRIX.json'), JSON.stringify(matrix, null, 2) + '\n', 'utf8')
  await writeFile(join(root, 'docs/CAPABILITY_STATUS.md'), renderDocument(matrix), 'utf8')
  console.log(JSON.stringify(matrix.counts))
}
