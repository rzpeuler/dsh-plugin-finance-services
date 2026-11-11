import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEastmoneyDaily, parseThsAnnualEps, parseTdxDailyPackage,
  createAshareAdapters, createEastmoneyPriceAdapter, createThsConsensusAdapter } from '../examples/ashare-adapters/sources.js'
import { FinancialDataRegistry } from '../src/data/registry.js'
import { apply as applyAsharePlugin } from '../examples/ashare-adapters/index.js'

const crc32Table = Array.from({ length: 256 }, (_unused, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const crc32 = bytes => {
  let value = 0xffffffff
  for (const byte of bytes) value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
const makeZip = entries => {
  const local = [], central = []
  let offset = 0
  for (const [name, dataValue] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(dataValue), localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8); localHeader.writeUInt32LE(crc32(data), 14); localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22); localHeader.writeUInt16LE(nameBytes.length, 26)
    local.push(localHeader, nameBytes, data)
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0); centralHeader.writeUInt16LE(20, 4); centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8); centralHeader.writeUInt16LE(0, 10); centralHeader.writeUInt32LE(crc32(data), 16)
    centralHeader.writeUInt32LE(data.length, 20); centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28); centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, nameBytes)
    offset += localHeader.length + nameBytes.length + data.length
  }
  const centralBytes = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, centralBytes, end])
}
const makeTdxPackage = () => {
  const code = Buffer.alloc(150), daily = Buffer.alloc(512)
  Buffer.from('600519').copy(code, 0); code.writeUInt16LE(0, 32)
  ;[1438.23, 1444.5, 1431.26, 1439].forEach((value, index) => daily.writeDoubleLE(value, 12 + index * 8))
  daily.writeBigUInt64LE(2_303_784n, 56); daily.writeDoubleLE(3_316_078_849, 72)
  return makeZip({ 'sh261110.cod': code, 'sh261110.md1': daily })
}

test('Eastmoney daily parser maps fqt=0 OHLC and refuses malformed or mismatched rows', () => {
  const body = JSON.stringify({ data: { code: 'SH600519', klines: ['2026-11-10,1438.23,1439.00,1444.50,1431.26,23038,3316078849'] } })
  assert.deepEqual(parseEastmoneyDaily(body, '600519.SH', '2026-11-10'),
    { open: 1438.23, close: 1439, high: 1444.5, low: 1431.26 })
  assert.throws(() => parseEastmoneyDaily(body, '000001.SZ', '2026-11-10'), { code: 'ENTITY_MISMATCH' })
  assert.throws(() => parseEastmoneyDaily('{', '600519.SH', '2026-11-10'), { code: 'INVALID_RESULT' })
  assert.throws(() => parseEastmoneyDaily(JSON.stringify({ data: { code: 'SH600519', klines: [] } }), '600519.SH', '2026-11-10'),
    { code: 'PERIOD_NOT_AVAILABLE' })
})

test('THS parser selects only explicit aggregate consensus EPS rows', () => {
  const html = '<table><tr><th>预测年度</th><th>机构一致预测EPS(元/股)</th></tr><tr><td>2026</td><td>58.75</td></tr></table>'
  assert.deepEqual(parseThsAnnualEps(html, '2026'), { eps: 58.75 })
  assert.throws(() => parseThsAnnualEps('<table><tr><th>年份</th><th>券商EPS</th></tr><tr><td>2026</td><td>99</td></tr></table>', '2026'),
    { code: 'CAPABILITY_UNSUPPORTED' })
  assert.throws(() => parseThsAnnualEps('<table><tr><th>年度</th><th>机构一致预测EPS(元/股)</th></tr><tr><td>2026</td><td>--</td></tr></table>', '2026'),
    { code: 'INVALID_RESULT' })
})

test('TDX ZIP parser checks local/central identity, bounds and CRC before accepting OHLC', () => {
  const valid = makeTdxPackage()
  const rows = parseTdxDailyPackage(valid, ['600519.SH'], '2026-11-10')
  assert.deepEqual(rows, [{ symbol: '600519.SH', open: 1438.23, high: 1444.5, low: 1431.26, close: 1439 }])
  assert.throws(() => parseTdxDailyPackage(valid, ['000001.SZ'], '2026-11-10'), { code: 'PERIOD_NOT_AVAILABLE' })
  assert.throws(() => parseTdxDailyPackage(Buffer.from('not a zip'), ['600519.SH'], '2026-11-10'), { code: 'INVALID_RESULT' })

  const wrongLocalName = Buffer.from(valid)
  wrongLocalName[30] = 'x'.charCodeAt(0)
  assert.throws(() => parseTdxDailyPackage(wrongLocalName, ['600519.SH'], '2026-11-10'), { code: 'INVALID_RESULT' })

  const wrongCentralCrc = Buffer.from(valid)
  const eocd = wrongCentralCrc.length - 22
  const centralOffset = wrongCentralCrc.readUInt32LE(eocd + 16)
  wrongCentralCrc.writeUInt32LE(wrongCentralCrc.readUInt32LE(centralOffset + 16) ^ 1, centralOffset + 16)
  assert.throws(() => parseTdxDailyPackage(wrongCentralCrc, ['600519.SH'], '2026-11-10'), { code: 'INVALID_RESULT' })
  const wrongPayload = Buffer.from(valid)
  wrongPayload[30 + Buffer.byteLength('sh261110.cod')] ^= 1
  assert.throws(() => parseTdxDailyPackage(wrongPayload, ['600519.SH'], '2026-11-10'), { code: 'INVALID_RESULT' })

  const wrongCentralExtent = Buffer.from(valid)
  wrongCentralExtent.writeUInt32LE(wrongCentralExtent.readUInt32LE(eocd + 12) - 1, eocd + 12)
  assert.throws(() => parseTdxDailyPackage(wrongCentralExtent, ['600519.SH'], '2026-11-10'), { code: 'INVALID_RESULT' })
})

test('three candidates register with independent identity and no default ordinary-share grants', async () => {
  const adapters = createAshareAdapters()
  assert.deepEqual(adapters.map(item => item.metadata.id), [
    'ashare-eastmoney-price', 'ashare-ths-consensus', 'ashare-tdx-daily-package',
  ])
  assert.deepEqual(adapters.map(item => item.metadata.sourceId), ['eastmoney', 'ths', 'tdx-daily-package'])
  assert.ok(adapters.every(item => item.metadata.licenseClass === 'UNASSESSED' && item.metadata.testOnly === false))
  assert.ok(adapters.every(item => item.state.getSnapshot().connectionStatus === 'UNKNOWN'))
  const asOf = new Date().toISOString()
  const price = { capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['close'], period: { kind: 'range', start: '2026-11-10', end: '2026-11-10' }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch', maxAgeSeconds: 3600, priceAdjustment: 'none' }
  assert.equal(createEastmoneyPriceAdapter().validate(price).code, 'ENTITY_UNSUPPORTED')
  let wrongMarketFetches = 0
  const bjPrice = { ...price, entity: { scheme: 'ticker', id: '600519.BJ' } }
  const eastmoney = createEastmoneyPriceAdapter({ ordinaryEquitySymbols: ['600519.BJ'], fetchImpl: async () => {
    wrongMarketFetches++
    throw new Error('must not fetch')
  } })
  assert.equal(eastmoney.validate(bjPrice).code, 'ENTITY_UNSUPPORTED')
  await assert.rejects(eastmoney.query(bjPrice), { code: 'ENTITY_UNSUPPORTED' })
  assert.equal(wrongMarketFetches, 0)
  const ths = { capability: 'earnings.consensus', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['eps'], period: { kind: 'fiscal_year', start: '2026-01-01', end: '2026-12-31' }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch', maxAgeSeconds: 3600 }
  assert.equal(createThsConsensusAdapter({ ordinaryEquitySymbols: ['600519.SH'] }).validate(ths).compatible, true)
})

test('Ashare adapters refuse historical replay before any provider I/O', async () => {
  let fetchCalls = 0
  const adapter = createEastmoneyPriceAdapter({ ordinaryEquitySymbols: ['600519.SH'], fetchImpl: async () => {
    fetchCalls++
    throw new Error('historical replay must not fetch')
  } })
  const asOf = new Date().toISOString(), day = asOf.slice(0, 10)
  const query = { capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['close'], period: { kind: 'range', start: day, end: day }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'historicalReplay', maxAgeSeconds: 3600,
    priceAdjustment: 'none' }
  assert.equal(adapter.validate(query).code, 'TEMPORAL_MODE_UNSUPPORTED')
  await assert.rejects(adapter.query(query), { code: 'TEMPORAL_MODE_UNSUPPORTED' })
  assert.equal(fetchCalls, 0)
})

test('THS refuses cross-market suffixes before any fetch even when misconfigured allowlisted', async () => {
  const asOf = new Date().toISOString()
  const template = { capability: 'earnings.consensus', entity: { scheme: 'ticker', id: '' }, market: 'CN',
    requiredFields: ['eps'], period: { kind: 'fiscal_year', start: '2026-01-01', end: '2026-12-31' },
    asOf, purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch', maxAgeSeconds: 3600 }
  let fetchCalls = 0
  for (const suffix of ['SZ', 'BJ']) {
    const id = `600519.${suffix}`
    const adapter = createThsConsensusAdapter({ ordinaryEquitySymbols: [id], fetchImpl: async () => {
      fetchCalls++
      return { ok: true, status: 200, headers: new Headers(), text: async () => '<html></html>' }
    } })
    const query = { ...template, entity: { scheme: 'ticker', id } }
    assert.equal(adapter.validate(query).code, 'CAPABILITY_UNSUPPORTED')
    await assert.rejects(adapter.query(query), { code: 'CAPABILITY_UNSUPPORTED' })
  }
  assert.equal(fetchCalls, 0)
})

test('Host plugin apply rolls back earlier registrations on duplicate failure', () => {
  const registry = new FinancialDataRegistry({ roles: [], authorize: () => false })
  const existing = createThsConsensusAdapter()
  registry.registerAdapter(existing)
  const ctx = { financeData: registry, effect(operation) { return operation() } }
  assert.throws(() => applyAsharePlugin(ctx), { code: 'ADAPTER_DUPLICATE' })
  assert.deepEqual(registry.catalog().adapters.map(item => item.id), ['ashare-ths-consensus'],
    'the earlier Eastmoney registration is rolled back and the pre-existing THS adapter remains')
  registry.dispose()
})

test('Host plugin apply registers and unregisters three separate Adapter identities', () => {
  const registered = [], removed = []
  let cleanup
  const ctx = {
    financeData: { registerAdapter(definition) {
      registered.push(definition.metadata.id)
      return () => removed.push(definition.metadata.id)
    } },
    effect(operation, _label) { cleanup = operation() },
  }
  applyAsharePlugin(ctx)
  assert.deepEqual(registered, ['ashare-eastmoney-price', 'ashare-ths-consensus', 'ashare-tdx-daily-package'])
  cleanup()
  assert.deepEqual(removed, [...registered].reverse())
})

test('caller cancellation leaves the adapter ready for a later successful request', async () => {
  let fetchCalls = 0, announceFetch
  const enteredFetch = new Promise(resolve => { announceFetch = resolve })
  const day = new Date().toISOString().slice(0, 10), asOf = new Date().toISOString()
  const adapter = createEastmoneyPriceAdapter({ ordinaryEquitySymbols: ['600519.SH'], fetchImpl: async (_url, { signal }) => {
    fetchCalls++
    if (fetchCalls === 1) return await new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('caller aborted')), { once: true })
      announceFetch()
    })
    return { ok: true, status: 200, headers: new Headers(),
      text: async () => JSON.stringify({ data: { code: 'SH600519', klines: [`${day},1438.23,1439.00,1444.50,1431.26,23038,3316078849`] } }) }
  } })
  const query = { capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['close'], period: { kind: 'range', start: day, end: day }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch', maxAgeSeconds: 3600, priceAdjustment: 'none' }
  const controller = new AbortController()
  const pending = adapter.query(query, { signal: controller.signal })
  await enteredFetch
  controller.abort()
  await assert.rejects(pending, { code: 'CANCELLED' })
  assert.equal(adapter.state.getSnapshot().state, 'READY')
  assert.equal(adapter.state.getSnapshot().connectionStatus, 'UNKNOWN')
  const recovered = await adapter.query(query)
  assert.equal(recovered.observations[0].value, 1439)
  assert.equal(adapter.state.getSnapshot().connectionStatus, 'CONNECTED')
  assert.equal(fetchCalls, 2)
})

test('a transient source failure leaves the adapter queryable for a later successful retry', async () => {
  const day = new Date().toISOString().slice(0, 10), asOf = new Date().toISOString()
  let fetchCalls = 0
  const adapter = createEastmoneyPriceAdapter({ ordinaryEquitySymbols: ['600519.SH'], fetchImpl: async () => {
    fetchCalls++
    if (fetchCalls === 1) return { ok: false, status: 503, headers: new Headers() }
    return { ok: true, status: 200, headers: new Headers(),
      text: async () => JSON.stringify({ data: { code: 'SH600519', klines: [`${day},1438.23,1439.00,1444.50,1431.26,23038,3316078849`] } }) }
  } })
  const registry = new FinancialDataRegistry({
    roles: [{ id: 'finance-market-researcher', writer: false, allowedMcpServers: [] }], authorize: () => true,
  })
  const remove = registry.registerAdapter(adapter)
  const request = { capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['close'], period: { kind: 'range', start: day, end: day }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch', maxAgeSeconds: 3600, priceAdjustment: 'none' }
  const context = { roleId: 'finance-market-researcher', scopeId: 'session-transient' }
  registry.setBindings({ expectedRevision: 0, bindings: [{ adapterId: adapter.metadata.id, sourceId: 'eastmoney',
    licenseAssessment: { version: 1, sourceId: 'eastmoney', assessmentStatus: 'VERIFIED',
      evidenceRefs: [{ uri: 'https://example.invalid/terms', label: 'Host-only simulated test fixture' }],
      allowedPurposes: ['research'], capabilityIds: ['prices.history'], automatedAccess: true,
      modelProcessing: true, sessionLogging: true, retention: 'SESSION_ONLY', redistribution: 'PROHIBITED',
      reviewedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: null },
    scopeIds: [context.scopeId], roleIds: [context.roleId], capabilities: ['prices.history'], markets: ['CN'],
    purposes: ['research'], temporalModes: ['current_only'], priority: 1, minQuality: 0, enabled: true, allowTestOnly: false }] })
  const first = await registry.query(request, context)
  assert.notEqual(first.status, 'OK')
  assert.equal(adapter.state.getSnapshot().state, 'READY')
  assert.equal(adapter.state.getSnapshot().connectionStatus, 'DISCONNECTED')
  const second = await registry.query(request, context)
  assert.equal(second.status, 'OK')
  assert.equal(second.data.observations[0].value, 1439)
  assert.equal(adapter.state.getSnapshot().connectionStatus, 'CONNECTED')
  assert.equal(fetchCalls, 2)
  remove()
  registry.dispose()
})

test('Registry unit fixture blocks unreviewed grants; simulated verified facts pass only the exact gate', async () => {
  const day = new Date().toISOString().slice(0, 10)
  const asOf = new Date().toISOString()
  let fetchCalls = 0
  const adapter = createEastmoneyPriceAdapter({ ordinaryEquitySymbols: ['600519.SH'], fetchImpl: async () => {
    fetchCalls++
    return { ok: true, status: 200, headers: new Headers(),
      text: async () => JSON.stringify({ data: { code: 'SH600519',
        klines: [`${day},1438.23,1439.00,1444.50,1431.26,23038,3316078849`] } }) }
  } })
  const registry = new FinancialDataRegistry({
    roles: [{ id: 'finance-market-researcher', writer: false, allowedMcpServers: [] }],
    authorize: () => true,
  })
  const dispose = registry.registerAdapter(adapter)
  const request = { capability: 'prices.history', entity: { scheme: 'ticker', id: '600519.SH' }, market: 'CN',
    requiredFields: ['close'], period: { kind: 'range', start: day, end: day }, asOf,
    purpose: 'research', temporalMode: 'current_only', researchIntent: 'currentResearch',
    maxAgeSeconds: 3600, priceAdjustment: 'none' }
  const context = { roleId: 'finance-market-researcher', scopeId: 'session-fprov' }
  const denied = await registry.query(request, context)
  assert.equal(denied.status, 'NOT_AUTHORIZED')
  assert.equal(fetchCalls, 0, 'no direct grant means no HTTP request')

  let licenseAssessment = { version: 1, sourceId: 'eastmoney', assessmentStatus: 'REVIEW_REQUIRED',
    evidenceRefs: [], allowedPurposes: ['research'], capabilityIds: ['prices.history'], automatedAccess: true,
    modelProcessing: true, sessionLogging: true, retention: 'SESSION_ONLY', redistribution: 'PROHIBITED',
    reviewedAt: null, expiresAt: null }
  const grant = { adapterId: adapter.metadata.id, sourceId: 'eastmoney', licenseAssessment,
    scopeIds: [context.scopeId], roleIds: [context.roleId], capabilities: ['prices.history'],
    markets: ['CN'], purposes: ['research'], temporalModes: ['current_only'], priority: 1,
    minQuality: 0, enabled: true, allowTestOnly: false }
  registry.setBindings({ expectedRevision: 0, bindings: [grant] })
  const reviewDenied = await registry.query(request, context)
  assert.equal(reviewDenied.status, 'NOT_AUTHORIZED')
  assert.equal(fetchCalls, 0, 'REVIEW_REQUIRED is denied before any HTTP request')

  licenseAssessment = { ...licenseAssessment, assessmentStatus: 'VERIFIED',
    evidenceRefs: [{ uri: 'https://example.com/terms', label: 'Offline Registry-test fixture only' }],
    reviewedAt: new Date(Date.now() - 1000).toISOString() }
  registry.setBindings({ expectedRevision: 1, bindings: [{ ...grant, licenseAssessment }] })
  const accepted = await registry.query(request, context)
  assert.equal(accepted.status, 'OK')
  assert.equal(accepted.data.observations[0].value, 1439)
  assert.equal(accepted.data.observations[0].pitQuality, 'CURRENT_OBSERVED')
  assert.equal(accepted.data.observations[0].unit.dimension, 'currency_per_share')
  assert.equal(fetchCalls, 1, 'unit fixture call is separate from real-source audit evidence')
  const catalog = registry.catalog().adapters[0]
  assert.equal(catalog.registrationStatus, 'REGISTERED')
  assert.equal(catalog.connectionStatus, 'CONNECTED')
  assert.equal(catalog.authenticationStatus, 'NOT_REQUIRED')
  assert.deepEqual(catalog.licenseAssessmentStatuses, ['VERIFIED'])
  dispose()
  assert.equal(registry.catalog().adapters.length, 0)
  registry.dispose()
})
