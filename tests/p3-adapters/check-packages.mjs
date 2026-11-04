// Local distribution and syntax checks. NO install, publish, profile mutation, network or model execution.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, copyFile, rm, stat } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const packages = [path.join(here, 'mcp-style'), path.join(here, 'rest-file-style'), path.join(root, 'examples/financial-data-adapter')]
const stagingRoot = path.join(here, '.package-check')
await mkdir(stagingRoot, { recursive: true })
const staging = await mkdtemp(path.join(stagingRoot, 'isolated-'))
const names = new Set()
const adapterIds = new Set()
const sourceIds = new Set()
let totalFiles = 0
const query = {
  capability: 'financial.statements', entity: { scheme: 'ticker', id: 'TOY' }, market: 'US', requiredFields: ['revenue', 'ebitda'],
  period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' }, asOf: '2025-03-01T00:00:00Z',
  purpose: 'research', maxAgeSeconds: 3000000,
}
function syntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `Syntax check failed: ${file}`)
}
try {
  for (const [index, dir] of packages.entries()) {
    const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
    assert.equal(manifest.private, true)
    assert.equal(manifest.type, 'module')
    assert.equal(manifest.version, '1.0.0')
    assert.equal(manifest.engines.dsh, '0.2.1-rc.5')
    assert.equal(manifest.dependencies, undefined)
    assert.equal(manifest.scripts, undefined)
    assert.equal(names.has(manifest.name), false)
    names.add(manifest.name)
    assert.equal(manifest.exports['.'], './index.js')
    assert.equal(manifest.exports['./icon'], './icon.svg')
    assert.equal(manifest.exports['./locale/*.json'], './locale/*.json')
    assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
    const patch = await readFile(path.join(dir, 'cordis.patch.yml'), 'utf8')
    assert.match(patch, /^- insert:\r?\n    - id: [a-z0-9-]+\r?\n      name: '@local\/[a-z0-9-]+'\r?\n      config: \{\}\r?\n$/)
    assert.ok(patch.includes(`name: '${manifest.name}'`))
    const files = ['package.json']
    for (const item of manifest.files) {
      assert.equal(path.isAbsolute(item), false)
      assert.equal(item.includes('..'), false)
      if (item === 'locale/*.json') {
        for (const name of await readdir(path.join(dir, 'locale'))) if (name.endsWith('.json')) files.push(`locale/${name}`)
      } else { assert.equal(item.includes('*'), false); files.push(item) }
    }
    for (const required of ['README.md', 'index.js', 'control.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) assert.ok(files.includes(required))
    for (const locale of ['en', 'zh']) {
      const value = JSON.parse(await readFile(path.join(dir, `locale/${locale}.json`), 'utf8'))
      assert.ok(value.meta.title.length > 8)
      assert.ok(value.meta.description.length > 20)
    }
    const icon = await readFile(path.join(dir, 'icon.svg'), 'utf8')
    assert.ok(Buffer.byteLength(icon) < 256 * 1024)
    // Intentionally accept only the exact safe, self-contained SVG grammar used by this original artwork.
    assert.match(icon, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="13" fill="#[0-9a-f]{6}"\/><path d="[MQLHV0-9 .-]+" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"\/><circle cx="49" cy="16" r="5" fill="#f4c75e"\/><\/svg>\n$/)
    const isolated = path.join(staging, `package-${index}`)
    for (const file of files) {
      const source = path.join(dir, file), destination = path.join(isolated, file)
      assert.equal((await stat(source)).isFile(), true)
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination)
      totalFiles++
      if (!file.endsWith('.js')) continue
      const sourceText = await readFile(source, 'utf8')
      for (const match of sourceText.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        const specifier = match[1]
        assert.ok(specifier.startsWith('./') || specifier.startsWith('node:'), `Cross-package runtime import: ${specifier}`)
        if (specifier.startsWith('./')) assert.ok(files.includes(specifier.slice(2)))
      }
      assert.doesNotMatch(sourceText, /\b(?:fetch|eval|exec|spawn|WebSocket)\s*\(/)
      syntax(source)
    }
    const plugin = await import(pathToFileURL(path.join(isolated, manifest.exports['.'])).href)
    assert.deepEqual(plugin.inject, ['financeData'])
    const adapter = plugin.createAdapter()
    try {
      assert.equal(adapterIds.has(adapter.definition.metadata.id), false)
      assert.equal(sourceIds.has(adapter.definition.metadata.sourceId), false)
      adapterIds.add(adapter.definition.metadata.id)
      sourceIds.add(adapter.definition.metadata.sourceId)
      const expected = index === 2 ? 'NOT_CONFIGURED' : 'READY'
      assert.equal(adapter.control.getSnapshot().state, expected)
      if (expected === 'NOT_CONFIGURED') adapter.control.setState('READY')
      const result = await adapter.definition.query(query, { signal: new AbortController().signal, requestId: 'isolated-check' })
      assert.equal(result.observations.length, 2)
      assert.equal(result.observations[0].value, index === 1 ? 2100000 : 2)
      assert.ok(result.observations.every(item => item.measurementType === 'actual' && item.period.end <= item.sourceAsOf.slice(0, 10)))
    } finally { adapter.dispose() }
    console.log(`PASS ${manifest.name}: ${files.length} distribution files, locales, original SVG, isolated runtime, syntax`)
  }
  syntax(path.join(here, 'adapter.test.mjs'))
  syntax(path.join(here, 'generate-packages.mjs'))
  syntax(fileURLToPath(import.meta.url))
  console.log(`PASS ${packages.length} independent bundles; ${totalFiles} copied distribution files; no installation or native UI verification claimed`)
} finally {
  // Verify the resolved absolute removal target is the exact newly allocated child of the owned staging root.
  const target = path.resolve(staging)
  assert.equal(path.dirname(target), path.resolve(stagingRoot))
  assert.ok(path.basename(target).startsWith('isolated-'))
  await rm(target, { recursive: true, force: false })
}
