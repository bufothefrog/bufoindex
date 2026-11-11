/**
 * Portfolio bindings: the profile feeds RebalanceInputsV2 exactly as the
 * old mapper (toRebalanceInputs) did, every engine input is bound or
 * engine-only, and the engine's checks land on the fields that show them.
 *
 * Golden. toRebalanceInputs (lib/profile/mappers.ts) is still the profile
 * link's mapper, so the comparison runs against it live, for v1-shaped
 * profiles (migrateProfile from a v1 payload) and for a v2 profile with
 * several accounts, holdings and a custom class. No documented exception.
 */

import { describe, expect, it } from 'vitest';
import { rebalancePortfolioV2, type RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import {
  PORTFOLIO_BINDINGS,
  PORTFOLIO_ENGINE_ONLY,
  classTargetsFor,
} from '@/lib/calculators/portfolio/bindings';
import { PORTFOLIO_CALCULATOR, validateRebalanceInputs } from '@/lib/calculators/portfolio/definition';
import { engineInputsFor, validateFor } from '@/lib/calculators/runtime';
import { isDerivedBinding } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { applyProfileWrites, getDefaultFinancialProfile, migrateProfile } from '@/lib/profile';
import type { FinancialProfile } from '@/lib/profile';
import { toRebalanceInputs } from '@/lib/profile/mappers';

const V1_DEFAULT = {
  version: 1,
  updatedAt: 0,
  person: { age: 30, state: 'TX', filingStatus: 'single', retirementAge: 60 },
  income: { grossPerPaycheck: 3500, netPerPaycheck: 2600, frequency: 'bi-weekly' },
  spending: { necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600, targetRetirementIncome: 80000 },
  cash: { emergencyFundBalance: 5000, emergencyFundApy: 0.04, targetMonths: 3 },
  workplace: { has401k: true, matchPercent: 0.5, matchLimit: 0.06, contributionPercent: 0.06 },
  investing: {
    investedBalance: 25000,
    monthlyContribution: 1500,
    taxableMonthlyContribution: 500,
    targetMix: '80-20',
    newCashThisMonth: 1000,
  },
  strategy: { preset: 'cashflow-investor', leverageRatio: 2 },
  provided: [] as string[],
};

function fromV1(investing: Partial<typeof V1_DEFAULT.investing>): FinancialProfile {
  return migrateProfile({ ...V1_DEFAULT, investing: { ...V1_DEFAULT.investing, ...investing } }, 1);
}

const profileWith = (writes: Write[]): FinancialProfile =>
  applyProfileWrites(getDefaultFinancialProfile(), writes).profile;

/** Three accounts, five holdings over four securities, a custom class and custom targets. */
const SEVERAL: Write[] = [
  { path: 'investing.targetMix', value: 'custom' },
  {
    path: 'portfolio.accounts',
    value: [
      { id: 'acc-401k', name: 'Work 401(k)', accountType: 'tax-deferred', deposit: 750.25 },
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 500 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 2000 },
    ],
  },
  {
    path: 'portfolio.securities',
    value: [
      { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
      { id: 'sec-vxus', ticker: 'VXUS', price: 60, assetClass: 'intl-stock' },
      { id: 'sec-bnd', ticker: 'BND', price: 75, assetClass: 'bonds' },
      { id: 'sec-btc', ticker: 'IBIT', price: 40, assetClass: 'cac-1' },
    ],
  },
  {
    path: 'portfolio.holdings',
    value: [
      { id: 'hld-1', accountId: 'acc-401k', securityId: 'sec-bnd', shares: 120 },
      { id: 'hld-2', accountId: 'acc-401k', securityId: 'sec-vti', shares: 30.5 },
      { id: 'hld-3', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
      { id: 'hld-4', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
      { id: 'hld-5', accountId: 'acc-brok', securityId: 'sec-btc', shares: 25 },
    ],
  },
  {
    path: 'portfolio.classTargets',
    value: [
      { accountId: null, assetClass: 'us-stock', target: 0.5 },
      { accountId: null, assetClass: 'intl-stock', target: 0.2 },
      { accountId: null, assetClass: 'bonds', target: 0.25 },
      { accountId: null, assetClass: 'cac-1', target: 0.05 },
    ],
  },
  { path: 'portfolio.customAssetClasses', value: [{ id: 'cac-1', label: 'Crypto' }] },
  { path: 'assumptions.portfolio.mode', value: 'fractional' },
  { path: 'assumptions.portfolio.allowTaxableSelling', value: true },
  { path: 'assumptions.portfolio.showPlacementAdvice', value: false },
];

describe('portfolio bindings: golden against toRebalanceInputs', () => {
  const cases: [string, FinancialProfile][] = [
    ['the default profile', getDefaultFinancialProfile()],
    ['the v1 default', fromV1({})],
    ['a v1 100/0 mix with $2,400 of new cash', fromV1({ targetMix: '100-0', newCashThisMonth: 2400 })],
    ['a v1 60/40 mix with negative new cash (clamped to 0)', fromV1({ targetMix: '60-40', newCashThisMonth: -50 })],
    ['several accounts, holdings and a custom class', profileWith(SEVERAL)],
  ];

  it.each(cases)('%s', (_name, profile) => {
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, profile)).toEqual(toRebalanceInputs(profile));
  });

  it('pins the default profile inputs and their rebalance', () => {
    const inputs = engineInputsFor(PORTFOLIO_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.setupMode).toBe('multi-shared');
    expect(inputs.accounts.map((a) => [a.id, a.deposit])).toEqual([
      ['acc-roth', 0],
      ['acc-brok', 1000],
    ]);
    // The 80/20 preset: 60% US, 20% intl, 20% bonds, 0% cash.
    expect(inputs.classTargets.map((t) => [t.assetClass, t.target])).toEqual([
      ['us-stock', 0.6],
      ['intl-stock', 0.2],
      ['bonds', 0.2],
      ['cash', 0],
    ]);
    expect([inputs.mode, inputs.allowTaxableSelling, inputs.showPlacementAdvice]).toEqual(['whole', false, true]);
    // Roth 10 x 250 + 5 x 75 = 2,875; Brokerage 20 x 250 + 15 x 60 = 5,900.
    const result = PORTFOLIO_CALCULATOR.calculate(inputs);
    expect(result.totalValueBefore).toBe(8775);
    expect(result.totalDeposit).toBe(1000);
  });

  it("uses the profile's class targets for the custom mix and the preset's weights otherwise", () => {
    const custom = profileWith(SEVERAL);
    expect(classTargetsFor(makeGet(custom))).toBe(custom.portfolio.classTargets);
    const preset = profileWith([...SEVERAL, { path: 'investing.targetMix', value: '60-40' }]);
    expect(classTargetsFor(makeGet(preset))).toEqual([
      { accountId: null, assetClass: 'us-stock', target: 0.45 },
      { accountId: null, assetClass: 'intl-stock', target: 0.15 },
      { accountId: null, assetClass: 'bonds', target: 0.4 },
      { accountId: null, assetClass: 'cash', target: 0 },
    ]);
    expect(classTargetsFor(makeGet({ investing: { targetMix: 'nope' } }))).toBeUndefined();
  });

  it('never mutates the profile when the rebalance runs', () => {
    const profile = profileWith(SEVERAL);
    const before = JSON.stringify(profile);
    rebalancePortfolioV2(engineInputsFor(PORTFOLIO_CALCULATOR, profile));
    expect(JSON.stringify(profile)).toBe(before);
  });
});

describe('portfolio bindings: every engine input is bound or engine-only', () => {
  it('enumerates the RebalanceInputsV2 leaves', () => {
    const leaves = Object.keys(PORTFOLIO_CALCULATOR.engineBase()).sort();
    const bound = PORTFOLIO_BINDINGS.map((binding) => binding.engine);
    expect(new Set(bound).size).toBe(bound.length);
    expect([...bound, ...Object.keys(PORTFOLIO_ENGINE_ONLY)].sort()).toEqual(leaves);
    expect(leaves).toEqual([
      'accounts',
      'allowTaxableSelling',
      'classTargets',
      'customAssetClasses',
      'holdings',
      'mode',
      'securities',
      'setupMode',
      'showPlacementAdvice',
    ]);
    for (const reason of Object.values(PORTFOLIO_ENGINE_ONLY)) expect(reason.length).toBeGreaterThan(20);
  });

  it('binds the lists and settings to their profile homes', () => {
    const direct = PORTFOLIO_BINDINGS.filter((b) => !isDerivedBinding(b)).map((b) => [b.engine, 'profile' in b && b.profile]);
    expect(direct).toEqual([
      ['accounts', 'portfolio.accounts'],
      ['customAssetClasses', 'portfolio.customAssetClasses'],
      ['allowTaxableSelling', 'assumptions.portfolio.allowTaxableSelling'],
      ['showPlacementAdvice', 'assumptions.portfolio.showPlacementAdvice'],
      ['mode', 'assumptions.portfolio.mode'],
    ]);
    const derived = PORTFOLIO_BINDINGS.filter(isDerivedBinding).map((b) => [b.engine, b.errorPath]);
    expect(derived).toEqual([
      ['securities', 'portfolio.holdings'],
      ['holdings', 'portfolio.holdings'],
      ['classTargets', 'portfolio.classTargets'],
    ]);
  });
});

describe('portfolio definition', () => {
  it('runs in-thread with no delay and keeps the engine base in multi-shared mode', () => {
    expect(PORTFOLIO_CALCULATOR.id).toBe('portfolio');
    expect(PORTFOLIO_CALCULATOR.debounceMs).toBe(0);
    expect(PORTFOLIO_CALCULATOR.engineBase()).toEqual<RebalanceInputsV2>({
      setupMode: 'multi-shared',
      securities: [],
      accounts: [],
      holdings: [],
      classTargets: [],
      customAssetClasses: [],
      allowTaxableSelling: false,
      showPlacementAdvice: true,
      mode: 'whole',
    });
  });

  it('keys the engine checks by engine path, the first message per path', () => {
    const inputs = engineInputsFor(PORTFOLIO_CALCULATOR, getDefaultFinancialProfile());
    expect(validateRebalanceInputs(inputs)).toEqual({});
    expect(
      validateRebalanceInputs({
        ...inputs,
        classTargets: [{ accountId: null, assetClass: 'us-stock', target: 0.9 }, { accountId: 'acc-roth', assetClass: 'bonds', target: 0.4 }],
        holdings: [{ id: 'h', accountId: 'acc-gone', securityId: 'sec-gone', shares: -1 }],
      })
    ).toEqual({
      'holdings[0].accountId': 'Holding references an unknown account.',
      'holdings[0].securityId': 'Holding references an unknown security.',
      'holdings[0].shares': 'Shares cannot be negative.',
      classTargets: 'Portfolio-wide targets must have accountId === null.',
      'classTargets.sum': 'Target allocations must sum to 100% (currently 90.00%).',
    });
  });

  it('shows a custom mix off 100% on the class-targets editor', () => {
    const profile = profileWith([
      ...SEVERAL,
      {
        path: 'portfolio.classTargets',
        value: [
          { accountId: null, assetClass: 'us-stock', target: 0.9 },
          { accountId: null, assetClass: 'bonds', target: 0.4 },
        ],
      },
    ]);
    expect(validateFor(PORTFOLIO_CALCULATOR, profile)).toEqual({
      'portfolio.classTargets': 'Target allocations must sum to 100% (currently 130.00%).',
    });
  });

  it('shows holding and price errors on the holdings editor, and account rows on their row', () => {
    const base = profileWith(SEVERAL);
    const holdings = base.portfolio.holdings.map((h, i) => (i === 0 ? { ...h, accountId: 'acc-gone' } : h));
    const securities = base.portfolio.securities.map((s, i) => (i === 1 ? { ...s, price: -5 } : s));
    // The engine inputs are built from the profile directly, past the store's own checks.
    const broken: FinancialProfile = { ...base, portfolio: { ...base.portfolio, holdings, securities } };
    expect(validateFor(PORTFOLIO_CALCULATOR, broken)).toEqual({
      'portfolio.holdings': 'Price cannot be negative.',
    });
    const negative: FinancialProfile = {
      ...base,
      portfolio: { ...base.portfolio, accounts: base.portfolio.accounts.map((a, i) => (i === 2 ? { ...a, deposit: -1 } : a)) },
    };
    expect(validateFor(PORTFOLIO_CALCULATOR, negative)).toEqual({
      'portfolio.accounts.2.deposit': 'New cash must be at least $0.',
    });
  });

  it('needs at least one account', () => {
    const none: FinancialProfile = profileWith([{ path: 'portfolio.accounts', value: [] }]);
    expect(validateFor(PORTFOLIO_CALCULATOR, none)).toMatchObject({
      'portfolio.accounts': 'Accounts needs at least 1 entry.',
    });
  });
});
