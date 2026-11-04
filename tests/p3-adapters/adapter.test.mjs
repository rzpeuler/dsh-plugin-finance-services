// Pure Node contract/fakeCtx tests ONLY. These do not claim a native install or live UI verification.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createDataSchemas } from '../../src/data/contracts.js'
import { normalizeObservations } from '../../src/data/normalization.js'
import { FinancialDataRegistry } from '../../src/data/registry.js'
import * as mcp from './mcp-style/index.js'
import * as rest from './rest-file-style/index.js'
import * as template from '../../examples/financial-data-adapter/index.js'
import { createFakeClient } from './mcp-style/client.js'
const schemas = createDataSchemas(z)
const query = overrides => schemas.Query.parse({
  capability: 'financial.statements', entity: { scheme: 'ticker', id: 'TOY' }, market: 'US',
  requiredFields: ['revenue', 'ebitda'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z', purpose: 'research', maxAgeSeconds: 3000000,
  targetUnit: { dimension: 'currency', currency: 'USD', scale: 'ones' },
  accountingBasis: 'US_GAAP', consolidation: 'consolidated', ...overrides,
})
const options = () => ({ signal: new AbortController().signal, requestId: 'fake-node-request' })
const factories = [['mcp', mcp, 'financeTestMcpAdapter'], ['rest', rest, 'financeTestRestAdapter']]
function fakeCtx(registration = {}) {
  const effects = []
  const definitions = new Map()
  const services = new Map()
  const subscriptions = new Map()
  return {
    definitions, services,
    financeData: { registerAdapter(definition) {
      registration.beforeRegister?.()
      schemas.AdapterMetadata.parse(definition.metadata)
      const unsubscribe = definition.state.subscribe(() => registration.changed?.())
      definitions.set(definition.metadata.id, definition)
      subscriptions.set(definition.metadata.id, unsubscribe)
      return () => { unsubscribe(); definitions.delete(definition.metadata.id); subscriptions.delete(definition.metadata.id) }
    } },
    effect(create, label) { assert.match(label, /^finance-/); const dispose = create(); effects.push(dispose); return dispose },
    provide(name, value) {
      registration.beforeProvide?.()
      assert.equal(services.has(name), false)
      services.set(name, value)
      return () => services.delete(name)
    },
    dispose() { for (const dispose of effects.splice(0).reverse()) dispose() },
  }
}
for (const [label, plugin, serviceName] of factories) {
  test(`${label}: strict metadata/result, raw unit and historical PIT`, async () => {
    const adapter = plugin.createAdapter()
    try {
      const meta = schemas.AdapterMetadata.parse(adapter.definition.metadata)
      assert.equal(meta.testOnly, true)
      assert.equal(meta.licenseClass, 'TEST_ONLY')
      assert.equal(meta.sourceId, `test-only-${label}`)
      assert.equal(meta.capabilities.length, 1)
      assert.deepEqual(meta.capabilities[0].fields, ['revenue', 'ebitda'])
      assert.deepEqual(adapter.definition.validate(query(), options()), { compatible: true })
      const result = schemas.AdapterResult.parse(await adapter.definition.query(query(), options()))
      assert.equal(result.observations.length, 2)
      const observation = result.observations[0]
      assert.equal(observation.value, label === 'mcp' ? 2 : 2100000)
      assert.equal(observation.unit.scale, label === 'mcp' ? 'millions' : 'ones')
      assert.deepEqual(Object.keys(observation).sort(), ['field', 'entity', 'value', 'unit', 'period', 'accountingBasis', 'consolidation', 'measurementType', 'sourceAsOf', 'availableAt', 'retrievedAt', 'revision', 'reference', 'licenseClass'].sort())
      assert.equal(observation.measurementType, 'actual')
      assert.ok(result.observations.every(item => item.measurementType === 'actual' && item.period.end <= item.sourceAsOf.slice(0, 10)))
      const { measurementType: _measurementType, ...withoutMeasurementType } = observation
      assert.equal(schemas.Observation.safeParse(withoutMeasurementType).success, false)
      assert.equal(observation.sourceAsOf, '2025-02-01T00:00:00Z')
      assert.equal(observation.availableAt, '2025-02-02T00:00:00Z')
      assert.ok(Date.parse(observation.availableAt) < Date.parse(query().asOf))
      assert.ok(Date.parse(observation.retrievedAt) > Date.parse(query().asOf))
      assert.ok(Math.abs(Date.now() - Date.parse(observation.retrievedAt)) < 5000)
      const normalized = normalizeObservations(query(), result, meta, new Date().toISOString())
      assert.equal(normalized.observations[0].value, label === 'mcp' ? 2000000 : 2100000)
      assert.equal(normalized.observations[0].provenance.originalValue, observation.value)
      assert.equal(normalized.observations[0].provenance.sourceId, meta.sourceId)
      assert.ok(result.warnings.every(warning => warning.includes('TEST_ONLY')))
      assert.equal(schemas.Observation.safeParse({ ...observation, unexpected: true }).success, false)
    } finally { adapter.dispose() }
  })
  test(`${label}: explicit coverage rejection rather than query-shaped fabricated observations`, async () => {
    const adapter = plugin.createAdapter()
    try {
      const cases = [
        [{ capability: 'company.identity' }, 'CAPABILITY_UNAVAILABLE'],
        [{ market: 'CN' }, 'MARKET_UNSUPPORTED'],
        [{ entity: { scheme: 'ticker', id: 'OTHER' } }, 'ENTITY_UNSUPPORTED'],
        [{ requiredFields: ['grossProfit'] }, 'FIELDS_UNSUPPORTED'],
        [{ period: { kind: 'fiscal_year', start: '2023-01-01', end: '2023-12-31' } }, 'PERIOD_UNSUPPORTED'],
        [{ asOf: '2025-02-01T23:59:59Z' }, 'PIT_UNAVAILABLE'],
        [{ maxAgeSeconds: 1 }, 'STALE_DATA'],
        [{ accountingBasis: 'IFRS' }, 'ACCOUNTING_BASIS_INCOMPATIBLE'],
        [{ consolidation: 'parent-only' }, 'CONSOLIDATION_INCOMPATIBLE'],
        [{ targetUnit: { dimension: 'currency', currency: 'EUR', scale: 'ones' } }, 'UNIT_INCOMPATIBLE'],
        [{ sourceIds: ['not-this-source'] }, 'SOURCE_NOT_SELECTED'],
      ]
      for (const [overrides, code] of cases) {
        assert.deepEqual(adapter.definition.validate(query(overrides), options()), { compatible: false, code })
        await assert.rejects(adapter.definition.query(query(overrides), options()), error => error.code === code)
      }
      assert.equal(adapter.definition.validate(query({ requiredFields: ['ebitda'] }), options()).compatible, true)
      const result = await adapter.definition.query(query({ requiredFields: ['ebitda'] }), options())
      assert.deepEqual(result.observations.map(item => item.field), ['ebitda'])
    } finally { adapter.dispose() }
  })
  test(`${label}: actual-only measurement filter, no forecasts mixed into statements`, async () => {
    const adapter = plugin.createAdapter()
    try {
      const actualQuery = query({ measurementType: 'actual' })
      assert.deepEqual(adapter.definition.validate(actualQuery, options()), { compatible: true })
      const result = schemas.AdapterResult.parse(await adapter.definition.query(actualQuery, options()))
      assert.ok(result.observations.every(item => item.measurementType === 'actual'))
      const normalized = normalizeObservations(actualQuery, result, adapter.definition.metadata, new Date().toISOString())
      assert.ok(normalized.observations.every(item => item.measurementType === 'actual'))
      for (const measurementType of ['estimate', 'forecast', 'indicative', 'identity', 'record', 'screening_result']) {
        const incompatible = { ...query(), measurementType }
        assert.deepEqual(adapter.definition.validate(incompatible, options()), { compatible: false, code: 'MEASUREMENT_TYPE_UNSUPPORTED' })
        await assert.rejects(adapter.definition.query(incompatible, options()), error => error.code === 'MEASUREMENT_TYPE_UNSUPPORTED')
      }
    } finally { adapter.dispose() }
  })
  test(`${label}: current verifiedAt, state controls, one-shot failure and abort`, async () => {
    const adapter = plugin.createAdapter()
    try {
      const snapshot = adapter.control.getSnapshot()
      snapshot.state = 'ERROR'
      assert.equal(adapter.control.getSnapshot().state, 'READY')
      assert.ok(Math.abs(Date.now() - Date.parse(snapshot.verifiedAt)) < 5000)
      for (const state of ['NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR']) {
        adapter.control.setState(state)
        assert.equal(adapter.definition.state.getSnapshot().state, state)
        await assert.rejects(adapter.definition.query(query(), options()), error => error.code === state)
      }
      adapter.control.setState('READY')
      adapter.control.failNextQuery()
      await assert.rejects(adapter.definition.query(query(), options()), error => error.code === 'FIXTURE_QUERY_FAILED')
      assert.equal(adapter.control.diagnostics().failureArmed, false)
      assert.equal((await adapter.definition.query(query(), options())).observations.length, 2)
      const controller = new AbortController()
      controller.abort()
      assert.throws(() => adapter.definition.validate(query(), { signal: controller.signal }), { name: 'AbortError' })
      await assert.rejects(adapter.definition.query(query(), { signal: controller.signal }), { name: 'AbortError' })
      assert.throws(() => adapter.control.setState('READY', 'api_key=secret'), /INVALID_TEST_STATE/)
      assert.throws(() => adapter.control.setState('CREDENTIALS_EXPOSED'), /INVALID_TEST_STATE/)
      assert.throws(() => adapter.control.failNextQuery('api_key=secret'), /INVALID_TEST_FAILURE/)
      assert.equal(JSON.stringify(adapter.control.getSnapshot()).includes('secret'), false)
    } finally { adapter.dispose() }
  })
  test(`${label}: armed failure belongs to next query, not an already-started query`, async () => {
    const adapter = plugin.createAdapter()
    try {
      const inFlight = adapter.definition.query(query(), options())
      adapter.control.failNextQuery()
      assert.equal((await inFlight).observations.length, 2)
      assert.equal(adapter.control.diagnostics().failureArmed, true)
      await assert.rejects(adapter.definition.query(query(), options()), error => error.code === 'FIXTURE_QUERY_FAILED')
      assert.equal(adapter.control.diagnostics().failureArmed, false)
    } finally { adapter.dispose() }
  })
  test(`${label}: direct in-flight query cannot publish results after adapter unload`, async () => {
    const adapter = plugin.createAdapter()
    const inFlight = adapter.definition.query(query(), options())
    adapter.dispose()
    await assert.rejects(inFlight, error => error.code === 'ADAPTER_DISPOSED')
  })
  test(`${label}: observer containment reports failures and unload clears callbacks`, () => {
    const adapter = plugin.createAdapter()
    let called = 0
    adapter.definition.state.subscribe(() => { throw new Error('secret should never be retained') })
    const unsubscribe = adapter.definition.state.subscribe(() => called++)
    assert.deepEqual(adapter.control.changed(), { notified: 1, observerFailures: 1 })
    assert.equal(called, 1)
    assert.equal(adapter.control.diagnostics().observerFailures, 1)
    unsubscribe()
    adapter.control.changed()
    assert.equal(called, 1)
    adapter.dispose()
    adapter.dispose()
    assert.equal(adapter.control.diagnostics().listenerCount, 0)
    assert.equal(adapter.control.diagnostics().closed, true)
    assert.throws(() => adapter.control.changed(), /ADAPTER_DISPOSED/)
    assert.throws(() => adapter.definition.state.subscribe(() => {}), /ADAPTER_DISPOSED/)
  })
  test(`${label}: fakeCtx effect registration and cleanup (NOT native install)`, () => {
    const ctx = fakeCtx()
    assert.deepEqual(plugin.inject, ['financeData'])
    plugin.apply(ctx)
    assert.equal(ctx.definitions.size, 1)
    const control = ctx.services.get(serviceName)
    assert.equal(control.diagnostics().listenerCount, 1)
    ctx.dispose()
    assert.equal(ctx.definitions.size, 0)
    assert.equal(ctx.services.size, 0)
    assert.equal(control.diagnostics().listenerCount, 0)
    assert.equal(control.diagnostics().closed, true)
    assert.throws(() => control.setState('READY'), /ADAPTER_DISPOSED/)
  })
  test(`${label}: fakeCtx failed service provision rolls registration back`, () => {
    const ctx = fakeCtx({ beforeProvide() { throw new Error('TEST_PROVISION_FAILURE') } })
    assert.throws(() => plugin.apply(ctx), /TEST_PROVISION_FAILURE/)
    assert.equal(ctx.definitions.size, 0)
    assert.equal(ctx.services.size, 0)
  })
}
test('raw interfaces are intentionally different and package-file fixture is actual JSON', async () => {
  const client = createFakeClient()
  const envelope = await client.tools.call({ name: 'financial_statements', arguments: { symbol: 'TOY', period: 'FY2024', market: 'US', fields: ['revenue'] } })
  assert.equal(envelope.structuredContent.metrics.revenue, 2)
  assert.equal(envelope.structuredContent.magnitude, 'millions')
  assert.equal(envelope.structuredContent.measurementType, 'actual')
  await assert.rejects(client.tools.call({ name: 'arbitrary_tool', arguments: {} }), /FIXTURE_REQUEST_INVALID/)
  const fileEnvelope = JSON.parse(await readFile(new URL('./rest-file-style/fixture.json', import.meta.url), 'utf8'))
  assert.equal(fileEnvelope.status, 200)
  assert.equal(fileEnvelope.body.report.line_items[0].amount, 2100000)
  assert.equal(fileEnvelope.body.report.measurement_type, 'actual')
  assert.equal(fileEnvelope.structuredContent, undefined)
})
test('template is independently identified and defaults NOT_CONFIGURED', async () => {
  const ctx = fakeCtx()
  template.apply(ctx)
  const definition = [...ctx.definitions.values()][0]
  const control = ctx.services.get('financeExampleDataAdapter')
  try {
    assert.equal(definition.metadata.id, 'example-financial-statements')
    assert.equal(definition.metadata.sourceId, 'test-only-template')
    assert.equal(control.getSnapshot().state, 'NOT_CONFIGURED')
    await assert.rejects(definition.query(query(), options()), error => error.code === 'NOT_CONFIGURED')
    control.setState('READY')
    const result = schemas.AdapterResult.parse(await definition.query(query({ sourceIds: ['test-only-template'], measurementType: 'actual' }), options()))
    assert.ok(result.observations.every(item => item.measurementType === 'actual'))
    assert.deepEqual(definition.validate({ ...query(), measurementType: 'forecast' }, options()), { compatible: false, code: 'MEASUREMENT_TYPE_UNSUPPORTED' })
  } finally { ctx.dispose() }
  assert.equal(control.diagnostics().closed, true)
})
test('pure registry integration: no registration grants, atomic fallback, distinct observations (NOT native)', async () => {
  const role = { id: 'finance-test-analyst', allowedMcpServers: ['capiq', 'daloopa'], writer: false }
  const context = { roleId: role.id, scopeId: 'test-native-id-placeholder' }
  const registry = new FinancialDataRegistry({ roles: [role], authorize: value => value === context })
  const a = mcp.createAdapter(), b = rest.createAdapter()
  const offA = registry.registerAdapter(a.definition), offB = registry.registerAdapter(b.definition)
  try {
    assert.equal(registry.catalog().bindings.length, 0)
    assert.equal((await registry.query(query(), context)).status, 'NOT_AUTHORIZED')
    registry.setBindings({ expectedRevision: 0, bindings: [a, b].map((adapter, index) => ({
      adapterId: adapter.definition.metadata.id, sourceAllowlistKey: index ? 'daloopa' : 'capiq',
      scopeIds: [context.scopeId], roleIds: [role.id], capabilities: ['financial.statements'], markets: ['US'], purposes: ['research'],
      priority: index ? 10 : 20, minQuality: 40, enabled: true, allowTestOnly: true,
    })) })
    const first = await registry.query(query(), context)
    assert.equal(first.status, 'OK')
    assert.equal(first.data.observations[0].value, 2000000)
    a.control.failNextQuery()
    const fallback = await registry.query(query(), context)
    assert.equal(fallback.status, 'OK')
    assert.equal(fallback.data.observations[0].value, 2100000)
    assert.equal(fallback.data.observations.length, 2)
    assert.deepEqual(fallback.trace.map(item => item.code), ['FIXTURE_QUERY_FAILED', 'SELECTED'])
    assert.ok(fallback.data.observations.every(item => item.provenance.sourceId === 'test-only-rest'))
    a.control.setState('NOT_AUTHORIZED')
    assert.equal(registry.catalog().adapters.find(item => item.id === a.definition.metadata.id).status.state, 'NOT_AUTHORIZED')
    const unavailablePrimary = await registry.query(query(), context)
    assert.equal(unavailablePrimary.data.observations[0].value, 2100000)
    assert.deepEqual(unavailablePrimary.trace.map(item => item.code), ['NOT_AUTHORIZED', 'SELECTED'])
    b.control.setState('UNAVAILABLE')
    assert.equal((await registry.query(query(), context)).status, 'NOT_AUTHORIZED')
  } finally { offA(); offB(); a.dispose(); b.dispose(); registry.dispose() }
  assert.equal(a.control.diagnostics().listenerCount, 0)
  assert.equal(b.control.diagnostics().listenerCount, 0)
})
