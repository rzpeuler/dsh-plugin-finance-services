import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Host Theme.listTokens (Client, DSH 0.2.2-rc.1) exposes these names and requires
// light/dark values, but does not expose color values. This is a token-contract test,
// not a WCAG contrast calculation; no DSH source snapshot is copied into this repo.
const publishedThemeTokens = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
])
const sources = [
  readFileSync(new URL('../src/client-factory.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/run/client.js', import.meta.url), 'utf8'),
]
const referencedTokens = [...new Set(sources.flatMap(source =>
  [...source.matchAll(/var\((--dsw-[\w-]+)/g)].map(match => match[1])))]

test('Finance UI styles reference only tokens published by the current runtime theme', () => {
  assert.ok(referencedTokens.length > 0)
  const unsupported = referencedTokens.filter(token => !publishedThemeTokens.has(token))
  assert.deepEqual(unsupported, [], `unknown runtime theme token(s): ${unsupported.join(', ')}`)
  assert.ok(referencedTokens.includes('--dsw-alias-label-primary'))
  assert.ok(referencedTokens.includes('--dsw-alias-bg-base'))
  assert.ok(referencedTokens.includes('--dsw-alias-state-error-primary'))
  assert.ok(referencedTokens.includes('--dsw-alias-brand-primary'))
})

test('interactive state styles use the published brand, surface and border tokens', () => {
  const source = sources[0]
  assert.match(source, /\.finance-p2 :focus-visible \{ outline: 2px solid var\(--dsw-alias-brand-primary\)/)
  assert.match(source, /\.finance-p2 button\.finance-p2__primary \{[^}]*var\(--dsw-alias-bg-layer-2\)[^}]*var\(--dsw-alias-label-primary\)[^}]*var\(--dsw-alias-brand-primary\)/)
  assert.match(source, /\.finance-p2 input, \.finance-p2 select \{[^}]*border: 1px solid var\(--dsw-alias-border-l2\)/)
  assert.match(source, /\.finance-p2__error \{ color: color-mix\(in srgb, var\(--dsw-alias-state-error-primary\) 95%, var\(--dsw-alias-label-primary\)\)/)
})
