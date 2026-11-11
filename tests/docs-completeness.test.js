import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = file => readFileSync(file, 'utf8')
const json = file => JSON.parse(read(file))
const scope = json('assets/runtime-scope.json')
const manifest = json('assets/runtime-manifest.json')

test('the README and runtime-scope documentation describe the selected scope', () => {
  const readme = read('README.md')
  const scopeDoc = read('docs/RUNTIME_SCOPE.md')
  const version = json('package.json').version
  assert.ok(readme.includes(version))
  for (const agent of ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder']) {
    assert.ok(scopeDoc.includes(agent), `scope documentation must name ${agent}`)
  }
  assert.ok(scopeDoc.includes('22-Skill'))
  assert.ok(scopeDoc.includes('not installed or pushed'))
})

test('scope, manifest and generated capability report agree on active counts', () => {
  const matrix = json('acceptance/CAPABILITY_MATRIX.json')
  assert.deepEqual(scope.mainAgentIds.slice().sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'])
  assert.deepEqual([manifest.counts.mainAgents, manifest.counts.workers, manifest.counts.skills, manifest.counts.commands], [3, 9, 22, 16])
  assert.deepEqual([matrix.counts.mains, matrix.counts.workers, matrix.counts.skills, matrix.counts.commands], [3, 9, 22, 16])
  assert.ok(read('docs/CAPABILITY_STATUS.md').includes('主 Agent 3、Worker 9、Skill 22、命令 16'))
})

test('removed source catalogues and audit copies stay absent', () => {
  for (const path of ['assets/agent-manifest.json', 'assets/source-archive', 'assets/source-snapshot.zip', 'assets/skills', 'assets/role-skills', 'assets/commands']) {
    assert.equal(existsSync(path), false, `${path} must remain absent`)
  }
})
