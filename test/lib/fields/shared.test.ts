import { describe, expect, it } from 'vitest';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { FILING_STATUS_META, STRATEGY_PRESET_OPTIONS } from '@/lib/constants/labels';
import {
  AGE,
  CORE_FIELDS,
  CORE_SCREENS,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_BALANCE,
  FILING_STATUS,
  GROSS_PAY,
  INVESTED_BALANCE,
  MONTHLY_INVESTING,
  NECESSARY_MONTHLY,
  NET_PAY,
  NET_PAY_AT_MOST_GROSS,
  PAY_FREQUENCY,
  PROFILE_EXTRA_FIELDS,
  PROFILE_EXTRA_SCREENS,
  RETIREMENT_AFTER_AGE,
  RETIREMENT_AGE,
  STATE,
  STRATEGY_PRESET,
  TAXABLE_MONTHLY,
  intakeDerivedWrites,
  offeredWithSaved,
  withOverrides,
} from '@/lib/fields/shared';
import { relationErrors, resolveOptions } from '@/lib/fields/runtime';
import type { FormSpec, Get } from '@/lib/fields/types';
import { PAY_FREQUENCIES, PROFILE_ENUM_VALUES, isProfilePath } from '@/lib/profile/defaults';

const SHARED = [
  AGE,
  STATE,
  FILING_STATUS,
  GROSS_PAY,
  PAY_FREQUENCY,
  NET_PAY,
  NECESSARY_MONTHLY,
  RETIREMENT_AGE,
  INVESTED_BALANCE,
  MONTHLY_INVESTING,
  TAXABLE_MONTHLY,
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_APY,
  STRATEGY_PRESET,
];

const getFrom =
  (values: Record<string, unknown>): Get =>
  (path) =>
    values[path];

describe('shared field specs', () => {
  it('keys every spec by a distinct profile path', () => {
    const paths = SHARED.map((spec) => spec.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(isProfilePath(path), path).toBe(true);
  });

  it('only offers values the profile accepts', () => {
    for (const spec of [FILING_STATUS, PAY_FREQUENCY, STRATEGY_PRESET]) {
      for (const option of resolveOptions(spec, getFrom({}))) {
        expect(PROFILE_ENUM_VALUES[spec.path]).toContain(option.value);
      }
    }
  });

  it('words filing status from the label table: single and married filing jointly', () => {
    const offered = [
      { value: 'single', label: 'Single' },
      { value: 'marriedJoint', label: 'Married filing jointly' },
    ];
    expect(resolveOptions(FILING_STATUS, getFrom({ 'person.filingStatus': 'single' }))).toEqual(offered);
    expect(resolveOptions(FILING_STATUS, getFrom({ 'person.filingStatus': 'marriedJoint' }))).toEqual(offered);
    expect(FILING_STATUS_META.marriedJoint.phrase).toBe('married filing jointly');
  });

  it('keeps a saved filing status the intake does not offer as a third option', () => {
    expect(resolveOptions(FILING_STATUS, getFrom({ 'person.filingStatus': 'headOfHousehold' }))).toEqual([
      { value: 'single', label: 'Single' },
      { value: 'marriedJoint', label: 'Married filing jointly' },
      { value: 'headOfHousehold', label: 'Head of household' },
    ]);
    expect(
      resolveOptions(FILING_STATUS, getFrom({ 'person.filingStatus': 'marriedSeparate' })).map((o) => o.label)
    ).toEqual(['Single', 'Married filing jointly', 'Married filing separately']);
  });

  it('offeredWithSaved adds only a known saved value, and returns the offered list itself otherwise', () => {
    const offered = [{ value: 'a', label: 'A' }];
    const all = [...offered, { value: 'b', label: 'B' }];
    const options = offeredWithSaved('x', offered, all);
    expect(options(getFrom({ x: 'a' }))).toBe(offered);
    expect(options(getFrom({ x: 'b' }))).toEqual([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    expect(options(getFrom({ x: 'zzz' }))).toBe(offered);
    expect(options(getFrom({}))).toBe(offered);
  });

  it('reuses the strategy preset options, Standard first', () => {
    expect(STRATEGY_PRESET.options).toEqual([STRATEGY_PRESET_OPTIONS[1], STRATEGY_PRESET_OPTIONS[0]]);
    expect((STRATEGY_PRESET.options as readonly { label: string }[]).map((o) => o.label)).toEqual([
      'Standard',
      'Cash-flow investor',
    ]);
  });

  it('offers every pay frequency in the profile order, in the intake wording', () => {
    expect(PAY_FREQUENCY.options).toEqual([
      { value: 'weekly', label: 'Every week' },
      { value: 'bi-weekly', label: 'Every two weeks' },
      { value: 'semi-monthly', label: 'Twice a month' },
      { value: 'monthly', label: 'Once a month' },
    ]);
    expect(Object.keys(PAY_FREQUENCY_META).sort()).toEqual([...PAY_FREQUENCIES].sort());
    expect(PAY_FREQUENCIES.map((frequency) => PAY_FREQUENCY_META[frequency].cadence)).toEqual([
      'every week',
      'every 2 weeks',
      'twice a month',
      'once a month',
    ]);
  });

  it('keeps the plan bounds the intake used', () => {
    expect([AGE.min, AGE.max, AGE.step]).toEqual([16, 100, 1]);
    expect([RETIREMENT_AGE.min, RETIREMENT_AGE.max, RETIREMENT_AGE.step]).toEqual([30, 85, 1]);
    expect([EMERGENCY_FUND_APY.min, EMERGENCY_FUND_APY.max]).toEqual([0, 0.2]);
    for (const spec of [GROSS_PAY, NET_PAY, NECESSARY_MONTHLY, INVESTED_BALANCE, MONTHLY_INVESTING, TAXABLE_MONTHLY]) {
      expect(spec.min, spec.path).toBe(0);
    }
  });

  it('marks the core facts as core and the rest as details', () => {
    expect(CORE_FIELDS.every((spec) => spec.tier === 'core')).toBe(true);
    expect(SHARED.filter((spec) => !CORE_FIELDS.includes(spec)).every((spec) => spec.tier === 'details')).toBe(true);
  });
});

describe('withOverrides', () => {
  it('rewords a spec without copying it or changing its path and kind', () => {
    const stop = withOverrides(RETIREMENT_AGE, { label: 'Age you plan to stop contributing' });
    expect(stop).toEqual({ ...RETIREMENT_AGE, label: 'Age you plan to stop contributing' });
    expect(RETIREMENT_AGE.label).toBe('Target retirement age');
  });
});

describe('CORE_SCREENS and PROFILE_EXTRA_SCREENS', () => {
  it('asks the seven core facts on three core screens, in order', () => {
    expect(CORE_SCREENS.map((s) => [s.id, s.tier, s.fields])).toEqual([
      ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
      ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
      ['must-pay', 'core', ['spending.necessaryMonthly']],
    ]);
    expect(CORE_SCREENS.flatMap((s) => s.fields)).toEqual(CORE_FIELDS.map((spec) => spec.path));
  });

  it('asks the emergency fund and the strategy preset on the profile-only screens', () => {
    expect(PROFILE_EXTRA_SCREENS.map((s) => [s.id, s.fields])).toEqual([
      ['cash-buffer', ['cash.emergencyFundBalance', 'cash.emergencyFundApy']],
      ['strategy', ['strategy.preset']],
    ]);
    expect(PROFILE_EXTRA_SCREENS.flatMap((s) => s.fields)).toEqual(PROFILE_EXTRA_FIELDS.map((spec) => spec.path));
  });
});

describe('shared cross-field rules', () => {
  const form: FormSpec = {
    id: 'rules',
    fields: [AGE, RETIREMENT_AGE, GROSS_PAY, NET_PAY],
    screens: [],
    relations: [NET_PAY_AT_MOST_GROSS, RETIREMENT_AFTER_AGE],
  };

  it('allows take-home equal to gross, and flags take-home above it', () => {
    const ok = getFrom({ 'income.grossPerPaycheck': 2600, 'income.netPerPaycheck': 2600 });
    expect(relationErrors(form, ok)).toEqual({});
    const bad = getFrom({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 2600 });
    expect(relationErrors(form, bad)).toEqual({ 'income.netPerPaycheck': NET_PAY_AT_MOST_GROSS.message });
  });

  it('needs the retirement age strictly above the age', () => {
    expect(relationErrors(form, getFrom({ 'person.age': 59, 'person.retirementAge': 60 }))).toEqual({});
    expect(relationErrors(form, getFrom({ 'person.age': 60, 'person.retirementAge': 60 }))).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
  });
});

describe('intakeDerivedWrites', () => {
  it('sets the target months from the preset unless they were entered', () => {
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'standard' }), new Set())).toEqual([
      { path: 'cash.targetMonths', value: 3 },
    ]);
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'cashflow-investor' }), new Set())).toEqual([
      { path: 'cash.targetMonths', value: 1 },
    ]);
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'standard' }), new Set(['cash.targetMonths']))).toEqual([]);
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'yolo' }), new Set())).toEqual([]);
  });

  it('raises a retirement age at or below the age to age + 1', () => {
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45, 'person.retirementAge': 45 }), new Set())).toEqual([
      { path: 'person.retirementAge', value: 46 },
    ]);
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45, 'person.retirementAge': 46 }), new Set())).toEqual([]);
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45 }), new Set())).toEqual([]);
  });
});
