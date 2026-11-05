import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Final consistency: version, installed rows, stage records, ledger and handover must agree.
const read = file => readFileSync(file, 'utf8')
const json = file => JSON.parse(read(file))
const pkg = json('package.json')
const build = json('lib/build-manifest.json')
const ledger = json('acceptance/gap-ledger.json')

test('the package, the build artifact and the documentation agree on one version', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+-alpha\.\d+$/)
  assert.equal(build.version, pkg.version)
  assert.equal(build.package, pkg.name)
  assert.ok(read('README.md').includes(pkg.version), 'README must name the current version')
  const handover = read('acceptance/HANDOVER.md')
  assert.ok(handover.includes(pkg.version), 'handover must name the current version')
})

test('every declared bundle row resolves to an exported entry', () => {
  const patch = read('cordis.patch.yml')
  const rows = [...patch.matchAll(/^    - id: (\S+)\n      name: '([^']+)'/gm)].map(match => ({ row: match[1], module: match[2] }))
  assert.ok(rows.length >= 43, `expected the bundle rows, found ${rows.length}`)
  const ours = rows.filter(row => row.module.includes('@local/dsh-financial-services'))
  assert.deepEqual(ours.map(row => row.row).sort(), ['finance-data', 'finance-review', 'financial-services'])
  for (const row of ours) {
    const suffix = row.module.replace('@local/dsh-financial-services', '') || '.'
    const key = suffix === '.' ? '.' : `.${suffix}`
    assert.ok(pkg.exports[key], `row ${row.row} points at missing export ${key}`)
  }
})

test('no stage is claimed accepted while the ledger still lists a gap for it', () => {
  const results = {
    P3: json('acceptance/P3-results.json'), P4: json('acceptance/P4-results.json'),
    P5: json('acceptance/P5-results.json'), P6: json('acceptance/P6-results.json'),
  }
  for (const [stage, result] of Object.entries(results)) {
    assert.equal(result.stageAccepted, false, `${stage} must not be accepted yet`)
    assert.equal(ledger.stages[stage].stageAccepted, false, `ledger must mirror ${stage}`)
    assert.ok(ledger.gaps.some(gap => gap.stage === stage), `${stage} needs an open gap`)
  }
  assert.equal(results.P6.browserRendered, true)
  assert.ok(existsSync(results.P6.manualVerification.record), 'the rendering claim needs its manual record')
})

test('the handover names every unaccepted stage and the blocked items', () => {
  const handover = read('acceptance/HANDOVER.md')
  for (const marker of ['P3', 'P4', 'P5', 'P6', 'MANUAL_CHECKLIST', 'gap-ledger.json']) {
    assert.ok(handover.includes(marker), `handover must reference ${marker}`)
  }
  for (const phrase of ['没有证明', '下一步']) {
    assert.ok(handover.includes(phrase), `handover must keep the ${phrase} section`)
  }
  assert.ok(existsSync('acceptance/MANUAL_CHECKLIST.md'))
  assert.ok(existsSync('acceptance/gap-ledger.json'))
})
