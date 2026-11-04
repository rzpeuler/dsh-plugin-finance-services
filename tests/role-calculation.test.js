import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateModel, describeCalculation } from '../src/role/calculation.js';

const example = model => describeCalculation(model).example;
function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
function assertRejected(model, mutate) {
  const request = example(model);
  mutate(request);
  assert.throws(() => calculateModel(request));
}

test('all descriptions expose bounded exact strict JSON schemas and valid TEST_ONLY examples', () => {
  for (const model of ['dcf', 'lbo', 'three_statement', 'comps']) {
    const description = describeCalculation(model);
    assert.ok(JSON.stringify(description).length < 20000);
    assert.equal(description.inputSchema.additionalProperties, false);
    assert.equal(description.inputSchema.properties.inputs.additionalProperties, false);
    assert.equal(description.inputSchema.properties.model.const, model);
    assert.ok(description.sourceRefs.length > 0);
    const result = calculateModel(description.example);
    assert.equal(result.model, model);
    assert.equal(result.provenance.classification, 'TEST_ONLY');
    assert.equal(result.commercialReady, false);
    assert.equal(result.reviewRequired, true);
    assert.equal(result.officeStatus, 'NOT_IMPLEMENTED_P4');
    assert.equal(result.artifactKind, 'NUMERIC_RESULT_NOT_OFFICE');
    assert.match(result.inputSha256, /^[a-f0-9]{64}$/);
    assert.equal(result.schemaVersion, '1.0.0');
  }
  assert.throws(() => describeCalculation('python'));
  assert.throws(() => describeCalculation('__proto__'));
});

test('DCF independent flat five-year midyear valuation oracle and equity bridge', () => {
  const result = calculateModel(example('dcf'));
  const base = result.calculations.base;
  const expected = 15 * (1 / 1.1 ** 0.5 + 1 / 1.1 ** 1.5 + 1 / 1.1 ** 2.5 + 1 / 1.1 ** 3.5 + 1 / 1.1 ** 4.5) + 150 / 1.1 ** 4.5;
  close(base.enterpriseValue, expected);
  close(base.wacc, 0.1);
  close(base.terminalValue, 150);
  close(base.perShare, expected / 10);
  assert.deepEqual(base.years.map(year => year.fcf), [15, 15, 15, 15, 15]);
  assert.deepEqual(base.years.map(year => year.discountPeriod), [0.5, 1.5, 2.5, 3.5, 4.5]);
  assert.equal(result.checks.enterpriseEquityBridge, true);
});

test('DCF uses negative source net-debt weights, never gross debt or a clamp', () => {
  const request = example('dcf');
  Object.assign(request.inputs, { debt: 20, cash: 40, costOfDebt: 0.08 });
  const base = calculateModel(request).calculations.base;
  close(base.wacc, 0.1 * 100 / 80 + 0.08 * 0.75 * -20 / 80);
  close(base.netDebtWeight, -0.25);
  close(base.equityValue, base.enterpriseValue + 20);
  Object.assign(request.inputs, { debt: 20, cash: 0 });
  close(calculateModel(request).calculations.base.wacc, 0.1 * 100 / 120 + 0.08 * 0.75 * 20 / 120);
  assertRejected('dcf', request => { request.inputs.cash = 100; });
});

test('DCF annual growth, delta revenue NWC, exit multiple and warning flags', () => {
  const request = example('dcf');
  request.inputs.years = [{ growth: 0.1, ebitMargin: 0.2, daPct: 0.05, capexPct: 0.08, deltaNwcPct: 0.1 }];
  request.inputs.terminal = { method: 'exit_multiple', multiple: 10 };
  const base = calculateModel(request).calculations.base;
  close(base.years[0].revenue, 110);
  close(base.years[0].deltaNwc, 1);
  close(base.years[0].fcf, 16.5 + 5.5 - 8.8 - 1);
  close(base.terminalValue, 275);
  assert.ok(calculateModel(request).warnings.includes('TERMINAL_VALUE_EXCEEDS_75_PERCENT'));
  request.inputs.riskFreeRate = 0.01;
  request.inputs.equityRiskPremium = 0.01;
  assert.ok(calculateModel(request).warnings.includes('WACC_OUTSIDE_5_TO_20_PERCENT'));
  assertRejected('dcf', request => { request.inputs.terminal.growth = 0.1; });
  assertRejected('dcf', request => { request.inputs.terminal.growth = 0.11; });
  assertRejected('dcf', request => { request.inputs.shares = 0; });
});

test('DCF all three 5x5 sensitivities recalculate center and driver effects independently', () => {
  const request = example('dcf');
  request.section = 'sensitivity';
  const result = calculateModel(request);
  const base = result.calculations.base;
  for (const table of Object.values(result.calculations.sensitivity)) {
    assert.equal(table.cells.length, 5);
    assert.equal(table.cells[0].length, 5);
    close(table.cells[2][2].enterpriseValue, base.enterpriseValue);
    close(table.cells[2][2].perShare, base.perShare);
    assert.notEqual(table.cells[0][0].enterpriseValue, table.cells[4][4].enterpriseValue);
  }
  const independent = example('dcf');
  independent.inputs.years.forEach(year => { year.growth += 0.02; year.ebitMargin += 0.01; });
  close(result.calculations.sensitivity.growthEbitMargin.cells[4][3].enterpriseValue, calculateModel(independent).calculations.base.enterpriseValue);
  independent.inputs = example('dcf').inputs;
  independent.inputs.beta = 1.2;
  independent.inputs.riskFreeRate = 0.045;
  close(result.calculations.sensitivity.betaRiskFree.cells[4][3].enterpriseValue, calculateModel(independent).calculations.base.enterpriseValue);
  // Near the terminal-growth boundary some cells are invalid; no fake center/base substitutions.
  request.inputs.terminal.growth = 0.099;
  assert.equal(calculateModel(request).calculations.sensitivity.waccTerminalGrowth.cells[0][4].valid, false);
  request.inputs.terminal = { method: 'exit_multiple', multiple: 10 };
  assert.equal(calculateModel(request).calculations.sensitivity.waccTerminalGrowth.available, false);
});

test('LBO independent beginning-balance interest, cash waterfall, MOIC and IRR oracle', () => {
  const result = calculateModel(example('lbo'));
  const base = result.calculations.base;
  assert.equal(base.sponsorEquity, 110);
  assert.equal(base.totalUses, 210);
  assert.deepEqual(base.years.map(year => year.interest), [10, 9.5]);
  assert.deepEqual(base.years.map(year => year.debtPaydown), [5, 5.5]);
  assert.deepEqual(base.years.map(year => year.endingDebt), [95, 89.5]);
  assert.equal(base.exitEquityValue, 110.5);
  close(base.moic, 110.5 / 110);
  close(base.irr, Math.sqrt(110.5 / 110) - 1);
  assert.deepEqual(base.sponsorCashFlows, [-110, 0, 110.5]);
  assert.ok(Object.values(result.checks).every(Boolean));
});

test('LBO multiple-priority mandatory/sweep waterfall caps principal and retains surplus cash', () => {
  const request = example('lbo');
  request.inputs.tranches = [
    { name: 'Junior', amount: 10, rate: 0, mandatoryAmortization: 0.2, priority: 2 },
    { name: 'Senior', amount: 10, rate: 0, mandatoryAmortization: 0.1, priority: 1 },
  ];
  request.inputs.years = [{ ebitda: 50, da: 0, capex: 0, deltaNwc: 0, taxRate: 0 }];
  const base = calculateModel(request).calculations.base;
  assert.equal(base.years[0].debtSchedule[0].name, 'Senior');
  assert.deepEqual(base.years[0].debtSchedule.map(tranche => tranche.mandatoryPaid), [1, 2]);
  assert.deepEqual(base.years[0].debtSchedule.map(tranche => tranche.sweepPaid), [9, 8]);
  assert.equal(base.exitDebt, 0);
  assert.equal(base.exitCash, 30);
  assert.equal(base.exitEquityValue, 530);
  request.inputs.cashSweep = 0;
  const noSweep = calculateModel(request).calculations.base;
  assert.equal(noSweep.exitDebt, 17);
  assert.equal(noSweep.exitCash, 47);
  assert.equal(noSweep.exitEquityValue, 530);
});

test('LBO 5x5 sensitivity reruns entry funding and exit returns with true center', () => {
  const request = example('lbo');
  request.section = 'sensitivity';
  const result = calculateModel(request);
  const grid = result.calculations.sensitivity;
  close(grid.cells[2][2].moic, result.calculations.base.moic);
  close(grid.cells[2][2].irr, result.calculations.base.irr);
  const independent = example('lbo');
  independent.inputs.entryMultiple = 9;
  independent.inputs.exitMultiple = 11;
  const changed = calculateModel(independent).calculations.base;
  close(grid.cells[1][3].moic, changed.moic);
  close(grid.cells[1][3].irr, changed.irr);
  assert.notEqual(grid.cells[0][2].sponsorEquity, grid.cells[4][2].sponsorEquity);
});

test('LBO loss cases are explicit and do not fabricate an XIRR', () => {
  const request = example('lbo');
  request.inputs.exitFees = 110.5;
  const zero = calculateModel(request).calculations.base;
  assert.equal(zero.exitEquityValue, 0);
  assert.equal(zero.irr, -1);
  assert.equal(zero.lossStatus, 'TOTAL_EQUITY_LOSS');
  request.inputs.exitFees = 200;
  const negative = calculateModel(request).calculations.base;
  assert.equal(negative.irr, null);
  assert.equal(negative.lossStatus, 'NEGATIVE_EXIT_EQUITY_IRR_UNDEFINED');
  assertRejected('lbo', request => { request.inputs.tranches[0].amount = 210; });
  assertRejected('lbo', request => { request.inputs.years[0].ebitda = 1; });
  assertRejected('lbo', request => { request.inputs.tranches[0].mandatoryAmortization = 1; });
  assertRejected('lbo', request => { request.inputs.tranches.push({ ...request.inputs.tranches[0], name: 'Other' }); });
});

test('three statements hand-calculated IS, WC, financing and balance-sheet ties', () => {
  const request = example('three_statement');
  const result = calculateModel(request);
  const year = result.calculations.years[0];
  const is = year.incomeStatement;
  assert.equal(is.revenue, 100);
  assert.equal(is.ebitda, 30);
  assert.equal(is.ebit, 25);
  assert.equal(is.interest, 2);
  assert.equal(is.taxes, 5.75);
  assert.equal(is.netIncome, 17.25);
  close(year.workingCapital.deltaNwc, 0);
  assert.equal(year.cashFlow.cfo, 22.25);
  assert.equal(year.cashFlow.cfi, -10);
  assert.equal(year.cashFlow.cff, 0);
  assert.equal(year.cashFlow.endingCash, 62.25);
  assert.equal(year.balanceSheet.ppe, 45);
  assert.equal(year.balanceSheet.debt, 22);
  assert.equal(year.balanceSheet.commonStock, 52);
  assert.equal(year.balanceSheet.retainedEarnings, 43.25);
  assert.equal(year.balanceSheet.assets, 127.25);
  close(year.balanceSheet.balanceCheck, 0);
  assert.ok(Object.values(year.checks).every(Boolean));
  // Changed WC drivers independently tie to cash and balance sheet.
  request.inputs.years[0].dso = 73;
  const changed = calculateModel(request).calculations.years[0];
  close(changed.workingCapital.deltaAr, 10);
  close(changed.cashFlow.cfo, 12.25);
  close(changed.balanceSheet.cash, 52.25);
  close(changed.balanceSheet.balanceCheck, 0);
});

test('three statements annual rollforwards, negative earnings tax floor and rejected plugs', () => {
  const request = example('three_statement');
  request.inputs.years.push({ ...request.inputs.years[0], growth: 0.1 });
  const years = calculateModel(request).calculations.years;
  assert.equal(years[1].cashFlow.beginningCash, years[0].balanceSheet.cash);
  close(years[1].incomeStatement.interest, years[0].balanceSheet.debt * 0.1);
  close(years[1].balanceSheet.retainedEarnings, years[0].balanceSheet.retainedEarnings + years[1].incomeStatement.netIncome - 4);
  request.inputs.years = [{ ...request.inputs.years[0], smPct: 0.4 }];
  assert.equal(calculateModel(request).calculations.years[0].incomeStatement.taxes, 0);
  assertRejected('three_statement', request => { request.inputs.opening.cash += 1; });
  assertRejected('three_statement', request => { request.inputs.years[0].repayment = 100; });
  assertRejected('three_statement', request => { request.inputs.years[0].da = 100; });
  assertRejected('three_statement', request => { request.inputs.years[0].dividends = 1000; });
  assertRejected('three_statement', request => { request.inputs.years[0].sbc = 1; });
});

test('comps ratio oracles, QUARTILE.INC interpolation and NM exclusion n', () => {
  const request = example('comps');
  const template = request.inputs.peers[0];
  request.inputs.peers = [1, 2, 3, 4].map(value => ({ ...template, ticker: `T${value}`, price: value * 10, debt: 0, cash: 0 }));
  const result = calculateModel(request);
  const peer = result.calculations.peers[0];
  assert.equal(peer.marketCap, 100);
  assert.equal(peer.enterpriseValue, 100);
  close(peer.revenueGrowth, 0.25);
  close(peer.grossMargin, 0.4);
  close(peer.ebitdaMargin, 0.2);
  close(peer.netMargin, 0.1);
  assert.equal(peer.eps, 1);
  assert.equal(peer.evRevenue, 1);
  assert.equal(peer.evEbitda, 5);
  assert.equal(peer.pe, 10);
  const stats = result.calculations.statistics.evEbitda;
  assert.deepEqual(stats, { n: 4, excluded: 0, min: 5, q25: 8.75, median: 12.5, q75: 16.25, max: 20 });
  request.inputs.peers[0].ebitda = 0;
  request.inputs.peers[0].netIncome = -1;
  request.inputs.peers[0].priorRevenue = 0;
  const nm = calculateModel(request).calculations;
  assert.equal(nm.peers[0].evEbitda, null);
  assert.equal(nm.peers[0].pe, null);
  assert.equal(nm.peers[0].revenueGrowth, null);
  assert.match(nm.peers[0].nmReasons.evEbitda, /nonpositive/);
  assert.equal(nm.statistics.evEbitda.n, 3);
  assert.equal(nm.statistics.evEbitda.excluded, 1);
  close(nm.statistics.evEbitda.median, 15);
});

test('comps all-NM and single-point statistics are explicit', () => {
  const request = example('comps');
  request.inputs.peers[0].revenue = 0;
  request.inputs.peers[0].priorRevenue = 0;
  request.inputs.peers[0].ebitda = -1;
  request.inputs.peers[0].netIncome = 0;
  const calculations = calculateModel(request).calculations;
  assert.deepEqual(calculations.statistics.evRevenue, { n: 0, excluded: 1, min: null, q25: null, median: null, q75: null, max: null });
  assert.equal(calculations.statistics.eps.n, 1);
  assert.equal(calculations.statistics.eps.q25, 0);
  assert.equal(calculations.statistics.eps.q75, 0);
});

test('comps rejects all silent currency/unit/asOf/period mixing and duplicate peers', () => {
  for (const [field, value] of [['currency', 'EUR'], ['unit', 'thousands'], ['period', '2024-FY'], ['asOf', '2026-02-01']]) {
    assertRejected('comps', request => { request.inputs.peers[0][field] = value; });
  }
  assertRejected('comps', request => { request.inputs.peers.push({ ...request.inputs.peers[0] }); });
  assertRejected('comps', request => { request.inputs.asOf = request.inputs.peers[0].asOf = '2025-02-31'; });
});

test('strict validation rejects unknown code/path/URL, unsupported sections, classifications and units', () => {
  for (const model of ['dcf', 'lbo', 'three_statement', 'comps']) {
    for (const [key, value] of [['code', 'return 1'], ['path', 'C:\\secret'], ['url', 'https://example.com'], ['script', 'process.exit()']]) {
      assertRejected(model, request => { request[key] = value; });
      assertRejected(model, request => { request.inputs[key] = value; });
    }
    assertRejected(model, request => { request.section = 'execute'; });
    assertRejected(model, request => { request.unit = 'USD millions'; });
    assertRejected(model, request => { request.provenance.classification = 'VERIFIED'; });
    assertRejected(model, request => { request.provenance.sources = ['https://example.com']; });
  }
  assertRejected('dcf', request => { request.inputs.years[0].code = 'evil'; });
  assertRejected('lbo', request => { request.inputs.tranches[0].path = '/tmp'; });
  assertRejected('comps', request => { request.inputs.peers[0].url = 'https://example.com'; });
  assert.throws(() => calculateModel({ model: 'bash' }));
});

test('finite bounded numbers, no coercion, array caps and plain JSON only', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 1e13, '100', null]) {
    assertRejected('dcf', request => { request.inputs.revenue = invalid; });
  }
  assertRejected('dcf', request => { request.inputs.years = Array.from({ length: 11 }, () => request.inputs.years[0]); });
  assertRejected('lbo', request => { request.inputs.tranches = Array.from({ length: 4 }, () => request.inputs.tranches[0]); });
  assertRejected('lbo', request => { request.inputs.years = Array.from({ length: 11 }, () => request.inputs.years[0]); });
  assertRejected('three_statement', request => { request.inputs.years = []; });
  assertRejected('comps', request => { request.inputs.peers = Array.from({ length: 31 }, () => request.inputs.peers[0]); });
  assertRejected('dcf', request => { request.provenance.sources = Array(21).fill('Test'); });
  assertRejected('dcf', request => { request.inputs.revenue = () => 100; });
  assertRejected('dcf', request => { request.inputs.years = new Array(1e8); });
  assertRejected('dcf', request => { request.inputs.years.code = 'unexpected'; });
  assertRejected('dcf', request => { delete request.inputs.years[0]; });
  const withAccessor = example('dcf');
  Object.defineProperty(withAccessor.inputs, 'revenue', { get() { throw Error('accessor executed'); }, enumerable: true });
  assert.throws(() => calculateModel(withAccessor), /accessors/);
  const circular = example('dcf');
  circular.inputs.circular = circular;
  assert.throws(() => calculateModel(circular), /structure bounds/);
});

test('hash is deterministic across property order, changes on inputs, and caller data is untouched', () => {
  const request = example('dcf');
  const snapshot = JSON.stringify(request);
  const first = calculateModel(request);
  assert.equal(JSON.stringify(request), snapshot);
  const reordered = Object.fromEntries(Object.entries(request).reverse());
  assert.equal(calculateModel(reordered).inputSha256, first.inputSha256);
  request.inputs.revenue = 101;
  assert.notEqual(calculateModel(request).inputSha256, first.inputSha256);
  request.provenance.classification = 'UNSOURCED';
  assert.equal(calculateModel(request).provenance.classification, 'UNSOURCED');
  const description = describeCalculation('dcf');
  description.example.inputs.revenue = 999;
  assert.equal(describeCalculation('dcf').example.inputs.revenue, 100);
});
