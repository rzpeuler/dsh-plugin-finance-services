import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize } from 'node:path'

// Documentation completeness for the delivery list in the task's section 10, item 7 and 8.
// It checks structure and resolvable evidence links, not wording quality or rendered pages.
const REQUIRED = [
  'README.md', 'SOURCE_INVENTORY.md', 'COMPATIBILITY_MATRIX.md', 'MIGRATION_MATRIX.md',
  'SECURITY_MATRIX.md', 'TEST_REPORT.md', 'ACCEPTANCE_REPORT.md',
]
const ACCEPTANCE_FILES = ['acceptance/P0.md', 'acceptance/P1.md', 'acceptance/P2.md', 'acceptance/P3.md',
  'acceptance/P4.md', 'acceptance/P5.md', 'acceptance/P6.md']

const read = file => readFileSync(file, 'utf8')

test('every delivery-list document exists and is non-trivial', () => {
  for (const file of [...REQUIRED, ...ACCEPTANCE_FILES]) {
    assert.ok(existsSync(file), `${file} is missing`)
    assert.ok(read(file).length > 800, `${file} looks empty`)
  }
})

test('the README covers installation, upgrade, uninstall, first use, dependencies and troubleshooting', () => {
  const text = read('README.md')
  for (const heading of ['## 安装', '## 升级与回滚', '## 卸载', '## 首次使用', '## 凭据与数据源依赖', '## Agent 能力目录', '## 排障']) {
    assert.ok(text.includes(heading), `README is missing ${heading}`)
  }
  assert.match(text, /[一-龥]{20,}/, 'README must carry substantive Chinese prose')
  assert.match(read('package.json'), /"version"/)
  const version = JSON.parse(read('package.json')).version
  assert.ok(text.includes(version), `README must name the current version ${version}`)
})

test('the matrices and reports name the known gaps instead of a blanket success', () => {
  const combined = ['COMPATIBILITY_MATRIX.md', 'MIGRATION_MATRIX.md', 'SECURITY_MATRIX.md', 'TEST_REPORT.md', 'ACCEPTANCE_REPORT.md']
    .map(read).join('\n')
  for (const gap of ['Manager', 'Office', 'PARTIAL', 'NOT_RUN']) {
    assert.ok(combined.includes(gap), `documentation must mention ${gap}`)
  }
})

test('every evidence link in the stage documents resolves to a file that exists', () => {
  const documents = [...REQUIRED, ...ACCEPTANCE_FILES, 'PROJECT_STATUS.md']
  const missing = []
  let checked = 0
  for (const document of documents) {
    const base = dirname(document)
    const text = read(document)
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const raw = match[1]
      if (/^(https?:|#|mailto:)/.test(raw)) continue
      // Angle-bracket destinations are allowed by Markdown and are used for Windows paths.
      const target = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
      const withoutAnchor = target.split('#')[0]
      if (!withoutAnchor) continue
      const path = isAbsolute(withoutAnchor) ? normalize(withoutAnchor) : normalize(join(base, withoutAnchor))
      checked += 1
      if (!existsSync(path)) missing.push({ document, target, path })
    }
  }
  assert.ok(checked > 20, `expected many evidence links, checked ${checked}`)
  assert.deepEqual(missing, [], `broken evidence links: ${JSON.stringify(missing.slice(0, 8), null, 2)}`)
})

test('the acceptance directory keeps failures and passing evidence for every stage', () => {
  const entries = readdirSync('acceptance')
  for (const stage of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
    assert.ok(entries.some(name => name.startsWith(stage)), `no acceptance evidence for ${stage}`)
  }
  assert.ok(entries.length > 40, `acceptance evidence looks too thin: ${entries.length} entries`)
  assert.ok(entries.some(name => /failure|fail/i.test(name)), 'at least one retained failure is expected')
})
