/**
 * The stored profile as it was at 90ef4ed (version 2, before PR 4 made
 * portfolio.accounts the single account list), and the payloads of the
 * v2 to v3 migration examples 1 to 9 (build contract section 8).
 *
 * Written out literally, as localStorage holds it, so that the fixture does
 * not change when the default profile does. Everything is a plain object:
 * no type of the current profile is named here.
 */

import { setAt } from '@/lib/fields/paths';

export type RawPayload = Record<string, unknown>;

/** Every leaf and list of the 90ef4ed default profile, nothing answered. */
export function defaultPayloadAt90ef4ed(): RawPayload {
  return {
    version: 2,
    updatedAt: 0,
    person: { age: 25, state: 'CA', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 },
    income: {
      grossPerPaycheck: 4000,
      netPerPaycheck: 2550,
      frequency: 'bi-weekly',
      hasBonus: false,
      bonusAmount: 0,
      bonusFrequency: 'annual',
    },
    spending: { necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600, targetRetirementIncome: 41000 },
    cash: { emergencyFundBalance: 9000, emergencyFundApy: 0.04, targetMonths: 3 },
    workplace: {
      has401k: true,
      matchPercent: 1,
      matchLimit: 0.04,
      contributionType: 'traditional',
      contributionPercent: 0.08,
      rothContributionPercent: 0,
      afterTaxAvailable: false,
    },
    hsa: { eligible: false, coverage: 'individual', monthlyContribution: 0, employerAnnualContribution: 0, investing: false },
    ira: { traditional: false, roth: false, traditionalMonthly: 0, rothMonthly: 0, traditionalBalance: 0, rothBalance: 0 },
    investing: { investedBalance: 25000, monthlyContribution: 1500, taxableMonthlyContribution: 500, targetMix: '80-20' },
    retirementIncome: { socialSecurityBenefit: null, socialSecurityAge: 67, annualHealthcareCost: null },
    debts: [],
    portfolio: {
      accounts: [
        { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
        { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1000 },
      ],
      securities: [
        { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 375, assetClass: 'us-stock' },
        { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 85, assetClass: 'intl-stock' },
        { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 70, assetClass: 'bonds' },
      ],
      holdings: [
        { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
        { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
        { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
        { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
      ],
      classTargets: [
        { accountId: null, assetClass: 'us-stock', target: 0.6 },
        { accountId: null, assetClass: 'intl-stock', target: 0.2 },
        { accountId: null, assetClass: 'bonds', target: 0.2 },
        { accountId: null, assetClass: 'cash', target: 0 },
      ],
      customAssetClasses: [],
    },
    strategy: { leverageRatio: 2 },
    leverage: { monthlyContribution: null, years: null, startingBalance: null },
    assumptions: {
      retirement: {
        riskProfile: 'tdf',
        accumulationReturn: 0.08,
        retirementReturn: 0.06,
        inflationRate: 0.03,
        volatility: 0.15,
        effectiveTaxRate: null,
        healthcareCostMultiplier: 1,
      },
      paycheck: { riskTolerance: 'moderate', optimizationGoal: 'balanced', expectedRetirementBracket: 0.12 },
      portfolio: { mode: 'whole', allowTaxableSelling: false, showPlacementAdvice: true },
      leverage: {
        indexMeanReturn: 0.1,
        indexVolatility: 0.16,
        financingRate: 0.045,
        expenseRatio: 0.0089,
        indexExpenseRatio: 0.0003,
      },
    },
    provided: [],
  };
}

/** The localStorage value (key 'bufo-profile') of a profile persisted at 90ef4ed. */
export function storedAt90ef4ed(profile: RawPayload = defaultPayloadAt90ef4ed()): string {
  return JSON.stringify({ state: { profile }, version: 2 });
}

/** The 90ef4ed default with `values` set by path and `provided` as given. */
export function v2With(values: Readonly<Record<string, unknown>>, provided: readonly string[] = []): RawPayload {
  let payload = defaultPayloadAt90ef4ed();
  for (const [path, value] of Object.entries(values)) payload = setAt(payload, path, value);
  return { ...payload, provided: [...provided] };
}

/** The v2 example registry plus BOXX (example 6). */
const BOXX = { id: 'sec-boxx', ticker: 'BOXX', price: 115, assetClass: 'cash' };

/** The payloads of the migration examples of contract section 8, by number ('3b', '4a' and '4b' for the variants). */
export const MIGRATION_EXAMPLES: Readonly<Record<string, () => RawPayload>> = {
  // 1. The v2 default payload, nothing answered.
  '1': () => defaultPayloadAt90ef4ed(),
  // 2. investedBalance answered at 60,000 and a monthly 2,000; no holdings answered.
  '2': () =>
    v2With({ 'investing.investedBalance': 60000, 'investing.monthlyContribution': 2000 }, [
      'investing.investedBalance',
      'investing.monthlyContribution',
    ]),
  // 3. The v2 example lists answered (Roth IRA 4,100, Brokerage 8,775 with deposit 1,000), B = 30,000.
  '3': () =>
    v2With({ 'investing.investedBalance': 30000 }, ['investing.investedBalance', 'portfolio.accounts', 'portfolio.holdings']),
  // 3b. The same with B = 10,000.
  '3b': () =>
    v2With({ 'investing.investedBalance': 10000 }, ['investing.investedBalance', 'portfolio.accounts', 'portfolio.holdings']),
  // 4a. IRA balances answered, lists unanswered.
  '4a': () =>
    v2With(
      { 'ira.traditional': true, 'ira.traditionalBalance': 20000, 'ira.roth': true, 'ira.rothBalance': 6000 },
      ['ira.traditional', 'ira.traditionalBalance', 'ira.roth', 'ira.rothBalance']
    ),
  // 4b. The same answers with the v2 example lists answered.
  '4b': () =>
    v2With(
      { 'ira.traditional': true, 'ira.traditionalBalance': 20000, 'ira.roth': true, 'ira.rothBalance': 6000 },
      ['ira.traditional', 'ira.traditionalBalance', 'ira.roth', 'ira.rothBalance', 'portfolio.accounts', 'portfolio.holdings']
    ),
  // 5. has401k and hsa.eligible answered yes, nothing else.
  '5': () => v2With({ 'workplace.has401k': true, 'hsa.eligible': true }, ['workplace.has401k', 'hsa.eligible']),
  // 6. The BOXX account counted twice in v2: EF 10,000 typed, B 40,000, Robinhood holds BOXX 90 x 115.
  '6': () =>
    v2With(
      {
        'cash.emergencyFundBalance': 10000,
        'investing.investedBalance': 40000,
        'portfolio.accounts': [
          { id: 'acc-fid', name: 'Fidelity Roth IRA', accountType: 'tax-free', deposit: 0 },
          { id: 'acc-rh', name: 'Robinhood', accountType: 'taxable', deposit: 0 },
        ],
        'portfolio.securities': [...(defaultPayloadAt90ef4ed().portfolio as { securities: unknown[] }).securities, BOXX],
        'portfolio.holdings': [
          { id: 'hld-fid-vti', accountId: 'acc-fid', securityId: 'sec-vti', shares: 20 },
          { id: 'hld-fid-vxus', accountId: 'acc-fid', securityId: 'sec-vxus', shares: 30 },
          { id: 'hld-rh-boxx', accountId: 'acc-rh', securityId: 'sec-boxx', shares: 90 },
        ],
      },
      [
        'cash.emergencyFundBalance',
        'investing.investedBalance',
        'portfolio.accounts',
        'portfolio.securities',
        'portfolio.holdings',
      ]
    ),
  // 7. An IRA without a name hint plus a typed Roth IRA balance of 6,000.
  '7': () =>
    v2With(
      {
        'ira.rothBalance': 6000,
        'portfolio.accounts': [{ id: 'acc-1', name: 'Fidelity', accountType: 'tax-free', deposit: 0 }],
        'portfolio.holdings': [
          { id: 'hld-1', accountId: 'acc-1', securityId: 'sec-vti', shares: 10 },
          { id: 'hld-2', accountId: 'acc-1', securityId: 'sec-bnd', shares: 5 },
        ],
      },
      ['ira.rothBalance', 'portfolio.accounts', 'portfolio.holdings']
    ),
  // 8. A v2 completer who accepted the typical 25,000 and the example lists.
  '8': () =>
    v2With({ 'ira.roth': false, 'workplace.has401k': true }, [
      'investing.investedBalance',
      'portfolio.accounts',
      'portfolio.holdings',
      'ira.roth',
      'workplace.has401k',
    ]),
  // 9. A securities-only answer (a v2 price edit: VTI 400).
  '9': () => v2With({ 'portfolio.securities.0.price': 400 }, ['portfolio.securities']),
};
