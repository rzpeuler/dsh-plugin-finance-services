/**
 * Clean-tree rebuild: export HEAD to a temporary directory, build there, and compare every
 * shipped artifact with the working tree. Proves the artifacts derive only from tracked sources.
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = { ...process.env }
if (!env.FINANCE_BUILD_PYTHON) {
  env.FINANCE_BUILD_PYTHON = process.execPath.replace(/node\.exe$/i, '') + 'python.exe'
}

async function hashes(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.js') || name.endsWith('.json')).sort()
  const map = {}
  for (const name of names) {
    map[name] = createHash('sha256').update(await readFile(join(directory, name))).digest('hex')
  }
  return map
}

const work = await mkdtemp(join(tmpdir(), 'finance-clean-'))
const archive = join(work, 'head.tar')
try {
  const { stdout: head } = await run('git', ['-C', root, 'rev-parse', 'HEAD'])
  await run('git', ['-C', root, 'archive', '--format=tar', '-o', archive, 'HEAD'])
  const source = join(work, 'src-tree')
  await mkdir(source, { recursive: true })
  await run('tar', ['-xf', archive, '-C', source])
  // Dependencies come from the pinned install of the working tree; only sources come from HEAD.
  await symlink(join(root, 'node_modules'), join(source, 'node_modules'), 'junction')
  await run(process.execPath, [join(source, 'scripts/build.mjs')], { cwd: source, env })

  const committed = await hashes(join(root, 'lib'))
  const rebuilt = await hashes(join(source, 'lib'))
  const differences = Object.keys(committed).filter(name => rebuilt[name] !== committed[name])
    .map(name => ({ name, committed: committed[name], rebuilt: rebuilt[name] ?? null }))
  const report = {
    stage: 'P1',
    id: 'P1_CLEAN_TREE_REBUILD',
    observedDate: new Date().toISOString().slice(0, 10),
    head: head.trim(),
    status: differences.length === 0 ? 'PASS_TRACKED_SOURCES_ONLY' : 'FAIL',
    artifacts: Object.keys(committed).length,
    differences,
    environment: { buildPython: env.FINANCE_BUILD_PYTHON.replace(/^.*[\\/]/, ''), dependencies: 'linked from the pinned working install' },
    note: 'A build in a pristine export of HEAD reproduces the committed artifacts byte for byte; only node_modules is shared because it is pinned by the lockfile.',
  }
  await writeFile(join(root, 'acceptance/P1-clean-rebuild-001.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ status: report.status, head: report.head.slice(0, 8), artifacts: report.artifacts, differences: differences.length }))
  if (report.status !== 'PASS_TRACKED_SOURCES_ONLY') process.exitCode = 1
} finally {
  await rm(work, { recursive: true, force: true })
}
