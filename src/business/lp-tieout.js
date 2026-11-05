// Independent B10 numerical subcheck; not a Tool, document reader, approval gate or native service.
const MAX_BYTES = 524288, MAX_OUTPUT_BYTES = 1048576, MAX_LPS = 200, CENT = 10000n, OWN = 1000000000000n;
const string = (pattern, maxLength) => ({ type: 'string', pattern, maxLength });
const id = string('^[A-Za-z0-9_-]+$', 64), lpId = string('^[A-Za-z0-9_-]+$', 32), ref = string('^[A-Za-z0-9_./:#-]+$', 96);
const money = string('^-?(0|[1-9][0-9]{0,23})(\\.[0-9]{1,6})?$', 32);
const ownership = string('^(0(\\.[0-9]{1,12})?|1(\\.0{1,12})?)$', 14);
const enumeration = (...values) => ({ enum: values });
const object = (properties, optional = []) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties).filter(k => !optional.includes(k)) });
const array = items => ({ type: 'array', minItems: 1, maxItems: MAX_LPS, items });
const source = object({ document_id: id, extract_ref: ref, classification: enumeration('TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED'), input_kind: enumeration('SIMULATED_FIXTURE', 'DOCUMENT_EXTRACT') });
const context = { entity_id: id, fund_id: id, period_start: string('^[0-9]{4}-[0-9]{2}-[0-9]{2}$', 10), period_end: string('^[0-9]{4}-[0-9]{2}-[0-9]{2}$', 10), currency: string('^[A-Z]{3}$', 3), source };
const fields = ['beginning', 'contributions', 'distributions', 'realized', 'unrealized', 'management_fee', 'expenses', 'allocated_net_income', 'carry', 'ending', 'commitment', 'unfunded', 'recallable'];
const monetary = names => Object.fromEntries(names.map(k => [k, money]));
const scoped = (properties) => object({ ...context, coverage: enumeration('FULL', 'SUBSET'), ...properties });
const schema = object({
  schema_version: { const: 1 }, batch_id: id,
  statements: scoped({ lps: array(object({ lp_id: lpId, ownership, ...monetary(fields) })) }),
  nav_pack: scoped({ totals: object(monetary(['realized', 'unrealized', 'management_fee', 'expenses', 'nav'])),
    terms: object({ allocation_method: { const: 'PRO_RATA_NET' }, ownership_basis: { const: 'NAV_PACK_COMMITMENT_FRACTION' }, carry_method: { const: 'SOURCED_LP_CRYSTALLIZED_AMOUNTS' }, rounding_basis: { const: 'ALLOCATED_NET_THEN_ENDING' }, money_scale: { const: 2 }, rounding_method: enumeration('HALF_AWAY_FROM_ZERO', 'HALF_EVEN'), fund_rounding_tolerance: money, source_ref: ref }),
    lps: array(object({ lp_id: lpId, ownership, ...monetary(['beginning', 'contributions', 'distributions', 'carry']) })) }),
  commitment_register: scoped({ lps: array(object({ lp_id: lpId, ...monetary(['commitment', 'unfunded', 'recallable']) })) }),
  prior: object({ ...context, lps: array(object({ lp_id: lpId, ending: money })) }),
  next: object({ ...context, lps: array(object({ lp_id: lpId, beginning: money })) })
}, ['nav_pack', 'commitment_register', 'prior', 'next']);

/** Local library discovery only. A future bridge must serialize trusted typed extracts; no identity/permissions are accepted here. */
export function describe() {
  return { kind: 'PURE_LIBRARY_NOT_NATIVE_TOOL', schema: JSON.parse(JSON.stringify(schema)), max_utf8_bytes: MAX_BYTES, max_output_utf8_bytes: MAX_OUTPUT_BYTES, max_lps: MAX_LPS,
    tolerance: '0.01', ownership_precision: '12 decimal places; exact rational fraction, not percent', money_precision: '24 integer / 6 fractional digits',
    authoritative_basis: 'Caller-designated NAV pack and independent commitment register; provenance and authorization are not authenticated',
    rounding: 'Explicit NAV terms: allocated components displayed at cents; net rounded once, then ending rounded; no waterfall inferred',
    scope: 'DRAFT recommendations only; no I/O, model, MCP, approval, mutation, distribution or official sign-off' };
}
class Invalid extends Error { constructor(code, path) { super(code); this.code = code; this.path = path; } }
function reject(code, path) { throw new Invalid(code, path); }
function validate(value, rule, path) {
  if (rule.const !== undefined && value !== rule.const) reject('INVALID_INPUT', path);
  if (rule.enum && !rule.enum.includes(value)) reject('INVALID_INPUT', path);
  if (rule.type === 'string' && (typeof value !== 'string' || value.length > rule.maxLength || !new RegExp(rule.pattern).test(value))) reject('INVALID_INPUT', path);
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) reject('INVALID_INPUT', path);
    value.forEach((v, i) => validate(v, rule.items, `${path}[${i}]`));
  }
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) reject('INVALID_INPUT', path);
    for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties, key)) reject('UNKNOWN_FIELD', path);
    for (const key of rule.required) if (!Object.hasOwn(value, key)) reject('MISSING_FIELD', `${path}.${key}`);
    for (const key of Object.keys(value)) validate(value[key], rule.properties[key], `${path}.${key}`);
  }
}
function parse(json) {
  if (typeof json !== 'string') reject('JSON_STRING_REQUIRED', '$');
  if (json.length > MAX_BYTES || new TextEncoder().encode(json).length > MAX_BYTES) reject('INPUT_LIMIT', '$');
  let value;
  try { value = JSON.parse(json); } catch { reject('INVALID_JSON', '$'); }
  // JSON.parse otherwise silently accepts duplicate keys. Scan valid JSON tokens without traversing untrusted objects.
  const stack = [];
  for (const token of json.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)) {
    const t = token[0], top = stack.at(-1);
    if (t === '{' || t === '[') { stack.push({ object: t === '{', key: true, keys: new Set() }); if (stack.length > 12) reject('DEPTH_LIMIT', '$'); }
    else if (t === '}' || t === ']') stack.pop();
    else if (t === ',' && top) top.key = true;
    else if (t === ':' && top) top.key = false;
    else if (t.startsWith('"') && top?.object && top.key) {
      const key = JSON.parse(t); if (top.keys.has(key)) reject('DUPLICATE_JSON_KEY', '$'); top.keys.add(key);
    }
  }
  validate(value, schema, '$'); return value;
}
const decimal = (text, places = 6) => { const [whole, fraction = ''] = text.split('.'); return BigInt(whole + fraction.padEnd(places, '0')); };
function format(value, places = 6) {
  const sign = value < 0n ? '-' : '', digits = (value < 0n ? -value : value).toString().padStart(places + 1, '0');
  return sign + digits.slice(0, -places) + '.' + digits.slice(-places).replace(/0+$/, '').padEnd(2, '0');
}
function rounded(numerator, denominator, method) {
  const sign = numerator < 0n ? -1n : 1n, n = numerator * sign, d = denominator * CENT;
  let q = n / d; const r = n % d;
  if (2n * r > d || (2n * r === d && (method === 'HALF_AWAY_FROM_ZERO' || q % 2n === 1n))) q++;
  return sign * q * CENT;
}
const validDate = text => { const ms = Date.parse(`${text}T00:00:00Z`); return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text; };
const sameSet = (a, b) => a.size === b.size && [...a.keys()].every(k => b.has(k));
const absolute = n => n < 0n ? -n : n;
const base = () => ({ schema_version: 1, trust: 'NONTRUSTED_DATA', status: 'DRAFT_REVIEW_REQUIRED', recommendation: 'HOLD', tolerance: '0.01',
  limitations: ['Caller-designated authority; no source authentication or license assertion', 'Not an audit opinion, clearance, distribution or official sign-off', 'Carry compared to explicit sourced amounts; waterfall not independently validated', 'Unfunded compared to actual register, not derived'], flags: [], statements: [] });

/** Accepts only bounded strict JSON text containing typed document extracts, never executable objects or PDFs. */
export function tieout(json) {
  const result = base(); let input;
  try { input = parse(json); }
  catch (error) { if (!(error instanceof Invalid)) throw error; result.flags.push({ code: error.code, path: error.path }); return result; }
  result.batch_id = input.batch_id;
  const flag = (code, path) => result.flags.push({ code, path });
  const docs = Object.entries(input).filter(([, v]) => v && typeof v === 'object');
  const maps = {};
  for (const [name, doc] of docs) {
    const map = new Map(); maps[name] = map;
    for (const lp of doc.lps) { if (map.has(lp.lp_id)) { flag('DUPLICATE_LP', name); return result; } map.set(lp.lp_id, lp); }
    if (!validDate(doc.period_start) || !validDate(doc.period_end) || doc.period_start > doc.period_end) flag('INVALID_PERIOD', name);
    if (doc.source.classification === 'UNSOURCED') flag('UNSOURCED_INPUT', name);
    if ((doc.source.classification === 'TEST_ONLY') !== (doc.source.input_kind === 'SIMULATED_FIXTURE')) flag('SOURCE_CLASSIFICATION_MISMATCH', name);
    for (const field of ['entity_id', 'fund_id', 'currency']) if (doc[field] !== input.statements[field]) flag(`CONTEXT_${field.toUpperCase()}_MISMATCH`, name);
    if (['nav_pack', 'commitment_register'].includes(name) && (doc.period_start !== input.statements.period_start || doc.period_end !== input.statements.period_end)) flag('CONTEXT_PERIOD_MISMATCH', name);
  }
  result.source_classifications = Object.fromEntries(docs.map(([k, v]) => [k, v.source.classification]));
  for (const name of ['nav_pack', 'commitment_register']) if (!input[name]) flag(`MISSING_${name.toUpperCase()}`, name);
  const nav = input.nav_pack, register = input.commitment_register;
  if (!nav) return result;
  if (nav.source.document_id === input.statements.source.document_id || (register && [nav.source.document_id, input.statements.source.document_id].includes(register.source.document_id))) flag('INDEPENDENT_SOURCE_REQUIRED', '$');
  if (nav.terms.source_ref !== nav.source.extract_ref) flag('UNSOURCED_TERMS', 'nav_pack.terms.source_ref');
  const fundTolerance = decimal(nav.terms.fund_rounding_tolerance);
  if (fundTolerance < 0n || fundTolerance > CENT * BigInt(nav.lps.length)) { flag('UNSUPPORTED_FUND_TOLERANCE', 'nav_pack.terms'); return result; }
  result.basis = { ...nav.terms, line_tolerance: '0.01', fund_tolerance_basis: 'Explicit sourced NAV terms, bounded by one source line tolerance per LP; never inferred' };
  const row = (target, field, actual, expected, code = 'LINE_MISMATCH', places = 6, tolerance = CENT) => {
    const delta = actual - expected, passed = places === 12 ? delta === 0n : absolute(delta) <= tolerance;
    target.push({ field, reported: format(actual, places), recomputed: format(expected, places), delta: format(delta, places), tolerance: places === 12 ? '0.00' : format(tolerance), status: passed ? 'PASS' : 'HOLD', cause: passed ? 'WITHIN_TOLERANCE' : code });
  };
  for (const name of ['statements', 'nav_pack', 'commitment_register']) {
    if (!input[name]) continue;
    if (input[name].coverage !== 'FULL') flag('MISSING_COVERAGE', name);
    if (input[name].coverage === 'FULL' && !sameSet(maps.statements, maps[name])) flag('MISSING_COVERAGE', name);
  }
  if (register && !sameSet(maps.nav_pack, maps.commitment_register)) flag('MISSING_COVERAGE', 'authoritative_lp_sets');
  for (const name of ['statements', 'nav_pack']) if (input[name].coverage === 'FULL' && [...maps[name].values()].reduce((s, lp) => s + decimal(lp.ownership, 12), 0n) !== OWN) flag('OWNERSHIP_SUM_NOT_ONE', name);
  const prior = maps.prior, next = maps.next, current = input.statements;
  for (const name of ['prior', 'next']) if (input[name]) {
    const adjacent = name === 'prior' ? Date.parse(`${current.period_start}T00:00:00Z`) - Date.parse(`${input[name].period_end}T00:00:00Z`) : Date.parse(`${input[name].period_start}T00:00:00Z`) - Date.parse(`${current.period_end}T00:00:00Z`);
    if (adjacent !== 86400000) flag('CONTINUITY_PERIOD_MISMATCH', name);
  }
  let reportedSum = 0n, recomputedSum = 0n;
  for (const reported of current.lps) {
    const lp = maps.nav_pack.get(reported.lp_id), reg = maps.commitment_register?.get(reported.lp_id);
    const item = { lp_id: reported.lp_id, recommendation: 'HOLD', checks: [], flags: [], continuity: { prior: prior ? 'HOLD' : 'NOT_PROVIDED', next: next ? 'HOLD' : 'NOT_PROVIDED' } };
    result.statements.push(item); reportedSum += decimal(reported.ending);
    if (!lp) { item.flags.push('MISSING_NAV_LP'); continue; }
    const pct = decimal(lp.ownership, 12), method = nav.terms.rounding_method;
    const expected = Object.fromEntries(['beginning', 'contributions', 'distributions', 'carry'].map(k => [k, decimal(lp[k])]));
    let net = 0n;
    for (const field of ['realized', 'unrealized', 'management_fee', 'expenses']) {
      const total = decimal(nav.totals[field]); net += ['realized', 'unrealized'].includes(field) ? total : -total;
      expected[field] = rounded(total * pct, OWN, method);
    }
    expected.allocated_net_income = rounded(net * pct, OWN, method);
    expected.ending = rounded(expected.beginning + expected.contributions - expected.distributions + expected.allocated_net_income - expected.carry, 1n, method);
    recomputedSum += expected.ending;
    row(item.checks, 'ownership', decimal(reported.ownership, 12), pct, 'OWNERSHIP_MISMATCH', 12);
    for (const field of fields.slice(0, 10)) row(item.checks, field, decimal(reported[field]), expected[field], ['management_fee', 'expenses'].includes(field) ? 'FEE_ALLOCATION_MISMATCH' : field === 'carry' ? 'CARRY_ALLOCATION_MISMATCH' : 'NAV_INPUT_OR_ALLOCATION_MISMATCH');
    if (!reg) item.flags.push('MISSING_REGISTER_LP');
    else for (const field of ['commitment', 'unfunded', 'recallable']) row(item.checks, field, decimal(reported[field]), decimal(reg[field]), 'REGISTER_MISMATCH');
    for (const name of ['prior', 'next']) {
      const doc = maps[name]; if (!doc) continue;
      const other = doc.get(lp.lp_id), field = name === 'prior' ? 'beginning' : 'ending';
      if (!other) { item.flags.push(`MISSING_${name.toUpperCase()}_LP`); continue; }
      const otherValue = decimal(other[name === 'prior' ? 'ending' : 'beginning']), start = item.checks.length;
      row(item.checks, `${name}_vs_reported_${field}`, decimal(reported[field]), otherValue, 'CONTINUITY_MISMATCH');
      row(item.checks, `${name}_vs_recomputed_${field}`, expected[field], otherValue, 'CONTINUITY_MISMATCH');
      item.continuity[name] = item.checks.slice(start).every(c => c.status === 'PASS') && !result.flags.some(f => f.path === name) ? 'PASS' : 'HOLD';
    }
    if (!item.flags.length && item.checks.every(c => c.status === 'PASS') && !result.flags.some(f => !['MISSING_COVERAGE', 'OWNERSHIP_SUM_NOT_ONE'].includes(f.code))) item.recommendation = 'PASS';
  }
  const full = register && ['statements', 'nav_pack', 'commitment_register'].every(k => input[k].coverage === 'FULL') && sameSet(maps.statements, maps.nav_pack) && sameSet(maps.nav_pack, maps.commitment_register);
  result.fund = { status: 'HOLD', coverage: full ? 'FULL' : 'MISSING_COVERAGE', checks: [] };
  if (full) {
    row(result.fund.checks, 'reported_lp_sum_vs_nav', reportedSum, decimal(nav.totals.nav), 'FUND_NAV_MISMATCH', 6, fundTolerance);
    row(result.fund.checks, 'recomputed_lp_sum_vs_nav', recomputedSum, decimal(nav.totals.nav), 'FUND_NAV_MISMATCH', 6, fundTolerance);
    if (result.fund.checks.every(c => c.status === 'PASS')) result.fund.status = 'PASS';
  }
  if (!result.flags.length && result.statements.every(s => s.recommendation === 'PASS') && result.fund.status === 'PASS') result.recommendation = 'PASS';
  return result;
}
