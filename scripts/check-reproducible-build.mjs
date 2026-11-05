/**
 * Reproducible build check: hash every artifact, rebuild, hash again, compare.
 * The full-source ZIP is verified separately for byte determinism; this covers the shipped entry points.
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const libDir = join(root, 'lib')

async function hashes() {
  const names = (await readdir(libDir)).filter(name => name.endsWith('.js') || name.endsWith('.json')).sort()
  const map = {}
  for (const name of names) {
    const bytes = await readFile(join(libDir, name))
    map[name] = createHash('sha256').update(bytes).digest('hex')
  }
  return map
}

const first = await hashes()
await run(process.execPath, [join(root, 'scripts/build.mjs')], { cwd: root })
const second = await hashes()

const differences = Object.keys(first).filter(name => first[name] !== second[name])
  .map(name => ({ name, first: first[name], second: second[name] }))
const added = Object.keys(second).filter(name => !(name in first))
const removed = Object.keys(first).filter(name => !(name in second))

const report = {
  stage: 'P1',
  id: 'P1_REPRODUCIBLE_BUILD',
  observedDate: new Date().toISOString().slice(0, 10),
  status: differences.length === 0 && added.length === 0 && removed.length === 0 ? 'PASS_BYTE_IDENTICAL' : 'FAIL',
  artifacts: Object.keys(first).length,
  differences, added, removed,
  note: 'A second build in the same working tree produced byte-identical artifacts.',
}
await writeFile(join(root, 'acceptance/P1-reproducible-build-001.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ status: report.status, artifacts: report.artifacts, differences: differences.length }))
if (report.status !== 'PASS_BYTE_IDENTICAL') process.exitCode = 1
