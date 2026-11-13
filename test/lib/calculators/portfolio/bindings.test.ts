/**
 * Portfolio bindings: the profile feeds RebalanceInputsV2 from the one
 * account list (lib/profile/accounts.ts), every engine input is bound or
 * engine-only, and the engine's checks land on the fields that show them.
 *
 * v3 (contract section 9): the rebalancer receives only the rebalanced
 * accounts (not the emergency fund, not cash, with holdings or new cash),
 * each named by accountDisplayName, typed by its kind's tax treatment, with
 * this run's new cash (the visitor's own figure, else the normal
 * contributions routed to it) as the deposit; only their holdings and the
 * securities those refer to are sent.
 */

import { describe, expect, it } from 'vitest';
import { rebalancePortfolioV2, type RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import {
  PORTFOLIO_BINDINGS,
  PORTFOLIO_ENGINE_ONLY,
  classTargetsFor,
} from '@/lib/calculators/portfolio/bindings';
import {
  NO_REBALANCED_ACCOUNT_MESSAGE,
  PORTFOLIO_CALCULATOR,
  validateRebalanceInputs,
} from '@/lib/calculators/portfolio/definition';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { engineErrorsToFields, isDerivedBinding } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { notRebalancedNote } from '@/lib/profile/accounts';
import { applyProfileWrites, getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { ownerRaw } from '@/test/factories/accountsFixtures';

/** The default profile with these writes, the account list answered. */
const profileWith = (writes: Write[]): FinancialProfile => {
  const profile = applyProfileWrites(getDefaultFinancialProfile(), writes).profile;
  return { ...profile, provided: [...profile.provided, 'portfolio.accounts'] };
};

/** Three accounts, five holdings over four securities, a custom class, custom targets and new cash on each. */
const SEVERAL: Write[] = [
  { path: 'investing.targetMix', value: 'custom' },
  {
    path: 'portfolio.accounts',
    value: [
      { id: 'acc-401k', kind: '401k', name: 'Work 401(k)', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-roth', kind: 'roth-ira', name: '', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-brok', kind: 'brokerage', name: 'Brokerage', balance: 0, holdsEmergencyFund: false },
    ],
  },
  {
    path: 'portfolio.newCash',
    value: [
      { id: 'acc-401k', amount: 750.25 },
      { id: 'acc-roth', amount: 500 },
      { id: 'acc-brok', amount: 2000 },
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

/** The value of the SEVERAL write at `path`. */
const severalValue = (path: string): unknown => SEVERAL.find((write) => write.path === path)?.value;

/** The owner fixture (test/factories/accountsFixtures.ts) as a stored v3 profile. */
const owner = (): FinancialProfile => normalizeProfile(ownerRaw());

describe('portfolio bindings: the engine inputs (contract section 9)', () => {
  it('sends the default its one rebalanced account: the example brokerage, with the taxable 500 as new cash', () => {
    const profile = getDefaultFinancialProfile();
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, profile)).toEqual<RebalanceInputsV2>({
      setupMode: 'multi-shared',
      securities: profile.portfolio.securities,
      accounts: [{ id: 'acc-brok', name: 'Brokerage (taxable)', accountType: 'taxable', deposit: 500 }],
      holdings: [
        { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
        { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
        { id: 'hld-brok-bnd', accountId: 'acc-brok', securityId: 'sec-bnd', shares: 0 },
      ],
      // The 80/20 preset: 60% US, 20% intl, 20% bonds, 0% cash.
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
    });
    expect(profile.portfolio.securities.map((sec) => [sec.ticker, sec.price])).toEqual([
      ['VTI', 375],
      ['VXUS', 85],
      ['BND', 70],
    ]);
    // The 401(k) has a typed balance and no holdings: the page says why it is left out.
    expect(notRebalancedNote(makeGet(profile))).toBe('Not rebalanced: 401(k) or similar (no holdings entered).');
  });

  it('pins the default rebalance (PR 3 example prices, measured on the v3 inputs)', () => {
    const result = PORTFOLIO_CALCULATOR.calculate(engineInputsFor(PORTFOLIO_CALCULATOR, getDefaultFinancialProfile()));
    // Brokerage 20 x 375 + 15 x 85 + 0 x 70 = 8,775.
    expect(result.totalValueBefore).toBe(8775);
    // 1,000 before (the Roth 0 and the Brokerage 1,000 deposits); 500 now.
    expect(result.totalDeposit).toBe(500);
    expect(result.totalSpent).toBe(495);
    expect(result.cashLeftover).toBe(5);
    expect(result.totalDriftBefore).toBeCloseTo(0.5094017094017094, 10);
    expect(result.totalDriftAfter).toBeCloseTo(0.4181229773462784, 10);
  });

  it('sends several accounts with their own new cash, display names and tax treatments', () => {
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, profileWith(SEVERAL))).toEqual<RebalanceInputsV2>({
      setupMode: 'multi-shared',
      securities: severalValue('portfolio.securities') as RebalanceInputsV2['securities'],
      accounts: [
        { id: 'acc-401k', name: 'Work 401(k)', accountType: 'tax-deferred', deposit: 750.25 },
        { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 500 },
        { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 2000 },
      ],
      holdings: severalValue('portfolio.holdings') as RebalanceInputsV2['holdings'],
      classTargets: severalValue('portfolio.classTargets') as RebalanceInputsV2['classTargets'],
      customAssetClasses: [{ id: 'cac-1', label: 'Crypto' }],
      allowTaxableSelling: true,
      showPlacementAdvice: false,
      mode: 'fractional',
    });
  });

  it('sends the owner the Roth IRA and the brokerage only, with their holdings and the securities they hold', () => {
    const inputs = engineInputsFor(PORTFOLIO_CALCULATOR, owner());
    expect(inputs.accounts).toEqual([
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 625 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 400 },
    ]);
    expect(inputs.holdings).toEqual([
      { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 20 },
      { id: 'hld-roth-vxus', accountId: 'acc-roth', securityId: 'sec-vxus', shares: 30 },
      { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 10 },
    ]);
    // BOXX is held only by the emergency-fund brokerage, BND by nobody.
    expect(inputs.securities.map((sec) => sec.ticker)).toEqual(['VTI', 'VXUS']);
  });

  it("sends the visitor's own new cash in place of the normal contributions", () => {
    const base = owner();
    const custom: FinancialProfile = {
      ...base,
      portfolio: { ...base.portfolio, newCash: [{ id: 'acc-roth', amount: 7500 }] },
    };
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, custom).accounts.map((a) => [a.id, a.deposit])).toEqual([
      ['acc-roth', 7500],
      ['acc-brok', 400],
    ]);
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
      ['customAssetClasses', 'portfolio.customAssetClasses'],
      ['allowTaxableSelling', 'assumptions.portfolio.allowTaxableSelling'],
      ['showPlacementAdvice', 'assumptions.portfolio.showPlacementAdvice'],
      ['mode', 'assumptions.portfolio.mode'],
    ]);
    const derived = PORTFOLIO_BINDINGS.filter(isDerivedBinding).map((b) => [b.engine, b.errorPath]);
    expect(derived).toEqual([
      ['securities', 'portfolio.holdings'],
      ['accounts', 'portfolio.newCash'],
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

  it('shows holding and price errors on the holdings editor', () => {
    const base = profileWith(SEVERAL);
    const securities = base.portfolio.securities.map((sec, i) => (i === 1 ? { ...sec, price: -5 } : sec));
    // The engine inputs are built from the profile directly, past the store's own checks.
    const broken: FinancialProfile = { ...base, portfolio: { ...base.portfolio, securities } };
    expect(prepareRun(PORTFOLIO_CALCULATOR, broken).errors).toEqual({
      'portfolio.holdings': 'Price cannot be negative.',
    });
  });

  it('shows an account check (a negative deposit) on the new cash card', () => {
    const inputs = engineInputsFor(PORTFOLIO_CALCULATOR, profileWith(SEVERAL));
    const errors = validateRebalanceInputs({
      ...inputs,
      accounts: inputs.accounts.map((a, i) => (i === 0 ? { ...a, deposit: -1 } : a)),
    });
    expect(Object.keys(errors)).toEqual(['accounts[0].deposit']);
    expect(engineErrorsToFields(PORTFOLIO_BINDINGS, errors)).toEqual({ 'portfolio.newCash': errors['accounts[0].deposit'] });
  });

  it('says what to add when no account is rebalanced', () => {
    // Typed balances only: nothing has holdings, and a typed balance is no candidate.
    const typed = profileWith([
      {
        path: 'portfolio.accounts',
        value: [{ id: 'acc-401k', kind: '401k', name: '', balance: 5000, holdsEmergencyFund: false }],
      },
      { path: 'portfolio.holdings', value: [] },
    ]);
    expect(engineInputsFor(PORTFOLIO_CALCULATOR, typed).accounts).toEqual([]);
    expect(prepareRun(PORTFOLIO_CALCULATOR, typed).errors).toEqual({ calculation: NO_REBALANCED_ACCOUNT_MESSAGE });
    expect(NO_REBALANCED_ACCOUNT_MESSAGE).toBe('Add holdings to an account, or new cash to an empty one, to rebalance.');
    const none = profileWith([{ path: 'portfolio.accounts', value: [] }]);
    expect(prepareRun(PORTFOLIO_CALCULATOR, none).errors).toEqual({ calculation: NO_REBALANCED_ACCOUNT_MESSAGE });
  });
});
