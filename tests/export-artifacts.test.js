import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Guards the defect found in the reproducible-build check: an export pointing at a stale file,
// or an artifact nobody exports, must fail here rather than ship.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const exportsList = Object.entries(pkg.exports)

test('every export that names a lib file resolves on disk', () => {
  const referenced = []
  for (const [key, value] of exportsList) {
    if (typeof value !== 'string' || !value.startsWith('./lib/')) continue
    assert.ok(existsSync(value), `export ${key} points at missing ${value}`)
    referenced.push(value.replace('./lib/', ''))
  }
  assert.ok(referenced.length >= 8, `expected the compiled exports, found ${referenced.length}`)
})

test('every shipped artifact is reachable from an export', () => {
  const exported = new Set(exportsList
    .map(([, value]) => (typeof value === 'string' && value.startsWith('./lib/') ? value.replace('./lib/', '') : null))
    .filter(Boolean))
  const artifacts = readdirSync('lib').filter(name => name.endsWith('.js'))
  const orphans = artifacts.filter(name => !exported.has(name))
  assert.deepEqual(orphans, [], `artifacts shipped without an export: ${orphans.join(', ')}`)
})

test('the compatibility aliases are byte-identical to their canonical entry', () => {
  const read = name => readFileSync(join('lib', name), 'utf8')
  assert.equal(read('role.js'), read('role-data-1.js'), 'lib/role.js must carry the canonical role generation')
  assert.equal(read('role-numeric-1.js'), read('role-data-1.js'), 'lib/role-numeric-1.js must carry the canonical role generation')
})

test('the manifest names exactly the artifacts that exist', () => {
  const manifest = JSON.parse(readFileSync('lib/build-manifest.json', 'utf8'))
  // client.js is recorded as clientSha256 rather than as an entry, so add it explicitly.
  const declared = new Set([...Object.keys(manifest.entrySha256), 'client.js'])
  const present = new Set(readdirSync('lib').filter(name => name.endsWith('.js')))
  assert.deepEqual([...declared].sort(), [...present].sort(), 'manifest entries and lib artifacts must match exactly')
  assert.equal(typeof manifest.clientSha256, 'string')
  assert.equal(manifest.package, pkg.name)
  assert.equal(manifest.version, pkg.version)
})

test('no artifact ships under a directory name that shadows an entry', () => {
  // An old lib/host/ directory used to ship next to lib/host.js; directories must not appear.
  const entries = readdirSync('lib', { withFileTypes: true })
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
  assert.deepEqual(directories, [], `unexpected directories in lib: ${directories.join(', ')}`)
  assert.ok(dirname(join('lib', 'host.js')))
})
