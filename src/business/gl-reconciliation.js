import { z } from 'zod'

// B06 gl-recon steps 1/2/4 only. No retrieval, trusted-source critic, cause inference or posting.
const MAX_BYTES = 64 * 1024
const buckets = ['MATCHED', 'AMOUNT_BREAK', 'QUANTITY_BREAK', 'TIMING_BREAK', 'GL_ONLY', 'SUBLEDGER_ONLY']
const fail = code => { throw new Error(code) }
const canonical = s => s.trim().toUpperCase()
const id = z.string().min(1).max(64).regex(/^ *[A-Za-z0-9][A-Za-z0-9_. -]* *$/)
  .refine(s => !/^(?:internal-gl|subledger|mcp[_. -].*)$/i.test(s.trim()), 'Source identities are not input capabilities')
const currency = z.string().regex(/^ *[A-Za-z]{3} *$/)
const date = z.string().regex(/^[1-9]\d{3}-\d{2}-\d{2}$/).refine(s => {
  const [y, m, d] = s.split('-').map(Number)
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1]
}, 'Expected ISO calendar date')
const decimal = places => z.string().max(57).regex(new RegExp(`^-?(?:0|[1-9]\\d{0,35})(?:\\.\\d{1,${places}})?$`))
const money = decimal(2), quantity = decimal(18)
const scale = z.enum(['ONES', 'THOUSANDS', 'MILLIONS'])
const units = { ONES: 1n, THOUSANDS: 1000n, MILLIONS: 1000000n }
const fixed = (s, places) => {
  const negative = s.startsWith('-'), [whole, frac = ''] = (negative ? s.slice(1) : s).split('.')
  return (negative ? -1n : 1n) * BigInt(whole + frac.padEnd(places, '0'))
}
const nonnegative = places => s => { try { return fixed(s, places) >= 0n } catch { return false } }
const positive = s => { try { return fixed(s, 18) > 0n } catch { return false } }
const abs = n => n < 0n ? -n : n
const display = (n, places) => {
  const digits = abs(n).toString().padStart(places + 1, '0')
  const fraction = digits.slice(-places).replace(/0+$/, '')
  return `${n < 0n ? '-' : ''}${digits.slice(0, -places)}${fraction ? `.${fraction}` : ''}`
}
const Record = z.strictObject({ entity: id, tradeDate: date, assetClass: id, currency, commonKey: id,
  postingDate: date, localAmount: money, baseAmount: money, baseCurrency: currency,
  amountScale: scale, quantity, quantityScale: scale, quantityUnit: z.enum(['UNITS', 'SHARES', 'CONTRACTS']),
  fxRate: quantity.refine(positive, 'Positive explicit FX rate required') })
const Side = z.strictObject({ asOf: date, records: z.array(Record).max(256) })
const Input = z.strictObject({ classification: z.enum(['TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED']),
  scope: z.strictObject({ entity: id, tradeDate: date, asOf: date, assetClasses: z.array(id).min(1).max(16) }),
  gl: Side, subledger: Side,
  tolerances: z.strictObject({ amount: money.refine(nonnegative(2)), quantity: quantity.refine(nonnegative(18)) })
    .default({ amount: '0.01', quantity: '0' }) })

// Reject duplicate JSON members (including escaped spellings), not just duplicate record keys.
const strictJson = text => {
  const stack = [], tokens = /"(?:\\.|[^"\\])*"|[{}\[\]]/g
  for (let token; (token = tokens.exec(text));) {
    const t = token[0]
    if (t === '{' || t === '[') {
      stack.push(t === '{' ? new Set() : null)
      if (stack.length > 12) fail('MAX_JSON_DEPTH_12')
    } else if (t === '}' || t === ']') stack.pop()
    else {
      let next = tokens.lastIndex
      while (' \t\r\n'.includes(text[next]) && next < text.length) next++
      if (text[next] !== ':') continue
      const key = JSON.parse(t), keys = stack.at(-1)
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('PROTOTYPE_KEY')
      if (keys?.has(key)) fail('DUPLICATE_JSON_KEY')
      keys?.add(key)
    }
  }
  return JSON.parse(text)
}

// String-only entry prevents getters, proxies, cycles and identity-bearing object APIs.
export const glReconciliationInputSchema = z.string().max(MAX_BYTES).superRefine((s, ctx) => {
  if (Buffer.byteLength(s, 'utf8') > MAX_BYTES) ctx.addIssue({ code: 'custom', message: 'MAX_UTF8_BYTES_65536' })
}).transform((s, ctx) => {
  try {
    const parsed = strictJson(s)
    if ([parsed?.gl?.records, parsed?.subledger?.records].some(rows => Array.isArray(rows) && rows.length > 256)) {
      ctx.addIssue({ code: 'custom', message: 'MAX_ROWS_PER_SIDE_256' }); return z.NEVER
    }
    return parsed
  } catch { ctx.addIssue({ code: 'custom', message: 'INVALID_JSON_OR_PROTOTYPE_KEY' }); return z.NEVER }
}).pipe(Input)

const normalize = r => ({ ...r, entity: canonical(r.entity), assetClass: canonical(r.assetClass),
  commonKey: canonical(r.commonKey), currency: canonical(r.currency), baseCurrency: canonical(r.baseCurrency),
  localAmount: display(fixed(r.localAmount, 2) * units[r.amountScale], 2),
  baseAmount: display(fixed(r.baseAmount, 2) * units[r.amountScale], 2), amountScale: 'ONES',
  quantity: display(fixed(r.quantity, 18) * units[r.quantityScale], 18), quantityScale: 'ONES',
  fxRate: display(fixed(r.fxRate, 18), 18) })
const keyOf = r => JSON.stringify([r.entity, r.tradeDate, r.assetClass, r.currency, r.commonKey])
const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0

export function reconcileGl(jsonText) {
  if (typeof jsonText !== 'string') throw new TypeError('JSON_STRING_REQUIRED')
  const input = glReconciliationInputSchema.parse(jsonText)
  const scope = { ...input.scope, entity: canonical(input.scope.entity), assetClasses: input.scope.assetClasses.map(canonical) }
  if (new Set(scope.assetClasses).size !== scope.assetClasses.length) fail('DUPLICATE_ASSET_CLASS')
  if (input.gl.asOf !== scope.asOf || input.subledger.asOf !== scope.asOf || scope.tradeDate > scope.asOf) fail('ASOF_MISMATCH')
  const index = side => {
    const out = new Map()
    for (const raw of side.records) {
      const r = normalize(raw), key = keyOf(r)
      if (r.entity !== scope.entity || r.tradeDate !== scope.tradeDate || !scope.assetClasses.includes(r.assetClass)) fail('SCOPE_MISMATCH')
      if (out.has(key)) fail('DUPLICATE_COMMON_KEY')
      out.set(key, r)
    }
    return out
  }
  const gl = index(input.gl), sub = index(input.subledger)
  const amountTolerance = fixed(input.tolerances.amount, 2), quantityTolerance = fixed(input.tolerances.quantity, 18)
  const delta = (a, b, field, places) => fixed(a?.[field] ?? '0', places) - fixed(b?.[field] ?? '0', places)
  const rows = [...new Set([...gl.keys(), ...sub.keys()])].sort(ordered).map(key => {
    const a = gl.get(key), b = sub.get(key)
    if (a && b && a.baseCurrency !== b.baseCurrency) fail('BASE_CURRENCY_MISMATCH')
    if (a && b && a.quantityUnit !== b.quantityUnit) fail('QUANTITY_UNIT_MISMATCH')
    const local = delta(a, b, 'localAmount', 2), base = delta(a, b, 'baseAmount', 2), qty = delta(a, b, 'quantity', 18)
    const differences = { localAmount: abs(local) > amountTolerance, baseAmount: abs(base) > amountTolerance,
      quantity: abs(qty) > quantityTolerance, postingDate: !!(a && b && a.postingDate !== b.postingDate),
      fxRate: !!(a && b && a.fxRate !== b.fxRate) }
    // Preserve all differences; deterministic primary-bucket precedence avoids double counting.
    const bucket = !a ? 'SUBLEDGER_ONLY' : !b ? 'GL_ONLY' : differences.quantity ? 'QUANTITY_BREAK'
      : differences.localAmount || differences.baseAmount || differences.fxRate ? 'AMOUNT_BREAK'
        : differences.postingDate ? 'TIMING_BREAK' : 'MATCHED'
    return { key: JSON.parse(key), gl: a ?? null, subledger: b ?? null, bucket, differences,
      delta: { localAmount: display(local, 2), baseAmount: display(base, 2), quantity: display(qty, 18) },
      rootCause: 'unknown', evidenceStatus: 'NEEDS_EVIDENCE', criticStatus: 'NOT_PERFORMED',
      owner: null, expectedClearDate: null, action: null }
  })
  // No cross-currency or cross-quantity-unit sums, including within each primary bucket.
  const totals = selected => {
    const moneyTotals = new Map(), quantityTotals = new Map()
    const add = (map, k, side, value) => {
      if (!map.has(k)) map.set(k, { gl: 0n, subledger: 0n })
      map.get(k)[side] += value
    }
    for (const row of selected) for (const side of ['gl', 'subledger']) {
      const r = row[side]; if (!r) continue
      add(moneyTotals, JSON.stringify(['LOCAL', r.currency]), side, fixed(r.localAmount, 2))
      add(moneyTotals, JSON.stringify(['BASE', r.baseCurrency]), side, fixed(r.baseAmount, 2))
      add(quantityTotals, JSON.stringify([r.assetClass, r.currency, r.quantityUnit]), side, fixed(r.quantity, 18))
    }
    const format = (map, places) => [...map.entries()].sort(([a], [b]) => ordered(a, b)).map(([key, v]) =>
      ({ key: JSON.parse(key), gl: display(v.gl, places), subledger: display(v.subledger, places), delta: display(v.gl - v.subledger, places) }))
    return { money: format(moneyTotals, 2), quantities: format(quantityTotals, 18) }
  }
  const counts = Object.fromEntries(buckets.map(bucket => [bucket, rows.filter(r => r.bucket === bucket).length]))
  // Exact rational percent; repeating decimals deliberately not rounded or represented as floats.
  const matchedPercentage = rows.length ? { numerator: String(counts.MATCHED * 100), denominator: String(rows.length) } : null
  const breaks = rows.filter(r => r.bucket !== 'MATCHED').sort((a, b) => {
    // Rank within currency only; ranking unlike base currencies by magnitude would imply FX conversion.
    const currencyOrder = ordered((a.gl ?? a.subledger).baseCurrency, (b.gl ?? b.subledger).baseCurrency)
    const magnitudeA = abs(fixed(a.delta.baseAmount, 2)), magnitudeB = abs(fixed(b.delta.baseAmount, 2))
    return currencyOrder || (magnitudeA > magnitudeB ? -1 : magnitudeA < magnitudeB ? 1 : ordered(JSON.stringify(a.key), JSON.stringify(b.key)))
  })
  return { version: '1.0.0', classification: input.classification, dataTrust: 'UNTRUSTED_DATA',
    status: 'DRAFT_REVIEW_REQUIRED', scope, inputData: { gl: input.gl, subledger: input.subledger },
    tolerances: input.tolerances, rows, breaks, summary: { glRows: gl.size, subledgerRows: sub.size, joinedRows: rows.length,
      counts, matchedPercentage, totals: totals(rows), byBucket: buckets.map(bucket => ({ bucket, count: counts[bucket], totals: totals(rows.filter(r => r.bucket === bucket)) })),
      byCause: [{ cause: 'unknown', count: breaks.length, totals: totals(breaks) }] },
    checks: { scope: 'CONSISTENT', duplicateKeys: 'ABSENT', arithmetic: 'EXACT_DECIMAL',
      underlyingTransactions: 'NEEDS_EVIDENCE', independentTrustedCritic: 'NOT_PERFORMED', authorization: 'NOT_EVALUATED' },
    controllerSignoff: 'PENDING', journalEntries: { status: 'DRAFT_ONLY', entries: [] }, publish: false, posting: false }
}
