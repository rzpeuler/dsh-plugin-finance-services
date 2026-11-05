import test from 'node:test';
import assert from 'node:assert/strict';
import { describe, tieout } from '../src/business/lp-tieout.js';

// SIMULATED_FIXTURE / TEST_ONLY: invented LP capital extracts, not documents, provider data or licensed inputs.
function fixture(continuity = false) {
  const source = document_id => ({ document_id, extract_ref: `${document_id}:page1`, classification: 'TEST_ONLY', input_kind: 'SIMULATED_FIXTURE' });
  const context = { entity_id: 'FundEntity', fund_id: 'FundA', period_start: '2026-01-01', period_end: '2026-03-31', currency: 'USD', coverage: 'FULL' };
  const balances = { ownership: '0.5', beginning: '100.00', contributions: '10.00', distributions: '5.00', realized: '10.00', unrealized: '5.00', management_fee: '2.00', expenses: '1.00', allocated_net_income: '12.00', carry: '2.00', ending: '115.00', commitment: '200.00', unfunded: '90.00', recallable: '5.00' };
  const lps = ['LP1', 'LP2'].map(lp_id => ({ lp_id, ...balances }));
  const project = (lp, keys) => Object.fromEntries(['lp_id', ...keys].map(k => [k, lp[k]]));
  const input = { schema_version: 1, batch_id: 'test-batch', statements: { ...context, source: source('statements'), lps },
    nav_pack: { ...context, source: source('nav'), totals: { realized: '20.00', unrealized: '10.00', management_fee: '4.00', expenses: '2.00', nav: '230.00' },
      terms: { allocation_method: 'PRO_RATA_NET', ownership_basis: 'NAV_PACK_COMMITMENT_FRACTION', carry_method: 'SOURCED_LP_CRYSTALLIZED_AMOUNTS', rounding_basis: 'ALLOCATED_NET_THEN_ENDING', money_scale: 2, rounding_method: 'HALF_AWAY_FROM_ZERO', fund_rounding_tolerance: '0.01', source_ref: 'nav:page1' },
      lps: lps.map(lp => project(lp, ['ownership', 'beginning', 'contributions', 'distributions', 'carry'])) },
    commitment_register: { ...context, source: source('register'), lps: lps.map(lp => project(lp, ['commitment', 'unfunded', 'recallable'])) } };
  if (continuity) {
    const { coverage, ...periodContext } = context;
    input.prior = { ...periodContext, source: source('prior'), period_start: '2025-10-01', period_end: '2025-12-31', lps: lps.map(lp => ({ lp_id: lp.lp_id, ending: '100.00' })) };
    input.next = { ...periodContext, source: source('next'), period_start: '2026-04-01', period_end: '2026-06-30', lps: lps.map(lp => ({ lp_id: lp.lp_id, beginning: '115.00' })) };
  }
  return input;
}
const run = input => tieout(JSON.stringify(input));
const check = (output, field, index = 0) => output.statements[index].checks.find(c => c.field === field);
const flagged = (output, code) => output.flags.some(f => f.code === code);

test('pure discovery is detached, strict and explicitly not a native Tool', () => {
  const d = describe(); assert.equal(d.kind, 'PURE_LIBRARY_NOT_NATIVE_TOOL');
  assert.equal(d.schema.additionalProperties, false); d.schema.properties = {};
  assert.ok(describe().schema.properties.statements); assert.equal(describe().tolerance, '0.01');
});
test('independent full capital-account batch passes only a DRAFT recommendation', () => {
  const output = run(fixture(true)); assert.equal(output.recommendation, 'PASS');
  assert.equal(output.trust, 'NONTRUSTED_DATA'); assert.equal(output.status, 'DRAFT_REVIEW_REQUIRED');
  assert.equal(check(output, 'ending').recomputed, '115.00'); assert.equal(output.fund.coverage, 'FULL');
  assert.equal(output.statements[0].continuity.prior, 'PASS'); assert.equal(output.statements[0].continuity.next, 'PASS');
  assert.ok(output.limitations.some(x => x.includes('official sign-off')));
});
test('absent optional prior/next are NOT_PROVIDED, not continuity success', () => {
  const output = run(fixture()); assert.equal(output.recommendation, 'PASS');
  assert.deepEqual(output.statements[0].continuity, { prior: 'NOT_PROVIDED', next: 'NOT_PROVIDED' });
});
test('deterministic and input remains byte-identical; output decimal strings only', () => {
  const input = fixture(true), json = JSON.stringify(input), a = tieout(json), b = tieout(json);
  assert.deepEqual(a, b); assert.equal(JSON.stringify(input), json);
  for (const lp of a.statements) for (const row of lp.checks) for (const key of ['reported', 'recomputed', 'delta', 'tolerance']) assert.equal(typeof row[key], 'string');
  assert.ok(JSON.stringify(a).length < 20000);
});
for (const [amount, expected] of [['115.01', 'PASS'], ['114.99', 'PASS'], ['115.010001', 'HOLD'], ['114.989999', 'HOLD']]) test(`inclusive per-LP 0.01 tolerance: ${amount}`, () => {
  const input = fixture(); input.statements.lps[0].ending = amount; const output = run(input);
  assert.equal(check(output, 'ending').status, expected); assert.equal(output.recommendation, expected);
});
test('fund tolerance is explicit, not guessed or widened from line tolerance', () => {
  const input = fixture(); input.nav_pack.terms.fund_rounding_tolerance = '0.00'; input.statements.lps[0].ending = '115.01';
  const output = run(input); assert.equal(check(output, 'ending').status, 'PASS'); assert.equal(output.fund.status, 'HOLD');
  delete input.nav_pack.terms.fund_rounding_tolerance; assert.ok(flagged(run(input), 'MISSING_FIELD'));
});
for (const value of ['-0.01', '999999.00']) test(`unsafe fund rounding threshold ${value} is rejected`, () => {
  const input = fixture(); input.nav_pack.terms.fund_rounding_tolerance = value; assert.ok(flagged(run(input), 'UNSUPPORTED_FUND_TOLERANCE'));
});
test('one LP wrong ownership detected independently even while ownership sums to one', () => {
  const input = fixture(); input.statements.lps[0].ownership = '0.6'; input.statements.lps[1].ownership = '0.4';
  const output = run(input); assert.equal(output.fund.status, 'PASS'); assert.equal(output.recommendation, 'HOLD');
  assert.equal(check(output, 'ownership').cause, 'OWNERSHIP_MISMATCH');
});
test('authoritative ownership after transfer drives recalculation despite cancelling fund sum', () => {
  const input = fixture(); input.nav_pack.lps[0].ownership = '0.6'; input.nav_pack.lps[1].ownership = '0.4';
  const output = run(input); assert.equal(output.fund.status, 'PASS'); assert.equal(output.recommendation, 'HOLD');
  assert.equal(check(output, 'ending').recomputed, '117.40'); assert.equal(check(output, 'ownership').cause, 'OWNERSHIP_MISMATCH');
});
test('offsetting LP ending errors cannot hide behind a correct fund NAV sum', () => {
  const input = fixture(); input.statements.lps[0].ending = '116.00'; input.statements.lps[1].ending = '114.00';
  const output = run(input); assert.equal(output.fund.status, 'PASS'); assert.equal(output.recommendation, 'HOLD');
  assert.ok(output.statements.every(s => s.recommendation === 'HOLD'));
});
test('offset fee errors identify fee cause, not a generic fund-only success', () => {
  const input = fixture(); input.statements.lps[0].management_fee = '3.00'; input.statements.lps[1].management_fee = '1.00';
  const output = run(input); assert.equal(output.fund.status, 'PASS'); assert.equal(check(output, 'management_fee').cause, 'FEE_ALLOCATION_MISMATCH');
  assert.equal(output.recommendation, 'HOLD');
});
for (const field of ['beginning', 'contributions', 'distributions', 'realized', 'unrealized', 'expenses', 'allocated_net_income', 'carry', 'commitment', 'unfunded', 'recallable']) test(`independent ${field} line mismatch held`, () => {
  const input = fixture(); input.statements.lps[0][field] = '999.00'; const output = run(input);
  assert.equal(check(output, field).status, 'HOLD'); assert.equal(output.recommendation, 'HOLD');
});
test('misaligned contribution/distribution columns do not pass', () => {
  const input = fixture(); [input.statements.lps[0].contributions, input.statements.lps[0].distributions] = ['5.00', '10.00'];
  const output = run(input); assert.equal(check(output, 'contributions').status, 'HOLD'); assert.equal(check(output, 'distributions').status, 'HOLD');
});
test('unfunded is compared to independent actual register, not an invented commitment formula', () => {
  const input = fixture(); input.statements.lps[0].unfunded = '17.23'; input.commitment_register.lps[0].unfunded = '17.23';
  assert.equal(run(input).recommendation, 'PASS'); input.commitment_register.lps[0].unfunded = '17.25';
  assert.equal(check(run(input), 'unfunded').cause, 'REGISTER_MISMATCH');
});
for (const name of ['nav_pack', 'commitment_register']) test(`missing ${name} is HOLD, never fabricated`, () => {
  const input = fixture(); delete input[name]; const output = run(input);
  assert.equal(output.recommendation, 'HOLD'); assert.ok(flagged(output, `MISSING_${name.toUpperCase()}`));
});
for (const name of ['statements', 'nav_pack', 'commitment_register']) test(`${name} subset cannot establish full-fund PASS`, () => {
  const input = fixture(); input[name].coverage = 'SUBSET'; const output = run(input);
  assert.equal(output.recommendation, 'HOLD'); assert.ok(flagged(output, 'MISSING_COVERAGE')); assert.equal(output.fund.coverage, 'MISSING_COVERAGE');
});
for (const name of ['statements', 'nav_pack', 'commitment_register']) test(`${name} incomplete LP set is HOLD`, () => {
  const input = fixture(); input[name].lps.pop(); const output = run(input);
  assert.equal(output.recommendation, 'HOLD'); assert.ok(flagged(output, 'MISSING_COVERAGE'));
});
for (const name of ['statements', 'nav_pack', 'commitment_register', 'prior', 'next']) test(`duplicate LP in ${name} rejected, not aggregated`, () => {
  const input = fixture(true); input[name].lps.push({ ...input[name].lps[0] }); const output = run(input);
  assert.equal(output.recommendation, 'HOLD'); assert.ok(flagged(output, 'DUPLICATE_LP')); assert.equal(output.statements.length, 0);
});
for (const name of ['statements', 'nav_pack']) test(`full ${name} ownership must sum exactly to one`, () => {
  const input = fixture(); input[name].lps[0].ownership = '0.499999999999'; assert.ok(flagged(run(input), 'OWNERSHIP_SUM_NOT_ONE'));
});
for (const [field, value, code] of [['entity_id', 'OtherEntity', 'ENTITY_ID'], ['fund_id', 'OtherFund', 'FUND_ID'], ['currency', 'EUR', 'CURRENCY'], ['period_end', '2026-03-30', 'PERIOD']]) test(`NAV ${field} identity mismatch holds`, () => {
  const input = fixture(); input.nav_pack[field] = value; const output = run(input);
  assert.ok(flagged(output, `CONTEXT_${code}_MISMATCH`)); assert.equal(output.recommendation, 'HOLD');
});
test('register wrong currency and period are not compared as if interchangeable', () => {
  const input = fixture(); input.commitment_register.currency = 'GBP'; input.commitment_register.period_start = '2026-02-01';
  const output = run(input); assert.ok(flagged(output, 'CONTEXT_CURRENCY_MISMATCH')); assert.ok(flagged(output, 'CONTEXT_PERIOD_MISMATCH'));
});
for (const date of ['2026-02-30', '2026-13-01', '2026-00-00']) test(`invalid calendar date ${date} held`, () => {
  const input = fixture(); input.statements.period_start = date; assert.ok(flagged(run(input), 'INVALID_PERIOD'));
});
for (const name of ['prior', 'next']) test(`${name} continuity mismatch and missing LP are distinct holds`, () => {
  const input = fixture(true), field = name === 'prior' ? 'ending' : 'beginning'; input[name].lps[0][field] = '77.00'; input[name].lps.pop();
  const output = run(input); assert.equal(output.recommendation, 'HOLD'); assert.equal(output.statements[0].continuity[name], 'HOLD');
  assert.ok(output.statements[1].flags.includes(`MISSING_${name.toUpperCase()}_LP`));
});
test('provided next draft must be adjacent and same fund/currency, not a false continuity PASS', () => {
  const input = fixture(true); input.next.period_start = '2026-05-01'; input.next.fund_id = 'OtherFund'; input.next.currency = 'EUR';
  const output = run(input); assert.ok(flagged(output, 'CONTINUITY_PERIOD_MISMATCH')); assert.equal(output.statements[0].continuity.next, 'HOLD');
});
test('prior continuity checks NAV beginning as well as reported beginning', () => {
  const input = fixture(true); input.nav_pack.lps[0].beginning = '101.00'; const output = run(input);
  assert.equal(check(output, 'prior_vs_reported_beginning').status, 'PASS'); assert.equal(check(output, 'prior_vs_recomputed_beginning').status, 'HOLD');
});
for (const value of [null, 0, 0.5, '', '1e2', 'NaN', 'Infinity', '1,000.00', '$100', '0.0000001', '1234567890123456789012345']) test(`money rejects non-exact/unsupported representation ${String(value)}`, () => {
  const input = fixture(); input.statements.lps[0].beginning = value; assert.ok(flagged(run(input), 'INVALID_INPUT'));
});
test('unknown fields, identity, commands, credentials, endpoints and approval cannot enter any boundary', () => {
  for (const key of ['identity', 'commands', 'credentials', 'endpoint', 'approval', 'provider', '__proto__']) {
    const input = fixture(); Object.defineProperty(input.nav_pack, key, { enumerable: true, value: 'denied' }); assert.ok(flagged(run(input), 'UNKNOWN_FIELD'));
  }
  const input = fixture(); input.statements.lps[0].Beginning = '100.00'; assert.ok(flagged(run(input), 'UNKNOWN_FIELD'));
});
test('never accesses object getters, proxies or cycles: only JSON strings accepted', () => {
  let touched = false; const getter = { get statements() { touched = true; throw Error('executed'); } };
  const cycle = {}; cycle.self = cycle;
  for (const v of [getter, cycle, new Proxy({}, { get() { throw Error('proxy'); } }), null, 1, []]) assert.ok(flagged(tieout(v), 'JSON_STRING_REQUIRED'));
  assert.equal(touched, false);
});
test('strict JSON rejects malformed data, duplicate keys (including escaped), depth and UTF8 budget', () => {
  assert.ok(flagged(tieout('{bad'), 'INVALID_JSON'));
  for (const key of ['batch_id', 'batch_\\u0069d']) {
    const json = JSON.stringify(fixture()).replace('"batch_id":"test-batch"', `"batch_id":"test-batch","${key}":"other"`);
    assert.ok(flagged(tieout(json), 'DUPLICATE_JSON_KEY'));
  }
  assert.ok(flagged(tieout('['.repeat(20) + '0' + ']'.repeat(20)), 'DEPTH_LIMIT'));
  assert.ok(flagged(tieout(JSON.stringify({ pad: '💰'.repeat(140000) })), 'INPUT_LIMIT'));
});
test('per-source classification and independent source checks cannot be replaced by a vendor claim', () => {
  const input = fixture(); input.nav_pack.source.classification = 'UNSOURCED'; input.nav_pack.source.input_kind = 'DOCUMENT_EXTRACT';
  assert.ok(flagged(run(input), 'UNSOURCED_INPUT'));
  input.nav_pack.source.document_id = input.statements.source.document_id; assert.ok(flagged(run(input), 'INDEPENDENT_SOURCE_REQUIRED'));
  const register = fixture(); register.commitment_register.source.document_id = register.nav_pack.source.document_id; assert.ok(flagged(run(register), 'INDEPENDENT_SOURCE_REQUIRED'));
});
test('TEST_ONLY simulated extracts cannot masquerade as USER_PROVIDED documents', () => {
  const input = fixture(); input.statements.source.classification = 'USER_PROVIDED'; assert.ok(flagged(run(input), 'SOURCE_CLASSIFICATION_MISMATCH'));
  input.statements.source.input_kind = 'DOCUMENT_EXTRACT'; const output = run(input); assert.equal(output.recommendation, 'PASS');
  assert.equal(output.source_classifications.statements, 'USER_PROVIDED'); assert.equal('license' in output, false); assert.equal('provider' in output, false);
});
test('terms must be explicit supported source-bounded allocation/carry/rounding, no guessed waterfall', () => {
  for (const key of ['allocation_method', 'carry_method', 'rounding_method', 'rounding_basis', 'ownership_basis']) {
    const input = fixture(); input.nav_pack.terms[key] = 'GUESS'; assert.ok(flagged(run(input), 'INVALID_INPUT'));
  }
  const input = fixture(); input.nav_pack.terms.source_ref = 'missing'; assert.ok(flagged(run(input), 'UNSOURCED_TERMS'));
});
function roundingFixture(method) {
  const input = fixture(); input.nav_pack.terms.rounding_method = method;
  input.nav_pack.totals = { realized: '0.01', unrealized: '0.00', management_fee: '0.00', expenses: '0.00', nav: method === 'HALF_EVEN' ? '0.00' : '0.02' };
  for (const lp of input.nav_pack.lps) for (const k of ['beginning', 'contributions', 'distributions', 'carry']) lp[k] = '0.00';
  for (const lp of input.statements.lps) {
    for (const k of ['beginning', 'contributions', 'distributions', 'realized', 'unrealized', 'management_fee', 'expenses', 'allocated_net_income', 'carry', 'ending']) lp[k] = '0.00';
    for (const k of ['realized', 'allocated_net_income', 'ending']) lp[k] = method === 'HALF_EVEN' ? '0.00' : '0.01';
  }
  return input;
}
for (const method of ['HALF_EVEN', 'HALF_AWAY_FROM_ZERO']) test(`exact positive half-cent ${method}`, () => {
  const output = run(roundingFixture(method)); assert.equal(output.recommendation, 'PASS'); assert.equal(check(output, 'allocated_net_income').recomputed, method === 'HALF_EVEN' ? '0.00' : '0.01');
});
test('negative half-cent is symmetric, no IEEE rounding or negative-zero artifacts', () => {
  const input = roundingFixture('HALF_AWAY_FROM_ZERO'); input.nav_pack.totals.realized = '-0.01'; input.nav_pack.totals.nav = '-0.02';
  for (const lp of input.statements.lps) for (const k of ['realized', 'allocated_net_income', 'ending']) lp[k] = '-0.01';
  const output = run(input); assert.equal(output.recommendation, 'PASS'); assert.equal(check(output, 'ending').recomputed, '-0.01');
});
test('net rounds once from rational unrounded components, not sum of rounded displayed components', () => {
  const input = roundingFixture('HALF_AWAY_FROM_ZERO'); input.nav_pack.totals.unrealized = '0.01';
  for (const lp of input.statements.lps) lp.unrealized = '0.01'; const output = run(input);
  assert.equal(output.recommendation, 'PASS'); assert.equal(check(output, 'allocated_net_income').recomputed, '0.01');
});
test('money beyond IEEE safe integer remains exact', () => {
  const input = fixture(); input.nav_pack.totals.nav = '18014398509482016.00';
  for (const lp of input.nav_pack.lps) lp.beginning = '9007199254740993.00';
  for (const lp of input.statements.lps) { lp.beginning = '9007199254740993.00'; lp.ending = '9007199254741008.00'; }
  const output = run(input); assert.equal(output.recommendation, 'PASS'); assert.equal(check(output, 'ending').recomputed, '9007199254741008.00');
});
test('ownership 12-place rational precision is retained exactly, never percentage-guessing', () => {
  const input = roundingFixture('HALF_AWAY_FROM_ZERO'); input.nav_pack.totals.realized = '1000000000000.00'; input.nav_pack.totals.nav = '1000000000000.00';
  for (const [i, pct] of ['0.000000000001', '0.999999999999'].entries()) {
    input.nav_pack.lps[i].ownership = pct; input.statements.lps[i].ownership = pct;
    for (const k of ['realized', 'allocated_net_income', 'ending']) input.statements.lps[i][k] = i === 0 ? '1.00' : '999999999999.00';
  }
  const output = run(input); assert.equal(output.recommendation, 'PASS'); assert.equal(check(output, 'ownership').recomputed, '0.000000000001');
  input.statements.lps[0].ownership = '50'; assert.ok(flagged(run(input), 'INVALID_INPUT'));
});
test('maximum LP and money precision bounds are enforced', () => {
  const input = fixture(); input.statements.lps = Array.from({ length: 201 }, (_, i) => ({ ...input.statements.lps[0], lp_id: `LP${i}` }));
  assert.ok(flagged(run(input), 'INVALID_INPUT'));
});
