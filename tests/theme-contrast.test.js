import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const themeManifest = JSON.parse(readFileSync(new URL('../audit/dsh-reference/packages/client/ui-theme/package.json', import.meta.url), 'utf8'))
const themeCss = readFileSync(new URL('../audit/dsh-reference/packages/client/ui-theme/src/styles/design-platform.css', import.meta.url), 'utf8')
const bundleSource = readFileSync(new URL('../src/client-factory.js', import.meta.url), 'utf8')
const themeBlocks = [...themeCss.matchAll(/(body(?:\[data-ds-dark-theme\])?)\s*\{([^}]*)\}/g)]
const lightTokens = new Map()
const darkTokens = new Map()

for (const [, selector, block] of themeBlocks) {
  const target = selector === 'body[data-ds-dark-theme]' ? darkTokens : lightTokens
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) target.set(name, value.trim())
}
for (const [name, value] of lightTokens) if (!darkTokens.has(name)) darkTokens.set(name, value)

function resolveColor(name, tokens, seen = new Set()) {
  assert.ok(!seen.has(name), `cyclic theme token: ${name}`)
  seen.add(name)
  const value = tokens.get(name)
  assert.ok(value, `missing theme token: ${name}`)
  const reference = value.match(/^var\((--[\w-]+)\)$/)
  if (reference) return resolveColor(reference[1], tokens, seen)
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  assert.ok(rgb, `unsupported theme color for ${name}: ${value}`)
  return rgb.slice(1).map(Number)
}

function relativeLuminance([red, green, blue]) {
  const linear = value => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

function contrast(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function mix(first, second, firstWeight) {
  return first.map((channel, index) => Math.round(channel * firstWeight + second[index] * (1 - firstWeight)))
}

function tokenRatio(mode, foreground, background) {
  const tokens = mode === 'light' ? lightTokens : darkTokens
  return contrast(resolveColor(foreground, tokens), resolveColor(background, tokens))
}

test('Settings form styles use contrast-safe theme tokens', () => {
  assert.equal(themeManifest.name, '@deepseek-ai/dsh-client-ui-theme')
  assert.equal(themeManifest.version, '0.2.1-rc.5')
  assert.match(bundleSource, /\.finance-p2 input, \.finance-p2 select \{[^}]*border: 1px solid var\(--dsw-alias-label-tertiary\)/)
  assert.match(bundleSource, /\.finance-p2 input::placeholder \{ color: var\(--dsw-alias-label-secondary\); \}/)
  assert.match(bundleSource, /\.finance-p2 button \{[^}]*border: 1px solid var\(--dsw-alias-label-tertiary\)/)
  assert.match(bundleSource, /\.finance-p2__error \{ color: color-mix\(in srgb, var\(--dsw-alias-state-error-primary\) 95%, var\(--dsw-alias-label-primary\)\)/)
  assert.match(bundleSource, /\.finance-p2 textarea \{[^}]*border: 1px solid var\(--dsw-alias-label-tertiary\)/)
  assert.match(bundleSource, /\.finance-p2 :focus-visible \{ outline: 2px solid var\(--dsw-alias-state-business-primary\)/)

  for (const mode of ['light', 'dark']) {
    const tokens = mode === 'light' ? lightTokens : darkTokens
    const base = resolveColor('--dsw-alias-bg-base', tokens)
    const primary = resolveColor('--dsw-alias-label-primary', tokens)
    const placeholder = resolveColor('--dsw-alias-label-secondary', tokens)
    const error = mix(resolveColor('--dsw-alias-state-error-primary', tokens), primary, 0.95)
    const controlBorder = resolveColor('--dsw-alias-label-tertiary', tokens)
    const focus = resolveColor('--dsw-alias-state-business-primary', tokens)
    const elevatedButton = resolveColor('--dsw-alias-button-elevated-fill', tokens)

    assert.ok(contrast(placeholder, base) >= 4.5, `${mode} placeholder text must meet 4.5:1`)
    assert.ok(contrast(error, base) >= 4.5, `${mode} error text must meet 4.5:1`)
    assert.ok(contrast(controlBorder, base) >= 3, `${mode} field boundary must meet 3:1`)
    assert.ok(contrast(controlBorder, elevatedButton) >= 3, `${mode} button boundary must meet 3:1`)
    assert.ok(contrast(focus, base) >= 3, `${mode} focus indicator must meet 3:1`)
  }
})
