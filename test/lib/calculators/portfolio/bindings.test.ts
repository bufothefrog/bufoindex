/**
 * Portfolio bindings: the profile feeds RebalanceInputsV2 exactly as the
 * old mapper (toRebalanceInputs) did, every engine input is bound or
 * engine-only, and the engine's checks land on the fields that show them.
 *
 * Golden fixture. Each GOLDEN entry was captured on 2026-11-12 from the
 * former lib/profile/mappers.ts (deleted in phase 5): what its
 * toRebalanceInputs returned for that profile, for v1-shaped profiles (a v1
 * payload loaded through normalizeProfile, as any stored profile is; the
 * Brokerage deposit set directly where a case needs new cash) and a v2
 * profile with several accounts, holdings and a custom class. No documented
 * exception.
 */

import { describe, expect, it } from 'vitest';
import { rebalancePortfolioV2, type RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import {
  PORTFOLIO_BINDINGS,
  PORTFOLIO_ENGINE_ONLY,
  classTargetsFor,
} from '@/lib/calculators/portfolio/bindings';
import { PORTFOLIO_CALCULATOR, validateRebalanceInputs } from '@/lib/calculators/portfolio/definition';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { isDerivedBinding } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { applyProfileWrites, BROKERAGE_ACCOUNT_ID, getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { answeredEverywhere, defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';

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
  strategy: { leverageRatio: 2 },
  provided: [] as string[],
};

/**
 * A v1 payload loaded over the 3bb0132 defaults the fixture was captured on
 * (the worked example's securities come from there), every field answered
 * (test/factories/profile-3bb0132.ts).
 */
function fromV1(investing: Partial<typeof V1_DEFAULT.investing>): FinancialProfile {
  return answeredEverywhere(
    normalizeProfile({ ...V1_DEFAULT, investing: { ...V1_DEFAULT.investing, ...investing } }, defaultProfileAt3bb0132())
  );
}

/** `profile` with the Brokerage account's deposit (its new cash) set to `deposit`, past the store's own checks. */
function withBrokerageDeposit(profile: FinancialProfile, deposit: number): FinancialProfile {
  const accounts = profile.portfolio.accounts.map((account) =>
    account.id === BROKERAGE_ACCOUNT_ID ? { ...account, deposit } : account
  );
  return { ...profile, portfolio: { ...profile.portfolio, accounts } };
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

/** The worked example's securities and holdings, which every v1 profile and the default carry. */
const EXAMPLE_SECURITIES = [
  { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
  { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 60, assetClass: 'intl-stock' },
  { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 75, assetClass: 'bonds' },
];
const EXAMPLE_HOLDINGS = [
  { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
  { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
  { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
  { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
];

/** The old mapper's output for the worked example with this Brokerage deposit and these portfolio-wide weights (us, intl, bonds, cash). */
function exampleInputs(brokerageDeposit: number, [us, intl, bonds, cash]: readonly number[]): RebalanceInputsV2 {
  return {
    setupMode: 'multi-shared',
    securities: EXAMPLE_SECURITIES,
    accounts: [
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: brokerageDeposit },
    ],
    holdings: EXAMPLE_HOLDINGS,
    classTargets: [
      { accountId: null, assetClass: 'us-stock', target: us },
      { accountId: null, assetClass: 'intl-stock', target: intl },
      { accountId: null, assetClass: 'bonds', target: bonds },
      { accountId: null, assetClass: 'cash', target: cash },
    ],
    customAssetClasses: [],
    allowTaxableSelling: false,
    showPlacementAdvice: true,
    mode: 'whole',
  };
}

/** The value of the SEVERAL write at `path`. */
const severalValue = (path: string): unknown => SEVERAL.find((write) => write.path === path)?.value;

describe('portfolio bindings: golden against the old mapper output', () => {
  const GOLDEN: [string, FinancialProfile, RebalanceInputsV2][] = [
    ['the 3bb0132 default profile, every field answered', answeredEverywhere(defaultProfileAt3bb0132()), exampleInputs(1000, [0.6, 0.2, 0.2, 0])],
    ['the v1 default', fromV1({}), exampleInputs(1000, [0.6, 0.2, 0.2, 0])],
    [
      'a v1 100/0 mix with a $2,400 Brokerage deposit',
      withBrokerageDeposit(fromV1({ targetMix: '100-0' }), 2400),
      exampleInputs(2400, [0.75, 0.25, 0, 0]),
    ],
    [
      'a v1 60/40 mix with no Brokerage deposit',
      withBrokerageDeposit(fromV1({ targetMix: '60-40' }), 0),
      exampleInputs(0, [0.45, 0.15, 0.4, 0]),
    ],
    [
      'several accounts, holdings and a custom class',
      profileWith(SEVERAL),
      {
        setupMode: 'multi-shared',
        securities: severalValue('portfolio.securities'),
        accounts: severalValue('portfolio.accounts'),
        holdings: severalValue('portfolio.holdings'),
        classTargets: severalValue('portfolio.classTargets'),
        customAssetClasses: severalValue('portfolio.customAssetClasses'),
        allowTaxableSelling: true,
        showPlacementAdvice: false,
        mode: 'fractional',
      } as RebalanceInputsV2,
    ],
  ];

  it.each(GOLDEN)('%s', (_name, profile, expected) => {
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, profile)).toEqual(expected);
  });

  it('passes a negative deposit through unclamped; the engine check reports it on its row', () => {
    const profile = withBrokerageDeposit(fromV1({ targetMix: '60-40' }), -50);
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, profile)).toEqual(exampleInputs(-50, [0.45, 0.15, 0.4, 0]));
    expect(prepareRun(PORTFOLIO_CALCULATOR, profile).errors).toEqual({
      'portfolio.accounts.1.deposit': 'New cash must be at least $0.',
    });
  });

  it('pins the default profile inputs and their rebalance (PR 3 example prices)', () => {
    const inputs = engineInputsFor(PORTFOLIO_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.setupMode).toBe('multi-shared');
    expect(inputs.securities.map((sec) => [sec.ticker, sec.price])).toEqual([
      ['VTI', 375],
      ['VXUS', 85],
      ['BND', 70],
    ]);
    expect(inputs.holdings).toEqual(EXAMPLE_HOLDINGS);
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
    // Roth 10 x 375 + 5 x 70 = 4,100; Brokerage 20 x 375 + 15 x 85 = 8,775.
    const result = PORTFOLIO_CALCULATOR.calculate(inputs);
    expect(result.totalValueBefore).toBe(12875);
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
    expect(prepareRun(PORTFOLIO_CALCULATOR, profile).errors).toEqual({
      'portfolio.classTargets': 'Target allocations must sum to 100% (currently 130.00%).',
    });
  });

  it('shows holding and price errors on the holdings editor, and account rows on their row', () => {
    const base = profileWith(SEVERAL);
    const holdings = base.portfolio.holdings.map((h, i) => (i === 0 ? { ...h, accountId: 'acc-gone' } : h));
    const securities = base.portfolio.securities.map((s, i) => (i === 1 ? { ...s, price: -5 } : s));
    // The engine inputs are built from the profile directly, past the store's own checks.
    const broken: FinancialProfile = { ...base, portfolio: { ...base.portfolio, holdings, securities } };
    expect(prepareRun(PORTFOLIO_CALCULATOR, broken).errors).toEqual({
      'portfolio.holdings': 'Price cannot be negative.',
    });
    const negative: FinancialProfile = {
      ...base,
      portfolio: { ...base.portfolio, accounts: base.portfolio.accounts.map((a, i) => (i === 2 ? { ...a, deposit: -1 } : a)) },
    };
    expect(prepareRun(PORTFOLIO_CALCULATOR, negative).errors).toEqual({
      'portfolio.accounts.2.deposit': 'New cash must be at least $0.',
    });
  });

  it('needs at least one account', () => {
    const none: FinancialProfile = profileWith([{ path: 'portfolio.accounts', value: [] }]);
    expect(prepareRun(PORTFOLIO_CALCULATOR, none).errors).toMatchObject({
      'portfolio.accounts': 'Accounts needs at least 1 entry.',
    });
  });
});
