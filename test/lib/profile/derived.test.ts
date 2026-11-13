/**
 * Derived typical values (lib/profile/derived.ts): each rule answered,
 * unanswered and with its dependency itself unanswered; the stored profile
 * left alone; and the single-function guarantee, that every reader of a
 * profile (engine inputs, dashboard figures) sees the same derived value.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { summarizeCashBuffer } from '@/lib/dashboard/derive';
import { getAt, setAt } from '@/lib/fields/paths';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import {
  DERIVED_DEPENDENCIES,
  DERIVED_PATHS,
  derivedEmergencyFundBalance,
  derivedHsaCoverage,
  derivedTargetRetirementIncome,
  withDerivedValues,
} from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import { defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';

/** The default profile with `values` set by path and `provided` as given. */
function profileWith(values: Record<string, unknown>, provided: string[] = []): FinancialProfile {
  let profile = getDefaultFinancialProfile();
  for (const [path, value] of Object.entries(values)) profile = setAt(profile, path, value);
  return { ...profile, provided };
}

describe('the rules', () => {
  it('emergency fund balance: three months of must-pay costs', () => {
    expect(derivedEmergencyFundBalance(3000)).toBe(9000);
    expect(derivedEmergencyFundBalance(2150)).toBe(6450);
    expect(derivedEmergencyFundBalance(0)).toBe(0);
  });

  it('target retirement income: 12 x (must-pay + fun money midpoint), to the nearest 1,000', () => {
    // 12 x (3,000 + 450) = 41,400 -> 41,000.
    expect(derivedTargetRetirementIncome(3000, 300, 600)).toBe(41000);
    // 12 x (2,000 + 300) = 27,600 -> 28,000.
    expect(derivedTargetRetirementIncome(2000, 200, 400)).toBe(28000);
    // 12 x (4,200 + 550) = 57,000 exactly.
    expect(derivedTargetRetirementIncome(4200, 300, 800)).toBe(57000);
    // 12 x (1,000 + 125) = 13,500: a half rounds up to 14,000.
    expect(derivedTargetRetirementIncome(1000, 100, 150)).toBe(14000);
  });

  it('HSA coverage: family when filing jointly, otherwise individual', () => {
    expect(derivedHsaCoverage('marriedJoint')).toBe('family');
    expect(derivedHsaCoverage('single')).toBe('individual');
    expect(derivedHsaCoverage('marriedSeparate')).toBe('individual');
    expect(derivedHsaCoverage('headOfHousehold')).toBe('individual');
  });

  it('lists each derived leaf with the leaves it reads', () => {
    expect(DERIVED_PATHS).toEqual(['cash.emergencyFundBalance', 'spending.targetRetirementIncome', 'hsa.coverage']);
    expect(Object.keys(DERIVED_DEPENDENCIES)).toEqual([...DERIVED_PATHS]);
  });
});

describe('withDerivedValues', () => {
  it('fills each unanswered derived leaf from the answers, ignoring the stored value', () => {
    const stored = profileWith(
      {
        'spending.necessaryMonthly': 2000,
        'spending.funMoneyMin': 200,
        'spending.funMoneyMax': 400,
        'person.filingStatus': 'marriedJoint',
        'cash.emergencyFundBalance': 5000,
        'spending.targetRetirementIncome': 80000,
        'hsa.coverage': 'individual',
      },
      ['spending.necessaryMonthly', 'spending.funMoneyMin', 'spending.funMoneyMax', 'person.filingStatus']
    );
    const derived = withDerivedValues(stored);
    expect(derived.cash.emergencyFundBalance).toBe(6000);
    expect(derived.spending.targetRetirementIncome).toBe(28000);
    expect(derived.hsa.coverage).toBe('family');
  });

  it('never touches an answered derived leaf', () => {
    const stored = profileWith(
      {
        'spending.necessaryMonthly': 2000,
        'person.filingStatus': 'marriedJoint',
        'cash.emergencyFundBalance': 1234,
        'spending.targetRetirementIncome': 99000,
        'hsa.coverage': 'individual',
      },
      ['spending.necessaryMonthly', 'person.filingStatus', ...DERIVED_PATHS]
    );
    const derived = withDerivedValues(stored);
    expect(derived).toBe(stored);
    expect([derived.cash.emergencyFundBalance, derived.spending.targetRetirementIncome, derived.hsa.coverage]).toEqual([
      1234,
      99000,
      'individual',
    ]);
  });

  it('uses the typical value of a dependency that is itself unanswered', () => {
    // Nothing answered: must-pay 3,000 and fun money 300 to 600 are the
    // typical values the profile holds; filing status single.
    const derived = withDerivedValues(profileWith({ 'cash.emergencyFundBalance': 5000, 'spending.targetRetirementIncome': 80000 }));
    expect(derived.cash.emergencyFundBalance).toBe(9000);
    expect(derived.spending.targetRetirementIncome).toBe(41000);
    expect(derived.hsa.coverage).toBe('individual');
    // A dependency stored but not answered (an old example value) is used as the typical value.
    const oldMustPay = withDerivedValues(profileWith({ 'spending.necessaryMonthly': 2500 }));
    expect(oldMustPay.cash.emergencyFundBalance).toBe(7500);
  });

  it('takes the answered list from the caller when given (the wizard)', () => {
    const stored = profileWith({ 'spending.necessaryMonthly': 2000, 'cash.emergencyFundBalance': 777 });
    expect(withDerivedValues(stored).cash.emergencyFundBalance).toBe(6000);
    expect(withDerivedValues(stored, ['cash.emergencyFundBalance']).cash.emergencyFundBalance).toBe(777);
  });

  it('does not change the stored profile it reads, and returns it as is when nothing changes', () => {
    const stored = profileWith({ 'spending.necessaryMonthly': 2000, 'cash.emergencyFundBalance': 5000 });
    const before = JSON.stringify(stored);
    const derived = withDerivedValues(stored);
    expect(derived).not.toBe(stored);
    expect(JSON.stringify(stored)).toBe(before);
    expect(derived.provided).toBe(stored.provided);
    // The defaults already hold what the rules give for them.
    const defaults = getDefaultFinancialProfile();
    expect(withDerivedValues(defaults)).toBe(defaults);
  });
});

// ---------------------------------------------------------------------------
// The single-function guarantee
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the four definitions have different engine types
const DEFINITIONS: readonly CalculatorDefinition<any, any>[] = [
  PAYCHECK_CALCULATOR,
  RETIREMENT_CALCULATOR,
  PORTFOLIO_CALCULATOR,
  LEVERAGE_CALCULATOR,
];

/**
 * A profile with every derived leaf unanswered and stored as a value no rule
 * gives, and the same profile with each derived leaf answered at the value
 * its rule gives.
 */
function storedAndResolved(values: Record<string, unknown>): [FinancialProfile, FinancialProfile] {
  const stored = profileWith(
    {
      ...values,
      'cash.emergencyFundBalance': 123457,
      'spending.targetRetirementIncome': 987000,
      'hsa.coverage': values['person.filingStatus'] === 'marriedJoint' ? 'individual' : 'family',
    },
    ['spending.necessaryMonthly', 'person.filingStatus']
  );
  let resolved: FinancialProfile = { ...stored, provided: [...stored.provided, ...DERIVED_PATHS] };
  for (const path of DERIVED_PATHS) resolved = setAt(resolved, path, getAt(withDerivedValues(stored), path));
  return [stored, resolved];
}

describe('every reader sees the derived value, never the stored one', () => {
  it.each([
    ['single, $2,000 must-pay', { 'spending.necessaryMonthly': 2000, 'person.filingStatus': 'single' }],
    ['joint, $4,200 must-pay', { 'spending.necessaryMonthly': 4200, 'person.filingStatus': 'marriedJoint' }],
  ])('engine inputs of every calculator (%s)', (_name, values) => {
    const [stored, resolved] = storedAndResolved(values);
    for (const def of DEFINITIONS) {
      expect(engineInputsFor(def, stored), def.id).toEqual(engineInputsFor(def, resolved));
      expect(prepareRun(def, stored).inputs, def.id).toEqual(prepareRun(def, resolved).inputs);
    }
  });

  it('follows a changed must-pay answer into the paycheck and retirement inputs and the cash card', () => {
    const at = (mustPay: number) =>
      profileWith({ 'spending.necessaryMonthly': mustPay, 'cash.emergencyFundBalance': 5000 }, ['spending.necessaryMonthly']);
    expect(engineInputsFor(PAYCHECK_CALCULATOR, at(2000)).preferences.currentEmergencyFund).toBe(6000);
    expect(engineInputsFor(PAYCHECK_CALCULATOR, at(4000)).preferences.currentEmergencyFund).toBe(12000);
    // 12 x (2,000 + 450) = 29,400 -> 29,000; 12 x (4,000 + 450) = 53,400 -> 53,000.
    expect(engineInputsFor(RETIREMENT_CALCULATOR, at(2000)).targetIncome).toBe(29000);
    expect(engineInputsFor(RETIREMENT_CALCULATOR, at(4000)).targetIncome).toBe(53000);
    expect(summarizeCashBuffer(at(4000)).balance).toBe(12000);
  });

  it('follows a joint filing status into the paycheck HSA coverage', () => {
    const joint = profileWith({ 'person.filingStatus': 'marriedJoint' }, ['person.filingStatus']);
    expect(engineInputsFor(PAYCHECK_CALCULATOR, joint).benefits.hsa.coverageType).toBe('family');
    const answered = { ...joint, provided: [...joint.provided, 'hsa.coverage'] };
    expect(engineInputsFor(PAYCHECK_CALCULATOR, answered).benefits.hsa.coverageType).toBe('individual');
  });

  it('builds the retirement engine base through the function too', () => {
    expect(RETIREMENT_CALCULATOR.engineBase().targetIncome).toBe(41000);
  });
});

// A source check: the rule above covers every reader that goes through
// engineInputsFor, prepareRun or summarizeCashBuffer. A new file that names a
// derived leaf, or calls toEngineInputs, must be reviewed for the same
// guarantee and added here with its reason.
const ROOT = join(__dirname, '..', '..', '..');
const DERIVED_LEAF_SOURCE = /emergencyFundBalance|targetRetirementIncome|hsa\.coverage\b|EMERGENCY_FUND_BALANCE|HSA_COVERAGE\b|toEngineInputs\(/;
const REVIEWED: Readonly<Record<string, string>> = {
  'lib/profile/derived.ts': 'The rules themselves.',
  'lib/profile/defaults.ts': 'The default values (the rules applied to the defaults).',
  'lib/profile/types.ts': 'The type.',
  'lib/calculators/runtime.ts': 'engineInputsFor and prepareRun apply withDerivedValues before toEngineInputs.',
  'lib/calculators/retirement/definition.ts': 'The engine base applies withDerivedValues to the default profile.',
  'lib/calculators/paycheck/bindings.ts': 'Bindings run only through lib/calculators/runtime.ts.',
  'lib/calculators/retirement/bindings.ts': 'Bindings run only through lib/calculators/runtime.ts.',
  'lib/calculators/paycheck/fields.ts': 'Field specs read through the get of useCalculatorValues or the wizard, both derived.',
  'lib/calculators/paycheck/form.ts': 'The form lists the field specs.',
  'lib/calculators/retirement/fields.ts': 'Field specs read through the get of useCalculatorValues or the wizard, both derived.',
  'lib/fields/shared.ts': 'Field specs read through the get of useCalculatorValues or the wizard, both derived.',
  'lib/dashboard/derive.ts': 'summarizeCashBuffer applies withDerivedValues.',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('no other file reads a derived leaf or runs the bindings', () => {
  it('names a derived leaf or calls toEngineInputs only in the reviewed files', () => {
    const found = ['lib', 'components', 'app']
      .flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .map((path) => relative(ROOT, path).split('\\').join('/'))
      .filter((path) => !path.startsWith('lib/calculations/'))
      .filter((path) => DERIVED_LEAF_SOURCE.test(readFileSync(join(ROOT, path), 'utf8')))
      .sort();
    expect(found).toEqual(Object.keys(REVIEWED).sort());
  });
});

describe('a profile saved at 3bb0132 with the old example stored but unanswered', () => {
  it('loads without an error; the old stored values stand, the derived leaves follow the stored must-pay costs', () => {
    // As localStorage holds it: every leaf of the 3bb0132 default (30, TX,
    // $3,500 every two weeks, a $5,000 emergency fund, an $80,000 target),
    // only the age answered.
    const saved = JSON.parse(JSON.stringify({ ...defaultProfileAt3bb0132(), provided: ['person.age'] }));
    let profile: FinancialProfile | undefined;
    expect(() => {
      profile = normalizeProfile(saved);
    }).not.toThrow();
    if (!profile) throw new Error('no profile');
    // Stored values are kept as they were saved: nothing is rewritten.
    expect(profile.person).toMatchObject({ age: 30, state: 'TX', retirementAge: 60, lifeExpectancy: 85 });
    expect(profile.cash.emergencyFundBalance).toBe(5000);
    expect(profile.spending.targetRetirementIncome).toBe(80000);

    // What the visitor now sees: the stored example for ordinary leaves, and
    // the derived value for each derived leaf ($3,000 of must-pay costs are
    // stored, so 3 x 3,000 = 9,000 and 12 x 3,450 -> 41,000).
    const paycheck = engineInputsFor(PAYCHECK_CALCULATOR, profile);
    expect(paycheck.income.grossPaycheck).toBe(3500);
    expect(paycheck.taxes.state).toBe('TX');
    expect(paycheck.benefits.employer401k.matchPercent).toBe(0.5);
    expect(paycheck.preferences.currentEmergencyFund).toBe(9000);
    const retirement = engineInputsFor(RETIREMENT_CALCULATOR, profile);
    expect(retirement).toMatchObject({ startingAge: 30, retirementAge: 60, lifeExpectancy: 85, targetIncome: 41000 });
    expect(summarizeCashBuffer(profile).balance).toBe(9000);
  });
});
