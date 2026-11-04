import { createHash } from 'node:crypto';
import { z } from 'zod';

// Fixed, bounded numeric profiles only. No source scripts, templates, or user code execute.
const VERSION = '1.0.0';
const amount = z.number().min(0).max(1e12);
const signedAmount = z.number().min(-1e12).max(1e12);
const positive = z.number().gt(0).max(1e12);
const fraction = z.number().min(0).max(1);
const growth = z.number().gt(-1).max(2);
const margin = z.number().min(-1).max(1);
const rate = z.number().min(0).max(1);
const multiple = z.number().gt(0).max(100);
const currency = z.string().regex(/^[A-Z]{3}$/);
const unit = z.enum(['units', 'thousands', 'millions', 'billions']);
const label = z.string().min(1).max(120).regex(/^[A-Za-z0-9 _.,()+-]+$/);
const provenance = z.strictObject({
  classification: z.enum(['TEST_ONLY', 'UNSOURCED']),
  sources: z.array(label).max(20).optional(),
});
const dcfYear = z.strictObject({ growth, ebitMargin: margin, daPct: fraction, capexPct: fraction, deltaNwcPct: margin });
const dcfInputs = z.strictObject({
  revenue: positive, years: z.array(dcfYear).min(1).max(10), taxRate: fraction,
  riskFreeRate: rate, beta: z.number().min(0).max(5), equityRiskPremium: rate,
  costOfDebt: rate, debt: amount, cash: amount, price: positive, shares: positive,
  terminal: z.discriminatedUnion('method', [
    z.strictObject({ method: z.literal('perpetuity'), growth: z.number().gt(-1).max(0.2) }),
    z.strictObject({ method: z.literal('exit_multiple'), multiple }),
  ]),
});
const lboYear = z.strictObject({ ebitda: signedAmount, da: amount, capex: amount, deltaNwc: signedAmount, taxRate: fraction });
const lboInputs = z.strictObject({
  entryEbitda: positive, entryMultiple: multiple, fees: amount, refinanceUses: amount,
  tranches: z.array(z.strictObject({
    name: label, amount: amount, rate, mandatoryAmortization: fraction,
    priority: z.number().int().min(1).max(3),
  })).max(3),
  years: z.array(lboYear).min(1).max(10), cashSweep: fraction,
  exitMultiple: multiple, exitFees: amount,
});
const opening = z.strictObject({
  cash: amount, ar: amount, inventory: amount, ppe: amount, ap: amount,
  debt: amount, commonStock: amount, retainedEarnings: signedAmount,
});
const statementYear = z.strictObject({
  growth, cogsPct: fraction, smPct: fraction, rdPct: fraction, gaPct: fraction,
  da: amount, capex: amount, dso: z.number().min(0).max(730),
  dio: z.number().min(0).max(730), dpo: z.number().min(0).max(730),
  interestRate: rate, taxRate: fraction, borrowing: amount, repayment: amount,
  dividends: amount, equityIssued: amount,
});
const statementInputs = z.strictObject({ revenue: positive, opening, years: z.array(statementYear).min(1).max(10) });
const period = z.string().regex(/^(19|20)\d{2}-(FY|Q[1-4]|LTM)$/);
const asOf = z.iso.date().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const peer = z.strictObject({
  ticker: z.string().min(1).max(20).regex(/^[A-Z0-9.-]+$/), currency, unit, period, asOf,
  revenue: signedAmount, priorRevenue: signedAmount, grossProfit: signedAmount,
  ebitda: signedAmount, netIncome: signedAmount, price: amount, shares: positive, debt: amount, cash: amount,
});
const compsInputs = z.strictObject({ period, asOf, peers: z.array(peer).min(1).max(30) });
const definitions = {
  dcf: {
    inputs: dcfInputs, sections: ['valuation', 'drivers', 'sensitivity'],
    profile: 'Mid-year unlevered DCF with source net-debt WACC weights',
    sourceRefs: ['plugins/agent-plugins/model-builder/skills/dcf-model/SKILL.md:142-366'],
    limits: [
      '1-10 explicit annual revenue growth and EBIT margin drivers; no bear/bull workflow or research automation.',
      'D&A and capex are percentages of revenue; delta NWC is a percentage of the change in revenue.',
      'Net debt may be negative; weights are not clamped or replaced by gross debt. WACC denominator must be positive.',
      'Three fixed 5x5 sensitivity grids. Growth/margin axes shift every annual driver by equal percentage points; WACC, terminal growth, beta and risk-free axes are absolute. Invalid cells are not substituted.',
      'Perpetuity growth grid is unavailable for exit-multiple terminal value; other grids still recalculate.',
      'No losses carried forward; NOPAT = EBIT * (1-tax). Currency amounts and diluted shares share the selected scale; price is unscaled currency per share.',
    ],
  },
  lbo: {
    inputs: lboInputs, sections: ['returns', 'sensitivity'],
    profile: 'Annual EBITDA-input LBO with beginning-debt interest and priority cash waterfall',
    sourceRefs: ['plugins/agent-plugins/model-builder/skills/lbo-model/SKILL.md:127-223'],
    limits: [
      '1-10 explicit EBITDA years and at most 3 debt tranches. No PIK, dividends, refinancing, NOLs, or interim sponsor proceeds.',
      'Refinance uses are an explicit entry use, not an operating refinancing feature. Entry fees are explicit amounts.',
      'Mandatory amortization is a fraction of original tranche principal per year, capped by cash and remaining debt.',
      'Operating shortfalls and unpaid mandatory amortization reject the run; no hidden revolver or sponsor injection.',
      'Cash retained after debt service is explicit and is added to exit equity. Cash sweep is a fraction of current-year cash remaining after mandatory amortization.',
      'Taxes floor taxable income at zero. IRR uses only initial and annual terminal sponsor cash flows; negative exit equity returns null IRR, not fabricated XIRR.',
      'Fixed 5x5 entry/exit multiple sensitivity; invalid funding cells report reasons. No Office template is claimed.',
    ],
  },
  three_statement: {
    inputs: statementInputs, sections: ['statements'],
    profile: 'Annual linked IS, balance sheet and cash flow with explicit opening balances',
    sourceRefs: ['plugins/agent-plugins/model-builder/skills/3-statement-model/references/formulas.md:7-18', 'plugins/agent-plugins/model-builder/skills/3-statement-model/references/formulas.md:62-134', 'plugins/agent-plugins/model-builder/skills/3-statement-model/references/formulas.md:209-236'],
    limits: [
      '1-10 years; no SBC, NOLs, deferred tax, or other balance-sheet accounts.',
      'Source RE guidance conflicts about SBC; this no-SBC profile uses prior RE + net income - dividends.',
      'Beginning debt determines interest; taxes floor pretax income at zero. DSO/DIO/DPO use 365 days.',
      'Opening balances must balance; negative cash, PP&E, or debt reject the run. Financing is explicit, never a hidden plug.',
    ],
  },
  comps: {
    inputs: compsInputs, sections: ['analysis'],
    profile: 'Same-period same-currency comparable-company metrics and QUARTILE.INC statistics',
    sourceRefs: ['plugins/agent-plugins/model-builder/skills/comps-analysis/SKILL.md:185-263'],
    limits: [
      '1-30 unique peers; all peers must match top-level currency/unit and input period/asOf. No currency conversion or mixed periods.',
      'Nonpositive ratio denominators yield null plus NM reason and are excluded from statistics with n reported.',
      'Quartiles use inclusive linear interpolation, not regression. Statistics are provided for ratios, margins, growth, and EPS, not size metrics.',
      'Price is currency per share; share count uses the same scale as financial amounts. No Office template is claimed.',
    ],
  },
};
const requestSchemas = Object.fromEntries(Object.entries(definitions).map(([model, definition]) => [model, z.strictObject({
  model: z.literal(model), section: z.enum(definition.sections), currency, unit, provenance, inputs: definition.inputs,
})]));

function requireCondition(condition, message) {
  if (!condition) throw new RangeError(message);
}
function total(values) { return values.reduce((sum, value) => sum + value, 0); }
function nearZero(value, scale = 1) { return Math.abs(value) <= 1e-8 + 1e-12 * Math.max(1, Math.abs(scale)); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateJson(value, depth = 0, counter = { n: 0 }) {
  requireCondition(depth <= 12 && ++counter.n <= 10000, 'Request exceeds JSON structure bounds');
  if (typeof value === 'number') requireCondition(Number.isFinite(value), 'All numbers must be finite');
  else if (value && typeof value === 'object') {
    requireCondition(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'Only plain JSON objects are accepted');
    const keys = Reflect.ownKeys(value);
    requireCondition(keys.length <= 100, 'Request object exceeds key bounds');
    if (Array.isArray(value)) requireCondition(value.length <= 30 && keys.length === value.length + 1, 'Request arrays must be dense and bounded to 30 items');
    for (const key of keys) {
      requireCondition(typeof key === 'string', 'Symbol keys are not accepted');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireCondition(!descriptor.get && !descriptor.set, 'JSON accessors are not accepted');
      if (Array.isArray(value)) {
        if (key === 'length') continue;
        requireCondition(/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length, 'Unexpected array property');
      }
      requireCondition(descriptor.enumerable, 'Only enumerable JSON properties are accepted');
      validateJson(descriptor.value, depth + 1, counter);
    }
  } else requireCondition(value === null || ['string', 'boolean', 'number'].includes(typeof value), 'Only JSON values are accepted');
}
function ensureFiniteResult(value) {
  if (typeof value === 'number') requireCondition(Number.isFinite(value) && Math.abs(value) <= 1e100, 'Calculation exceeds supported numeric range');
  else if (Array.isArray(value)) value.forEach(ensureFiniteResult);
  else if (value && typeof value === 'object') Object.values(value).forEach(ensureFiniteResult);
}
function dcfCore(input, overrides = {}) {
  const netDebt = input.debt - input.cash;
  const marketEquity = input.price * input.shares;
  const denominator = marketEquity + netDebt;
  requireCondition(denominator > 0, 'DCF market equity plus net debt must be positive');
  const riskFreeRate = overrides.riskFreeRate ?? input.riskFreeRate;
  const beta = overrides.beta ?? input.beta;
  requireCondition(riskFreeRate >= 0 && riskFreeRate <= 1 && beta >= 0 && beta <= 5, 'DCF sensitivity CAPM driver outside supported domain');
  const costOfEquity = riskFreeRate + beta * input.equityRiskPremium;
  const wacc = overrides.wacc ?? (costOfEquity * marketEquity / denominator + input.costOfDebt * (1 - input.taxRate) * netDebt / denominator);
  requireCondition(wacc > -1 && wacc <= 10, 'DCF WACC outside supported discount domain');
  let revenue = input.revenue;
  const years = input.years.map((driver, index) => {
    const previousRevenue = revenue;
    const annualGrowth = driver.growth + (overrides.growthShift ?? 0);
    const ebitMargin = driver.ebitMargin + (overrides.marginShift ?? 0);
    requireCondition(annualGrowth > -1 && annualGrowth <= 2 && ebitMargin >= -1 && ebitMargin <= 1, 'DCF sensitivity operating driver outside supported domain');
    revenue *= 1 + annualGrowth;
    const ebit = revenue * ebitMargin;
    const da = revenue * driver.daPct;
    const capex = revenue * driver.capexPct;
    const deltaNwc = (revenue - previousRevenue) * driver.deltaNwcPct;
    const nopat = ebit * (1 - input.taxRate);
    const fcf = nopat + da - capex - deltaNwc;
    const discountPeriod = index + 0.5;
    const discountFactor = (1 + wacc) ** -discountPeriod;
    return { year: index + 1, revenue, growth: annualGrowth, ebitMargin, ebit, da, ebitda: ebit + da, capex, deltaNwc, nopat, fcf, discountPeriod, discountFactor, pvFcf: fcf * discountFactor };
  });
  const last = years.at(-1);
  let terminalValue;
  if (input.terminal.method === 'perpetuity') {
    const terminalGrowth = overrides.terminalGrowth ?? input.terminal.growth;
    requireCondition(terminalGrowth > -1 && terminalGrowth <= 0.2 && terminalGrowth < wacc, 'DCF terminal growth must be below WACC and within supported bounds');
    terminalValue = last.fcf * (1 + terminalGrowth) / (wacc - terminalGrowth);
  } else terminalValue = last.ebitda * input.terminal.multiple;
  const pvTerminalValue = terminalValue / (1 + wacc) ** last.discountPeriod;
  const pvExplicitFcf = total(years.map(year => year.pvFcf));
  const enterpriseValue = pvExplicitFcf + pvTerminalValue;
  const equityValue = enterpriseValue - netDebt;
  const perShare = equityValue / input.shares;
  return { years, netDebt, marketEquity, capitalDenominator: denominator, equityWeight: marketEquity / denominator, netDebtWeight: netDebt / denominator, costOfEquity, wacc, terminalValue, pvTerminalValue, pvExplicitFcf, enterpriseValue, equityValue, perShare, impliedReturn: perShare / input.price - 1, terminalValueShare: enterpriseValue > 0 ? pvTerminalValue / enterpriseValue : null };
}
function axis(base, step) { return [-2, -1, 0, 1, 2].map(offset => base + offset * step); }
function grid(rowName, rows, columnName, columns, calculate) {
  return { rowName, rows, columnName, columns, center: [2, 2], cells: rows.map(row => columns.map(column => {
    try { const result = calculate(row, column); ensureFiniteResult(result); return { valid: true, ...result }; }
    catch (error) { return { valid: false, reason: error.message }; }
  })) };
}
function dcfValuation(input, overrides) {
  const value = dcfCore(input, overrides);
  return { enterpriseValue: value.enterpriseValue, equityValue: value.equityValue, perShare: value.perShare, wacc: value.wacc };
}
function calculateDcf(input, section) {
  const base = dcfCore(input);
  const warnings = [];
  if (base.wacc < 0.05 || base.wacc > 0.2) warnings.push('WACC_OUTSIDE_5_TO_20_PERCENT');
  if (base.terminalValueShare !== null && base.terminalValueShare > 0.75) warnings.push('TERMINAL_VALUE_EXCEEDS_75_PERCENT');
  if (base.netDebt < 0) warnings.push('NEGATIVE_NET_DEBT_WEIGHT_USED_WITHOUT_CLAMPING');
  const calculations = { base };
  if (section === 'sensitivity') {
    calculations.sensitivity = {
      waccTerminalGrowth: input.terminal.method === 'perpetuity'
        ? grid('wacc', axis(base.wacc, 0.005), 'terminalGrowth', axis(input.terminal.growth, 0.005), (wacc, terminalGrowth) => dcfValuation(input, { wacc, terminalGrowth }))
        : { available: false, reason: 'Perpetuity terminal growth does not apply to exit-multiple profile' },
      growthEbitMargin: grid('growthShift', axis(0, 0.01), 'ebitMarginShift', axis(0, 0.01), (growthShift, marginShift) => dcfValuation(input, { growthShift, marginShift })),
      betaRiskFree: grid('beta', axis(input.beta, 0.1), 'riskFreeRate', axis(input.riskFreeRate, 0.005), (beta, riskFreeRate) => dcfValuation(input, { beta, riskFreeRate })),
    };
  }
  return { calculations, checks: { positiveCapitalDenominator: true, midYearConvention: true, enterpriseEquityBridge: nearZero(base.enterpriseValue - base.netDebt - base.equityValue, base.enterpriseValue) }, warnings };
}
function lboCore(input, entryMultiple = input.entryMultiple, exitMultiple = input.exitMultiple) {
  requireCondition(entryMultiple > 0 && entryMultiple <= 100 && exitMultiple > 0 && exitMultiple <= 100, 'LBO sensitivity multiple outside supported bounds');
  requireCondition(new Set(input.tranches.map(tranche => tranche.priority)).size === input.tranches.length, 'LBO tranche priorities must be unique');
  requireCondition(new Set(input.tranches.map(tranche => tranche.name)).size === input.tranches.length, 'LBO tranche names must be unique');
  const entryEnterpriseValue = input.entryEbitda * entryMultiple;
  const totalUses = entryEnterpriseValue + input.fees + input.refinanceUses;
  const debtFunding = total(input.tranches.map(tranche => tranche.amount));
  const sponsorEquity = totalUses - debtFunding;
  requireCondition(sponsorEquity > 0, 'LBO sponsor equity must be positive; debt cannot exceed or equal uses');
  const tranches = [...input.tranches].sort((a, b) => a.priority - b.priority).map(tranche => ({ ...tranche, balance: tranche.amount }));
  let cash = 0;
  const years = input.years.map((driver, index) => {
    const beginningCash = cash;
    const beginningDebt = total(tranches.map(tranche => tranche.balance));
    const interest = total(tranches.map(tranche => tranche.balance * tranche.rate));
    const ebit = driver.ebitda - driver.da;
    const pretaxIncome = ebit - interest;
    const taxes = Math.max(0, pretaxIncome) * driver.taxRate;
    const netIncome = pretaxIncome - taxes;
    const operatingCashFlow = netIncome + driver.da - driver.deltaNwc;
    const cashAvailableForDebtService = operatingCashFlow - driver.capex;
    requireCondition(cashAvailableForDebtService >= 0, `LBO year ${index + 1} operating cash shortfall; no implicit financing allowed`);
    let available = cashAvailableForDebtService;
    const debtSchedule = tranches.map(tranche => {
      const beginningBalance = tranche.balance;
      const mandatoryDue = Math.min(beginningBalance, tranche.amount * tranche.mandatoryAmortization);
      const mandatoryPaid = Math.min(available, mandatoryDue);
      requireCondition(nearZero(mandatoryDue - mandatoryPaid, mandatoryDue), `LBO year ${index + 1} mandatory amortization cash shortfall`);
      available -= mandatoryPaid;
      tranche.balance -= mandatoryPaid;
      return { name: tranche.name, priority: tranche.priority, beginningBalance, interest: beginningBalance * tranche.rate, mandatoryDue, mandatoryPaid, sweepPaid: 0, endingBalance: tranche.balance };
    });
    let sweepBudget = available * input.cashSweep;
    for (let position = 0; position < tranches.length; position++) {
      const tranche = tranches[position];
      const paid = Math.min(tranche.balance, sweepBudget);
      tranche.balance -= paid;
      sweepBudget -= paid;
      available -= paid;
      debtSchedule[position].sweepPaid = paid;
      debtSchedule[position].endingBalance = tranche.balance;
    }
    cash += available;
    const endingDebt = total(tranches.map(tranche => tranche.balance));
    return { year: index + 1, ebitda: driver.ebitda, da: driver.da, capex: driver.capex, deltaNwc: driver.deltaNwc, ebit, beginningCash, beginningDebt, interest, pretaxIncome, taxes, netIncome, operatingCashFlow, cashAvailableForDebtService, debtSchedule, debtPaydown: beginningDebt - endingDebt, endingDebt, cashRetained: available, endingCash: cash };
  });
  const last = years.at(-1);
  const exitEnterpriseValue = last.ebitda * exitMultiple;
  const exitEquityValue = exitEnterpriseValue - last.endingDebt + cash - input.exitFees;
  const moic = exitEquityValue / sponsorEquity;
  const irr = exitEquityValue > 0 ? moic ** (1 / years.length) - 1 : exitEquityValue === 0 ? -1 : null;
  return { entryEnterpriseValue, totalUses, debtFunding, sponsorEquity, totalSources: debtFunding + sponsorEquity, years, exitEnterpriseValue, exitDebt: last.endingDebt, exitCash: cash, exitFees: input.exitFees, exitEquityValue, moic, irr, lossStatus: exitEquityValue < 0 ? 'NEGATIVE_EXIT_EQUITY_IRR_UNDEFINED' : exitEquityValue === 0 ? 'TOTAL_EQUITY_LOSS' : exitEquityValue < sponsorEquity ? 'PARTIAL_EQUITY_LOSS' : 'NO_EQUITY_LOSS', sponsorCashFlows: [-sponsorEquity, ...years.slice(0, -1).map(() => 0), exitEquityValue] };
}
function calculateLbo(input, section) {
  const base = lboCore(input);
  const calculations = { base };
  if (section === 'sensitivity') calculations.sensitivity = grid('entryMultiple', axis(input.entryMultiple, 1), 'exitMultiple', axis(input.exitMultiple, 1), (entry, exit) => {
    const value = lboCore(input, entry, exit);
    return { sponsorEquity: value.sponsorEquity, exitEquityValue: value.exitEquityValue, moic: value.moic, irr: value.irr, lossStatus: value.lossStatus };
  });
  return { calculations, checks: { sourcesEqualUses: nearZero(base.totalSources - base.totalUses, base.totalUses), nonnegativeDebt: base.years.every(year => year.endingDebt >= 0), cashWaterfall: base.years.every(year => nearZero(year.cashAvailableForDebtService - year.debtPaydown - year.cashRetained, year.cashAvailableForDebtService)) }, warnings: base.exitEquityValue <= 0 ? [base.lossStatus] : [] };
}
function balanceSheet(state) {
  const assets = state.cash + state.ar + state.inventory + state.ppe;
  const liabilities = state.ap + state.debt;
  const equity = state.commonStock + state.retainedEarnings;
  return { ...state, assets, liabilities, equity, balanceCheck: assets - liabilities - equity };
}
function calculateStatements(input) {
  const initial = balanceSheet(input.opening);
  requireCondition(nearZero(initial.balanceCheck, initial.assets), 'Opening balance sheet must balance');
  let prior = initial;
  let revenue = input.revenue;
  const warnings = [];
  const years = input.years.map((driver, index) => {
    revenue *= 1 + driver.growth;
    const cogs = revenue * driver.cogsPct;
    const grossProfit = revenue - cogs;
    const sm = revenue * driver.smPct;
    const rd = revenue * driver.rdPct;
    const ga = revenue * driver.gaPct;
    const ebitda = grossProfit - sm - rd - ga;
    const ebit = ebitda - driver.da;
    const interest = prior.debt * driver.interestRate;
    const pretaxIncome = ebit - interest;
    const taxes = Math.max(0, pretaxIncome) * driver.taxRate;
    const netIncome = pretaxIncome - taxes;
    const ar = revenue * driver.dso / 365;
    const inventory = cogs * driver.dio / 365;
    const ap = cogs * driver.dpo / 365;
    const deltaAr = ar - prior.ar;
    const deltaInventory = inventory - prior.inventory;
    const deltaAp = ap - prior.ap;
    const cfo = netIncome + driver.da - deltaAr - deltaInventory + deltaAp;
    const cfi = -driver.capex;
    const cff = driver.borrowing - driver.repayment + driver.equityIssued - driver.dividends;
    const netCashFlow = cfo + cfi + cff;
    const endingCash = prior.cash + netCashFlow;
    const ppe = prior.ppe + driver.capex - driver.da;
    const debt = prior.debt + driver.borrowing - driver.repayment;
    requireCondition(endingCash >= 0 && ppe >= 0 && debt >= 0, `Three-statement year ${index + 1} negative cash, PP&E, or debt; explicit funding/assets required`);
    const bs = balanceSheet({ cash: endingCash, ar, inventory, ppe, ap, debt, commonStock: prior.commonStock + driver.equityIssued, retainedEarnings: prior.retainedEarnings + netIncome - driver.dividends });
    requireCondition(nearZero(bs.balanceCheck, bs.assets), `Three-statement year ${index + 1} balance sheet does not balance`);
    const result = { year: index + 1, incomeStatement: { revenue, cogs, grossProfit, sm, rd, ga, ebitda, da: driver.da, ebit, interest, pretaxIncome, taxes, netIncome }, workingCapital: { ar, inventory, ap, deltaAr, deltaInventory, deltaAp, deltaNwc: deltaAr + deltaInventory - deltaAp }, balanceSheet: bs, cashFlow: { beginningCash: prior.cash, netIncome, da: driver.da, cfo, cfi, cff, netCashFlow, endingCash }, checks: { balanceSheet: nearZero(bs.balanceCheck, bs.assets), cashTie: nearZero(endingCash - bs.cash, bs.assets), retainedEarningsRoll: nearZero(bs.retainedEarnings - prior.retainedEarnings - netIncome + driver.dividends, bs.assets) } };
    prior = bs;
    return result;
  });
  return { calculations: { opening: initial, years }, checks: { openingBalanced: true, allYearsBalanced: years.every(year => year.checks.balanceSheet), cashTies: years.every(year => year.checks.cashTie) }, warnings };
}
function quotient(numerator, denominator, name, reasons) {
  if (denominator <= 0) { reasons[name] = 'NM: denominator is nonpositive'; return null; }
  return numerator / denominator;
}
function statistics(values) {
  const sorted = values.filter(value => value !== null).sort((a, b) => a - b);
  function percentile(p) {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * p;
    const low = Math.floor(position);
    return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
  }
  return { n: sorted.length, excluded: values.length - sorted.length, min: sorted[0] ?? null, q25: percentile(0.25), median: percentile(0.5), q75: percentile(0.75), max: sorted.at(-1) ?? null };
}
function calculateComps(input, commonCurrency, commonUnit) {
  requireCondition(new Set(input.peers.map(company => company.ticker)).size === input.peers.length, 'Comparable tickers must be unique');
  const peers = input.peers.map(company => {
    requireCondition(company.currency === commonCurrency && company.unit === commonUnit && company.period === input.period && company.asOf === input.asOf, 'Comparable currency, unit, period and asOf must match common assumptions');
    const nmReasons = {};
    const marketCap = company.price * company.shares;
    const enterpriseValue = marketCap + company.debt - company.cash;
    const revenueGrowth = quotient(company.revenue - company.priorRevenue, company.priorRevenue, 'revenueGrowth', nmReasons);
    const grossMargin = quotient(company.grossProfit, company.revenue, 'grossMargin', nmReasons);
    const ebitdaMargin = quotient(company.ebitda, company.revenue, 'ebitdaMargin', nmReasons);
    const netMargin = quotient(company.netIncome, company.revenue, 'netMargin', nmReasons);
    const eps = quotient(company.netIncome, company.shares, 'eps', nmReasons);
    const evRevenue = quotient(enterpriseValue, company.revenue, 'evRevenue', nmReasons);
    const evEbitda = quotient(enterpriseValue, company.ebitda, 'evEbitda', nmReasons);
    const pe = quotient(marketCap, company.netIncome, 'pe', nmReasons);
    return { ticker: company.ticker, marketCap, enterpriseValue, revenueGrowth, grossMargin, ebitdaMargin, netMargin, eps, evRevenue, evEbitda, pe, nmReasons };
  });
  const stats = Object.fromEntries(['revenueGrowth', 'grossMargin', 'ebitdaMargin', 'netMargin', 'eps', 'evRevenue', 'evEbitda', 'pe'].map(metric => [metric, statistics(peers.map(company => company[metric]))]));
  return { calculations: { period: input.period, asOf: input.asOf, peers, statistics: stats, quartileMethod: 'QUARTILE.INC_LINEAR_INTERPOLATION' }, checks: { consistentCurrencyUnitPeriodAsOf: true, uniqueTickers: true }, warnings: peers.some(company => Object.keys(company.nmReasons).length) ? ['NM_VALUES_EXCLUDED_FROM_STATISTICS'] : [] };
}

/** Validate and calculate a fixed financial numeric profile; never produce an Office artifact. */
export function calculateModel(request) {
  validateJson(request);
  requireCondition(request && Object.hasOwn(requestSchemas, request.model), 'Unsupported financial model');
  const parsed = requestSchemas[request.model].parse(request);
  const { model, section, currency: commonCurrency, unit: commonUnit, inputs } = parsed;
  const output = model === 'dcf' ? calculateDcf(inputs, section)
    : model === 'lbo' ? calculateLbo(inputs, section)
      : model === 'three_statement' ? calculateStatements(inputs)
        : calculateComps(inputs, commonCurrency, commonUnit);
  ensureFiniteResult(output);
  return {
    schemaVersion: VERSION, modelVersion: `${model}-${VERSION}`, methodology: definitions[model].profile,
    model, section, inputSha256: createHash('sha256').update(canonical(parsed)).digest('hex'),
    currency: commonCurrency, unit: commonUnit, ...output,
    provenance: { ...parsed.provenance }, commercialReady: false, reviewRequired: true,
    officeStatus: 'NOT_IMPLEMENTED_P4', artifactKind: 'NUMERIC_RESULT_NOT_OFFICE',
  };
}
const examples = {
  dcf: { revenue: 100, years: Array.from({ length: 5 }, () => ({ growth: 0, ebitMargin: 0.2, daPct: 0.05, capexPct: 0.05, deltaNwcPct: 0 })), taxRate: 0.25, riskFreeRate: 0.04, beta: 1, equityRiskPremium: 0.06, costOfDebt: 0.05, debt: 0, cash: 0, price: 10, shares: 10, terminal: { method: 'perpetuity', growth: 0 } },
  lbo: { entryEbitda: 20, entryMultiple: 10, fees: 10, refinanceUses: 0, tranches: [{ name: 'Senior', amount: 100, rate: 0.1, mandatoryAmortization: 0, priority: 1 }], years: Array.from({ length: 2 }, () => ({ ebitda: 20, da: 5, capex: 5, deltaNwc: 0, taxRate: 0 })), cashSweep: 1, exitMultiple: 10, exitFees: 0 },
  three_statement: { revenue: 100, opening: { cash: 50, ar: 10, inventory: 10, ppe: 40, ap: 10, debt: 20, commonStock: 50, retainedEarnings: 30 }, years: [{ growth: 0, cogsPct: 0.5, smPct: 0.1, rdPct: 0.05, gaPct: 0.05, da: 5, capex: 10, dso: 36.5, dio: 73, dpo: 73, interestRate: 0.1, taxRate: 0.25, borrowing: 5, repayment: 3, dividends: 4, equityIssued: 2 }] },
  comps: { period: '2025-FY', asOf: '2026-01-31', peers: [{ ticker: 'TEST', currency: 'USD', unit: 'millions', period: '2025-FY', asOf: '2026-01-31', revenue: 100, priorRevenue: 80, grossProfit: 40, ebitda: 20, netIncome: 10, price: 10, shares: 10, debt: 20, cash: 5 }] },
};
/** Progressive disclosure: exact per-model request schema and a small valid test-only request. */
export function describeCalculation(model) {
  requireCondition(typeof model === 'string' && Object.hasOwn(definitions, model), 'Unsupported financial model');
  const definition = definitions[model];
  return {
    schemaVersion: VERSION, model, profile: definition.profile, sourceRefs: [...definition.sourceRefs],
    inputSchema: z.toJSONSchema(requestSchemas[model], { target: 'draft-2020-12' }),
    example: { model, section: definition.sections[0], currency: 'USD', unit: 'millions', provenance: { classification: 'TEST_ONLY', sources: ['Synthetic hand-check fixture'] }, inputs: JSON.parse(JSON.stringify(examples[model])) },
    limits: [...definition.limits], commercialReady: false, reviewRequired: true,
    officeStatus: 'NOT_IMPLEMENTED_P4', artifactKind: 'NUMERIC_RESULT_NOT_OFFICE',
  };
}
