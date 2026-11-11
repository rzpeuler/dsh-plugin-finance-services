/**
 * Additive, bounded adapters over CNEquity's local /api/read route.
 *
 * This factory only describes Adapters; it does not register them, start a CNE
 * process, enumerate instruments, or contact a source. The three sources remain
 * separate. All definitions are explicitly test-only until the Host supplies
 * positive permission evidence for license, model processing and session log.
 */

const DATASETS = Object.freeze({
  prices: 'daily_bars',
  statements: 'financial_statement_items',
  filings: 'announcement_index',
})
const MAX_WINDOW_DAYS = 366
const MAX_ROWS = 1000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_SYMBOLS = 20
const MAX_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 5_000
const SYMBOL_PATTERN = /^[0-9]{6}\.(?:SH|SZ|BJ)$/
const SAFE_DEFAULT_PERMISSIONS = Object.freeze({
  licensePermitted: false,
  modelProcessingPermitted: false,
  sessionLoggingPermitted: false,
})
const WARNING = 'Local CNEquity snapshot only; no source-stable revision chain is asserted.'

const DAILY_FIELDS = Object.freeze({
  open: { source: 'open', unit: 'currency_per_share' },
  high: { source: 'high', unit: 'currency_per_share' },
  low: { source: 'low', unit: 'currency_per_share' },
  close: { source: 'close', unit: 'currency_per_share' },
  pre_close: { source: 'pre_close', unit: 'currency_per_share' },
  volume: { source: 'volume', unit: 'count' },
  amount: { source: 'amount', unit: 'currency' },
})

// Reviewed against eastmoney/fundamentals.py's _REPORTS item map. Amount-like
// items are CNY; *_yoy, roe and gross_margin are percentages; EPS/BPS/OCF per
// share are CNY/share. Q4 rows are used as annual reports without subtracting
// prior quarters or otherwise converting cumulative values.
const FINANCIAL_ITEMS = Object.freeze({
  revenue: { field: 'revenue', statement: 'income', unit: 'currency' },
  net_profit: { field: 'net_profit', statement: 'income', unit: 'currency' },
  roe: { field: 'roe', statement: 'indicator', unit: 'ratio' },
  eps: { field: 'eps', statement: 'indicator', unit: 'currency_per_share' },
  eps_deducted: { field: 'eps_deducted', statement: 'indicator', unit: 'currency_per_share' },
  bps: { field: 'bps', statement: 'indicator', unit: 'currency_per_share' },
  gross_margin: { field: 'gross_margin', statement: 'indicator', unit: 'ratio' },
  ocf_per_share: { field: 'ocf_per_share', statement: 'indicator', unit: 'currency_per_share' },
  revenue_yoy: { field: 'revenue_yoy', statement: 'indicator', unit: 'ratio' },
  net_profit_yoy: { field: 'net_profit_yoy', statement: 'indicator', unit: 'ratio' },
  total_assets: { field: 'total_assets', statement: 'balance', unit: 'currency' },
  total_equity: { field: 'total_equity', statement: 'balance', unit: 'currency' },
  total_liabilities: { field: 'total_liabilities', statement: 'balance', unit: 'currency' },
  inventory: { field: 'inventory', statement: 'balance', unit: 'currency' },
  accounts_receivable: { field: 'accounts_receivable', statement: 'balance', unit: 'currency' },
  monetary_funds: { field: 'monetary_funds', statement: 'balance', unit: 'currency' },
  fixed_assets: { field: 'fixed_assets', statement: 'balance', unit: 'currency' },
  operating_cost: { field: 'operating_cost', statement: 'income', unit: 'currency' },
  operating_profit: { field: 'operating_profit', statement: 'income', unit: 'currency' },
  total_profit: { field: 'total_profit', statement: 'income', unit: 'currency' },
  net_profit_deducted: { field: 'net_profit_deducted', statement: 'income', unit: 'currency' },
  income_tax: { field: 'income_tax', statement: 'income', unit: 'currency' },
  sale_expense: { field: 'sale_expense', statement: 'income', unit: 'currency' },
  manage_expense: { field: 'manage_expense', statement: 'income', unit: 'currency' },
  finance_expense: { field: 'finance_expense', statement: 'income', unit: 'currency' },
  net_cash_operate: { field: 'net_cash_operate', statement: 'cashflow', unit: 'currency' },
  net_cash_invest: { field: 'net_cash_invest', statement: 'cashflow', unit: 'currency' },
  net_cash_finance: { field: 'net_cash_finance', statement: 'cashflow', unit: 'currency' },
  capex: { field: 'capex', statement: 'cashflow', unit: 'currency' },
  end_cash: { field: 'end_cash', statement: 'cashflow', unit: 'currency' },
})
const FINANCIAL_FIELDS = Object.freeze(Object.fromEntries(
  Object.values(FINANCIAL_ITEMS).map(item => [item.field, item]),
))
const FILING_FIELDS = Object.freeze([
  'filing_id', 'filing_type', 'title', 'announcement_date', 'filing_reference',
])
const ROW_SOURCE_BY_DATASET = Object.freeze({
  [DATASETS.prices]: 'tdx_protocol',
  [DATASETS.statements]: 'eastmoney',
  [DATASETS.filings]: 'cninfo',
})
const ADAPTER_SOURCE_BY_DATASET = Object.freeze({
  [DATASETS.prices]: 'tdx_protocol',
  [DATASETS.statements]: 'eastmoney',
  [DATASETS.filings]: 'cninfo',
})

function error(code, message) {
  return Object.assign(new Error(message), { code })
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

function contractTimestamp(value) {
  if (!validTimestamp(value)) return null
  // CNE's Python datetime may serialize microseconds; the schema accepts milliseconds.
  return new Date(Date.parse(value)).toISOString()
}

function inclusiveDays(start, end) {
  if (!validDate(start) || !validDate(end) || end < start) return Infinity
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000 + 1
}

function shanghaiDate(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function timestampFromClock(clock) {
  const value = clock()
  const timestamp = value instanceof Date ? value.toISOString() : value
  const canonical = contractTimestamp(timestamp)
  if (!canonical) throw error('INVALID_NOW', 'Reader clock returned an invalid timestamp')
  return canonical
}

function parseLoopbackBaseUrl(baseUrl) {
  if (baseUrl === undefined || baseUrl === null || baseUrl === '') return null
  let url
  try { url = new URL(baseUrl) } catch { throw error('ADAPTER_INCOMPATIBLE', 'CNEquity base URL is invalid') }
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'http:' || !['127.0.0.1', '::1', '[::1]'].includes(hostname) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity base URL must be a credential-free HTTP loopback origin')
  }
  return url.origin
}

function normalizeAllowedSymbols(symbols) {
  if (!Array.isArray(symbols) || symbols.length > MAX_SYMBOLS ||
    symbols.some(symbol => typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol)) ||
    new Set(symbols).size !== symbols.length) {
    throw error('ADAPTER_INCOMPATIBLE', 'Ordinary-equity allowlist must contain at most 20 unique six-digit SH/SZ/BJ symbols')
  }
  return new Set(symbols)
}

function permissionEvidence(provider, sourceId, query, execution) {
  let evidence
  try {
    evidence = typeof provider === 'function'
      ? provider({ sourceId, query, context: execution?.context })
      : provider
  } catch { return SAFE_DEFAULT_PERMISSIONS }
  if (!evidence || typeof evidence !== 'object' || typeof evidence.then === 'function') return SAFE_DEFAULT_PERMISSIONS
  return Object.freeze({
    licensePermitted: evidence.licensePermitted === true,
    modelProcessingPermitted: evidence.modelProcessingPermitted === true,
    sessionLoggingPermitted: evidence.sessionLoggingPermitted === true,
  })
}

function permissionsGranted(evidence) {
  return evidence.licensePermitted === true && evidence.modelProcessingPermitted === true &&
    evidence.sessionLoggingPermitted === true
}

function currentOnlyFresh(query, now) {
  if (!validTimestamp(query?.asOf) || !validTimestamp(now)) return false
  const age = Date.parse(now) - Date.parse(query.asOf)
  return age >= 0 && age <= 300_000
}

function validateQueryForAdapter(query, { capability, sourceId, allowedSymbols, now }) {
  if (!query || query.capability !== capability) return 'CAPABILITY_UNSUPPORTED'
  if (query.market !== 'CN') return 'MARKET_UNSUPPORTED'
  if (!query.entity || query.entity.scheme !== 'ticker' || !SYMBOL_PATTERN.test(query.entity.id) ||
    !allowedSymbols.has(query.entity.id)) return 'ENTITY_UNSUPPORTED'
  if (query.sourceIds && (!Array.isArray(query.sourceIds) || !query.sourceIds.includes(sourceId))) return 'ADAPTER_INCOMPATIBLE'
  if (query.temporalMode !== 'current_only' || !currentOnlyFresh(query, now)) return 'TEMPORAL_MODE_UNSUPPORTED'
  const fields = capability === 'prices.history' ? Object.keys(DAILY_FIELDS)
    : capability === 'financial.statements' ? Object.keys(FINANCIAL_FIELDS) : FILING_FIELDS
  if (!Array.isArray(query.requiredFields) || query.requiredFields.length === 0 ||
    query.requiredFields.some(field => !fields.includes(field))) return 'FIELDS_UNSUPPORTED'
  if (!query.period) return 'PERIOD_UNSUPPORTED'
  if (capability === 'prices.history' || capability === 'filings') {
    if (query.period.kind !== 'range' || inclusiveDays(query.period.start, query.period.end) > MAX_WINDOW_DAYS) {
      return 'PERIOD_UNSUPPORTED'
    }
    if (capability === 'prices.history' && query.priceAdjustment !== 'none') return 'PRICE_ADJUSTMENT_UNSUPPORTED'
  } else {
    const { start, end } = query.period
    const year = start?.slice(0, 4)
    if (query.period.kind !== 'fiscal_year' || !/^\d{4}$/.test(year || '') ||
      start !== `${year}-01-01` || end !== `${year}-12-31` || !validDate(start) || !validDate(end)) {
      return 'PERIOD_UNSUPPORTED'
    }
    if (query.measurementType && query.measurementType !== 'actual') return 'MEASUREMENT_INCOMPATIBLE'
    if (query.accountingBasis && query.accountingBasis !== 'unknown') return 'ACCOUNTING_BASIS_INCOMPATIBLE'
    if (query.consolidation && query.consolidation !== 'unknown') return 'CONSOLIDATION_INCOMPATIBLE'
  }
  return null
}

function counts(values) {
  const result = Object.create(null)
  for (const value of values) result[value] = (result[value] || 0) + 1
  return result
}

function sameCounts(actual, expected) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) =>
    key === expectedKeys[index] && actual[key] === expected[key])
}

function comparableTimestamp(value) {
  return validTimestamp(value) ? Date.parse(value) : null
}

function credentialFreeText(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) return false
  if ([...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false
  return !/(?:Bearer +[^ ]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token) *[:=] *[^ ]+)/i.test(value)
}

function rowSourceAllowed(dataset, source) {
  if (dataset === DATASETS.statements) return source === 'eastmoney' || source === 'eastmoney_backfill'
  return source === ROW_SOURCE_BY_DATASET[dataset]
}

function validateReceipt(page, expected) {
  if (!page || typeof page !== 'object' || !Array.isArray(page.rows) || !page.receipt ||
    typeof page.receipt !== 'object' || page.rows.length > MAX_ROWS) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response did not satisfy the bounded read contract')
  }
  const { rows, receipt } = page
  const request = receipt.request
  const coverage = receipt.coverage
  const provenance = receipt.provenance
  if (receipt.dataset !== expected.dataset || receipt.replayable !== true ||
    !/^[a-f0-9]{64}$/.test(receipt.receipt_id || '') ||
    !request || typeof request !== 'object' || !coverage || typeof coverage !== 'object' ||
    !provenance || typeof provenance !== 'object') {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt identity is missing or inconsistent')
  }
  if (request.start !== expected.start || request.end !== expected.end ||
    !Array.isArray(request.symbols) || request.symbols.length !== 1 || request.symbols[0] !== expected.symbol ||
    coverage.requested_start !== expected.start || coverage.requested_end !== expected.end ||
    coverage.date_column !== expected.coverageDateColumn || coverage.row_count !== rows.length) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt request window or symbol does not match')
  }
  if (expected.asOf !== undefined && request.as_of !== expected.asOf) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt as-of date does not match')
  }
  if (expected.pitMode !== undefined && request.pit_mode !== expected.pitMode) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt PIT mode does not match')
  }
  if (expected.dataset === DATASETS.prices && request.adjust != null) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity price reads must remain unadjusted')
  }
  for (const key of ['universe', 'profile', 'universe_profile', 'items', 'all_vintages']) {
    if (request[key] != null && request[key] !== false && request[key] !== '') {
      throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt contains an unsupported query option')
    }
  }
  if (rows.some(row => !row || typeof row !== 'object' || !rowSourceAllowed(expected.dataset, row.source) ||
    !credentialFreeText(row.data_version) ||
    typeof row.symbol !== 'string' || row.symbol !== expected.symbol || !validTimestamp(row.fetched_at) ||
    (expected.capturedAt && Date.parse(row.fetched_at) > Date.parse(expected.capturedAt)))) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity rows contain mixed sources or invalid local identity')
  }
  const sourceCounts = counts(rows.map(row => row.source))
  const versionCounts = counts(rows.map(row => row.data_version))
  const fetched = rows.map(row => Date.parse(row.fetched_at)).sort((left, right) => left - right)
  const expectedStart = fetched.length ? fetched[0] : null
  const expectedEnd = fetched.length ? fetched[fetched.length - 1] : null
  if (!sameCounts(provenance.returned_row_sources, sourceCounts) ||
    !sameCounts(provenance.returned_row_data_versions, versionCounts) ||
    comparableTimestamp(provenance.fetched_at_start) !== expectedStart ||
    comparableTimestamp(provenance.fetched_at_end) !== expectedEnd) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt provenance does not match returned rows')
  }
  const dates = rows.map(row => expected.dataset === DATASETS.prices ? row.trade_date : row.announce_date)
  if (expected.dataset === DATASETS.statements) {
    const year = expected.start.slice(0, 4)
    if (rows.some(row => row.report_period !== `${year}Q4` || !validDate(row.announce_date) || row.announce_date > expected.asOf)) {
      throw error('ADAPTER_INCOMPATIBLE', 'CNEquity statements must be disclosed annual Q4 rows within the PIT bound')
    }
  } else if (rows.some(row => !validDate(expected.dataset === DATASETS.prices ? row.trade_date : row.announce_date) ||
    (expected.dataset === DATASETS.prices ? row.trade_date : row.announce_date) < expected.start ||
    (expected.dataset === DATASETS.prices ? row.trade_date : row.announce_date) > expected.end)) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity row dates fall outside the requested window')
  }
  const observed = dates.filter(value => value !== null && value !== undefined).sort()
  const expectedObservedStart = observed.length ? observed[0] : null
  const expectedObservedEnd = observed.length ? observed[observed.length - 1] : null
  if ((coverage.observed_start ?? null) !== expectedObservedStart ||
    (coverage.observed_end ?? null) !== expectedObservedEnd) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity receipt observed bounds do not match returned rows')
  }
  return { rows, receipt }
}

async function readLimitedBody(response, signal) {
  const contentLength = response.headers?.get?.('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response exceeds the 2 MiB limit')
  }
  if (!response.body?.getReader) throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response body is not stream-readable')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  const cancelReader = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancelReader, { once: true })
  let bytes
  try {
    for (;;) {
      if (signal?.aborted) throw error('CANCELLED', 'CNEquity read was cancelled')
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) {
        try { await reader.cancel() } catch { /* bounded failure path */ }
        throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response exceeds the 2 MiB limit')
      }
      chunks.push(value)
    }
  } finally {
    signal?.removeEventListener('abort', cancelReader)
    try { reader.releaseLock() } catch { /* stream may already be cancelled */ }
  }
  bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response is not valid UTF-8')
  }
}

function unitFor(kind) {
  if (kind === 'currency_per_share') return { dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' }
  if (kind === 'currency') return { dimension: 'currency', currency: 'CNY', scale: 'ones' }
  if (kind === 'ratio') return { dimension: 'ratio', currency: null, scale: 'percent' }
  return { dimension: 'count', currency: null, scale: 'ones' }
}

function referenceFor(receipt, dataset, sourceVariant, dataVersion, identity = '') {
  const segment = value => [...new TextEncoder().encode(String(value))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const uri = `urn:cne-reader:receipt:${receipt.receipt_id}:dataset:${dataset}:data-version:${segment(dataVersion)}:source-variant:${segment(sourceVariant)}${identity ? `:row:${segment(identity)}` : ''}`
  const label = `Local CNE receipt ${receipt.receipt_id}; dataset ${dataset}; local data_version and source variant are encoded in URI`
  return { uri, label: label.slice(0, 256) }
}

function revisionEvidence(receipt, dataset, row, reference, sourceRecordId = null) {
  return {
    chainId: null,
    chainStatus: 'unknown',
    supersedes: [],
    changeType: 'local_cne_snapshot_unverified',
    sourceRecordId,
    capturedAt: contractTimestamp(row.fetched_at),
    evidence: reference,
  }
}

function statementField(row) {
  const mapping = FINANCIAL_ITEMS[row.item_code]
  return mapping && mapping.statement === row.statement_type ? mapping : null
}

function mapDailyRows(rows, receipt, query, capturedAt) {
  const observations = []
  const requested = new Set(query.requiredFields)
  for (const row of rows) {
    const date = row.trade_date
    for (const field of requested) {
      const spec = DAILY_FIELDS[field]
      const value = row[spec.source]
      if (value === null || value === undefined) continue
      if (typeof value !== 'number' || !Number.isFinite(value) ||
        (field === 'volume' && (!Number.isSafeInteger(value) || value < 0))) {
        throw error('ADAPTER_INCOMPATIBLE', 'CNEquity daily bar value is invalid')
      }
      const reference = referenceFor(receipt, DATASETS.prices, row.source, row.data_version, `${row.symbol}:${date}:${field}`)
      observations.push({
        field, entity: query.entity, value, unit: unitFor(spec.unit),
        period: { kind: 'instant', start: date, end: date },
        measurementType: 'actual', accountingBasis: 'not_applicable', consolidation: 'not_applicable',
        availabilityEvidence: { type: 'current_snapshot', capturedAt }, retrievedAt: capturedAt,
        revision: null, revisionEvidence: revisionEvidence(receipt, DATASETS.prices, row, reference),
        reference, licenseClass: 'TEST_ONLY',
      })
    }
  }
  return observations
}

function mapFinancialRows(rows, receipt, query, capturedAt) {
  const observations = []
  const requested = new Set(query.requiredFields)
  const year = query.period.start.slice(0, 4)
  const period = { kind: 'fiscal_year', start: `${year}-01-01`, end: `${year}-12-31`, label: `FY${year}` }
  for (const row of rows) {
    const mapping = statementField(row)
    if (!mapping || !requested.has(mapping.field)) continue
    const value = row.item_value
    if (value === null || value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw error('ADAPTER_INCOMPATIBLE', 'CNEquity financial item value is invalid')
    }
    const reference = referenceFor(receipt, DATASETS.statements, row.source, row.data_version,
      `${row.symbol}:${row.report_period}:${row.statement_type}:${row.item_code}:${row.announce_date}`)
    observations.push({
      field: mapping.field, entity: query.entity, value, unit: unitFor(mapping.unit), period,
      measurementType: 'actual', accountingBasis: 'unknown', consolidation: 'unknown',
      availabilityEvidence: { type: 'current_snapshot', capturedAt }, retrievedAt: capturedAt,
      revision: null, revisionEvidence: revisionEvidence(receipt, DATASETS.statements, row, reference),
      reference, licenseClass: 'TEST_ONLY',
    })
  }
  return observations
}

function mapFilingRows(rows, receipt, query, capturedAt) {
  return rows.map(row => {
    if (typeof row.announcement_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.announcement_id) ||
      typeof row.title !== 'string' || !row.title.trim() || row.title.length > 512 ||
      typeof row.category !== 'string' || !row.category.trim() || row.category.length > 96 ||
      !validDate(row.announce_date)) {
      throw error('ADAPTER_INCOMPATIBLE', 'CNEquity filing row is missing a bounded source identifier or filing fields')
    }
    const reference = referenceFor(receipt, DATASETS.filings, row.source, row.data_version,
      `${row.symbol}:${row.announcement_id}`)
    return {
      filingId: row.announcement_id,
      entity: query.entity,
      filingType: row.category,
      title: row.title,
      announcementDate: row.announce_date,
      reportPeriod: null,
      filingReference: reference,
      availabilityEvidence: { type: 'current_snapshot', capturedAt },
      retrievedAt: capturedAt,
      revision: null,
      revisionEvidence: revisionEvidence(receipt, DATASETS.filings, row, reference, row.announcement_id),
      licenseClass: 'TEST_ONLY',
    }
  })
}

function requestSpec(dataset, query) {
  if (dataset === DATASETS.prices) {
    return { start: query.period.start, end: query.period.end, coverageDateColumn: 'trade_date' }
  }
  if (dataset === DATASETS.statements) {
    // The read query bounds report_period (YYYYQn) to the annual Q4 period.
    // Its receipt coverage axis is separately announce_date, per DATE_COLUMNS.
    return {
      start: query.period.end, end: query.period.end, coverageDateColumn: 'announce_date',
      asOf: shanghaiDate(query.asOf), pitMode: 'best_effort',
    }
  }
  return {
    start: query.period.start, end: query.period.end, coverageDateColumn: 'announce_date',
    asOf: shanghaiDate(query.asOf), pitMode: 'strict',
  }
}

function buildUrl(baseUrl, dataset, query, spec) {
  if (!baseUrl) throw error('UNAVAILABLE', 'CNEquity loopback base URL is not configured')
  const url = new URL(`/api/read/${dataset}`, baseUrl)
  url.searchParams.set('start', spec.start)
  url.searchParams.set('end', spec.end)
  url.searchParams.set('symbol', query.entity.id)
  if (spec.asOf) url.searchParams.set('as_of', spec.asOf)
  if (spec.pitMode) url.searchParams.set('pit_mode', spec.pitMode)
  // `adjust` deliberately omitted: the raw CNE daily_bars route is unadjusted.
  return url
}

function makeAdapter({ dataset, capability, sourceId, fields, priceAdjustments, options, listeners }) {
  const metadata = Object.freeze({
    id: `cne-reader-${sourceId.replaceAll('_', '-')}`,
    version: '1.0.0',
    sourceId,
    label: `CNEquity local ${sourceId} Reader (test-only, unapproved)`,
    testOnly: true,
    licenseClass: 'TEST_ONLY',
    capabilities: [Object.freeze({
      id: capability, markets: ['CN'], fields,
      temporalModes: ['current_only'],
      ...(priceAdjustments ? { priceAdjustments } : {}),
      priority: 0, quality: 0,
    })],
  })
  const readPermissions = (query, execution) => permissionEvidence(options.permissions, sourceId, query, execution)
  const statusSnapshot = () => {
    const permissions = readPermissions(undefined, undefined)
    const verifiedAt = timestampFromClock(options.clock)
    if (!permissionsGranted(permissions)) return { state: 'NOT_AUTHORIZED', verifiedAt, code: 'NOT_AUTHORIZED' }
    if (!options.baseUrl || options.allowedSymbols.size === 0) {
      return { state: 'NOT_CONFIGURED', verifiedAt, code: 'UNAVAILABLE' }
    }
    return { state: 'READY', verifiedAt }
  }
  const state = Object.freeze({
    getSnapshot: statusSnapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw error('ADAPTER_INCOMPATIBLE', 'State listener is required')
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  })

  const validate = async (query, execution = {}) => {
    const evidence = readPermissions(query, execution)
    if (!permissionsGranted(evidence)) {
      return { compatible: false, code: 'NOT_AUTHORIZED', ...evidence }
    }
    if (!options.baseUrl || options.allowedSymbols.size === 0) {
      return { compatible: false, code: 'UNAVAILABLE', ...evidence }
    }
    const now = timestampFromClock(options.clock)
    const code = validateQueryForAdapter(query, { capability, sourceId, allowedSymbols: options.allowedSymbols, now })
    return code ? { compatible: false, code, ...evidence } : { compatible: true, ...evidence }
  }

  const queryAdapter = async (query, execution = {}) => {
    const validation = await validate(query, execution)
    if (!validation.compatible) throw error(validation.code || 'ADAPTER_INCOMPATIBLE', 'CNEquity request is not authorized or compatible')
    const spec = requestSpec(dataset, query)
    const url = buildUrl(options.baseUrl, dataset, query, spec)
    const evidence = readPermissions(query, execution)
    if (!permissionsGranted(evidence)) throw error('NOT_AUTHORIZED', 'CNEquity source use is not authorized')
    if (typeof options.fetchImpl !== 'function') throw error('HTTP_UNAVAILABLE', 'CNEquity fetch implementation is unavailable')

    const externalSignal = execution?.signal
    if (externalSignal?.aborted) throw error('CANCELLED', 'CNEquity read was cancelled')
    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = () => controller.abort(externalSignal?.reason)
    if (externalSignal?.aborted) abortFromCaller()
    else externalSignal?.addEventListener?.('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(error('TIMEOUT', 'CNEquity request timed out'))
    }, options.requestTimeoutMs)
    timeout.unref?.()
    let rejectAbort
    const abortPromise = new Promise((_, reject) => { rejectAbort = reject })
    const rejectOnAbort = () => rejectAbort(externalSignal?.aborted
      ? error('CANCELLED', 'CNEquity read was cancelled')
      : error('TIMEOUT', 'CNEquity request timed out'))
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
    let page
    let capturedAt
    try {
      const payload = await Promise.race([ (async () => {
        const response = await options.fetchImpl(url.toString(), {
          method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal,
        })
        if (externalSignal?.aborted) throw error('CANCELLED', 'CNEquity read was cancelled')
        if (response?.type === 'opaqueredirect' || (response?.status >= 300 && response?.status < 400)) {
          throw error('HTTP_REDIRECT', 'CNEquity redirects are not allowed')
        }
        if (!response || response.status !== 200 || response.ok === false) {
          throw error('HTTP_UNAVAILABLE', 'CNEquity returned an unsuccessful response')
        }
        try { return JSON.parse(await readLimitedBody(response, controller.signal)) } catch (cause) {
          if (cause?.code) throw cause
          throw error('ADAPTER_INCOMPATIBLE', 'CNEquity response is not valid JSON')
        }
      })(), abortPromise ])
      if (timedOut) throw error('TIMEOUT', 'CNEquity request timed out')
      capturedAt = timestampFromClock(options.clock)
      const expected = { ...spec, dataset, symbol: query.entity.id, capturedAt }
      page = validateReceipt(payload, expected)
      if (externalSignal?.aborted) throw error('CANCELLED', 'CNEquity read was cancelled')
      if (!permissionsGranted(readPermissions(query, execution))) {
        throw error('NOT_AUTHORIZED', 'CNEquity source use was revoked during the read')
      }
    } catch (cause) {
      if (externalSignal?.aborted) throw error('CANCELLED', 'CNEquity read was cancelled')
      if (timedOut) throw error('TIMEOUT', 'CNEquity request timed out')
      if (cause?.code) throw cause
      throw error('NETWORK_UNAVAILABLE', 'CNEquity loopback read failed')
    } finally {
      clearTimeout(timeout)
      controller.signal.removeEventListener('abort', rejectOnAbort)
      externalSignal?.removeEventListener?.('abort', abortFromCaller)
    }

    const observations = dataset === DATASETS.prices
      ? mapDailyRows(page.rows, page.receipt, query, capturedAt)
      : dataset === DATASETS.statements
        ? mapFinancialRows(page.rows, page.receipt, query, capturedAt)
        : []
    const filings = dataset === DATASETS.filings
      ? mapFilingRows(page.rows, page.receipt, query, capturedAt)
      : []
    return { observations, corporateActions: [], filings, warnings: [WARNING] }
  }

  return Object.freeze({ metadata, state, validate, query: queryAdapter })
}

/**
 * Create three independent, source-specific Adapter definitions for later
 * `registerAdapter` calls. `ordinaryEquitySymbols` is an explicit host/user
 * allowlist, not a discovery mechanism; an empty list is the default.
 */
export function createCNEquityReader({
  baseUrl,
  ordinaryEquitySymbols = [],
  fetch: fetchImpl = globalThis.fetch,
  clock = () => new Date().toISOString(),
  permissions = SAFE_DEFAULT_PERMISSIONS,
  requestTimeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof clock !== 'function') throw error('ADAPTER_INCOMPATIBLE', 'Reader clock must be a function')
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > MAX_TIMEOUT_MS) {
    throw error('ADAPTER_INCOMPATIBLE', 'CNEquity timeout must be between 100 and 10000 milliseconds')
  }
  const listeners = new Set()
  const config = {
    baseUrl: parseLoopbackBaseUrl(baseUrl),
    allowedSymbols: normalizeAllowedSymbols(ordinaryEquitySymbols),
    fetchImpl,
    clock,
    permissions,
    requestTimeoutMs,
  }
  const adapters = Object.freeze([
    makeAdapter({
      dataset: DATASETS.prices, capability: 'prices.history', sourceId: ADAPTER_SOURCE_BY_DATASET[DATASETS.prices],
      fields: Object.keys(DAILY_FIELDS), priceAdjustments: ['none'], options: config, listeners,
    }),
    makeAdapter({
      dataset: DATASETS.statements, capability: 'financial.statements', sourceId: ADAPTER_SOURCE_BY_DATASET[DATASETS.statements],
      fields: Object.keys(FINANCIAL_FIELDS), options: config, listeners,
    }),
    makeAdapter({
      dataset: DATASETS.filings, capability: 'filings', sourceId: ADAPTER_SOURCE_BY_DATASET[DATASETS.filings],
      fields: FILING_FIELDS, options: config, listeners,
    }),
  ])
  return Object.freeze({
    adapters,
    dailyBars: adapters[0],
    financialStatements: adapters[1],
    announcementIndex: adapters[2],
    refreshPermissions() {
      for (const listener of listeners) {
        try { listener() } catch { /* status listeners are observers only */ }
      }
    },
  })
}

export const CN_EQUITY_READER_LIMITS = Object.freeze({
  maxWindowDays: MAX_WINDOW_DAYS,
  maxRows: MAX_ROWS,
  maxResponseBytes: MAX_RESPONSE_BYTES,
  maxSymbols: MAX_SYMBOLS,
  maxTimeoutMs: MAX_TIMEOUT_MS,
})
