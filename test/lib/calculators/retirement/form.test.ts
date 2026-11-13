/**
 * The retirement form: the six screens after the core (plan sections 2.12
 * and 2.14), of which the intent intake asks two, the shared accounts screen
 * and the target (monthly investing and the claiming age are calculator-only
 * controls, the Social Security and healthcare screen is optional, and the
 * assumptions stay on the page), what each
 * asks, its visibility rules,
 * validation and 'remaining' mode, the nullable overrides, and proof that
 * every question the old intake asked is still asked.
 */

import { describe, expect, it } from 'vitest';
import {
  EFFECTIVE_TAX_RATE,
  ANNUAL_HEALTHCARE_COST,
  IRA_ROTH_TIMING,
  IRA_TRADITIONAL_TIMING,
  TAXABLE_TIMING,
  SOCIAL_SECURITY_BENEFIT,
  TARGET_RETIREMENT_INCOME,
  tdfProfileFor,
} from '@/lib/calculators/retirement/fields';
import { RETIREMENT_FORM } from '@/lib/calculators/retirement/form';
import {
  CORE_PATHS,
  getIntakeScreens,
  remainingIntakeScreens,
  nextNeedsOwnAnswer,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { fieldMap, resolveOptions, resolveOverrideDefault, summarizeScreen } from '@/lib/fields/runtime';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { PROFILE_FORM, profileFormSection } from '@/lib/calculators/forms';
import { screensFor } from '@/lib/fields/runtime';
import {
  OLD_CORE_FLOW,
  askedScreen,
  askedScreens,
  fromDefaults,
  intakePaths,
  type OldQuestion,
} from '@/test/utils/intakeFixture';
import { makeGet } from '@/lib/fields/paths';
import { visibleScreenFields } from '@/lib/fields/runtime';
import { normalizeProfile } from '@/lib/profile/defaults';
import { ownerRaw } from '@/test/factories/accountsFixtures';

const ids = (overrides: Record<string, unknown> = {}) =>
  getIntakeScreens('retirement', fromDefaults(overrides)).map((s) => s.id);

const remainingIds = (provided: string[], overrides: Record<string, unknown> = {}) =>
  getIntakeScreens('retirement', fromDefaults(overrides), { mode: 'remaining', provided }).map((s) => s.id);

const screen = (id: string) => RETIREMENT_FORM.screens.find((s) => s.id === id)!;

/** Every screen of the form as the intake would show it, the optional one included. */
const allScreens = (overrides: Record<string, unknown> = {}) =>
  RETIREMENT_FORM.screens.map((s) => askedScreen(RETIREMENT_FORM, s, fromDefaults(overrides)));

/** Each screen's visible questions, by path. */
const fieldsByScreen = (overrides: Record<string, unknown> = {}) =>
  Object.fromEntries(allScreens(overrides).map((s) => [s.id, s.questions.map((q) => q.path)]));

const validate = (id: string, overrides: Record<string, unknown>) =>
  validateIntakeScreen('retirement', screen(id), fromDefaults(overrides));

const profileWith = (provided: string[]): FinancialProfile => ({ ...getDefaultFinancialProfile(), provided });

const CUSTOM = { 'assumptions.retirement.riskProfile': 'custom' };

describe('retirement form: screens', () => {
  it('asks the core, then accounts and target; Social Security and healthcare is optional, monthly investing and claiming are page-only', () => {
    expect(ids()).toEqual(['about', 'pay', 'must-pay', 'accounts', 'target']);
    expect(RETIREMENT_FORM.screens.map((s) => [s.id, s.tier, s.surface, s.optional])).toEqual([
      ['about', 'core', undefined, undefined],
      ['pay', 'core', undefined, undefined],
      ['must-pay', 'core', undefined, undefined],
      ['accounts', 'details', 'both', undefined],
      ['monthly-investing', 'details', 'calculator', undefined],
      ['target', 'details', undefined, undefined],
      ['ss-healthcare', 'details', undefined, true],
      ['claiming', 'details', 'calculator', undefined],
      ['assumptions', 'assumption', undefined, undefined],
    ]);
  });

  it('asks 2 screens after the core in the intent intake (plan section 2.12, less the optional, claiming and assumptions)', () => {
    expect(remainingIds([...CORE_PATHS])).toEqual(['accounts', 'target']);
  });

  it('keeps the optional screen on the calculator page, and adds the claiming-age control after it', () => {
    const page = screensFor(RETIREMENT_FORM, fromDefaults(), { mode: 'all', surface: 'calculator' }).map((s) => s.id);
    expect(page).toEqual([
      'about',
      'pay',
      'must-pay',
      'accounts',
      'monthly-investing',
      'target',
      'ss-healthcare',
      'claiming',
      'assumptions',
    ]);
  });

  it('asks the optional screen at the end of the profile form, in the section "Optional"', () => {
    const last = PROFILE_FORM.screens[PROFILE_FORM.screens.length - 1];
    expect(last.id).toBe('ss-healthcare');
    expect(last.fields).toEqual(screen('ss-healthcare').fields);
    expect(profileFormSection(last.id)).toBe('optional');
  });

  it('titles each screen, with a question for the wizard where the card title is not one', () => {
    expect(
      RETIREMENT_FORM.screens.slice(3).map((s) => ({ id: s.id, title: s.title, question: s.question, description: s.description }))
    ).toEqual([
      { id: 'accounts', title: 'What do you have saved and invested?', question: undefined, description: undefined },
      { id: 'monthly-investing', title: 'Monthly investing', question: undefined, description: undefined },
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
        description: "Amounts are in today's dollars.",
      },
      {
        id: 'claiming',
        title: 'When to claim Social Security',
        question: undefined,
        description: "Amounts are in today's dollars.",
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
      // No take-home pay: no retirement binding reads it.
      pay: ['income.grossPerPaycheck', 'income.frequency'],
      'must-pay': ['spending.necessaryMonthly'],
      accounts: ['portfolio.accounts'],
      // The default runs only the taxable part of Auto monthly investing (500), so only its timing shows.
      'monthly-investing': ['investing.monthlyContribution', 'investing.taxableTiming'],
      target: ['person.retirementAge', 'spending.targetRetirementIncome', 'person.lifeExpectancy'],
      'ss-healthcare': ['retirementIncome.socialSecurityBenefit', 'retirementIncome.annualHealthcareCost'],
      claiming: ['retirementIncome.socialSecurityAge'],
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
    const asked = allScreens(CUSTOM).flatMap((s) => s.questions);
    const pick = (path: string) => {
      const { label, kind, min, max, step } = asked.find((q) => q.path === path)!;
      return { label, kind, min, max, step };
    };
    expect(pick('spending.targetRetirementIncome')).toEqual({ label: 'Target annual income in retirement', kind: 'money', min: 0, max: undefined, step: undefined });
    expect(pick('person.lifeExpectancy')).toEqual({ label: 'Life expectancy', kind: 'number', min: 50, max: 110, step: 1 });
    expect(pick('retirementIncome.socialSecurityBenefit')).toEqual({ label: 'Social Security benefit', kind: 'money', min: 0, max: undefined, step: undefined });
    expect(pick('retirementIncome.socialSecurityAge')).toEqual({ label: 'Social Security claiming age', kind: 'custom', min: 62, max: 70, step: undefined });
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
    expect(resolveOptions(spec, fromDefaults({ 'person.age': 30 }))).toEqual([
      {
        value: 'tdf',
        label: 'Target Date Fund',
        description: `Age-based: 90% stocks, ${Math.round(at30.accumulationReturn * 100)}% / ${Math.round(at30.retirementReturn * 100)}% returns`,
      },
      { value: 'custom', label: 'Custom' },
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

  it('summarizes the collapsed core cards with their values; take-home pay is not on them', () => {
    const summary = (id: string, get = fromDefaults()) => summarizeScreen(RETIREMENT_FORM, screen(id), get);
    // The filing status always shows; it says so when it runs here as single (the form's own FILING summary).
    expect(summary('about')).toBe('25, CA, single');
    expect(summary('about', fromDefaults({ 'person.filingStatus': 'marriedJoint' }))).toBe(
      '25, CA, married filing jointly'
    );
    expect(summary('about', fromDefaults({ 'person.filingStatus': 'marriedSeparate' }))).toBe(
      '25, CA, married filing separately, run here as single'
    );
    expect(summary('pay')).toBe('$4,000 gross every 2 weeks');
    expect(summary('must-pay')).toBe('$3,000 a month');
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
    expect(summarizeScreen(RETIREMENT_FORM, screen('accounts'), fromDefaults())).toBe(
      '401(k) or similar $16,225; Brokerage (taxable) $8,775 (3 holdings)'
    );
    // Auto sums the normal contributions: 693.33 own 401(k) (8% of 8,666.67 a month) + 346.67 match (4%) + 500 taxable.
    expect(summarizeScreen(RETIREMENT_FORM, screen('monthly-investing'), fromDefaults())).toBe('saving $1,540/mo');
    expect(
      summarizeScreen(RETIREMENT_FORM, screen('monthly-investing'), fromDefaults({ 'investing.monthlyContribution': 1500 }))
    ).toBe('saving $1,500/mo');
    expect(summarizeScreen(RETIREMENT_FORM, screen('target'), fromDefaults())).toBe('retire at 65, $41,000/yr target, plan to age 90');
    // Auto reads as an estimate (104,000 a year of pay: $40,359), never as the visitor's number.
    expect(summarizeScreen(RETIREMENT_FORM, screen('ss-healthcare'), fromDefaults())).toBe(
      'Social Security estimate $40,359/yr, typical healthcare cost'
    );
    expect(
      summarizeScreen(RETIREMENT_FORM, screen('ss-healthcare'), fromDefaults({ 'retirementIncome.socialSecurityBenefit': 30000 }))
    ).toBe('Social Security $30,000/yr, typical healthcare cost');
    expect(summarizeScreen(RETIREMENT_FORM, screen('claiming'), fromDefaults())).toBe('claim at 67 (full)');
    // A stored age between the choices reads as the nearest choice.
    expect(
      summarizeScreen(RETIREMENT_FORM, screen('claiming'), fromDefaults({ 'retirementIncome.socialSecurityAge': 64 }))
    ).toBe('claim at 62 (early)');
  });

  it('takes the typical values on Next on the topic screens and the assumptions', () => {
    expect(['accounts', 'target', 'ss-healthcare', 'assumptions'].map((id) => nextNeedsOwnAnswer(screen(id)))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('retirement form: nullable overrides', () => {
  it('estimates the effective tax rate from the target income and the filing status the model runs', () => {
    const at80k = (values: Record<string, unknown> = {}) =>
      fromDefaults({ 'spending.targetRetirementIncome': 80000, ...values });
    // 80,000 single: 63,900 taxable after the 16,100 deduction;
    // 1,240 + 4,560 + 2,970 = 8,770 tax, 10.9625%.
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, at80k())).toBeCloseTo(0.109625, 10);
    // Head of household runs as single (O10).
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, at80k({ 'person.filingStatus': 'headOfHousehold' }))).toBeCloseTo(0.109625, 10);
    // Joint: 47,800 taxable after 32,200; 2,480 + 2,760 = 5,240 tax, 6.55%.
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, at80k({ 'person.filingStatus': 'marriedJoint' }))).toBeCloseTo(0.0655, 10);
    // The PR 3 default target, 41,000 single: 24,900 taxable; 1,240 + 1,500 = 2,740 tax, 2,740 / 41,000.
    expect(resolveOverrideDefault(EFFECTIVE_TAX_RATE, fromDefaults())).toBeCloseTo(2740 / 41000, 10);
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

  it('keeps the claiming age between 62 and 70, and accepts a stored age between the three choices', () => {
    expect(validate('claiming', { 'retirementIncome.socialSecurityAge': 61 })).toEqual({
      'retirementIncome.socialSecurityAge': 'Social Security claiming age must be between 62 and 70.',
    });
    expect(validate('claiming', { 'retirementIncome.socialSecurityAge': 65 })).toEqual({});
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
    expect(remainingIds([])).toEqual(['accounts', 'target']);
    expect(remainingIds([...CORE_PATHS, 'person.retirementAge'])).toEqual(['accounts', 'target']);
    expect(remainingIds(['portfolio.accounts', 'person.retirementAge'])).toEqual(['target']);
    expect(remainingIds(intakePaths('retirement'))).toEqual([]);
  });

  it('never asks the assumptions or the claiming age, answered or not', () => {
    expect(remainingIds([], CUSTOM)).toEqual(['accounts', 'target']);
    expect(remainingIds(['retirementIncome.socialSecurityAge'])).toEqual(['accounts', 'target']);
    // Monthly investing is calculator-only: answered or not, the intake does not ask it.
    expect(remainingIds(['investing.monthlyContribution'])).toEqual(['accounts', 'target']);
  });

  it('matches what /start/retirement asks on arrival, from the saved profile', () => {
    const profile = profileWith([...CORE_PATHS, 'portfolio.accounts']);
    expect(remainingIntakeScreens('retirement', profile).map((s) => s.id)).toEqual(['target']);
  });

  it('asks the same screens whether or not the optional facts were saved earlier', () => {
    const optional = screen('ss-healthcare').fields;
    const base = [...CORE_PATHS, 'portfolio.accounts'];
    const ids = (provided: string[]) => remainingIntakeScreens('retirement', profileWith(provided)).map((s) => s.id);
    expect(ids([...base, ...optional])).toEqual(ids(base));
  });
});

describe('retirement form: the old intake question set is still asked', () => {
  // Captured from the intake before slice w1 (the provisional form carried
  // the retirement age, the invested balance and the monthly contribution
  // after the core, one per screen). In v3 the invested balance is the sum of
  // the account list's balances, and the monthly contribution is Auto from
  // the contribution answers, a calculator-only control.
  const OLD_QUESTIONS: readonly OldQuestion[] = [
    { path: 'person.retirementAge', label: 'Target retirement age', kind: 'number', min: 30, max: 85, step: 1 },
  ];

  it('asks the account list where the invested balance was, and keeps monthly investing on the page', () => {
    const asked = askedScreens('retirement');
    expect(asked.find((s) => s.id === 'accounts')?.questions.map((q) => q.path)).toEqual(['portfolio.accounts']);
    const paths = asked.flatMap((s) => s.questions.map((q) => q.path));
    expect(paths).not.toContain('investing.investedBalance');
    expect(paths).not.toContain('investing.monthlyContribution');
    expect(screen('monthly-investing').surface).toBe('calculator');
  });

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

describe('retirement form: placeholders', () => {
  it('gives the derived target income no fixed placeholder, which would disagree once must-pay is answered', () => {
    expect(TARGET_RETIREMENT_INCOME.placeholder).toBeUndefined();
  });

  it('gives the Social Security benefit no placeholder from the old 30,000 default', () => {
    expect(SOCIAL_SECURITY_BENEFIT.placeholder).toBeUndefined();
  });
});

describe('retirement form: contribution timing on the Monthly investing card', () => {
  const visibleOn = (get: ReturnType<typeof fromDefaults>) =>
    visibleScreenFields(RETIREMENT_FORM, screen('monthly-investing'), get).map((spec) => spec.path);
  const owner = () => makeGet(normalizeProfile(ownerRaw()));

  it('puts the three timing choices on the calculator-only monthly-investing screen, after monthly investing', () => {
    expect(screen('monthly-investing').fields).toEqual([
      'investing.monthlyContribution',
      'ira.traditionalTiming',
      'ira.rothTiming',
      'investing.taxableTiming',
    ]);
    const formPaths = RETIREMENT_FORM.fields.map((spec) => spec.path);
    const at = formPaths.indexOf('investing.monthlyContribution');
    expect(formPaths.slice(at, at + 4)).toEqual(screen('monthly-investing').fields);
    for (const spec of [IRA_TRADITIONAL_TIMING, IRA_ROTH_TIMING, TAXABLE_TIMING]) {
      expect(spec).toMatchObject({ kind: 'choice', tier: 'details' });
      expect(spec.help).toBeUndefined();
      expect(spec.hint).toBeUndefined();
      expect(spec.question).toBeUndefined();
    }
    expect([IRA_TRADITIONAL_TIMING, IRA_ROTH_TIMING, TAXABLE_TIMING].map((spec) => spec.label)).toEqual([
      'Traditional IRA',
      'Roth IRA',
      'Taxable investing',
    ]);
  });

  it('shows the parts in use while Auto is on: taxable for the default, Roth and taxable for the owner', () => {
    expect(visibleOn(fromDefaults())).toEqual(['investing.monthlyContribution', 'investing.taxableTiming']);
    expect(visibleOn(owner())).toEqual(['investing.monthlyContribution', 'ira.rothTiming', 'investing.taxableTiming']);
    expect(
      visibleOn(fromDefaults({ 'ira.traditional': true, 'ira.traditionalMonthly': 100, 'investing.taxableMonthlyContribution': 0 }))
    ).toEqual(['investing.monthlyContribution', 'ira.traditionalTiming']);
    // An IRA switched on with nothing in it, or an amount with the IRA off, shows nothing.
    expect(visibleOn(fromDefaults({ 'ira.roth': true, 'ira.rothMonthly': 0 }))).not.toContain('ira.rothTiming');
    expect(visibleOn(fromDefaults({ 'ira.roth': false, 'ira.rothMonthly': 625 }))).not.toContain('ira.rothTiming');
  });

  it('hides all three under a Custom monthly investing figure (it is all monthly)', () => {
    expect(visibleOn(fromDefaults({ 'investing.monthlyContribution': 1500 }))).toEqual(['investing.monthlyContribution']);
    const ownerCustom = (path: string) => (path === 'investing.monthlyContribution' ? 1500 : owner()(path));
    expect(visibleOn(ownerCustom)).toEqual(['investing.monthlyContribution']);
  });

  it('labels the yearly option with 12 x the part', () => {
    expect(resolveOptions(IRA_ROTH_TIMING, owner())).toEqual([
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearStart', label: 'Once a year, at the start: $7,500' },
    ]);
    expect(resolveOptions(TAXABLE_TIMING, fromDefaults()).map((o) => o.label)).toEqual([
      'Monthly',
      'Once a year, at the start: $6,000',
    ]);
    // A negative amount reads as 0.
    expect(
      resolveOptions(IRA_TRADITIONAL_TIMING, fromDefaults({ 'ira.traditionalMonthly': -5 })).map((o) => o.label)
    ).toEqual(['Monthly', 'Once a year, at the start: $0']);
  });

  it('keeps the card summary on monthly, and names a yearly part', () => {
    expect(summarizeScreen(RETIREMENT_FORM, screen('monthly-investing'), fromDefaults())).toBe('saving $1,540/mo');
    expect(
      summarizeScreen(RETIREMENT_FORM, screen('monthly-investing'), fromDefaults({ 'investing.taxableTiming': 'yearStart' }))
    ).toBe('saving $1,540/mo, Taxable investing once a year, at the start');
  });
});
