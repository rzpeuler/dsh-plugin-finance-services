import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildMatrix, renderDocument } from '../scripts/generate-capability-matrix.mjs'
import { CAPABILITIES } from '../src/data/contracts.js'

// Drift guard: the committed matrix must be exactly what the generator produces now.
const manifest = JSON.parse(readFileSync('assets/agent-manifest.json', 'utf8'))
const committed = JSON.parse(readFileSync('acceptance/CAPABILITY_MATRIX.json', 'utf8'))

test('the committed matrix matches a fresh generation', () => {
  const fresh = buildMatrix(manifest, CAPABILITIES)
  assert.deepEqual(committed, fresh, 'run node scripts/generate-capability-matrix.mjs')
})

test('the matrix counts match the audited inventory', () => {
  assert.equal(committed.counts.mains, 10)
  assert.equal(committed.counts.workers, 30)
  assert.equal(committed.counts.skills, 63)
  assert.equal(committed.counts.commands, 41)
  assert.equal(committed.counts.capabilities, 14)
  assert.equal(committed.sourceTreeSha256, manifest.sourceTreeSha256)
  assert.equal(committed.contractVersion, '1.0.0')
})

test('every worker belongs to exactly one main and every main owns three', () => {
  const seen = new Set()
  for (const main of committed.mains) {
    assert.equal(main.workers.length, 3, `${main.id} must own three workers`)
    for (const workerId of main.workers) {
      assert.ok(!seen.has(workerId), `${workerId} claimed twice`)
      seen.add(workerId)
      const worker = committed.workers.find(item => item.id === workerId)
      assert.ok(worker, `${workerId} missing from the worker list`)
      assert.equal(worker.parentId, main.id)
    }
  }
  assert.equal(seen.size, 30)
})

test('the 14 capabilities are unique and still contract-only', () => {
  const ids = committed.capabilities.map(item => item.id)
  assert.equal(new Set(ids).size, 14)
  assert.deepEqual(ids, [...CAPABILITIES])
  for (const item of committed.capabilities) {
    assert.equal(item.contract, true)
    assert.equal(item.registeredProviders, 0, 'no production provider is registered')
    assert.equal(item.status, 'CONTRACT_ONLY')
  }
})

test('no skill is orphaned and every skill keeps its asset status', () => {
  const names = committed.skills.map(skill => skill.name)
  assert.equal(new Set(names).size, 63)
  for (const skill of committed.skills) {
    assert.ok(skill.boundRoles >= 1, `${skill.name} is bound to no role`)
    assert.match(skill.assetStatus, /^[A-Z_]+$/)
  }
})

test('the generated document is what the generator renders and keeps the key sections', () => {
  const document = readFileSync('docs/CAPABILITY_STATUS.md', 'utf8')
  assert.equal(document, renderDocument(committed))
  for (const marker of ['# 能力与角色映射', '## 主 Agent 与 Worker 归属', '## 14 个能力现状', '## Skill 资产状态']) {
    assert.ok(document.includes(marker), `missing section ${marker}`)
  }
  assert.match(document, /TEST_ONLY Adapter 在验收后已移除/)
})
