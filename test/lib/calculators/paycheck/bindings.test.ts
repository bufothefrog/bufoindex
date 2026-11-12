/**
 * The paycheck bindings and definition: the golden test against the old
 * mapper's output for v1-shaped profiles, the 401(k) truth table, every
 * PaycheckProfile leaf bound or engine-only, the fixed federal bracket, the
 * form relations, and the reverse direction the legacy import uses.
 *
 * Golden fixture. The expected engine profiles are what the old mapper
 * (toPaycheckProfile in lib/profile/mappers.ts) returned for each profile,
 * metadata excluded, captured on 2026-11-12 before slice x1 deleted it,
 * written as the leaves that differ from its output for the v1 default
 * (DEFAULT_ENGINE). Non-integer figures are compared to 9 decimals.
 */

import { describe, expect, it } from 'vitest';
import { getDefaultProfile } from '@/lib/calculations/core';
import { PAYCHECK_BINDINGS, PAYCHECK_ENGINE_ONLY, split401k } from '@/lib/calculators/paycheck/bindings';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_FORM } from '@/lib/calculators/paycheck/form';
import { LEGACY_IMPORTS } from '@/lib/calculators/legacyImports';
import { PAYCHECK_LEGACY } from '@/lib/calculators/paycheck/legacy';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { fromEngineInputs, isDerivedBinding } from '@/lib/fields/binding';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { applyProfileWrites, getDefaultFinancialProfile, isProfilePath } from '@/lib/profile/defaults';
import { migrateProfile } from '@/lib/profile/migrate';
import type { ContributionType, FinancialProfile, ProfilePatch } from '@/lib/profile/types';
import type { PaycheckProfile } from '@/lib/types';

/** A v1-shaped profile: the given v1 sections over the v1 defaults, loaded the way a saved v1 profile is. */
const v1 = (patch: ProfilePatch = {}): FinancialProfile => migrateProfile(patch, 1);

/** The default profile with `writes` applied; each must be a valid profile write, or the test fails. */
function withWrites(writes: Write[]): FinancialProfile {
  const { profile, accepted } = applyProfileWrites(getDefaultFinancialProfile(), writes);
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
  investing: { investedBalance: 140000, monthlyContribution: 2200, taxableMonthlyContribution: 900 },
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
      { path: 'ira.rothBalance', value: 20000 },
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

  it('pins the default profile value by value where the profile sets it', () => {
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.income).toMatchObject({ grossPaycheck: 3500, frequency: 'bi-weekly', regularBonus: false });
    expect(inputs.taxes).toMatchObject({ federalBracket: 0.22, state: 'TX', filingStatus: 'single' });
    expect(inputs.benefits.employer401k).toMatchObject({
      available: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      contributionType: 'traditional',
      currentContribution: 0.06,
      traditionalContribution: 0.06,
      rothContribution: 0,
    });
    expect(inputs.preferences).toMatchObject({
      emergencyFundMonths: 3,
      currentEmergencyFund: 5000,
      emergencyFundAPY: 0.04,
      necessaryExpenses: 3000,
      funMoney: { min: 300, max: 600, current: 450 },
      age: 30,
      hasTaxableAccount: true,
      taxableAccountContribution: 500,
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

describe('the fixed federal bracket (O9)', () => {
  it.each([
    ['a low income', 800],
    ['the default income', 3500],
    ['a high income', 25000],
  ])('stays 22%% for %s', (_name, gross) => {
    const profile = withWrites([
      { path: 'income.grossPerPaycheck', value: gross },
      { path: 'income.netPerPaycheck', value: gross * 0.7 },
    ]);
    expect(engineInputsFor(PAYCHECK_CALCULATOR, profile).taxes.federalBracket).toBe(0.22);
  });
});

describe('the definition and its relations', () => {
  it('runs debounced by 150 ms, with the legacy storage import and no engine checks', () => {
    expect(PAYCHECK_CALCULATOR.id).toBe('paycheck');
    expect(PAYCHECK_CALCULATOR.debounceMs).toBe(150);
    expect(PAYCHECK_CALCULATOR.form).toBe(PAYCHECK_FORM);
    expect(PAYCHECK_CALCULATOR.bindings).toBe(PAYCHECK_BINDINGS);
    expect(LEGACY_IMPORTS[0].legacy).toBe(PAYCHECK_LEGACY);
    expect(LEGACY_IMPORTS[0].bindings).toBe(PAYCHECK_BINDINGS);
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

describe('the reverse direction (legacy import)', () => {
  const writesFor = (edit: (engine: PaycheckProfile) => void) => {
    const engine = PAYCHECK_LEGACY.storageDefaults();
    edit(engine);
    return fromEngineInputs(PAYCHECK_BINDINGS, engine, makeGet(getDefaultFinancialProfile()));
  };
  const valueAt = (writes: Write[], path: string) => writes.filter((write) => write.path === path).map((write) => write.value);

  it('writes each 1:1 leaf to its profile path, and the coupled paths again from their derived binding', () => {
    const writes = writesFor(() => undefined);
    const paths = writes.map((write) => write.path);
    const direct = PAYCHECK_BINDINGS.filter((binding) => !isDerivedBinding(binding));
    expect(new Set(paths)).toEqual(new Set(direct.map((binding) => (binding as { profile: string }).profile)));
    // The pay amounts with their frequency (the income binding), and the
    // 401(k) type with its total (the Roth binding; the Roth part only for a
    // split): written twice, with the same values, so the import keeps them together.
    const coupled = [
      'income.grossPerPaycheck',
      'income.netPerPaycheck',
      'income.frequency',
      'workplace.contributionType',
      'workplace.contributionPercent',
    ];
    expect(paths).toHaveLength(direct.length + coupled.length);
    for (const path of coupled) {
      const values = valueAt(writes, path);
      expect(values, path).toHaveLength(2);
      expect(values[1], path).toEqual(values[0]);
    }
    expect(valueAt(writes, 'person.state')).toEqual(['CA']);
    expect(valueAt(writes, 'income.grossPerPaycheck')).toEqual([2500, 2500]);
    expect(valueAt(writes, 'cash.targetMonths')).toEqual([3]);
    expect(valueAt(writes, 'workplace.contributionPercent')).toEqual([0.03, 0.03]);
  });

  it('writes the Roth part only for a split election', () => {
    const split = writesFor((engine) => {
      engine.benefits.employer401k.contributionType = 'split';
      engine.benefits.employer401k.rothContribution = 0.02;
    });
    expect(valueAt(split, 'workplace.rothContributionPercent')).toEqual([0.02]);
    const roth = writesFor((engine) => {
      engine.benefits.employer401k.contributionType = 'roth';
      engine.benefits.employer401k.rothContribution = 0.03;
    });
    expect(valueAt(roth, 'workplace.rothContributionPercent')).toEqual([]);
  });
});
