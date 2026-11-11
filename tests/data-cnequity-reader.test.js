import test from 'node:test'
import assert from 'node:assert/strict'
import { createCNEquityReader, CN_EQUITY_READER_LIMITS } from '../src/data/cnequity-reader.js'
import { normalizeObservations } from '../src/data/normalization.js'

const now = '2025-04-05T00:00:00.000Z'
const granted = Object.freeze({
  licensePermitted: true,
  modelProcessingPermitted: true,
  sessionLoggingPermitted: true,
})
const denied = Object.freeze({
  licensePermitted: false,
  modelProcessingPermitted: false,
  sessionLoggingPermitted: false,
})
const symbol = '600519.SH'
const digest = 'a'.repeat(64)
const fetchedAt = '2025-04-04T12:00:00.123456+08:00'

const baseQuery = (overrides = {}) => ({
  capability: 'prices.history', entity: { scheme: 'ticker', id: symbol }, market: 'CN',
  requiredFields: ['close'], period: { kind: 'range', start: '2025-04-04', end: '2025-04-04' },
  asOf: now, purpose: 'research', temporalMode: 'current_only', maxAgeSeconds: 86_400,
  priceAdjustment: 'none', ...overrides,
})

function rowCounts(rows, key) {
  const out = {}
  for (const row of rows) out[row[key]] = (out[row[key]] || 0) + 1
  return out
}

function receiptPage(dataset, rows, request, { dateColumn, start, end, observedStart, observedEnd } = {}) {
  const dates = rows.map(row => dataset === 'daily_bars' ? row.trade_date : row.announce_date).sort()
  const times = rows.map(row => Date.parse(row.fetched_at)).sort((a, b) => a - b)
  return {
    rows,
    receipt: {
      dataset,
      replayable: true,
      receipt_id: digest,
      request,
      coverage: {
        kind: 'observed_rows_only',
        requested_start: start,
        requested_end: end,
        date_column: dateColumn,
        observed_start: observedStart === undefined ? (dates[0] ?? null) : observedStart,
        observed_end: observedEnd === undefined ? (dates.at(-1) ?? null) : observedEnd,
        row_count: rows.length,
        completeness: 'not_assessed',
      },
      provenance: {
        returned_row_sources: rowCounts(rows, 'source'),
        returned_row_data_versions: rowCounts(rows, 'data_version'),
        fetched_at_start: times.length ? new Date(times[0]).toISOString() : null,
        fetched_at_end: times.length ? new Date(times.at(-1)).toISOString() : null,
      },
    },
  }
}

function dailyPage({ rows, start = '2025-04-04', end = '2025-04-04', request = {} } = {}) {
  const effectiveRequest = {
    start, end, symbols: [symbol], adjust: null, ...request,
  }
  const bars = rows ?? [{
    symbol, trade_date: '2025-04-04', open: 100, high: 102, low: 99, close: 101,
    pre_close: 98, volume: 123_000, amount: 12_300_000,
    source: 'tdx_protocol', data_version: 'tdx-v3', fetched_at: fetchedAt,
  }]
  return receiptPage('daily_bars', bars, effectiveRequest, {
    dateColumn: 'trade_date', start, end,
  })
}

function statementPage(rows, { year = '2024', asOf = '2025-04-05', pitMode = 'best_effort' } = {}) {
  const date = `${year}-12-31`
  const request = { start: date, end: date, symbols: [symbol], as_of: asOf, pit_mode: pitMode }
  return receiptPage('financial_statement_items', rows, request, {
    dateColumn: 'announce_date', start: date, end: date,
  })
}

function filingPage(rows, { start = '2025-03-01', end = '2025-04-01', asOf = '2025-04-05' } = {}) {
  const request = { start, end, symbols: [symbol], as_of: asOf, pit_mode: 'strict' }
  return receiptPage('announcement_index', rows, request, {
    dateColumn: 'announce_date', start, end,
  })
}

const jsonResponse = value => new Response(JSON.stringify(value), {
  status: 200, headers: { 'content-type': 'application/json' },
})
const createReader = ({ fetch = async () => { throw new Error('unexpected fetch') }, ...options } = {}) =>
  createCNEquityReader({
    baseUrl: 'http://127.0.0.1:8000', ordinaryEquitySymbols: [symbol], fetch,
    clock: () => now, permissions: granted, ...options,
  })

function statementRow(itemCode, statementType, value, extra = {}) {
  return {
    symbol, report_period: '2024Q4', statement_type: statementType, item_code: itemCode,
    item_value: value, announce_date: '2025-03-15', source: 'eastmoney_backfill',
    data_version: 'em-version-7', fetched_at: fetchedAt, ...extra,
  }
}

test('factory exposes three isolated, test-only current-snapshot adapters', () => {
  const factory = createCNEquityReader()
  assert.equal(factory.adapters.length, 3)
  assert.deepEqual(factory.adapters.map(adapter => adapter.metadata.sourceId), ['tdx_protocol', 'eastmoney', 'cninfo'])
  assert.deepEqual(factory.adapters.map(adapter => adapter.metadata.capabilities[0].id), [
    'prices.history', 'financial.statements', 'filings',
  ])
  for (const adapter of factory.adapters) {
    assert.equal(adapter.metadata.testOnly, true)
    assert.equal(adapter.metadata.licenseClass, 'TEST_ONLY')
    assert.deepEqual(adapter.metadata.capabilities[0].temporalModes, ['current_only'])
  }
  assert.equal(factory.dailyBars.metadata.capabilities[0].priceAdjustments[0], 'none')
  assert.equal(factory.announcementIndex.metadata.capabilities[0].fields.includes('report_period'), false)
  assert.equal(factory.adapters.some(adapter => adapter.metadata.capabilities.some(cap => cap.id === 'corporate.actions')), false)
  assert.equal(factory.dailyBars.state.getSnapshot().state, 'NOT_AUTHORIZED')
})

test('default permissions fail closed before fetch and report NOT_AUTHORIZED', async () => {
  let calls = 0
  const reader = createCNEquityReader({
    baseUrl: 'http://127.0.0.1:8000', ordinaryEquitySymbols: [symbol],
    fetch: async () => { calls++; return jsonResponse(dailyPage()) }, clock: () => now,
  })
  const query = baseQuery()
  const validation = await reader.dailyBars.validate(query)
  assert.deepEqual(validation, {
    compatible: false, code: 'NOT_AUTHORIZED', ...denied,
  })
  assert.equal(reader.dailyBars.state.getSnapshot().state, 'NOT_AUTHORIZED')
  await assert.rejects(reader.dailyBars.query(query), error => error.code === 'NOT_AUTHORIZED')
  assert.equal(calls, 0)
})

test('loopback origins only; rejects credentials, paths, redirects and arbitrary hosts', () => {
  for (const baseUrl of [
    'https://127.0.0.1:8000', 'http://localhost:8000', 'http://127.0.0.2:8000',
    'http://user:secret@127.0.0.1:8000', 'http://127.0.0.1:8000/private',
    'http://127.0.0.1:8000/?dataset=anything',
  ]) {
    assert.throws(() => createCNEquityReader({ baseUrl }), error => error.code === 'ADAPTER_INCOMPATIBLE')
  }
  assert.equal(createCNEquityReader({ baseUrl: 'http://[::1]:8000' }).adapters.length, 3)
})

test('prices use one symbol, fixed GET, no headers/credentials, raw adjustment none', async () => {
  let call
  const reader = createReader({ fetch: async (url, init) => {
    call = { url: new URL(url), init }
    return jsonResponse(dailyPage())
  } })
  const query = baseQuery({ requiredFields: ['open', 'close', 'pre_close', 'volume', 'amount'] })
  const result = await reader.dailyBars.query(query)
  assert.equal(call.url.pathname, '/api/read/daily_bars')
  assert.equal(call.url.searchParams.get('start'), '2025-04-04')
  assert.equal(call.url.searchParams.get('end'), '2025-04-04')
  assert.equal(call.url.searchParams.get('symbol'), symbol)
  assert.equal(call.url.searchParams.has('adjust'), false)
  assert.deepEqual(Object.keys(call.init).sort(), ['credentials', 'method', 'redirect', 'signal'])
  assert.equal(call.init.method, 'GET')
  assert.equal(call.init.redirect, 'manual')
  assert.equal(call.init.credentials, 'omit')
  assert.equal(result.observations.length, 5)
  assert.deepEqual(result.observations.find(item => item.field === 'volume').unit,
    { dimension: 'count', currency: null, scale: 'ones' })
  assert.deepEqual(result.observations.find(item => item.field === 'amount').unit,
    { dimension: 'currency', currency: 'CNY', scale: 'ones' })
  assert.equal(result.observations[0].availabilityEvidence.capturedAt, now)
  assert.equal(result.observations[0].revisionEvidence.capturedAt, '2025-04-04T04:00:00.123Z')
  assert.equal(result.observations[0].revision, null)
  assert.equal(result.observations[0].revisionEvidence.chainStatus, 'unknown')
  assert.match(result.observations[0].reference.uri, /:data-version:7464782d7633:source-variant:7464785f70726f746f636f6c/)
  const normalized = normalizeObservations(query, result, reader.dailyBars.metadata, now)
  assert.equal(normalized.observations.length, 5)
  assert.equal(normalized.observations[0].provenance.sourceId, 'tdx_protocol')
})

test('only current_only and an explicit ordinary-equity allowlist are accepted', async () => {
  const reader = createReader({ fetch: async () => jsonResponse(dailyPage()) })
  const adapter = reader.dailyBars
  const query = baseQuery()
  assert.equal((await adapter.validate({ ...query, temporalMode: 'strict' })).code, 'TEMPORAL_MODE_UNSUPPORTED')
  assert.equal((await adapter.validate({ ...query, temporalMode: 'date_bounded' })).code, 'TEMPORAL_MODE_UNSUPPORTED')
  assert.equal((await adapter.validate({ ...query, entity: { scheme: 'ticker', id: '000001.SZ' } })).code, 'ENTITY_UNSUPPORTED')
  assert.throws(() => createCNEquityReader({ ordinaryEquitySymbols: Array.from({ length: 21 }, (_, i) => `${String(i).padStart(6, '0')}.SH`) }),
    error => error.code === 'ADAPTER_INCOMPATIBLE')
  const empty = createCNEquityReader({ permissions: granted, clock: () => now })
  assert.equal((await empty.dailyBars.validate(query)).code, 'UNAVAILABLE')
})

test('window is bounded to 366 inclusive calendar days', async () => {
  let calls = 0
  const reader = createReader({ fetch: async (_url, init) => {
    calls++
    assert.equal(init.method, 'GET')
    return jsonResponse(dailyPage({ rows: [], start: '2025-01-01', end: '2026-01-01' }))
  } })
  const within = baseQuery({ requiredFields: ['close'], period: { kind: 'range', start: '2025-01-01', end: '2026-01-01' } })
  await reader.dailyBars.query(within)
  const tooWide = { ...within, period: { kind: 'range', start: '2025-01-01', end: '2026-01-02' } }
  await assert.rejects(reader.dailyBars.query(tooWide), error => error.code === 'PERIOD_UNSUPPORTED')
  assert.equal(calls, 1)
  assert.equal(CN_EQUITY_READER_LIMITS.maxWindowDays, 366)
})

test('financial adapter maps reviewed annual Q4 items and preserves local version evidence', async () => {
  const rows = [
    statementRow('net_profit', 'income', 862.5),
    statementRow('roe', 'indicator', 27.4),
    statementRow('eps', 'indicator', 4.3),
    statementRow('revenue_yoy', 'indicator', 6.1),
  ]
  let requestUrl
  const fixture = statementPage(rows)
  assert.equal(fixture.receipt.request.start, '2024-12-31')
  assert.equal(fixture.receipt.coverage.date_column, 'announce_date')
  assert.equal(fixture.receipt.coverage.observed_start, '2025-03-15')
  const reader = createReader({ fetch: async url => {
    requestUrl = new URL(url)
    return jsonResponse(fixture)
  } })
  const query = {
    capability: 'financial.statements', entity: { scheme: 'ticker', id: symbol }, market: 'CN',
    requiredFields: ['net_profit', 'roe', 'eps', 'revenue_yoy'],
    period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
    asOf: now, purpose: 'research', temporalMode: 'current_only', maxAgeSeconds: 86_400,
  }
  const result = await reader.financialStatements.query(query)
  assert.equal(requestUrl.pathname, '/api/read/financial_statement_items')
  assert.equal(requestUrl.searchParams.get('start'), '2024-12-31')
  assert.equal(requestUrl.searchParams.get('end'), '2024-12-31')
  assert.equal(requestUrl.searchParams.get('symbol'), symbol)
  assert.equal(requestUrl.searchParams.get('as_of'), '2025-04-05')
  assert.equal(requestUrl.searchParams.get('pit_mode'), 'best_effort')
  assert.equal(requestUrl.searchParams.has('items'), false)
  assert.deepEqual(result.observations.map(item => item.field), ['net_profit', 'roe', 'eps', 'revenue_yoy'])
  const declaredFields = reader.financialStatements.metadata.capabilities[0].fields
  assert.equal(declaredFields.includes('net_profit'), true)
  assert.equal(declaredFields.includes('netProfit'), false)
  assert.deepEqual(result.observations[0].unit, { dimension: 'currency', currency: 'CNY', scale: 'ones' })
  assert.deepEqual(result.observations[1].unit, { dimension: 'ratio', currency: null, scale: 'percent' })
  assert.deepEqual(result.observations[2].unit, { dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' })
  assert.deepEqual(result.observations[3].unit, { dimension: 'ratio', currency: null, scale: 'percent' })
  assert.equal(result.observations[0].period.kind, 'fiscal_year')
  assert.equal(result.observations[0].revisionEvidence.chainStatus, 'unknown')
  assert.equal(result.observations[0].revision, null)
  assert.match(result.observations[0].reference.uri, /:data-version:656d2d76657273696f6e2d37:source-variant:656173746d6f6e65795f6261636b66696c6c/)
  const normalized = normalizeObservations(query, result, reader.financialStatements.metadata, now)
  assert.equal(normalized.observations.length, 4)
})

test('financial adapter rejects quarterly rows rather than deriving quarter values', async () => {
  const rows = [statementRow('net_profit', 'income', 20, { report_period: '2024Q3' })]
  const reader = createReader({ fetch: async () => jsonResponse(statementPage(rows)) })
  const query = {
    capability: 'financial.statements', entity: { scheme: 'ticker', id: symbol }, market: 'CN',
    requiredFields: ['net_profit'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31' },
    asOf: now, purpose: 'research', temporalMode: 'current_only', maxAgeSeconds: 86_400,
  }
  await assert.rejects(reader.financialStatements.query(query), error => error.code === 'ADAPTER_INCOMPATIBLE')
  assert.equal((await reader.financialStatements.validate({ ...query, period: { kind: 'fiscal_quarter', start: '2024-10-01', end: '2024-12-31' } })).code,
    'PERIOD_UNSUPPORTED')
})

test('CNINFO filings preserve source category, announcement date, null report period and safe local URN', async () => {
  const rows = [{
    symbol, announcement_id: 'cninfo-2025-000123', title: '2024 年年度报告',
    announce_date: '2025-03-20', category: '年度报告', url: 'https://cninfo.example/report?token=secret',
    source: 'cninfo', data_version: 'cninfo-v5', fetched_at: fetchedAt,
  }]
  const reader = createReader({ fetch: async () => jsonResponse(filingPage(rows)) })
  const query = {
    capability: 'filings', entity: { scheme: 'ticker', id: symbol }, market: 'CN',
    requiredFields: ['filing_id', 'filing_type', 'announcement_date'],
    period: { kind: 'range', start: '2025-03-01', end: '2025-04-01' },
    asOf: now, purpose: 'research', temporalMode: 'current_only', maxAgeSeconds: 86_400,
  }
  const result = await reader.announcementIndex.query(query)
  assert.equal(result.filings.length, 1)
  const filing = result.filings[0]
  assert.equal(filing.filingType, '年度报告')
  assert.equal(filing.announcementDate, '2025-03-20')
  assert.equal(filing.reportPeriod, null)
  assert.equal(filing.filingId, 'cninfo-2025-000123')
  assert.equal(filing.revisionEvidence.sourceRecordId, filing.filingId)
  assert.equal(filing.revisionEvidence.chainStatus, 'unknown')
  assert.equal(filing.revision, null)
  assert.match(filing.filingReference.uri, /^urn:cne-reader:receipt:/)
  assert.equal(filing.filingReference.uri.includes('?'), false)
  assert.equal(filing.filingReference.uri.includes('secret'), false)
  const normalized = normalizeObservations(query, result, reader.announcementIndex.metadata, now)
  assert.equal(normalized.filings[0].filingType, '年度报告')
  assert.equal(normalized.filings[0].reportPeriod, null)
})

test('receipt identity, source mix, and row ceilings fail closed', async t => {
  const query = baseQuery()
  const cases = [
    ['wrong dataset', page => { page.receipt.dataset = 'minute_bars' }],
    ['window mismatch', page => { page.receipt.request.start = '2025-04-03' }],
    ['mixed supplier', page => { page.rows[0].source = 'eastmoney' }],
    ['source counts mismatch', page => { page.receipt.provenance.returned_row_sources = { tdx_protocol: 9 } }],
  ]
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const page = dailyPage()
      mutate(page)
      const reader = createReader({ fetch: async () => jsonResponse(page) })
      await assert.rejects(reader.dailyBars.query(query), error => error.code === 'ADAPTER_INCOMPATIBLE')
    })
  }
  const tooMany = Array.from({ length: 1001 }, (_, i) => ({
    symbol, trade_date: '2025-04-04', open: i + 1, high: i + 1, low: i + 1, close: i + 1,
    pre_close: null, volume: 1, amount: 1, source: 'tdx_protocol', data_version: 'v1', fetched_at: fetchedAt,
  }))
  const reader = createReader({ fetch: async () => jsonResponse(dailyPage({ rows: tooMany })) })
  await assert.rejects(reader.dailyBars.query(query), error => error.code === 'ADAPTER_INCOMPATIBLE')
  assert.equal(CN_EQUITY_READER_LIMITS.maxRows, 1000)
})

test('redirects, oversized payloads, cancellation and timeout are bounded', async t => {
  const query = baseQuery()
  const redirectReader = createReader({ fetch: async () => new Response('', { status: 302, headers: { location: 'https://example.com' } }) })
  await assert.rejects(redirectReader.dailyBars.query(query), error => error.code === 'HTTP_REDIRECT')

  const largeReader = createReader({ fetch: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { status: 200 }) })
  await assert.rejects(largeReader.dailyBars.query(query), error => error.code === 'ADAPTER_INCOMPATIBLE')

  let calls = 0
  const cancelledReader = createReader({ fetch: async () => { calls++; return jsonResponse(dailyPage()) } })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(cancelledReader.dailyBars.query(query, { signal: controller.signal }), error => error.code === 'CANCELLED')
  assert.equal(calls, 0)

  const timeoutReader = createReader({
    requestTimeoutMs: 100,
    fetch: async () => new Promise(() => {}),
  })
  await assert.rejects(timeoutReader.dailyBars.query(query), error => error.code === 'TIMEOUT')
})
