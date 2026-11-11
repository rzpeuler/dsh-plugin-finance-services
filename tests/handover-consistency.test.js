import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = file => readFileSync(file, 'utf8')
const json = file => JSON.parse(read(file))
const pkg = json('package.json')
const build = json('lib/build-manifest.json')
const manifest = json('assets/runtime-manifest.json')
const scope = json('assets/runtime-scope.json')

test('package, build artifact, and active-scope documentation agree on one version', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+-alpha\.\d+$/)
  assert.equal(build.version, pkg.version)
  assert.equal(build.package, pkg.name)
  assert.ok(read('README.md').includes(pkg.version))
  assert.ok(read('docs/RUNTIME_SCOPE.md').includes('not installed or pushed'))
})

test('bundle rows contain only four local services and the three Agent/Worker families', () => {
  const patch = read('cordis.patch.yml')
  const rows = [...patch.matchAll(/^    - id: (\S+)\n      name: '([^']+)'/gm)].map(match => ({ row: match[1], module: match[2] }))
  assert.equal(rows.length, 16)
  const ours = rows.filter(row => row.module.includes('@local/dsh-financial-services'))
  assert.deepEqual(ours.map(row => row.row).sort(), ['finance-data', 'finance-review', 'finance-runs', 'financial-services'])
  for (const row of ours) {
    const suffix = row.module.replace('@local/dsh-financial-services', '') || '.'
    const key = suffix === '.' ? '.' : `.${suffix}`
    assert.ok(pkg.exports[key], `row ${row.row} points at missing export ${key}`)
  }
  assert.deepEqual(scope.mainAgentIds.slice().sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'])
  assert.deepEqual([manifest.counts.mainAgents, manifest.counts.workers, manifest.counts.skills, manifest.counts.commands], [3, 9, 22, 16])
})

test('historical catalogue and archive copies are absent from the workspace', () => {
  for (const path of ['assets/agent-manifest.json', 'assets/source-archive', 'assets/source-snapshot.zip', 'assets/skills', 'assets/role-skills', 'assets/commands']) {
    assert.equal(existsSync(path), false, `${path} must stay removed`)
  }
  assert.ok(!('sourceSnapshotSha256' in build))
})
