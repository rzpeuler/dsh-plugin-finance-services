/**
 * Deterministic capability matrix: one machine-readable table plus one document.
 * Run `node scripts/generate-capability-matrix.mjs` after changing assets or capabilities;
 * tests/capability-matrix.test.js fails when the committed output drifts.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPABILITIES } from '../src/data/contracts.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export function buildMatrix(manifest, capabilities = CAPABILITIES) {
  const mains = manifest.roles.filter(role => role.kind === 'main')
  const workers = manifest.roles.filter(role => role.kind === 'worker')
  const roleById = new Map(manifest.roles.map(role => [role.id, role]))
  const skillsUsing = new Map()
  for (const role of manifest.roles) {
    for (const name of role.skillNames) skillsUsing.set(name, (skillsUsing.get(name) ?? 0) + 1)
  }
  const contractOnly = ids => ids.map(id => ({ id, contract: true, registeredProviders: 0, status: 'CONTRACT_ONLY' }))
  const matrix = {
    schemaVersion: 3,
    sourceTreeSha256: manifest.sourceTreeSha256,
    counts: {
      mains: mains.length, workers: workers.length, skills: manifest.skills.length,
      commands: manifest.commands.length, steering: manifest.counts.steering, capabilities: capabilities.length,
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
    capabilities: contractOnly(capabilities),
    candidateAdapters: {
      cnequityReaderDefinitions: 3,
      cnequityReaderRegistered: 0,
      fprovAshareDefinitions: 3,
      fprovAshareRegistered: 0,
      fprovAshareAuthorized: 0,
      defaultSymbolAllowlistSize: 0,
      defaultPermissionFlagsEnabled: 0,
    },
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
    `- 唯一 FinanceData 契约；源树 \`${matrix.sourceTreeSha256}\``,
    `- 主 Agent ${matrix.counts.mains}、Worker ${matrix.counts.workers}、Skill ${matrix.counts.skills}、命令 ${matrix.counts.commands}、steering样例 ${matrix.counts.steering}、数据能力 ${matrix.counts.capabilities}`,
    '',
    '## 主 Agent 与 Worker 归属',
    '',
    '| 主 Agent | Worker | 写权限 | 允许来源 | 技能数 |',
    '|---|---|---|---|---:|',
    ...matrix.mains.map(main => `| \`${main.id}\` | ${main.workers.map(id => `\`${id}\``).join('<br>')} | ${main.writer ? 'yes' : 'no'} | ${main.allowedMcpServers.join(', ') || '—'} | ${main.skills} |`),
    '',
    '## 唯一 FinanceData 能力现状',
    '',
    '当前只有一套 FinanceData 能力契约。CNEquity Reader 有 3 个本地 TEST_ONLY factory；FPROV-01另有3个独立UNASSESSED A-share Adapter定义。两组均未注册/授权，默认代码allowlist为空，FPROV直接来源审核尚未建立。',
    '',
    '| FinanceData 能力 | 已有契约 | 已注册 Provider | 状态 |',
    '|---|---:|---:|---|',
    ...matrix.capabilities.map(item => `| \`${item.id}\` | yes | ${item.registeredProviders} | ${item.status} |`),
    '',
    '## 未注册 A-share 候选状态',
    '',
    '| 候选组 | 定义数 | 已注册 | 已授权 | 默认符号 allowlist | 默认权限标志 |',
    '|---|---:|---:|---:|---:|---:|',
    `| CNEquity Reader（TEST_ONLY） | ${matrix.candidateAdapters.cnequityReaderDefinitions} | ${matrix.candidateAdapters.cnequityReaderRegistered} | 0 | ${matrix.candidateAdapters.defaultSymbolAllowlistSize} | ${matrix.candidateAdapters.defaultPermissionFlagsEnabled} |`,
    `| FPROV-01 A-share（UNASSESSED） | ${matrix.candidateAdapters.fprovAshareDefinitions} | ${matrix.candidateAdapters.fprovAshareRegistered} | ${matrix.candidateAdapters.fprovAshareAuthorized} | ${matrix.candidateAdapters.defaultSymbolAllowlistSize} | ${matrix.candidateAdapters.defaultPermissionFlagsEnabled} |`,
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
  const manifest = JSON.parse(await readFile(join(root, 'assets/runtime-manifest.json'), 'utf8'))
  const matrix = buildMatrix(manifest)
  await mkdir(join(root, 'acceptance'), { recursive: true })
  await writeFile(join(root, 'acceptance/CAPABILITY_MATRIX.json'), JSON.stringify(matrix, null, 2) + '\n', 'utf8')
  await writeFile(join(root, 'docs/CAPABILITY_STATUS.md'), renderDocument(matrix), 'utf8')
  console.log(JSON.stringify(matrix.counts))
}
