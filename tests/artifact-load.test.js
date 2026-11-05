import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { z } from 'zod'

// Smoke test for the artifacts that will actually be loaded after a restart.
// It does not boot Cordis: it proves each entry imports and exposes the shape the loader expects,
// which is exactly what a stale or half-written build would break.
const CLASS_ENTRIES = ['host', 'review', 'data-runtime-2', 'data']
const FUNCTION_ENTRIES = ['floor', 'role', 'role-numeric-1', 'role-data-1']

test('every compiled entry imports without touching a service runtime', async () => {
  for (const name of [...CLASS_ENTRIES, ...FUNCTION_ENTRIES]) {
    const module = await import(`../lib/${name}.js`)
    assert.ok(module, `${name} did not import`)
  }
})

test('service entries default to their declared class and declare config where they accept it', async () => {
  // financeOperations takes no configuration, so it has no static Config. The review and data
  // services are configured from their native rows and must keep their schema.
  const configured = new Set(['review', 'data-runtime-2', 'data'])
  for (const name of CLASS_ENTRIES) {
    const module = await import(`../lib/${name}.js`)
    assert.equal(typeof module.default, 'function', `${name} must default to a Service class`)
    assert.match(module.default.name, /^(Finance|Data)/, `${name} default export should be a named service`)
    if (configured.has(name)) assert.equal(typeof module.default.Config, 'function', `${name} must declare a Config schema`)
    else assert.equal(module.default.Config, undefined, `${name} declares no configuration on purpose`)
  }
})

test('function plugins declare Config, apply and the dependencies they inject', async () => {
  for (const name of FUNCTION_ENTRIES) {
    const module = await import(`../lib/${name}.js`)
    assert.equal(typeof module.apply, 'function', `${name} must export apply`)
    assert.equal(typeof module.Config, 'function', `${name} must export Config`)
    assert.ok(Array.isArray(module.inject) && module.inject.length >= 1, `${name} must declare inject`)
    assert.equal(typeof module.name, 'string')
  }
})

test('the role aliases carry exactly the canonical generation', () => {
  const canonical = readFileSync('lib/role-data-1.js', 'utf8')
  for (const alias of ['lib/role.js', 'lib/role-numeric-1.js']) {
    assert.equal(readFileSync(alias, 'utf8'), canonical, `${alias} must equal the canonical role entry`)
  }
  assert.equal(readFileSync('lib/data.js', 'utf8'), readFileSync('lib/data-runtime-2.js', 'utf8'),
    'lib/data.js must equal lib/data-runtime-2.js')
})

test('the artifacts carry their reviewed behaviour, not a placeholder', async () => {
  const role = await import('../lib/role-data-1.js')
  // The role plugin must still refuse to run without the permission floor service.
  assert.ok(role.inject.includes('financeOperations'))
  const review = await import('../lib/review.js')
  const service = review.default
  for (const method of ['policy', 'settle', 'evaluate', 'recordStage', 'runs', 'reviewWorkbook']) {
    assert.equal(typeof service.prototype[method], 'function', `FinanceReview must still expose ${method}`)
  }
  const methods = Object.getOwnPropertyNames(service.prototype)
  for (const forbidden of ['publish', 'post', 'postTrade', 'trade', 'transfer', 'placeOrder']) {
    assert.ok(!methods.includes(forbidden), `FinanceReview must not expose ${forbidden}`)
  }
})

test('the client artifact still registers a factory that resolves its two modules', () => {
  typecheck: {
    const artifact = readFileSync('lib/client.js', 'utf8')
    let factory
    runInNewContext(artifact, {
      window: { __ModuleLoader__: { load: options => { factory = options.factory } } },
      require: specifier => {
        if (specifier === 'zod') return { z }
        if (specifier === 'react') return { createElement: () => null, useState: value => [value, () => {}], useEffect: () => {} }
        throw new Error(`unexpected module ${specifier}`)
      },
      AbortController, AbortSignal, TextEncoder, TextDecoder, URL, URLSearchParams, Blob,
      setTimeout, clearTimeout, queueMicrotask,
    })
    assert.equal(typeof factory, 'function')
  }
})
