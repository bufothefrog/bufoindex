/**
 * The paycheck bindings and definition: the golden test against the old
 * mapper's output for v1-shaped profiles, the 401(k) truth table, every
 * PaycheckProfile leaf bound or engine-only, the computed federal bracket,
 * the nearest-bracket read of the retirement bracket, the identical figures
 * of a 22% profile against the 3bb0132 bindings, and the form relations.
 *
 * Golden fixture. The expected engine profiles were captured on 2026-11-12
 * from the former lib/profile/mappers.ts (deleted in phase 5): what its
 * toPaycheckProfile returned for each profile, metadata excluded, written as
 * the leaves that differ from its output for the v1 default (DEFAULT_ENGINE).
 * Non-integer figures are compared to 9 decimals. One captured leaf changed
 * on purpose in PR 3 (slice c4): taxes.federalBracket was a fixed 22% and is
 * now the bracket of the profile's taxable pay, which for the custom profile
 * is 12% (see that case). One leaf is new in PR 5 and not from the old
 * mapper: preferences.investedBalance (the invested total of the account
 * list, emergency fund left out), measured with the binding in place.
 */

import { describe, expect, it } from 'vitest';
import { getDefaultProfile } from '@/lib/calculations/core';
import {
  PAYCHECK_BINDINGS,
  PAYCHECK_ENGINE_ONLY,
  RETIREMENT_BRACKET_PATH,
  currentBracketFrom,
  split401k,
} from '@/lib/calculators/paycheck/bindings';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_FORM } from '@/lib/calculators/paycheck/form';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { type Binding, isDerivedBinding, toEngineInputs } from '@/lib/fields/binding';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { applyProfileWrites, getDefaultFinancialProfile, isProfilePath, normalizeProfile } from '@/lib/profile/defaults';
import { withDerivedValues } from '@/lib/profile/derived';
import type { ContributionType, FinancialProfile, ProfilePatch } from '@/lib/profile/types';
import type { PaycheckProfile } from '@/lib/types';
import { ownerRaw } from '@/test/factories/accountsFixtures';
import { answeredAt3bb0132, answeredEverywhere, defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';

/**
 * A v1-shaped profile: the given sections over the 3bb0132 defaults the
 * fixture was captured on, normalized the way any stored profile is, every
 * field answered (test/factories/profile-3bb0132.ts).
 */
const v1 = (patch: ProfilePatch = {}): FinancialProfile => answeredAt3bb0132(patch);

/** The 3bb0132 default profile, all answered, with `writes` applied; each must be a valid profile write, or the test fails. */
function withWrites(writes: Write[]): FinancialProfile {
  const { profile, accepted } = applyProfileWrites(answeredEverywhere(defaultProfileAt3bb0132()), writes);
  expect(accepted).toEqual(writes.map((write) => write.path));
  return profile;
}

/** The engine profile without its metadata, which the old mapper stamped from the profile. */
function withoutMetadata(engine: PaycheckProfile): Omit<PaycheckProfile, 'version' | 'lastUpdated' | 'source'> {
  const { income, taxes, benefits, debts, preferences } = engine;
  return { income, taxes, benefits, debts, preferences };
}

/** Every PaycheckProfile leaf (the debts list counts as one), written out. */
const LEAVES: readonly string[] = [
  'income.grossPaycheck',
  'income.netPaycheck',
  'income.frequency',
  'income.regularBonus',
  'income.bonusAmount',
  'income.bonusFrequency',
  'income.monthlyGross',
  'income.monthlyNet',
  'income.gross',
  'income.net',
  'income.bonusExpected',
  'taxes.federalBracket',
  'taxes.state',
  'taxes.filingStatus',
  'taxes.currentWithholding.federal',
  'taxes.currentWithholding.state',
  'taxes.currentWithholding.fica',
  'benefits.employer401k.available',
  'benefits.employer401k.matchPercent',
  'benefits.employer401k.matchLimit',
  'benefits.employer401k.currentContribution',
  'benefits.employer401k.contributionType',
  'benefits.employer401k.traditionalContribution',
  'benefits.employer401k.rothContribution',
  'benefits.employer401k.afterTaxAvailable',
  'benefits.employer401k.currentYTD',
  'benefits.hsa.eligible',
  'benefits.hsa.employerContribution',
  'benefits.hsa.currentContribution',
  'benefits.hsa.currentYTD',
  'benefits.hsa.coverageType',
  'benefits.hsa.investmentStrategy',
  'benefits.ira.hasIRA',
  'benefits.ira.accountTypes.traditional',
  'benefits.ira.accountTypes.roth',
  'benefits.ira.currentContributions.traditional',
  'benefits.ira.currentContributions.roth',
  'benefits.ira.currentBalances.traditional',
  'benefits.ira.currentBalances.roth',
  'benefits.other.fsaElection',
  'benefits.other.transitBenefits',
  'benefits.other.lifeInsurance',
  'debts',
  'preferences.emergencyFundMonths',
  'preferences.currentEmergencyFund',
  'preferences.emergencyFundAPY',
  'preferences.necessaryExpenses',
  'preferences.funMoney.min',
  'preferences.funMoney.max',
  'preferences.funMoney.current',
  'preferences.age',
  'preferences.hasTaxableAccount',
  'preferences.taxableAccountContribution',
  'preferences.investedBalance',
  'preferences.isPeakEarnings',
  'preferences.expectedRetirementBracket',
  'preferences.riskTolerance',
  'preferences.optimizationGoal',
  'version',
  'lastUpdated',
  'source',
];

/** The leaf paths of a plain object; arrays are leaves. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

const CUSTOM_V1: ProfilePatch = {
  person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
  income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
  spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
  investing: { monthlyContribution: 2200, taxableMonthlyContribution: 900 },
};

/** A non-integer figure of the captured output, compared to 9 decimals. */
const near = (value: number) => expect.closeTo(value, 9);

/** The old mapper's output for the v1 default, metadata excluded. */
const DEFAULT_ENGINE = {
  income: {
    grossPaycheck: 3500,
    netPaycheck: 2600,
    frequency: 'bi-weekly',
    regularBonus: false,
    bonusAmount: 0,
    bonusFrequency: 'annual',
    monthlyGross: near(7583.333333333333),
    monthlyNet: near(5633.333333333333),
    gross: near(7583.333333333333),
    net: near(5633.333333333333),
    bonusExpected: 0,
  },
  taxes: {
    federalBracket: 0.22,
    state: 'TX',
    filingStatus: 'single',
    currentWithholding: { federal: 800, state: 200, fica: 382 },
  },
  benefits: {
    employer401k: {
      available: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      currentContribution: 0.06,
      contributionType: 'traditional',
      traditionalContribution: 0.06,
      rothContribution: 0,
      afterTaxAvailable: false,
      currentYTD: 0,
    },
    hsa: {
      eligible: false,
      employerContribution: 0,
      currentContribution: 0,
      currentYTD: 0,
      coverageType: 'individual',
      investmentStrategy: false,
    },
    ira: {
      hasIRA: false,
      accountTypes: { traditional: false, roth: false },
      currentContributions: { traditional: 0, roth: 0 },
      currentBalances: { traditional: 0, roth: 0 },
    },
    other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
  },
  debts: [],
  preferences: {
    emergencyFundMonths: 3,
    currentEmergencyFund: 5000,
    emergencyFundAPY: 0.04,
    necessaryExpenses: 3000,
    funMoney: { min: 300, max: 600, current: 450 },
    age: 30,
    hasTaxableAccount: true,
    taxableAccountContribution: 500,
    // New in PR 5 (not from the old mapper): the example accounts' invested total.
    investedBalance: 25000,
    isPeakEarnings: false,
    expectedRetirementBracket: 0.12,
    riskTolerance: 'moderate',
    optimizationGoal: 'balanced',
  },
};

/** The captured default output with the given engine leaves changed. */
const engineWith = (changed: Record<string, unknown>) =>
  applyWrites(
    DEFAULT_ENGINE,
    Object.entries(changed).map(([path, value]) => ({ path, value }))
  );

describe('golden: engineInputsFor equals the old mapper output for v1-shaped profiles, metadata excluded', () => {
  it.each<[string, ProfilePatch, Record<string, unknown>]>([
    ['the default', {}, {}],
    [
      'a custom profile (weekly pay, joint filing)',
      CUSTOM_V1,
      {
        'income.grossPaycheck': 2100,
        'income.netPaycheck': 1550,
        'income.frequency': 'weekly',
        'income.monthlyGross': 9100,
        'income.monthlyNet': near(6716.666666666666),
        'income.gross': 9100,
        'income.net': near(6716.666666666666),
        // PR 3, slice c4: weekly 2,100 x 52 = 109,200 - 6,552 (6% traditional)
        // - 32,200 joint standard deduction = 70,448: the 12% joint bracket
        // (the old mapper's fixed 22% before).
        'taxes.federalBracket': 0.12,
        'taxes.state': 'CA',
        'taxes.filingStatus': 'marriedJoint',
        'preferences.necessaryExpenses': 4200,
        'preferences.funMoney.min': 250,
        'preferences.funMoney.max': 900,
        'preferences.funMoney.current': 575,
        'preferences.age': 38,
        'preferences.taxableAccountContribution': 900,
      },
    ],
    [
      'bi-weekly pay',
      { income: { frequency: 'bi-weekly', grossPerPaycheck: 3100, netPerPaycheck: 2300 } },
      {
        'income.grossPaycheck': 3100,
        'income.netPaycheck': 2300,
        'income.monthlyGross': near(6716.666666666666),
        'income.monthlyNet': near(4983.333333333333),
        'income.gross': near(6716.666666666666),
        'income.net': near(4983.333333333333),
      },
    ],
    [
      'semi-monthly pay',
      { income: { frequency: 'semi-monthly', grossPerPaycheck: 4000, netPerPaycheck: 3000 } },
      {
        'income.grossPaycheck': 4000,
        'income.netPaycheck': 3000,
        'income.frequency': 'semi-monthly',
        'income.monthlyGross': 8000,
        'income.monthlyNet': 6000,
        'income.gross': 8000,
        'income.net': 6000,
      },
    ],
    [
      'monthly pay, no taxable investing',
      { income: { frequency: 'monthly', grossPerPaycheck: 8000 }, investing: { taxableMonthlyContribution: 0 } },
      {
        'income.grossPaycheck': 8000,
        'income.frequency': 'monthly',
        'income.monthlyGross': 8000,
        'income.monthlyNet': 2600,
        'income.gross': 8000,
        'income.net': 2600,
        'preferences.hasTaxableAccount': false,
        'preferences.taxableAccountContribution': 0,
      },
    ],
  ])('%s', (_name, patch, changed) => {
    expect(withoutMetadata(engineInputsFor(PAYCHECK_CALCULATOR, v1(patch)))).toEqual(engineWith(changed));
  });

  it('matches the old mapper output on the v2 leaves too: bonus, plan, HSA, IRAs, debts and assumptions', () => {
    const debts = [{ id: 'd1', name: 'Card', balance: 3000, interestRate: 0.22, minimumPayment: 90, extraPayment: 50, taxDeductible: false }];
    const profile = withWrites([
      { path: 'income.hasBonus', value: true },
      { path: 'income.bonusAmount', value: 6000 },
      { path: 'income.bonusFrequency', value: 'quarterly' },
      { path: 'cash.targetMonths', value: 6 },
      { path: 'cash.emergencyFundBalance', value: 12000 },
      { path: 'workplace.contributionType', value: 'split' },
      { path: 'workplace.contributionPercent', value: 0.1 },
      { path: 'workplace.rothContributionPercent', value: 0.04 },
      { path: 'workplace.afterTaxAvailable', value: true },
      { path: 'hsa.eligible', value: true },
      { path: 'hsa.coverage', value: 'family' },
      { path: 'hsa.monthlyContribution', value: 300 },
      { path: 'hsa.investing', value: true },
      { path: 'ira.roth', value: true },
      { path: 'ira.rothMonthly', value: 500 },
      // The Roth IRA balance lives on its account row in profile v3.
      {
        path: 'portfolio.accounts',
        value: [
          ...defaultProfileAt3bb0132().portfolio.accounts,
          { id: 'acc-roth-ira', kind: 'roth-ira', name: '', balance: 20000, holdsEmergencyFund: false },
        ],
      },
      { path: 'debts', value: debts },
      { path: 'assumptions.paycheck.riskTolerance', value: 'optimizer' },
      { path: 'assumptions.paycheck.optimizationGoal', value: 'wealth_maximization' },
      { path: 'assumptions.paycheck.expectedRetirementBracket', value: 0.22 },
    ]);
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, profile);
    expect(withoutMetadata(inputs)).toEqual(
      engineWith({
        'income.regularBonus': true,
        'income.bonusAmount': 6000,
        'income.bonusFrequency': 'quarterly',
        'income.bonusExpected': 2000,
        'benefits.employer401k.currentContribution': 0.1,
        'benefits.employer401k.contributionType': 'split',
        'benefits.employer401k.traditionalContribution': near(0.06),
        'benefits.employer401k.rothContribution': 0.04,
        'benefits.employer401k.afterTaxAvailable': true,
        'benefits.hsa.eligible': true,
        'benefits.hsa.currentContribution': 300,
        'benefits.hsa.coverageType': 'family',
        'benefits.hsa.investmentStrategy': true,
        'benefits.ira.hasIRA': true,
        'benefits.ira.accountTypes.roth': true,
        'benefits.ira.currentContributions.roth': 500,
        'benefits.ira.currentBalances.roth': 20000,
        debts,
        'preferences.emergencyFundMonths': 6,
        'preferences.currentEmergencyFund': 12000,
        // 25,000 example accounts + the 20,000 Roth IRA row (new in PR 5).
        'preferences.investedBalance': 45000,
        'preferences.expectedRetirementBracket': 0.22,
        'preferences.riskTolerance': 'optimizer',
        'preferences.optimizationGoal': 'wealth_maximization',
      })
    );
    // 10% total, 4% of it Roth: 6% traditional (to float precision).
    expect(inputs.benefits.employer401k.traditionalContribution).toBeCloseTo(0.06, 10);
    expect(inputs.benefits.employer401k.rothContribution).toBe(0.04);
    expect(inputs.benefits.ira.hasIRA).toBe(true);
    expect(inputs.debts).toEqual(profile.debts);
  });

  it('pins the default profile value by value where the profile sets it (the PR 3 worked example)', () => {
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.income).toMatchObject({ grossPaycheck: 4000, netPaycheck: 2550, frequency: 'bi-weekly', regularBonus: false });
    expect(inputs.taxes).toMatchObject({ federalBracket: 0.22, state: 'CA', filingStatus: 'single' });
    expect(inputs.benefits.employer401k).toMatchObject({
      available: true,
      matchPercent: 1,
      matchLimit: 0.04,
      contributionType: 'traditional',
      currentContribution: 0.08,
      traditionalContribution: 0.08,
      rothContribution: 0,
    });
    expect(inputs.benefits.hsa.coverageType).toBe('individual');
    expect(inputs.preferences).toMatchObject({
      emergencyFundMonths: 3,
      // Derived while unanswered: 3 x 3,000 of must-pay costs.
      currentEmergencyFund: 9000,
      emergencyFundAPY: 0.04,
      necessaryExpenses: 3000,
      funMoney: { min: 300, max: 600, current: 450 },
      age: 25,
      hasTaxableAccount: true,
      taxableAccountContribution: 500,
      // PR 5: 401(k) 16,225 + brokerage 8,775 (the example accounts).
      investedBalance: 25000,
    });
    expect({ version: inputs.version, lastUpdated: inputs.lastUpdated, source: inputs.source }).toEqual({
      version: '1.0',
      lastUpdated: 0,
      source: 'user_input',
    });
  });

  it('gives equal inputs for equal profiles (the engine base is fixed)', () => {
    const profile = getDefaultFinancialProfile();
    expect(engineInputsFor(PAYCHECK_CALCULATOR, profile)).toEqual(engineInputsFor(PAYCHECK_CALCULATOR, profile));
    expect(PAYCHECK_CALCULATOR.engineBase()).toBe(PAYCHECK_CALCULATOR.engineBase());
  });
});

describe('the 401(k) truth table', () => {
  it.each<[ContributionType, number, number, number, number]>([
    ['traditional', 0.08, 0, 0.08, 0],
    ['traditional', 0.08, 0.05, 0.08, 0],
    ['roth', 0.08, 0, 0, 0.08],
    ['roth', 0.08, 0.03, 0, 0.08],
    ['split', 0.08, 0.03, 0.05, 0.03],
    ['split', 0.08, 0.08, 0, 0.08],
    ['split', 0.08, 0.12, 0, 0.08],
    ['split', 0.08, 0, 0.08, 0],
    ['split', 0, 0.05, 0, 0],
  ])('%s with %d total and %d Roth part: %d traditional, %d Roth', (type, total, rothPart, traditional, roth) => {
    const election = split401k(type, total, rothPart);
    expect(election.traditional).toBeCloseTo(traditional, 10);
    expect(election.roth).toBeCloseTo(roth, 10);
    const profile = withWrites([
      { path: 'workplace.contributionType', value: type },
      { path: 'workplace.contributionPercent', value: total },
      { path: 'workplace.rothContributionPercent', value: rothPart },
    ]);
    const plan = engineInputsFor(PAYCHECK_CALCULATOR, profile).benefits.employer401k;
    expect(plan.traditionalContribution).toBeCloseTo(traditional, 10);
    expect(plan.rothContribution).toBeCloseTo(roth, 10);
    expect(plan.currentContribution).toBe(total);
    expect(plan.contributionType).toBe(type);
  });
});

describe('every PaycheckProfile leaf is bound or engine-only', () => {
  const exact = new Map(PAYCHECK_BINDINGS.map((binding) => [binding.engine as string, binding]));

  it('lists every leaf of the engine profile', () => {
    expect(leafPaths(getDefaultProfile()).sort()).toEqual([...LEAVES].sort());
  });

  it('binds each leaf by its own engine path, or names it engine-only with a reason', () => {
    for (const leaf of LEAVES) {
      const bound = exact.has(leaf);
      const engineOnly = leaf in PAYCHECK_ENGINE_ONLY;
      expect(bound || engineOnly, leaf).toBe(true);
      // A leaf that is both is a derived one, never a 1:1 read.
      if (bound && engineOnly) expect(isDerivedBinding(exact.get(leaf)!), leaf).toBe(true);
    }
    for (const [leaf, reason] of Object.entries(PAYCHECK_ENGINE_ONLY)) {
      expect(LEAVES, leaf).toContain(leaf);
      expect(reason.length, leaf).toBeGreaterThan(0);
    }
  });

  it('binds no leaf twice, apart from the income figures the income binding derives', () => {
    const engines = PAYCHECK_BINDINGS.map((binding) => binding.engine as string);
    expect(new Set(engines).size).toBe(engines.length);
    const prefixes = engines.filter((engine) => !LEAVES.includes(engine));
    expect(prefixes).toEqual(['income']);
  });

  it('reads every 1:1 leaf from a real profile path the form asks', () => {
    const asked = new Set(PAYCHECK_FORM.fields.map((spec) => spec.path));
    for (const binding of PAYCHECK_BINDINGS) {
      if (isDerivedBinding(binding)) continue;
      expect(isProfilePath(binding.profile), binding.profile).toBe(true);
      expect(asked.has(binding.profile), binding.profile).toBe(true);
    }
  });
});

describe('the computed federal bracket', () => {
  /** The 3bb0132 default (TX, single, 6% traditional), all answered, with pay and the given writes. */
  const bracketOf = (gross: number, writes: Write[] = []) =>
    engineInputsFor(
      PAYCHECK_CALCULATOR,
      withWrites([
        { path: 'income.grossPerPaycheck', value: gross },
        { path: 'income.netPerPaycheck', value: gross * 0.7 },
        ...writes,
      ])
    ).taxes.federalBracket;

  it.each<[string, number, Write[], number]>([
    // 800 x 26 = 20,800 - 1,248 - 16,100 = 3,452: 10%.
    ['a low income', 800, [], 0.1],
    // 2,500 x 26 = 65,000 - 3,900 - 16,100 = 45,000: 12%.
    ['a 12% income', 2500, [], 0.12],
    // 3,500 x 26 = 91,000 - 5,460 - 16,100 = 69,440: 22%.
    ['the 3bb0132 default income', 3500, [], 0.22],
    // 6,000 x 26 = 156,000 - 9,360 - 16,100 = 130,540: 24%.
    ['a 24% income', 6000, [], 0.24],
    // 9,500 x 26 = 247,000 - 14,820 - 16,100 = 216,080: 32%.
    ['a 32% income', 9500, [], 0.32],
    // 25,000 x 26 = 650,000 - 39,000 - 16,100 = 594,900: 35%.
    ['a high income', 25000, [], 0.35],
    // No plan: 2,600 x 26 = 67,600 - 16,100 = 51,500: 22% (with the 6% it would be 47,444: 12%).
    ['no 401(k)', 2600, [{ path: 'workplace.has401k', value: false }], 0.22],
    ['a 6% traditional 401(k)', 2600, [], 0.12],
    // Roth: nothing pre-tax, 51,500: 22%.
    ['a Roth 401(k)', 2600, [{ path: 'workplace.contributionType', value: 'roth' }], 0.22],
    // HSA 150 a month: 67,600 - 4,056 - 1,800 - 16,100 = 45,644: 12%.
    ['HSA payroll contributions', 2650, [{ path: 'hsa.eligible', value: true }, { path: 'hsa.monthlyContribution', value: 150 }], 0.12],
    // A quarterly 3,000 bonus: 65,000 + 12,000 - 3,900 - 16,100 = 57,000: 22%.
    ['a regular bonus', 2500, [{ path: 'income.hasBonus', value: true }, { path: 'income.bonusAmount', value: 3000 }, { path: 'income.bonusFrequency', value: 'quarterly' }], 0.22],
    // Joint: 6,000 x 26 = 156,000 - 9,360 - 32,200 = 114,440: 22%.
    ['joint filing', 6000, [{ path: 'person.filingStatus', value: 'marriedJoint' }], 0.22],
    // Head of household: 2,900 x 26 = 75,400 - 4,524 - 24,150 = 46,726: 12%.
    ['head of household', 2900, [{ path: 'person.filingStatus', value: 'headOfHousehold' }], 0.12],
  ])('%s', (_name, gross, writes, bracket) => {
    expect(bracketOf(gross, writes)).toBe(bracket);
  });

  it('does not count HSA contributions when the HSA is off', () => {
    // 2,800 x 26 = 72,800 - 4,368 - 16,100 = 52,332: 22%; with 200 a month (2,400) 49,932: 12%.
    const hsa = (eligible: boolean): Write[] => [
      { path: 'hsa.eligible', value: eligible },
      { path: 'hsa.monthlyContribution', value: 200 },
    ];
    expect(bracketOf(2800, hsa(true))).toBe(0.12);
    expect(bracketOf(2800, hsa(false))).toBe(0.22);
  });

  it('caps the traditional 401(k) deduction at the 2026 deferral limit for the age', () => {
    const election: Write[] = [{ path: 'workplace.contributionPercent', value: 0.3 }];
    // 9,500 x 26 = 247,000; 30% is 74,100, capped at 24,500: 247,000 - 24,500 - 16,100 = 206,400: 32%
    // (uncapped, 156,800 would read 24%).
    expect(bracketOf(9500, election)).toBe(0.32);
    // At 55 the limit is 24,500 + 8,000: 247,000 - 32,500 - 16,100 = 198,400: 24%.
    expect(bracketOf(9500, [...election, { path: 'person.age', value: 55 }])).toBe(0.24);
  });

  it('caps a split election as a whole before taking its traditional share', () => {
    // The reviewer's probe, which sits on the two sides of the single 24% / 32% edge (201,775):
    // single, age 30, 9,100 every two weeks: 9,100 x 26 = 236,600 of pay.
    // 30% elected, 15% of it Roth: 70,980 elected, capped at the 24,500 limit (traditional and
    // Roth together); traditional share 15 / 30 = 0.5 of it: 12,250 pre-tax.
    // 236,600 - 12,250 - 16,100 = 208,250: 32%.
    // (Capping the traditional 15% alone, 35,490 to 24,500, gives 236,600 - 24,500 - 16,100 = 196,000: 24%.)
    const split: Write[] = [
      { path: 'workplace.contributionType', value: 'split' },
      { path: 'workplace.contributionPercent', value: 0.3 },
      { path: 'workplace.rothContributionPercent', value: 0.15 },
    ];
    expect(bracketOf(9100, split)).toBe(0.32);
    // All traditional, the same 30%: 24,500 pre-tax, 196,000: 24%.
    expect(bracketOf(9100, [...split, { path: 'workplace.contributionType', value: 'traditional' }])).toBe(0.24);
    // All Roth: nothing pre-tax, 236,600 - 16,100 = 220,500: 32%.
    expect(bracketOf(9100, [...split, { path: 'workplace.contributionType', value: 'roth' }])).toBe(0.32);
  });

  it('caps the HSA deduction at the coverage limit less the employer money', () => {
    const hsa = (employer: number): Write[] => [
      { path: 'hsa.eligible', value: true },
      { path: 'hsa.coverage', value: 'individual' },
      { path: 'hsa.monthlyContribution', value: 1000 },
      { path: 'hsa.employerAnnualContribution', value: employer },
    ];
    // 3,000 x 26 = 78,000 - 4,680 - 16,100 = 57,220; 12,000 a year capped at 4,400: 52,820: 22%
    // (uncapped, 45,220 would read 12%).
    expect(bracketOf(3000, hsa(0))).toBe(0.22);
    // 2,880 x 26 = 74,880 - 4,492.80 - 16,100 = 54,287.20. Room 4,400: 49,887.20: 12%.
    expect(bracketOf(2880, hsa(0))).toBe(0.12);
    // An employer 1,000 leaves 3,400 of room: 50,887.20: 22%.
    expect(bracketOf(2880, hsa(1000))).toBe(0.22);
  });

  it('matches the helper the note and the help read', () => {
    const profile = withWrites([{ path: 'income.grossPerPaycheck', value: 6000 }]);
    expect(currentBracketFrom(makeGet(profile))).toBe(engineInputsFor(PAYCHECK_CALCULATOR, profile).taxes.federalBracket);
  });
});

describe('the retirement bracket read', () => {
  const readOf = (stored: number) =>
    engineInputsFor(PAYCHECK_CALCULATOR, withWrites([{ path: RETIREMENT_BRACKET_PATH, value: stored }])).preferences
      .expectedRetirementBracket;

  it('passes each of the seven rates through and reads any other stored value as the nearest rate', () => {
    for (const rate of [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]) expect(readOf(rate)).toBe(rate);
    expect(readOf(0.15)).toBe(0.12);
    expect(readOf(0.2)).toBe(0.22);
    expect(readOf(0.17)).toBe(0.12);
    // 0 was read by the engine as 80% of the current bracket (17.6%); it is now the 10% bracket.
    expect(readOf(0)).toBe(0.1);
  });

  it('does not rewrite the stored value', () => {
    const profile = withWrites([{ path: RETIREMENT_BRACKET_PATH, value: 0.15 }]);
    engineInputsFor(PAYCHECK_CALCULATOR, profile);
    expect(profile.assumptions.paycheck.expectedRetirementBracket).toBe(0.15);
  });

  it('uses the typical bracket of the target retirement income while unanswered', () => {
    // The worked example: 41,000 - 16,100 = 24,900: 12%.
    expect(engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile()).preferences.expectedRetirementBracket).toBe(0.12);
    // A target of 150,000 answered, single: 133,900: 24%.
    const p = getDefaultFinancialProfile();
    const answered = { ...applyWrites(p, [{ path: 'spending.targetRetirementIncome', value: 150000 }]), provided: ['spending.targetRetirementIncome'] };
    expect(engineInputsFor(PAYCHECK_CALCULATOR, answered).preferences.expectedRetirementBracket).toBe(0.24);
  });
});

/**
 * The bindings as they were at 3bb0132: the federal bracket kept the engine
 * base's fixed 22% and the retirement bracket was read 1:1.
 */
const BINDINGS_AT_3BB0132: readonly Binding<PaycheckProfile>[] = [
  ...PAYCHECK_BINDINGS.filter(
    (binding) => binding.engine !== 'taxes.federalBracket' && binding.engine !== 'preferences.expectedRetirementBracket'
  ),
  { profile: RETIREMENT_BRACKET_PATH, engine: 'preferences.expectedRetirementBracket' },
];

describe('a 22% profile with a stored bracket rate gives the figures of 3bb0132', () => {
  const PROFILES_AT_22: readonly [string, FinancialProfile][] = [
    ['the 3bb0132 default, all answered', answeredEverywhere(defaultProfileAt3bb0132())],
    ['the PR 3 worked example, all answered', answeredEverywhere(getDefaultFinancialProfile())],
    [
      'joint, 6,000 every two weeks, HSA and debts',
      withWrites([
        { path: 'person.filingStatus', value: 'marriedJoint' },
        { path: 'income.grossPerPaycheck', value: 6000 },
        { path: 'income.netPerPaycheck', value: 4300 },
        { path: 'hsa.eligible', value: true },
        { path: 'hsa.monthlyContribution', value: 300 },
        {
          path: 'debts',
          value: [{ id: 'd1', name: 'Card', balance: 4000, interestRate: 0.24, minimumPayment: 120, extraPayment: 0, taxDeductible: false }],
        },
      ]),
    ],
  ];

  it.each(PROFILES_AT_22)('%s, for each of the seven stored rates', (_name, base) => {
    for (const rate of [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]) {
      const profile = applyWrites(base, [{ path: RETIREMENT_BRACKET_PATH, value: rate }]);
      const now = engineInputsFor(PAYCHECK_CALCULATOR, profile);
      expect(now.taxes.federalBracket).toBe(0.22);
      const then = toEngineInputs(BINDINGS_AT_3BB0132, PAYCHECK_CALCULATOR.engineBase(), makeGet(withDerivedValues(profile)));
      expect(now).toEqual(then);
      expect(PAYCHECK_CALCULATOR.calculate(now)).toEqual(PAYCHECK_CALCULATOR.calculate(then));
    }
  });
});

describe('the definition and its relations', () => {
  it('runs debounced by 150 ms, with no engine checks', () => {
    expect(PAYCHECK_CALCULATOR.id).toBe('paycheck');
    expect(PAYCHECK_CALCULATOR.debounceMs).toBe(150);
    expect(PAYCHECK_CALCULATOR.form).toBe(PAYCHECK_FORM);
    expect(PAYCHECK_CALCULATOR.bindings).toBe(PAYCHECK_BINDINGS);
    expect(PAYCHECK_CALCULATOR.validate(engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile()))).toEqual({});
  });

  it('flags take-home pay above gross pay', () => {
    const profile = withWrites([
      { path: 'income.grossPerPaycheck', value: 2000 },
      { path: 'income.netPerPaycheck', value: 2600 },
    ]);
    expect(prepareRun(PAYCHECK_CALCULATOR, profile).errors).toEqual({
      'income.netPerPaycheck':
        'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
    });
    expect(prepareRun(PAYCHECK_CALCULATOR, withWrites([{ path: 'income.netPerPaycheck', value: 3500 }])).errors).toEqual({});
  });

  it('flags a fun-money minimum above the maximum', () => {
    const profile = withWrites([
      { path: 'spending.funMoneyMin', value: 700 },
      { path: 'spending.funMoneyMax', value: 600 },
    ]);
    expect(prepareRun(PAYCHECK_CALCULATOR, profile).errors).toEqual({
      'spending.funMoneyMax': 'The minimum is above the maximum. Adjust one of them.',
    });
    expect(prepareRun(PAYCHECK_CALCULATOR, getDefaultFinancialProfile()).errors).toEqual({});
  });
});

describe('profile v3: the account list feeds the emergency fund and the IRA balances', () => {
  it('reads the default: the derived 9,000 fund and no IRA rows', () => {
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.preferences.currentEmergencyFund).toBe(9000);
    expect(inputs.benefits.ira.currentBalances).toEqual({ traditional: 0, roth: 0 });
    // The invested total: 401(k) 16,225 + brokerage 8,775.
    expect(inputs.preferences.investedBalance).toBe(25000);
  });

  it('reads the owner fixture: the ticked Robinhood account is the fund, the Roth IRA holdings the Roth balance', () => {
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, normalizeProfile(ownerRaw()));
    // BOXX 90 x 115 = 10,350 (the typed 10,000 gives way to the account).
    expect(inputs.preferences.currentEmergencyFund).toBe(10350);
    // VTI 20 x 375 + VXUS 30 x 85 = 10,050.
    expect(inputs.benefits.ira.currentBalances).toEqual({ traditional: 0, roth: 10050 });
    // Every invested account, the emergency fund left out:
    // 401(k) 80,000 + HSA 12,000 + Roth IRA 10,050 + brokerage 3,750 = 105,800.
    expect(inputs.preferences.investedBalance).toBeCloseTo(105800, 6);
  });
});
