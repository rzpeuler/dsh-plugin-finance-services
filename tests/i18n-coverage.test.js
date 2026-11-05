import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Static coverage only: literal keys passed to the local translator are checked against the
// file's double dictionary. Dynamic keys are excluded, and rendering is not exercised here.
const FILES = [
  ['src/client-factory.js', 't'],
  ['src/data/client-panel.js', 't'],
  ['src/review/client-panel.js', 't'],
  ['src/workbench/client-panel.js', 't'],
]

const read = file => readFileSync(file, 'utf8')
const usedKeys = (source, translator) => {
  const pattern = new RegExp(`\\b${translator}\\('([A-Za-z][A-Za-z0-9_]*)'\\)`, 'g')
  const keys = new Set()
  for (const match of source.matchAll(pattern)) keys.add(match[1])
  return [...keys].sort()
}

test('every literal translation key exists in both dictionaries', () => {
  const report = []
  for (const [file, translator] of FILES) {
    const source = read(file)
    const keys = usedKeys(source, translator)
    assert.ok(keys.length > 0, `${file} uses ${translator}() but no literal keys were found`)
    const missing = []
    for (const key of keys) {
      // A key must appear at least twice: once in the en dictionary and once in zh.
      const occurrences = source.match(new RegExp(`(^|[^A-Za-z0-9_])${key}\\s*:`, 'g'))?.length ?? 0
      if (occurrences < 2) missing.push({ key, occurrences })
    }
    report.push({ file, keys: keys.length, missing })
  }
  const failures = report.filter(entry => entry.missing.length)
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2))
})

function dictionaryKeys(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) return null
  const open = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let index = open; index < source.length; index++) {
    const character = source[index]
    if (character === '{') depth++
    else if (character === '}') { depth--; if (depth === 0) { end = index; break } }
  }
  if (end < 0) return null
  return new Set([...source.slice(open + 1, end).matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:/g)].map(match => match[1]))
}

test('the dictionaries declare the same key set in both languages', () => {
  for (const [file] of FILES) {
    const source = read(file)
    const en = dictionaryKeys(source, 'en: {')
    const zh = dictionaryKeys(source, 'zh: {')
    if (!en || !zh) continue
    const onlyEnglish = [...en].filter(key => !zh.has(key)).sort()
    const onlyChinese = [...zh].filter(key => !en.has(key)).sort()
    assert.deepEqual(onlyEnglish, [], `${file}: keys only in en`)
    assert.deepEqual(onlyChinese, [], `${file}: keys only in zh`)
  }
})
