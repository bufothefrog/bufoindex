/**
 * End to end, PR 5: contribution timing from the stored profile to every
 * calculator.
 *
 * The EC300FD_* fixtures below are the engine inputs each calculator built
 * from the same raw payloads at ec300fd (the base of PR 5), captured on
 * 2026-11-13 by running engineInputsFor over normalizeProfile(v3DefaultRaw())
 * and normalizeProfile(ownerRaw()) on an ec300fd checkout. A payload stored at
 * ec300fd holds none of the three timing leaves, so after PR 5 it must build
 * exactly those inputs plus the two new derived ones: yearStartSavings 0
 * (retirement) and preferences.investedBalance (paycheck net worth).
 */

import { describe, expect, it } from 'vitest';
import { calculateProjectedBalance } from '@/lib/calculations/retirement';
import { simulateDcaComparison } from '@/lib/calculations/leverageComparison';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { summarizeRetirement } from '@/lib/dashboard/derive';
import { normalizeProfile } from '@/lib/profile/defaults';
import { toTodaysDollars } from '@/lib/utils/displayDollars';
import { ownerRaw, ownerYearStartRaw, v3DefaultRaw } from '@/test/factories/accountsFixtures';

/**
 * Deep comparison that holds integers and every non-number exactly and a
 * non-integer number to 9 decimal places, so no computed double is compared
 * bit for bit.
 */
function expectSameInputs(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number' && !Number.isInteger(expected)) {
    expect(typeof actual, path).toBe('number');
    expect(actual as number, path).toBeCloseTo(expected, 9);
    return;
  }
  if (expected === null || typeof expected !== 'object') {
    expect(actual, path).toBe(expected);
    return;
  }
  expect(actual !== null && typeof actual === 'object', path).toBe(true);
  expect(Array.isArray(actual), path).toBe(Array.isArray(expected));
  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  expect(Object.keys(actualRecord).sort(), path).toEqual(Object.keys(expectedRecord).sort());
  for (const key of Object.keys(expectedRecord)) {
    expectSameInputs(actualRecord[key], expectedRecord[key], `${path}.${key}`);
  }
}

const EC300FD_DEFAULT_RETIREMENT = {
  startingAge: 25, retirementAge: 65, lifeExpectancy: 90, targetIncome: 41000, startingBalance: 25000,
  currentIncome: 104000, incomeAmount: 4000, incomePeriod: 'biweekly', monthlySavings: 1540,
  necessaryMonthlyExpenses: 3000, accumulationReturn: 0.08, retirementReturn: 0.06, inflationRate: 0.03,
  socialSecurityAge: 67, socialSecurityBenefit: 40359, healthcareCostMultiplier: 1, volatility: 0.15,
  filingStatus: 'single', state: 'CA', riskProfile: 'tdf', effectiveTaxRate: null, estimatedAnnualHealthcareCost: null,
};

const EC300FD_DEFAULT_PAYCHECK = {
  income: {
    grossPaycheck: 4000, netPaycheck: 2550, frequency: 'bi-weekly', regularBonus: false, bonusAmount: 0,
    bonusFrequency: 'annual', monthlyGross: 8666.666666666666, monthlyNet: 5525, gross: 8666.666666666666,
    net: 5525, bonusExpected: 0,
  },
  taxes: {
    federalBracket: 0.22, state: 'CA', filingStatus: 'single',
    currentWithholding: { federal: 800, state: 200, fica: 382 },
  },
  benefits: {
    employer401k: {
      available: true, matchPercent: 1, matchLimit: 0.04, currentContribution: 0.08, contributionType: 'traditional',
      traditionalContribution: 0.08, rothContribution: 0, afterTaxAvailable: false, currentYTD: 0,
    },
    hsa: {
      eligible: false, employerContribution: 0, currentContribution: 0, currentYTD: 0, coverageType: 'individual',
      investmentStrategy: false,
    },
    ira: {
      hasIRA: false, accountTypes: { traditional: false, roth: false },
      currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 },
    },
    other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
  },
  debts: [],
  preferences: {
    emergencyFundMonths: 3, currentEmergencyFund: 9000, emergencyFundAPY: 0.04, necessaryExpenses: 3000,
    funMoney: { min: 300, max: 600, current: 450 }, age: 25, hasTaxableAccount: true, taxableAccountContribution: 500,
    isPeakEarnings: false, expectedRetirementBracket: 0.12, riskTolerance: 'moderate', optimizationGoal: 'balanced',
  },
  version: '1.0', lastUpdated: 0, source: 'user_input',
};

const EC300FD_DEFAULT_LEVERAGE = {
  monthlyContribution: 500, years: 40, startingBalance: 25000, leverageRatio: 2, indexMeanReturn: 0.1,
  indexVolatility: 0.16, financingRate: 0.045, expenseRatio: 0.0089, indexExpenseRatio: 0.0003, paths: 500,
  seed: 20260812,
};

const EC300FD_DEFAULT_PORTFOLIO = {
  setupMode: 'multi-shared',
  securities: [
    { id: 'sec-vti', ticker: 'VTI', price: 375, assetClass: 'us-stock', name: 'Vanguard Total US Stock' },
    { id: 'sec-vxus', ticker: 'VXUS', price: 85, assetClass: 'intl-stock', name: 'Vanguard Total Intl Stock' },
    { id: 'sec-bnd', ticker: 'BND', price: 70, assetClass: 'bonds', name: 'Vanguard Total Bond' },
  ],
  accounts: [{ id: 'acc-brok', name: 'Brokerage (taxable)', accountType: 'taxable', deposit: 500 }],
  holdings: [
    { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
    { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
    { id: 'hld-brok-bnd', accountId: 'acc-brok', securityId: 'sec-bnd', shares: 0 },
  ],
  classTargets: [
    { accountId: null, assetClass: 'us-stock', target: 0.6 },
    { accountId: null, assetClass: 'intl-stock', target: 0.2 },
    { accountId: null, assetClass: 'bonds', target: 0.2 },
    { accountId: null, assetClass: 'cash', target: 0 },
  ],
  customAssetClasses: [],
  allowTaxableSelling: false,
  showPlacementAdvice: true,
  mode: 'whole',
};

/** The owner (ownerRaw) at ec300fd: retirement inputs, leverage inputs and paycheck allocations. */
const EC300FD_OWNER_RETIREMENT = {
  ...EC300FD_DEFAULT_RETIREMENT,
  startingBalance: 105800, currentIncome: 156000, incomeAmount: 6000, monthlySavings: 3195, socialSecurityBenefit: 48159,
};

const EC300FD_OWNER_LEVERAGE = { ...EC300FD_DEFAULT_LEVERAGE, monthlyContribution: 400, startingBalance: 105800 };

const EC300FD_OWNER_ALLOCATIONS = [
  { id: 'hsa-contribution', account: 'HSA Contribution', amount: 7.692307692307693, category: 'tax_advantaged' },
  { id: 'additional-401k', account: 'Roth 401k', amount: 342.3076923076923, category: 'tax_advantaged' },
  { id: 'taxable-investment', account: 'Taxable Investment', amount: 676.9230769230767, category: 'investment' },
];

const EC300FD_DEFAULT_ALLOCATIONS = [
  { id: 'roth-ira', account: 'Roth IRA', amount: 288.4615384615385, category: 'tax_advantaged' },
  { id: 'additional-401k', account: 'Roth 401k', amount: 622.3076923076923, category: 'tax_advantaged' },
  { id: 'taxable-investment', account: 'Taxable Investment', amount: 116.15384615384585, category: 'investment' },
];

const allocationsOf = (profile: ReturnType<typeof normalizeProfile>) =>
  PAYCHECK_CALCULATOR.calculate(engineInputsFor(PAYCHECK_CALCULATOR, profile)).allocations.map((a) => ({
    id: a.id,
    account: a.account,
    amount: a.amount,
    category: a.category,
  }));

describe('a profile stored at ec300fd builds the same engine inputs, plus the two derived PR 5 inputs', () => {
  const profile = () => normalizeProfile(v3DefaultRaw());

  it('normalizes the three timing leaves to monthly', () => {
    const p = profile();
    expect(p.ira.traditionalTiming).toBe('monthly');
    expect(p.ira.rothTiming).toBe('monthly');
    expect(p.investing.taxableTiming).toBe('monthly');
  });

  it('retirement: ec300fd inputs plus yearStartSavings 0', () => {
    expectSameInputs(engineInputsFor(RETIREMENT_CALCULATOR, profile()), {
      ...EC300FD_DEFAULT_RETIREMENT,
      yearStartSavings: 0,
    });
  });

  it('paycheck: ec300fd inputs plus preferences.investedBalance 25,000 (401(k) 16,225 + brokerage 8,775)', () => {
    expectSameInputs(engineInputsFor(PAYCHECK_CALCULATOR, profile()), {
      ...EC300FD_DEFAULT_PAYCHECK,
      preferences: { ...EC300FD_DEFAULT_PAYCHECK.preferences, investedBalance: 25000 },
    });
  });

  it('leverage and portfolio: ec300fd inputs, unchanged', () => {
    expectSameInputs(engineInputsFor(LEVERAGE_CALCULATOR, profile()), EC300FD_DEFAULT_LEVERAGE);
    expectSameInputs(engineInputsFor(PORTFOLIO_CALCULATOR, profile()), EC300FD_DEFAULT_PORTFOLIO);
  });

  it('paycheck allocation amounts are the ec300fd ones (288.46 / 622.31 / 116.15 per paycheck)', () => {
    expectSameInputs(allocationsOf(profile()), EC300FD_DEFAULT_ALLOCATIONS);
  });

  it('the default projection is bit-identical to ec300fd (5,796,147.137288305)', () => {
    expect(calculateProjectedBalance(engineInputsFor(RETIREMENT_CALCULATOR, profile()))).toBe(5796147.137288305);
  });
});

describe('the owner with the Roth IRA once a year (ownerYearStartRaw)', () => {
  const yearly = () => normalizeProfile(ownerYearStartRaw());
  const untouched = () => normalizeProfile(ownerRaw());

  it('retirement: the ec300fd owner inputs plus yearStartSavings 7,500 (12 x 625)', () => {
    expectSameInputs(engineInputsFor(RETIREMENT_CALCULATOR, yearly()), {
      ...EC300FD_OWNER_RETIREMENT,
      yearStartSavings: 7500,
    });
    expect(engineInputsFor(RETIREMENT_CALCULATOR, untouched()).yearStartSavings).toBe(0);
  });

  it('retirement: projected 13,494,440.92 (13,394,066.77 with every part monthly)', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, yearly());
    expect(calculateProjectedBalance(inputs)).toBeCloseTo(13494440.92, 1);
    expect(calculateProjectedBalance(engineInputsFor(RETIREMENT_CALCULATOR, untouched()))).toBeCloseTo(13394066.77, 1);
  });

  it('overview: the +$500 lever keeps the yearly part (15,170,282.20 nominal, $4,650,554 today)', () => {
    const outcome = summarizeRetirement(engineInputsFor(RETIREMENT_CALCULATOR, yearly()));
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.lever.projectedBalance).toBeCloseTo(15170282.2, 1);
    // 15,170,282.20 / 1.03^40 (3.262037792).
    expect(Math.round(toTodaysDollars(outcome.lever.projectedBalance, 0.03, 40))).toBe(4650554);
  });

  it('leverage: the ec300fd owner inputs (400 a month, 40 years, 105,800 start); the timing leaf is not read', () => {
    expectSameInputs(engineInputsFor(LEVERAGE_CALCULATOR, yearly()), EC300FD_OWNER_LEVERAGE);
  });

  it('paycheck: inputs and allocation amounts do not read the timing leaves', () => {
    expectSameInputs(engineInputsFor(PAYCHECK_CALCULATOR, yearly()), engineInputsFor(PAYCHECK_CALCULATOR, untouched()));
    expect(engineInputsFor(PAYCHECK_CALCULATOR, yearly()).preferences.investedBalance).toBe(105800);
    expectSameInputs(allocationsOf(yearly()), EC300FD_OWNER_ALLOCATIONS);
  });

  it('portfolio: the timing leaf is not read', () => {
    expectSameInputs(engineInputsFor(PORTFOLIO_CALCULATOR, yearly()), engineInputsFor(PORTFOLIO_CALCULATOR, untouched()));
  });

  it('leverage card: row 2 (start of each year) $1,328,840 / $1,507,679, 43% behind; row 1 unchanged', () => {
    const result = simulateDcaComparison(engineInputsFor(LEVERAGE_CALCULATOR, yearly()));
    const today = (nominal: number) => Math.round(toTodaysDollars(nominal, 0.03, 40));
    // Row 2, the start of each year: 4,800 a year (12 x 400) plus the 105,800 start.
    expect(result.index.yearStart.p50).toBeCloseTo(4334725.605291478, 2);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(4918106.928060821, 2);
    expect(today(result.index.yearStart.p50)).toBe(1328840);
    expect(today(result.leveraged.yearStart.p50)).toBe(1507679);
    expect(result.probLeveragedBehindYearStart).toBeCloseTo(0.43, 10);
    // Row 1, monthly (the ec300fd stream): $1,316,924 / $1,502,882, 42.8% behind.
    expect(today(result.index.dca.p50)).toBe(1316924);
    expect(today(result.leveraged.dca.p50)).toBe(1502882);
    expect(result.probLeveragedBehindDca).toBeCloseTo(0.428, 10);
    // Relative gaps: +13.46% (start of each year) against +14.12% (monthly),
    // a difference of 0.66 points, inside the noise threshold.
    const yearStartRelative = result.dcaEffect.yearStartGap / result.index.yearStart.p50;
    const monthlyRelative = result.dcaEffect.dcaGap / result.index.dca.p50;
    expect(yearStartRelative).toBeCloseTo(0.1346, 4);
    expect(monthlyRelative).toBeCloseTo(0.1412, 4);
  });
});
