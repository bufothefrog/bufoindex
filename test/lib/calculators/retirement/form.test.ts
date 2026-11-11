/**
 * The retirement form (slice c1): the four topic screens after the core
 * (plan sections 2.12 and 2.14), what each asks, its visibility rules,
 * validation and 'remaining' mode, the nullable overrides, and proof that
 * every question the old intake asked is still asked.
 */

import { describe, expect, it } from 'vitest';
import { EFFECTIVE_TAX_RATE, ANNUAL_HEALTHCARE_COST, tdfProfileFor } from '@/lib/calculators/retirement/fields';
import { RETIREMENT_FORM } from '@/lib/calculators/retirement/form';
import {
  CORE_PATHS,
  getIntakeScreens,
  intakePaths,
  remainingIntakeScreens,
  skipLabelFor,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { fieldMap, resolveOptions, resolveOverrideDefault, summarizeScreen } from '@/lib/fields/runtime';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { OLD_CORE_FLOW, askedScreens, fromDefaults, type OldQuestion } from '@/test/utils/intakeFixture';

const ids = (overrides: Record<string, unknown> = {}) =>
  getIntakeScreens('retirement', fromDefaults(overrides)).map((s) => s.id);

const remainingIds = (provided: string[], overrides: Record<string, unknown> = {}) =>
  getIntakeScreens('retirement', fromDefaults(overrides), { mode: 'remaining', provided }).map((s) => s.id);

/** Each screen's visible questions, by path. */
const fieldsByScreen = (overrides: Record<string, unknown> = {}) =>
  Object.fromEntries(
    askedScreens('retirement', fromDefaults(overrides)).map((screen) => [screen.id, screen.questions.map((q) => q.path)])
  );

const screen = (id: string) => RETIREMENT_FORM.screens.find((s) => s.id === id)!;

const validate = (id: string, overrides: Record<string, unknown>) =>
  validateIntakeScreen('retirement', screen(id), fromDefaults(overrides));

const profileWith = (provided: string[]): FinancialProfile => ({ ...getDefaultFinancialProfile(), provided });

const CUSTOM = { 'assumptions.retirement.riskProfile': 'custom' };

describe('retirement form: screens', () => {
  it('asks the core, then savings, target, Social Security and healthcare, and the assumptions last', () => {
    expect(ids()).toEqual(['about', 'pay', 'must-pay', 'savings', 'target', 'ss-healthcare', 'assumptions']);
    expect(RETIREMENT_FORM.screens.map((s) => [s.id, s.tier, s.surface])).toEqual([
      ['about', 'core', undefined],
      ['pay', 'core', undefined],
      ['must-pay', 'core', undefined],
      ['savings', 'details', undefined],
      ['target', 'details', undefined],
      ['ss-healthcare', 'details', undefined],
      ['assumptions', 'assumption', undefined],
    ]);
  });

  it('asks 4 screens after the core (plan section 2.12)', () => {
    expect(remainingIds([...CORE_PATHS])).toEqual(['savings', 'target', 'ss-healthcare', 'assumptions']);
  });

  it('titles each screen, with a question for the wizard where the card title is not one', () => {
    expect(
      RETIREMENT_FORM.screens.slice(3).map((s) => ({ id: s.id, title: s.title, question: s.question, description: s.description }))
    ).toEqual([
      { id: 'savings', title: 'What are you investing today?', question: undefined, description: undefined },
      {
        id: 'target',
        title: 'When would you like to retire?',
        question: undefined,
        description: "Your target income is in today's dollars.",
      },
      {
        id: 'ss-healthcare',
        title: 'Social Security and healthcare',
        question: 'What will Social Security and healthcare look like?',
        description: "Estimates in today's dollars are fine.",
      },
      {
        id: 'assumptions',
        title: 'Assumptions',
        question: 'Which assumptions should the projection use?',
        description: undefined,
      },
    ]);
  });

  it('asks these fields on each screen under the target-date profile', () => {
    expect(fieldsByScreen()).toEqual({
      about: ['person.age', 'person.state', 'person.filingStatus'],
      pay: ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck'],
      'must-pay': ['spending.necessaryMonthly'],
      savings: ['investing.monthlyContribution', 'investing.investedBalance'],
      target: ['person.retirementAge', 'spending.targetRetirementIncome', 'person.lifeExpectancy'],
      'ss-healthcare': [
        'retirementIncome.socialSecurityBenefit',
        'retirementIncome.socialSecurityAge',
        'retirementIncome.annualHealthcareCost',
      ],
      assumptions: [
        'assumptions.retirement.riskProfile',
        'assumptions.retirement.inflationRate',
        'assumptions.retirement.effectiveTaxRate',
        'assumptions.retirement.healthcareCostMultiplier',
      ],
    });
  });

  it('shows accumulation, retirement return and volatility only for the custom profile', () => {
    expect(fieldsByScreen(CUSTOM).assumptions).toEqual([
      'assumptions.retirement.riskProfile',
      'assumptions.retirement.accumulationReturn',
      'assumptions.retirement.retirementReturn',
      'assumptions.retirement.volatility',
      'assumptions.retirement.inflationRate',
      'assumptions.retirement.effectiveTaxRate',
      'assumptions.retirement.healthcareCostMultiplier',
    ]);
  });

  it('labels and bounds each retirement field', () => {
    const asked = askedScreens('retirement', fromDefaults(CUSTOM)).flatMap((s) => s.questions);
    const pick = (path: string) => {
      const { label, kind, min, max, step } = asked.find((q) => q.path === path)!;
      return { label, kind, min, max, step };
    };
    expect(pick('spending.targetRetirementIncome')).toEqual({ label: 'Target annual income in retirement', kind: 'money', min: 0, max: undefined, step: undefined });
    expect(pick('person.lifeExpectancy')).toEqual({ label: 'Life expectancy', kind: 'number', min: 50, max: 110, step: 1 });
    expect(pick('retirementIncome.socialSecurityBenefit')).toEqual({ label: 'Social Security benefit', kind: 'money', min: 0, max: undefined, step: undefined });
    expect(pick('retirementIncome.socialSecurityAge')).toEqual({ label: 'Social Security age', kind: 'number', min: 62, max: 70, step: 1 });
    expect(pick('retirementIncome.annualHealthcareCost')).toEqual({ label: 'Annual healthcare cost', kind: 'money', min: 0, max: undefined, step: undefined });
    expect(pick('assumptions.retirement.riskProfile')).toEqual({ label: 'Risk profile', kind: 'choice', min: undefined, max: undefined, step: undefined });
    expect(pick('assumptions.retirement.accumulationReturn')).toEqual({ label: 'Accumulation return', kind: 'percent', min: 0, max: 0.25, step: 0.001 });
    expect(pick('assumptions.retirement.retirementReturn')).toEqual({ label: 'Retirement return', kind: 'percent', min: 0, max: 0.25, step: 0.001 });
    expect(pick('assumptions.retirement.volatility')).toEqual({ label: 'Portfolio volatility', kind: 'percent', min: 0.05, max: 0.25, step: 0.005 });
    expect(pick('assumptions.retirement.inflationRate')).toEqual({ label: 'Inflation rate', kind: 'percent', min: 0.01, max: 0.05, step: 0.001 });
    expect(pick('assumptions.retirement.effectiveTaxRate')).toEqual({ label: 'Effective tax rate', kind: 'percent', min: 0, max: 0.4, step: 0.01 });
    expect(pick('assumptions.retirement.healthcareCostMultiplier')).toEqual({ label: 'Healthcare cost multiplier', kind: 'slider', min: 0.5, max: 3, step: 0.1 });
  });

  it('offers the target-date fund with its glide-path figures for the current age, and custom', () => {
    const spec = fieldMap(RETIREMENT_FORM).get('assumptions.retirement.riskProfile')!;
    // Age 30 holds 90% stocks; the returns come from the engine's glide path.
    const at30 = tdfProfileFor(30);
    expect(at30.stocks).toBe(0.9);
    expect(resolveOptions(spec, fromDefaults())).toEqual([
      {
        value: 'tdf',
        label: 'Target Date Fund',
        description: `Age-based: 90% stocks, ${Math.round(at30.accumulationReturn * 100)}% / ${Math.round(at30.retirementReturn * 100)}% returns`,
      },
      { value: 'custom', label: 'Custom', description: 'Set your own values' },
    ]);
    // Age 65 is down to 40% stocks.
    expect(resolveOptions(spec, fromDefaults({ 'person.age': 65 }))[0].description).toMatch(/^Age-based: 40% stocks, /);
  });

  it('fills the custom inputs with the glide-path figures when the target-date fund is chosen', () => {
    const spec = fieldMap(RETIREMENT_FORM).get('assumptions.retirement.riskProfile')!;
    const tdf = tdfProfileFor(45);
    expect(spec.onChange!('tdf', fromDefaults({ 'person.age': 45 }))).toEqual([
      { path: 'assumptions.retirement.accumulationReturn', value: tdf.accumulationReturn },
      { path: 'assumptions.retirement.retirementReturn', value: tdf.retirementReturn },
      { path: 'assumptions.retirement.volatility', value: tdf.volatility },
    ]);
    expect(spec.onChange!('custom', fromDefaults())).toEqual([]);
  });

  it('summarizes the collapsed assumptions and details cards as the old cards did', () => {
    expect(summarizeScreen(RETIREMENT_FORM, screen('assumptions'), fromDefaults())).toBe(
      'Target-date glide path, 3% inflation, tax rate estimated from income, 1x healthcare'
    );
    expect(
      summarizeScreen(
        RETIREMENT_FORM,
        screen('assumptions'),
        fromDefaults({ ...CUSTOM, 'assumptions.retirement.effectiveTaxRate': 0.15 })
      )
    ).toBe('8% / 6% returns, 15% volatility, 3% inflation, 15% tax rate, 1x healthcare');
    expect(summarizeScreen(RETIREMENT_FORM, screen('savings'), fromDefaults())).toBe('saving $1,500/mo, $25,000 invested');
    expect(summarizeScreen(RETIREMENT_FORM, screen('target'), fromDefaults())).toBe('retire at 60, $80,000/yr target, plan to age 85');
    expect(summarizeScreen(RETIREMENT_FORM, screen('ss-healthcare'), fromDefaults())).toBe(
      'Social Security $30,000/yr at 67, typical healthcare cost'
    );
  });

  it('offers the typical-value skip on the topic screens and keeps the defaults on the assumptions', () => {
    expect(['savings', 'target', 'ss-healthcare'].map((id) => skipLabelFor(screen(id)))).toEqual([
      'Skip, use a typical value',
      'Skip, use a typical value',
      'Skip, use a typical value',
    ]);
    expect(skipLabelFor(screen('assumptions'))).toBe('Keep the default assumptions');
  });
});

describe('retirement form: nullable overrides', () => {
  it('estimates the effective tax rate from the target income and the filing status the model runs', () => {
    // 80,000 single: 63,900 taxable after the 16,100 deduction;
    // 1,240 + 4,560 + 2,970 = 8,770 tax, 10.9625%.
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, fromDefaults())).toBeCloseTo(0.109625, 10);
    // Head of household runs as single (O10).
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, fromDefaults({ 'person.filingStatus': 'headOfHousehold' }))).toBeCloseTo(0.109625, 10);
    // Joint: 47,800 taxable after 32,200; 2,480 + 2,760 = 5,240 tax, 6.55%.
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, fromDefaults({ 'person.filingStatus': 'marriedJoint' }))).toBeCloseTo(0.0655, 10);
    expect(EFFECTIVE_TAX_RATE.nullable?.autoLabel).toBe('Estimated from your target income and filing status');
  });

  it('starts a healthcare override at the model base cost', () => {
    expect(resolveOverrideDefault(ANNUAL_HEALTHCARE_COST, fromDefaults())).toBe(7500);
    expect(ANNUAL_HEALTHCARE_COST.nullable?.autoLabel).toBe('Typical cost the model uses');
  });

  it('accepts auto (null) and checks an override against the bounds', () => {
    expect(validate('assumptions', { 'assumptions.retirement.effectiveTaxRate': null })).toEqual({});
    expect(validate('assumptions', { 'assumptions.retirement.effectiveTaxRate': 0.5 })).toEqual({
      'assumptions.retirement.effectiveTaxRate': 'Effective tax rate must be between 0% and 40%.',
    });
    expect(validate('ss-healthcare', { 'retirementIncome.annualHealthcareCost': null })).toEqual({});
    expect(validate('ss-healthcare', { 'retirementIncome.annualHealthcareCost': -5 })).toEqual({
      'retirementIncome.annualHealthcareCost': 'Annual healthcare cost must be at least $0.',
    });
  });
});

describe('retirement form: validation', () => {
  it('requires retirement age strictly above current age, on the target screen only', () => {
    const get = { 'person.age': 60, 'person.retirementAge': 60 };
    expect(validate('target', get)).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    expect(validate('about', get)).toEqual({});
  });

  it('requires life expectancy at or above the retirement age', () => {
    expect(validate('target', { 'person.retirementAge': 70, 'person.lifeExpectancy': 70 })).toEqual({});
    expect(validate('target', { 'person.retirementAge': 70, 'person.lifeExpectancy': 69 })).toEqual({
      'person.lifeExpectancy': 'Life expectancy needs to be at least your retirement age.',
    });
    expect(validate('target', { 'person.lifeExpectancy': 120 })).toEqual({
      'person.lifeExpectancy': 'Life expectancy must be between 50 years and 110 years.',
    });
  });

  it('keeps Social Security between 62 and 70', () => {
    expect(validate('ss-healthcare', { 'retirementIncome.socialSecurityAge': 61 })).toEqual({
      'retirementIncome.socialSecurityAge': 'Social Security age must be between 62 and 70.',
    });
  });

  it('checks the custom return inputs only while they are shown', () => {
    expect(validate('assumptions', { 'assumptions.retirement.volatility': 0.3 })).toEqual({});
    expect(validate('assumptions', { ...CUSTOM, 'assumptions.retirement.volatility': 0.3 })).toEqual({
      'assumptions.retirement.volatility': 'Portfolio volatility must be between 5% and 25%.',
    });
  });

  it('accepts the default profile on every screen', () => {
    for (const s of RETIREMENT_FORM.screens) expect(validate(s.id, {}), s.id).toEqual({});
    for (const s of RETIREMENT_FORM.screens) expect(validate(s.id, CUSTOM), s.id).toEqual({});
  });
});

describe("retirement form: 'remaining' mode", () => {
  it('drops the core and the fully answered screens, and keeps a partly answered one whole', () => {
    expect(remainingIds([])).toEqual(['savings', 'target', 'ss-healthcare', 'assumptions']);
    expect(remainingIds([...CORE_PATHS, 'investing.investedBalance'])).toEqual([
      'savings',
      'target',
      'ss-healthcare',
      'assumptions',
    ]);
    expect(remainingIds(['investing.investedBalance', 'investing.monthlyContribution', 'person.retirementAge'])).toEqual([
      'target',
      'ss-healthcare',
      'assumptions',
    ]);
    expect(remainingIds(intakePaths('retirement'))).toEqual([]);
  });

  it('counts the assumptions answered by their visible fields', () => {
    const tdfAnswers = [
      'assumptions.retirement.riskProfile',
      'assumptions.retirement.inflationRate',
      'assumptions.retirement.effectiveTaxRate',
      'assumptions.retirement.healthcareCostMultiplier',
    ];
    expect(remainingIds(tdfAnswers)).toEqual(['savings', 'target', 'ss-healthcare']);
    expect(remainingIds(tdfAnswers, CUSTOM)).toEqual(['savings', 'target', 'ss-healthcare', 'assumptions']);
  });

  it('matches what /start/retirement asks on arrival, from the saved profile', () => {
    const profile = profileWith([...CORE_PATHS, 'investing.investedBalance', 'investing.monthlyContribution']);
    expect(remainingIntakeScreens('retirement', profile).map((s) => s.id)).toEqual([
      'target',
      'ss-healthcare',
      'assumptions',
    ]);
  });
});

describe('retirement form: the old intake question set is still asked', () => {
  // Captured from the intake before slice w1 (the provisional form carried
  // these three after the core, one per screen).
  const OLD_QUESTIONS: readonly OldQuestion[] = [
    { path: 'person.retirementAge', label: 'Target retirement age', kind: 'number', min: 30, max: 85, step: 1 },
    { path: 'investing.investedBalance', label: 'Invested balance', kind: 'money', help: 'A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund.', min: 0 },
    { path: 'investing.monthlyContribution', label: 'Monthly investing contribution', kind: 'money', help: 'What you put toward investing each month across all accounts, including your own 401(k) contributions.', min: 0 },
  ];

  it('asks the old core screens first and every old question with its wording and bounds', () => {
    const asked = askedScreens('retirement');
    expect(asked.slice(0, OLD_CORE_FLOW.length).map((s) => s.id)).toEqual(OLD_CORE_FLOW.map(([id]) => id));
    const questions = asked.flatMap((s) => s.questions);
    for (const old of OLD_QUESTIONS) {
      const now = questions.find((q) => q.path === old.path);
      expect(now, old.path).toBeDefined();
      expect({ label: now!.label, kind: now!.kind, help: now!.help, min: now!.min, max: now!.max, step: now!.step }).toEqual({
        label: old.label,
        kind: old.kind,
        help: old.help,
        min: old.min,
        max: old.max,
        step: old.step,
      });
    }
  });
});
