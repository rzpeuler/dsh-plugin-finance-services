/** Independent hand arithmetic assertions; never imports calculation core or asks it for an expected result. */
import assert from 'node:assert/strict';
export function near(actual, expected, label = 'numeric result') {
  assert.equal(typeof actual, 'number', label);
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}
export function goldenRequest(model, example) {
  const request = structuredClone(example);
  request.provenance = { classification: 'TEST_ONLY', sources: ['Independent native hand arithmetic fixture'] };
  if (model === 'dcf') request.inputs = { revenue: 100, years: [
    { growth: 0.1, ebitMargin: 0.2, daPct: 0.05, capexPct: 0.03, deltaNwcPct: 0.1 },
    { growth: 0, ebitMargin: 0.2, daPct: 0.05, capexPct: 0.03, deltaNwcPct: 0.1 }],
    taxRate: 0.25, riskFreeRate: 0.04, beta: 1, equityRiskPremium: 0.06, costOfDebt: 0.05,
    debt: 40, cash: 10, price: 10, shares: 10, terminal: { method: 'perpetuity', growth: 0.02 } };
  if (model === 'lbo') request.inputs = { entryEbitda: 20, entryMultiple: 10, fees: 10, refinanceUses: 10,
    tranches: [{ name: 'Senior', amount: 100, rate: 0.1, mandatoryAmortization: 0.1, priority: 1 },
      { name: 'Junior', amount: 20, rate: 0.05, mandatoryAmortization: 0, priority: 2 }],
    years: [{ ebitda: 40, da: 5, capex: 5, deltaNwc: 1, taxRate: 0.25 },
      { ebitda: 44, da: 5, capex: 5, deltaNwc: 1, taxRate: 0.25 }], cashSweep: 0.5, exitMultiple: 8, exitFees: 2 };
  return request;
}
export function assertGolden(model, result) {
  assert.equal(result.model, model); assert.equal(result.officeStatus, 'NOT_IMPLEMENTED_P4');
  assert.equal(result.commercialReady, false); assert.equal(result.reviewRequired, true);
  assert.equal(result.provenance.classification, 'TEST_ONLY');
  assert.match(result.inputSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.values(result.checks).every(value => value === true));
  const values = result.calculations;
  if (model === 'dcf') {
    const b = values.base;
    const wacc = 11.125 / 130; // market equity 100, NET debt 30, after-tax debt cost .0375
    const terminal = 18.7 * 1.02 / (wacc - 0.02);
    const pvExplicit = 17.7 / Math.sqrt(1 + wacc) + 18.7 / (1 + wacc) ** 1.5;
    const enterprise = pvExplicit + terminal / (1 + wacc) ** 1.5;
    near(b.netDebt, 30); near(b.marketEquity, 100); near(b.capitalDenominator, 130);
    near(b.equityWeight, 100 / 130); near(b.netDebtWeight, 30 / 130); near(b.wacc, wacc);
    near(b.years[0].revenue, 110); near(b.years[0].deltaNwc, 1);
    near(b.years[0].fcf, 17.7); near(b.years[1].fcf, 18.7);
    near(b.years[0].discountPeriod, 0.5); near(b.years[1].discountPeriod, 1.5);
    near(b.terminalValue, terminal); near(b.pvExplicitFcf, pvExplicit);
    near(b.enterpriseValue, enterprise); near(b.equityValue, enterprise - 30); near(b.perShare, (enterprise - 30) / 10);
  } else if (model === 'lbo') {
    const b = values.base;
    near(b.totalUses, 220); near(b.debtFunding, 120); near(b.sponsorEquity, 100);
    const y1 = b.years[0], y2 = b.years[1];
    near(y1.beginningDebt, 120); near(y1.interest, 11); near(y1.taxes, 6);
    near(y1.netIncome, 18); near(y1.operatingCashFlow, 22); near(y1.cashAvailableForDebtService, 17);
    near(y1.debtSchedule[0].mandatoryPaid, 10); near(y1.debtSchedule[0].sweepPaid, 3.5);
    near(y1.debtSchedule[0].endingBalance, 86.5); near(y1.debtSchedule[1].endingBalance, 20); near(y1.endingCash, 3.5);
    near(y2.beginningDebt, 106.5); near(y2.interest, 9.65); near(y2.taxes, 7.3375);
    near(y2.cashAvailableForDebtService, 21.0125); near(y2.debtSchedule[0].sweepPaid, 5.50625);
    near(b.exitDebt, 90.99375); near(b.exitCash, 9.00625); near(b.exitEquityValue, 268.0125);
    near(b.moic, 2.680125); near(b.irr, Math.sqrt(2.680125) - 1);
    assert.equal(b.sponsorCashFlows.length, 3); near(b.sponsorCashFlows[0], -100); near(b.sponsorCashFlows[1], 0); near(b.sponsorCashFlows[2], 268.0125);
  } else if (model === 'three_statement') {
    const y = values.years[0];
    near(y.incomeStatement.revenue, 100); near(y.incomeStatement.ebitda, 30); near(y.incomeStatement.interest, 2);
    near(y.incomeStatement.netIncome, 17.25); near(y.cashFlow.cfo, 22.25); near(y.cashFlow.cfi, -10); near(y.cashFlow.cff, 0);
    near(y.cashFlow.endingCash, 62.25); near(y.balanceSheet.cash, 62.25); near(y.balanceSheet.ppe, 45);
    near(y.balanceSheet.debt, 22); near(y.balanceSheet.commonStock, 52); near(y.balanceSheet.retainedEarnings, 43.25);
    near(y.balanceSheet.balanceCheck, 0); assert.ok(Object.values(y.checks).every(Boolean));
  } else if (model === 'comps') {
    const p = values.peers[0];
    near(p.marketCap, 100); near(p.enterpriseValue, 115); near(p.revenueGrowth, 0.25); near(p.grossMargin, 0.4);
    near(p.ebitdaMargin, 0.2); near(p.netMargin, 0.1); near(p.eps, 1); near(p.evRevenue, 1.15); near(p.evEbitda, 5.75); near(p.pe, 10);
    assert.equal(values.statistics.evEbitda.n, 1); near(values.statistics.evEbitda.median, 5.75);
  }
}
