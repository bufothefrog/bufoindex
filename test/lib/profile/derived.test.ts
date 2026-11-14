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
  DERIVED_PATHS,
  derivedEmergencyFundBalance,
  derivedHsaCoverage,
  derivedRetirementBracket,
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

  it('retirement bracket: the 2026 federal bracket of the target income after the standard deduction', () => {
    // 41,000 - 16,100 = 24,900, single: 12%.
    expect(derivedRetirementBracket(41000, 'single')).toBe(0.12);
    // 28,500 - 16,100 = 12,400: on the 10% edge, so 10%; one dollar more is 12%.
    expect(derivedRetirementBracket(28500, 'single')).toBe(0.1);
    expect(derivedRetirementBracket(28501, 'single')).toBe(0.12);
    // 110,000 - 32,200 = 77,800, joint: 12%.
    expect(derivedRetirementBracket(110000, 'marriedJoint')).toBe(0.12);
    // 90,000 - 24,150 = 65,850, head of household: 12% (up to 67,450).
    expect(derivedRetirementBracket(90000, 'headOfHousehold')).toBe(0.12);
    // 130,000 - 16,100 = 113,900, separate: 24%.
    expect(derivedRetirementBracket(130000, 'marriedSeparate')).toBe(0.24);
    // 250,000 - 16,100 = 233,900, single: 32%.
    expect(derivedRetirementBracket(250000, 'single')).toBe(0.32);
    // Below the standard deduction: lowest bracket.
    expect(derivedRetirementBracket(10000, 'single')).toBe(0.1);
  });

  it('lists the derived leaves in rule order', () => {
    expect(DERIVED_PATHS).toEqual([
      'cash.emergencyFundBalance',
      'spending.targetRetirementIncome',
      'hsa.coverage',
      'assumptions.paycheck.expectedRetirementBracket',
    ]);
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

  it('derives the retirement bracket from the target income as derived or answered, never the stored bracket', () => {
    // Target unanswered: 12 x (5,000 + 450) = 65,400 -> 65,000; 65,000 - 16,100 = 48,900: 12%.
    const derivedTarget = withDerivedValues(
      profileWith({ 'spending.necessaryMonthly': 5000, 'assumptions.paycheck.expectedRetirementBracket': 0.35 }, [
        'spending.necessaryMonthly',
      ])
    );
    expect(derivedTarget.spending.targetRetirementIncome).toBe(65000);
    expect(derivedTarget.assumptions.paycheck.expectedRetirementBracket).toBe(0.12);
    // Target answered at 150,000, joint: 150,000 - 32,200 = 117,800: 22%.
    const answeredTarget = withDerivedValues(
      profileWith({ 'spending.targetRetirementIncome': 150000, 'person.filingStatus': 'marriedJoint' }, [
        'spending.targetRetirementIncome',
        'person.filingStatus',
      ])
    );
    expect(answeredTarget.assumptions.paycheck.expectedRetirementBracket).toBe(0.22);
    // The bracket answered: left as stored, even off the seven rates (the binding reads it as the nearest).
    const answeredBracket = profileWith({ 'spending.targetRetirementIncome': 150000, 'assumptions.paycheck.expectedRetirementBracket': 0.15 }, [
      'assumptions.paycheck.expectedRetirementBracket',
    ]);
    expect(withDerivedValues(answeredBracket).assumptions.paycheck.expectedRetirementBracket).toBe(0.15);
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
      'assumptions.paycheck.expectedRetirementBracket': 0.35,
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
const DERIVED_LEAF_SOURCE =
  /emergencyFundBalance|targetRetirementIncome|hsa\.coverage\b|EMERGENCY_FUND_BALANCE|HSA_COVERAGE\b|paycheck\.expectedRetirementBracket|EXPECTED_RETIREMENT_BRACKET|toEngineInputs\(/;
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
  'lib/profile/accounts.ts': 'Reads cash.emergencyFundBalance and hsa.coverage only through the derived get its callers pass.',
  'lib/calculators/portfolio/accountWrites.ts': 'Copies cash.emergencyFundBalance from the derived get of the accounts renderer.',
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
