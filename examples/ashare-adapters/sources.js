import { inflateRawSync } from 'node:zlib'
import { open, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const SOURCE_REF = {
  eastmoney: { uri: 'https://quote.eastmoney.com/', label: 'Eastmoney quotation source' },
  ths: { uri: 'https://basic.10jqka.com.cn/', label: 'THS basic data source' },
  'tdx-daily-package': { uri: 'https://www.tdx.com.cn/products/data/data/g4day/', label: 'TDX official daily package index' },
}
const TICKER = /^\d{6}\.(?:SH|SZ|BJ)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_SYMBOLS = 20
const MAX_BODY = 8_000_000
const MAX_ZIP_TOTAL = 64_000_000
const TIMEOUT_MS = 10_000
const FIELDS = ['open', 'high', 'low', 'close']
const fault = code => Object.assign(new Error(code), { code })
const freshRequest = query => Number.isFinite(Date.parse(query?.asOf)) &&
  Math.abs(Date.now() - Date.parse(query.asOf)) <= 300_000
const oneDayPeriod = period => period?.kind === 'range' && period.start === period.end && DATE.test(period.start)
const tickerAllowed = (query, symbols) => query?.market === 'CN' && query.entity?.scheme === 'ticker' &&
  TICKER.test(query.entity.id ?? '') && symbols.has(query.entity.id)
const checkCommon = (query, symbols, fields, capability, sourceId) => {
  if (query?.capability !== capability) return 'CAPABILITY_UNSUPPORTED'
  if (!tickerAllowed(query, symbols)) return 'ENTITY_UNSUPPORTED'
  if (query.temporalMode !== 'current_only' || query.researchIntent === 'historicalReplay') return 'TEMPORAL_MODE_UNSUPPORTED'
  if (capability === 'prices.history' ? !oneDayPeriod(query.period) :
    !(query.period?.kind === 'fiscal_year' && /^20\d{2}$/.test(query.period.end.slice(0, 4)) &&
      query.period.start === `${query.period.end.slice(0, 4)}-01-01` && query.period.end === `${query.period.end.slice(0, 4)}-12-31`)) return 'PERIOD_UNSUPPORTED'
  if (!freshRequest(query)) return 'CURRENT_ONLY_REQUEST_STALE'
  if (!Array.isArray(query.requiredFields) || query.requiredFields.length === 0 ||
    query.requiredFields.some(field => !fields.includes(field))) return 'FIELDS_UNSUPPORTED'
  if (query.sourceIds && !query.sourceIds.includes(sourceId)) return 'SOURCE_NOT_SELECTED'
  return null
}
const ordinarySymbols = values => {
  if (!Array.isArray(values) || values.length > MAX_SYMBOLS || values.some(value => typeof value !== 'string' || !TICKER.test(value))) {
    throw fault('INVALID_ORDINARY_EQUITY_ALLOWLIST')
  }
  return new Set(values)
}
const nowISO = () => new Date().toISOString()
function observableState(initial = 'READY') {
  let snapshot = { state: initial, verifiedAt: nowISO(), connectionStatus: 'UNKNOWN', authenticationStatus: 'NOT_REQUIRED' }
  const listeners = new Set()
  return {
    getSnapshot: () => ({ ...snapshot }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    set(state, nextCode, connectionStatus = 'UNKNOWN') {
      snapshot = { state, verifiedAt: nowISO(), connectionStatus, authenticationStatus: 'NOT_REQUIRED', ...(nextCode ? { code: nextCode } : {}) }
      for (const listener of listeners) { try { listener() } catch { /* observer is isolated */ } }
    },
    setQueryFailure(nextCode, connectionStatus = 'UNKNOWN') {
      // A failed request is not a failed registration. Keep the Adapter queryable so
      // a later request can recover; preserve verifiedAt as the last successful check.
      snapshot = { ...snapshot, state: 'READY', connectionStatus, code: nextCode }
      for (const listener of listeners) { try { listener() } catch { /* observer is isolated */ } }
    },
  }
}
function observation(field, value, query, retrievedAt, sourceId) {
  return {
    field, entity: { ...query.entity }, value,
    unit: { dimension: 'currency_per_share', currency: 'CNY', scale: 'ones' },
    period: { ...query.period }, accountingBasis: 'NOT_APPLICABLE', consolidation: 'NOT_APPLICABLE',
    measurementType: query.capability === 'earnings.consensus' ? 'estimate' : 'actual',
    availabilityEvidence: { type: 'current_snapshot', capturedAt: retrievedAt }, retrievedAt,
    revision: null,
    revisionEvidence: { chainId: null, chainStatus: 'unknown', supersedes: [],
      changeType: 'current_source_snapshot', sourceRecordId: null, capturedAt: retrievedAt,
      evidence: { uri: `urn:finance:${sourceId}:current-observation`, label: 'Current retrieval; no historical revision chain asserted' } },
    reference: SOURCE_REF[sourceId], licenseClass: 'UNASSESSED', pitQuality: 'CURRENT_OBSERVED',
  }
}
function safeResponseError(response) {
  if (response.status === 429 || response.status >= 500) return fault('HTTP_UNAVAILABLE')
  return fault('HTTP_UNAVAILABLE')
}
async function readTextBounded(response) {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_BODY) throw fault('RESPONSE_TOO_LARGE')
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_BODY) throw fault('RESPONSE_TOO_LARGE')
    return text
  }
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY) { await reader.cancel(); throw fault('RESPONSE_TOO_LARGE') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
function safeFetch(fetchImpl, url, signal, headers = {}) {
  if (typeof fetchImpl !== 'function') throw fault('NETWORK_UNAVAILABLE')
  if (signal?.aborted) throw signal.reason ?? fault('CANCELLED')
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  return fetchImpl(url, { method: 'GET', redirect: 'error', signal: combined, credentials: 'omit', headers })
    .catch(error => {
      if (signal?.aborted) throw fault('CANCELLED')
      if (timeout.aborted) throw fault('TIMEOUT')
      throw fault('NETWORK_UNAVAILABLE')
    })
}
function sourceRecord(query, raw, sourceId, warnings) {
  const retrievedAt = nowISO()
  return { observations: query.requiredFields.map(field => observation(field, raw[field], query, retrievedAt, sourceId)),
    corporateActions: [], filings: [], warnings }
}
function makeAdapter(metadata, sourceId, validate, query) {
  const state = observableState()
  let busy = false
  return {
    metadata,
    state,
    validate(request) { const code = validate(request); return { compatible: !code, ...(code ? { code } : {}) } },
    async query(request, execution = {}) {
      if (busy) throw fault('BUSY')
      const code = validate(request)
      if (code) throw fault(code)
      busy = true
      try {
        const raw = await query(request, execution)
        state.set('READY', undefined, 'CONNECTED')
        return sourceRecord(request, raw, sourceId,
          ['CURRENT_OBSERVED only; source revision history and strict point-in-time availability are not established.'])
      } catch (error) {
        const safeCode = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'ADAPTER_ERROR'
        const connectionStatus = ['NETWORK_UNAVAILABLE', 'TIMEOUT', 'HTTP_UNAVAILABLE'].includes(safeCode)
          ? 'DISCONNECTED' : 'UNKNOWN'
        state.setQueryFailure(safeCode, connectionStatus)
        throw error?.code ? error : fault('ADAPTER_ERROR')
      } finally { busy = false }
    },
  }
}

/** Parse one Eastmoney push2his daily JSON/JSONP response. No source call is made here. */
export function parseEastmoneyDaily(text, symbol, date) {
  if (!TICKER.test(symbol) || !DATE.test(date)) throw fault('INVALID_QUERY')
  let jsonText = String(text).trim()
  if (!jsonText.startsWith('{')) {
    const first = jsonText.indexOf('('), last = jsonText.lastIndexOf(')')
    if (first < 0 || last <= first) throw fault('INVALID_RESULT')
    jsonText = jsonText.slice(first + 1, last)
  }
  let payload
  try { payload = JSON.parse(jsonText) } catch { throw fault('INVALID_RESULT') }
  const code = payload?.data?.code
  const expected = symbol.slice(0, 6)
  const market = symbol.slice(-2)
  if (!['SH', 'SZ'].includes(market)) throw fault('ENTITY_UNSUPPORTED')
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : ''
  if (normalizedCode !== expected && normalizedCode !== `${market}${expected}`) throw fault('ENTITY_MISMATCH')
  const lines = payload?.data?.klines
  if (!Array.isArray(lines) || lines.length > 1000) throw fault('INVALID_RESULT')
  const line = lines.find(item => typeof item === 'string' && item.slice(0, 10) === date)
  if (!line) throw fault('PERIOD_NOT_AVAILABLE')
  const values = line.split(',')
  if (values.length < 7 || values[0] !== date) throw fault('INVALID_RESULT')
  // Eastmoney fields2 order: date, open, close, high, low, volume, amount, ...
  const mapped = { open: Number(values[1]), close: Number(values[2]), high: Number(values[3]), low: Number(values[4]) }
  if (Object.values(mapped).some(value => !Number.isFinite(value) || value <= 0) ||
    mapped.high < mapped.low || mapped.high < Math.max(mapped.open, mapped.close) ||
    mapped.low > Math.min(mapped.open, mapped.close)) throw fault('INVALID_RESULT')
  return mapped
}

export function createEastmoneyPriceAdapter({ ordinaryEquitySymbols = [], fetchImpl = globalThis.fetch } = {}) {
  const symbols = ordinarySymbols(ordinaryEquitySymbols)
  const validate = query => {
    const common = checkCommon(query, symbols, FIELDS, 'prices.history', 'eastmoney')
    if (common) return common
    return query.entity.id.endsWith('.SH') || query.entity.id.endsWith('.SZ') ? null : 'ENTITY_UNSUPPORTED'
  }
  const definition = makeAdapter({
    id: 'ashare-eastmoney-price', version: '1.0.0', sourceId: 'eastmoney',
    label: 'Eastmoney daily A-share price (current-source observation)', testOnly: false, licenseClass: 'UNASSESSED',
    authenticationMode: 'NONE',
    capabilities: [{ id: 'prices.history', markets: ['CN'], fields: FIELDS, temporalModes: ['current_only'],
      pitQualities: ['CURRENT_OBSERVED'], priceAdjustments: ['none'], priority: 10, quality: 50 }],
  }, 'eastmoney', validate, async (query, { signal } = {}) => {
    const symbol = query.entity.id
    const period = query.period.start
    const market = symbol.endsWith('.SH') ? '1' : symbol.endsWith('.SZ') ? '0' : null
    if (!market) throw fault('ENTITY_UNSUPPORTED')
    const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
    for (const [key, value] of Object.entries({ secid: `${market}.${symbol.slice(0, 6)}`, klt: '101', fqt: '0',
      beg: period.replaceAll('-', ''), end: period.replaceAll('-', ''), lmt: '1',
      fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61' })) url.searchParams.set(key, value)
    const response = await safeFetch(fetchImpl, url, signal, { accept: 'application/json', referer: 'https://quote.eastmoney.com/' })
    if (!response.ok) throw safeResponseError(response)
    return parseEastmoneyDaily(await readTextBounded(response), symbol, period)
  })
  return definition
}

function decodeHtml(value) {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\s+/g, ' ').trim()
}
function htmlCells(row) {
  return [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(match => decodeHtml(match[1]))
}
/** Accept only a THS table explicitly labelled as aggregate/consensus EPS, not broker EPSJB rows. */
export function parseThsAnnualEps(html, year) {
  if (!/^20\d{2}$/.test(String(year))) throw fault('INVALID_QUERY')
  const tables = [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(match => match[1])
  for (const table of tables) {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => htmlCells(match[1]))
    const header = rows.find(row => row.some(cell => /(?:一致|机构平均|平均预测)/.test(cell)) &&
      row.some(cell => /(?:EPS|每股收益)/i.test(cell) && /元\s*\/\s*股/.test(cell)))
    if (!header) continue
    const yearIndex = header.findIndex(cell => /(?:年度|年份|预测年|年份)/.test(cell))
    const epsIndex = header.findIndex(cell => /(?:一致|机构平均|平均预测)/.test(cell) && /(?:EPS|每股收益)/i.test(cell))
    if (yearIndex < 0 || epsIndex < 0) continue
    for (const row of rows) {
      if (row[yearIndex] !== String(year)) continue
      const text = row[epsIndex]?.replace(/[，,]/g, '').trim()
      if (!text || !/^-?(?:\d+\.\d+|\d+|\.\d+)$/.test(text)) throw fault('INVALID_RESULT')
      const value = Number(text)
      if (!Number.isFinite(value)) throw fault('INVALID_RESULT')
      return { eps: value }
    }
  }
  throw fault('CAPABILITY_UNSUPPORTED')
}

export function createThsConsensusAdapter({ ordinaryEquitySymbols = [], fetchImpl = globalThis.fetch } = {}) {
  const symbols = ordinarySymbols(ordinaryEquitySymbols)
  const validate = query => {
    const common = checkCommon(query, symbols, ['eps'], 'earnings.consensus', 'ths')
    if (common) return common
    if (query.entity.id !== '600519.SH') return 'CAPABILITY_UNSUPPORTED'
    if (query.period.kind !== 'fiscal_year' || query.period.start !== `${query.period.end.slice(0, 4)}-01-01` ||
      query.period.end !== `${query.period.end.slice(0, 4)}-12-31`) return 'PERIOD_UNSUPPORTED'
    return null
  }
  return makeAdapter({
    id: 'ashare-ths-consensus', version: '1.0.0', sourceId: 'ths',
    label: 'THS annual analyst-consensus EPS (current-source observation)', testOnly: false, licenseClass: 'UNASSESSED',
    authenticationMode: 'NONE',
    capabilities: [{ id: 'earnings.consensus', markets: ['CN'], fields: ['eps'], temporalModes: ['current_only'],
      pitQualities: ['CURRENT_OBSERVED'], priority: 10, quality: 35 }],
  }, 'ths', validate, async (query, { signal } = {}) => {
    const symbol = query.entity.id
    const url = `https://basic.10jqka.com.cn/new/${symbol.slice(0, 6)}/worth.html`
    const response = await safeFetch(fetchImpl, url, signal, { accept: 'text/html', referer: 'https://basic.10jqka.com.cn/' })
    if (!response.ok) throw safeResponseError(response)
    return parseThsAnnualEps(await readTextBounded(response), query.period.end.slice(0, 4))
  })
}

function findEocd(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557)
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (offset + 22 > bytes.length || bytes.readUInt32LE(offset) !== 0x06054b50) continue
    if (offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) return offset
  }
  throw fault('INVALID_RESULT')
}
const CRC32_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
function zipEntries(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BODY) throw fault('RESPONSE_TOO_LARGE')
  if (bytes.length < 22) throw fault('INVALID_RESULT')
  const eocd = findEocd(bytes)
  const disk = bytes.readUInt16LE(eocd + 4), centralDisk = bytes.readUInt16LE(eocd + 6)
  const diskCount = bytes.readUInt16LE(eocd + 8), count = bytes.readUInt16LE(eocd + 10)
  const centralSize = bytes.readUInt32LE(eocd + 12), centralOffset = bytes.readUInt32LE(eocd + 16)
  const centralEnd = centralOffset + centralSize
  if (disk !== 0 || centralDisk !== 0 || diskCount !== count || count > 100 ||
      centralOffset > eocd || centralEnd !== eocd) throw fault('INVALID_RESULT')
  const entries = new Map(), ranges = []
  let cursor = centralOffset, totalUncompressed = 0
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > centralEnd || bytes.readUInt32LE(cursor) !== 0x02014b50) throw fault('INVALID_RESULT')
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10)
    const checksum = bytes.readUInt32LE(cursor + 16), compressed = bytes.readUInt32LE(cursor + 20)
    const uncompressed = bytes.readUInt32LE(cursor + 24), nameLength = bytes.readUInt16LE(cursor + 28)
    const extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32)
    const diskStart = bytes.readUInt16LE(cursor + 34), localOffset = bytes.readUInt32LE(cursor + 42)
    const centralRecordEnd = cursor + 46 + nameLength + extraLength + commentLength
    if (centralRecordEnd > centralEnd || diskStart !== 0 || (flags & 1) !== 0 || ![0, 8].includes(method)) {
      throw fault('INVALID_RESULT')
    }
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    const name = nameBytes.toString('utf8')
    if (!/^(?:sh|sz|bj)\d{6}\.(?:cod|md1)$/.test(name) || entries.has(name) || localOffset + 30 > centralOffset) {
      throw fault('INVALID_RESULT')
    }
    totalUncompressed += uncompressed
    if (totalUncompressed > MAX_ZIP_TOTAL) throw fault('RESPONSE_TOO_LARGE')
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw fault('INVALID_RESULT')
    const localFlags = bytes.readUInt16LE(localOffset + 6), localMethod = bytes.readUInt16LE(localOffset + 8)
    const localChecksum = bytes.readUInt32LE(localOffset + 14), localCompressed = bytes.readUInt32LE(localOffset + 18)
    const localUncompressed = bytes.readUInt32LE(localOffset + 22), localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localExtraLength = bytes.readUInt16LE(localOffset + 28)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataOffset + compressed
    if (localFlags !== flags || localMethod !== method || localNameLength !== nameLength ||
        !bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).equals(nameBytes) ||
        dataOffset > centralOffset || dataEnd > centralOffset) throw fault('INVALID_RESULT')
    const hasDescriptor = (flags & 8) !== 0
    if (!hasDescriptor && (localChecksum !== checksum || localCompressed !== compressed || localUncompressed !== uncompressed)) {
      throw fault('INVALID_RESULT')
    }
    if (hasDescriptor && ((localChecksum !== 0 && localChecksum !== checksum) ||
        (localCompressed !== 0 && localCompressed !== compressed) ||
        (localUncompressed !== 0 && localUncompressed !== uncompressed))) throw fault('INVALID_RESULT')
    const compressedData = bytes.subarray(dataOffset, dataEnd)
    let data
    try {
      data = method === 0 ? Buffer.from(compressedData) : inflateRawSync(compressedData, { maxOutputLength: MAX_ZIP_TOTAL })
    } catch { throw fault('INVALID_RESULT') }
    if (data.length !== uncompressed || crc32(data) !== checksum) throw fault('INVALID_RESULT')
    let rangeEnd = dataEnd
    if (hasDescriptor) {
      let descriptor = dataEnd
      if (descriptor + 4 <= centralOffset && bytes.readUInt32LE(descriptor) === 0x08074b50) descriptor += 4
      if (descriptor + 12 > centralOffset || bytes.readUInt32LE(descriptor) !== checksum ||
          bytes.readUInt32LE(descriptor + 4) !== compressed || bytes.readUInt32LE(descriptor + 8) !== uncompressed) {
        throw fault('INVALID_RESULT')
      }
      rangeEnd = descriptor + 12
    }
    ranges.push([localOffset, rangeEnd])
    entries.set(name, data)
    cursor = centralRecordEnd
  }
  if (cursor !== centralEnd) throw fault('INVALID_RESULT')
  ranges.sort((left, right) => left[0] - right[0])
  for (let index = 1; index < ranges.length; index++) if (ranges[index - 1][1] > ranges[index][0]) throw fault('INVALID_RESULT')
  return entries
}
/** Decode only configured symbols from a dated TDX official daily package. */
export function parseTdxDailyPackage(bytes, symbols, date) {
  if (!DATE.test(date) || !Array.isArray(symbols) || symbols.length > MAX_SYMBOLS || symbols.some(symbol => !TICKER.test(symbol))) {
    throw fault('INVALID_QUERY')
  }
  const yymmdd = date.slice(2).replaceAll('-', '')
  const entries = zipEntries(Buffer.from(bytes))
  const rows = []
  for (const symbol of symbols) {
    const market = symbol.endsWith('.SH') ? 'sh' : symbol.endsWith('.SZ') ? 'sz' : 'bj'
    const stem = `${market}${yymmdd}`
    const codes = entries.get(`${stem}.cod`), daily = entries.get(`${stem}.md1`)
    if (!codes || !daily) throw fault('PERIOD_NOT_AVAILABLE')
    if (codes.length % 150 !== 0 || daily.length % 512 !== 0 || codes.length / 150 !== daily.length / 512) throw fault('INVALID_RESULT')
    const wanted = symbol.slice(0, 6), seenCodes = new Set(), seenSequences = new Set()
    let selected = null
    for (let offset = 0; offset < codes.length; offset += 150) {
      const code = codes.subarray(offset, offset + 6).toString('ascii')
      const sequence = codes.readUInt16LE(offset + 32)
      if (!/^\d{6}$/.test(code) || seenCodes.has(code) || seenSequences.has(sequence) || sequence >= daily.length / 512) throw fault('INVALID_RESULT')
      seenCodes.add(code); seenSequences.add(sequence)
      if (code !== wanted) continue
      const block = daily.subarray(sequence * 512, (sequence + 1) * 512)
      const previousClose = block.readDoubleLE(4)
      const [open, high, low, close] = [12, 20, 28, 36].map(index => block.readDoubleLE(index))
      const volume = block.readBigUInt64LE(56)
      const amount = block.readDoubleLE(72)
      if ([previousClose, open, high, low, close, amount].some(value => !Number.isFinite(value)) ||
        close <= 0 || [open, high, low].some(value => value < 0) || volume > BigInt(Number.MAX_SAFE_INTEGER) || amount < 0) {
        throw fault('INVALID_RESULT')
      }
      if ([open, high, low].some(value => value === 0)) throw fault('PERIOD_NOT_AVAILABLE')
      selected = { open, high, low, close }
    }
    if (!selected) throw fault('PERIOD_NOT_AVAILABLE')
    rows.push({ symbol, ...selected })
  }
  return rows
}

function localPackageReader(directory) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('://')) throw fault('NOT_CONFIGURED')
  const root = resolve(directory)
  return async (date, { signal } = {}) => {
    if (!DATE.test(date)) throw fault('INVALID_QUERY')
    signal?.throwIfAborted()
    const configuredRoot = await realpath(root)
    const configuredFile = await realpath(join(configuredRoot, `${date.replaceAll('-', '')}.zip`))
    const rel = relative(configuredRoot, configuredFile)
    if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw fault('INVALID_RESULT')
    const file = await open(configuredFile, 'r')
    try {
      const info = await file.stat()
      if (!info.isFile()) throw fault('INVALID_RESULT')
      if (info.size > MAX_BODY) throw fault('RESPONSE_TOO_LARGE')
      const bytes = Buffer.alloc(info.size)
      let offset = 0
      while (offset < bytes.length) {
        signal?.throwIfAborted()
        const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset)
        if (bytesRead === 0) throw fault('INVALID_RESULT')
        offset += bytesRead
      }
      const after = await file.stat()
      if (after.size !== info.size || after.mtimeMs !== info.mtimeMs) throw fault('INVALID_RESULT')
      signal?.throwIfAborted()
      return bytes
    } finally { await file.close() }
  }
}

/** TDX is a local authorized-package adapter; no download is enabled by default. */
export function createTdxDailyPackageAdapter({ ordinaryEquitySymbols = [], readAuthorizedPackage, packageDirectory } = {}) {
  const symbols = ordinarySymbols(ordinaryEquitySymbols)
  const safeDirectory = typeof packageDirectory === 'string' && isAbsolute(packageDirectory) && !packageDirectory.includes('://')
  const readPackage = readAuthorizedPackage ?? (safeDirectory ? localPackageReader(packageDirectory) : undefined)
  const validate = query => {
    const common = checkCommon(query, symbols, FIELDS, 'prices.history', 'tdx-daily-package')
    if (common) return common
    if (typeof readPackage !== 'function') return 'NOT_CONFIGURED'
    return null
  }
  return makeAdapter({
    id: 'ashare-tdx-daily-package', version: '1.0.0', sourceId: 'tdx-daily-package',
    label: 'TDX official dated daily package (authorized local file only)', testOnly: false, licenseClass: 'UNASSESSED',
    authenticationMode: 'USER_FILE',
    capabilities: [{ id: 'prices.history', markets: ['CN'], fields: FIELDS, temporalModes: ['current_only'],
      pitQualities: ['CURRENT_OBSERVED'], priceAdjustments: ['none'], priority: 5, quality: 45 }],
  }, 'tdx-daily-package', validate, async (query, { signal } = {}) => {
    const bytes = await readPackage(query.period.start, { signal })
    if (signal?.aborted) throw fault('CANCELLED')
    const rows = parseTdxDailyPackage(bytes, [query.entity.id], query.period.start)
    return rows[0]
  })
}

/** Three independent definitions; the caller owns one exact disposer per definition. */
export function createAshareAdapters(options = {}) {
  return [
    createEastmoneyPriceAdapter(options.eastmoney ?? {}),
    createThsConsensusAdapter(options.ths ?? {}),
    createTdxDailyPackageAdapter(options.tdx ?? {}),
  ]
}
