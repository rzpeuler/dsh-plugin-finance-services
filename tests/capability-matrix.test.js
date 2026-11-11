import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildMatrix, renderDocument } from '../scripts/generate-capability-matrix.mjs'
import { CAPABILITIES } from '../src/data/contracts.js'

// The committed matrix/docs are retained as historical evidence; active contract tests use only the current generator output.
const manifest = JSON.parse(readFileSync('assets/runtime-manifest.json', 'utf8'))
const fresh = buildMatrix(manifest)

test('current generator emits the single active capability list', () => {
  assert.equal(fresh.counts.capabilities, CAPABILITIES.length)
  assert.ok(Array.isArray(fresh.capabilities))
})

test('the matrix counts match the active scope', () => {
  assert.equal(fresh.counts.mains, 3)
  assert.equal(fresh.counts.workers, 9)
  assert.equal(fresh.counts.skills, 22)
  assert.equal(fresh.counts.commands, 16)
  assert.equal(fresh.counts.capabilities, CAPABILITIES.length)
  assert.equal(fresh.sourceTreeSha256, manifest.sourceTreeSha256)
  assert.deepEqual(fresh.candidateAdapters, {
    cnequityReaderDefinitions: 3, registered: 0, authorized: 0,
    defaultSymbolAllowlistSize: 0, defaultPermissionFlagsEnabled: 0,
  })
})

test('every worker belongs to exactly one main and every main owns three', () => {
  const seen = new Set()
  for (const main of fresh.mains) {
    assert.equal(main.workers.length, 3, `${main.id} must own three workers`)
    for (const workerId of main.workers) {
      assert.ok(!seen.has(workerId), `${workerId} claimed twice`)
      seen.add(workerId)
      const worker = fresh.workers.find(item => item.id === workerId)
      assert.ok(worker, `${workerId} missing from the worker list`)
      assert.equal(worker.parentId, main.id)
    }
  }
  assert.equal(seen.size, 9)
})

test('the single capability list is unique and remains contract-only', () => {
  const ids = fresh.capabilities.map(item => item.id)
  assert.equal(new Set(ids).size, CAPABILITIES.length)
  assert.deepEqual(ids, [...CAPABILITIES])
  for (const item of fresh.capabilities) {
    assert.equal(item.contract, true)
    assert.equal(item.registeredProviders, 0, 'no production provider is registered')
    assert.equal(item.status, 'CONTRACT_ONLY')
  }
})

test('no selected Skill is orphaned and every Skill keeps its asset status', () => {
  const names = fresh.skills.map(skill => skill.name)
  assert.equal(new Set(names).size, 22)
  for (const skill of fresh.skills) {
    assert.ok(skill.boundRoles >= 1, `${skill.name} is bound to no role`)
    assert.match(skill.assetStatus, /^[A-Z_]+$/)
  }
})

test('generated capability report matches the sole current capability list', () => {
  const activeDocument = renderDocument(fresh)
  assert.deepEqual(fresh.capabilities.map(item => item.id), CAPABILITIES)
  for (const capability of CAPABILITIES) assert.ok(activeDocument.includes(`| \`${capability}\` |`))
})
