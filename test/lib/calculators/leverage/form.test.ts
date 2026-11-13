/**
 * The leverage form (slice c7): every field the comparison uses, on the
 * screens of docs/rebuild-plan.md sections 2.12 and 2.14. The comparison
 * screen is the calculator's own; the intake asks the facts and the market
 * assumptions, 2 screens after the core.
 */

import { describe, expect, it } from 'vitest';
import { LEVERAGE_FORM } from '@/lib/calculators/leverage/form';
import {
  CORE_PATHS,
  getIntakeScreens,
  remainingIntakeScreens,
  skipLabelFor,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { resolveOptions, resolveText, screensFor, summarizeScreen, visibleScreenNotes } from '@/lib/fields/runtime';
import type { FieldSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { askedScreens, fromDefaults, type OldQuestion } from '@/test/utils/intakeFixture';

/** The questions the intake asked for the leverage intent before c7 (slice w1's fixture). */
const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'person.age': { path: 'person.age', label: 'Your age', kind: 'number', min: 16, max: 100, step: 1 },
  'leverage:person.retirementAge': { path: 'person.retirementAge', label: 'Age you plan to stop contributing', kind: 'number', min: 30, max: 85, step: 1 },
  'investing.taxableMonthlyContribution': { path: 'investing.taxableMonthlyContribution', label: 'Monthly taxable contribution', kind: 'money', help: 'Money you invest each month outside 401(k) and IRA accounts.', min: 0 },
  'leverage:investing.investedBalance': { path: 'investing.investedBalance', label: 'Starting balance', kind: 'money', help: 'Total across 401(k), IRA and brokerage, not your emergency fund.', min: 0 },
};

const spec = (path: string): FieldSpec => LEVERAGE_FORM.fields.find((field) => field.path === path)!;
const calculatorScreens = (get = fromDefaults()) =>
  screensFor(LEVERAGE_FORM, get, { mode: 'all', surface: 'calculator' }).map((s) => [s.id, s.fields]);
const remainingIds = (provided: string[]) =>
  getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided }).map((s) => s.id);

const MARKET_PATHS = [
  'assumptions.leverage.indexMeanReturn',
  'assumptions.leverage.indexVolatility',
  'assumptions.leverage.financingRate',
  'assumptions.leverage.expenseRatio',
  'assumptions.leverage.indexExpenseRatio',
];

describe('leverage form: screens', () => {
  it('has the comparison, facts and market screens, in that order', () => {
    expect(LEVERAGE_FORM.screens.map((s) => [s.id, s.tier, s.surface ?? 'both'])).toEqual([
      ['comparison', 'details', 'calculator'],
      ['facts', 'details', 'intake'],
      ['market', 'assumption', 'both'],
    ]);
  });

  it('shows the comparison and the market assumptions on the calculator', () => {
    expect(calculatorScreens()).toEqual([
      ['comparison', ['leverage.monthlyContribution', 'leverage.years', 'leverage.startingBalance', 'strategy.leverageRatio']],
      ['market', MARKET_PATHS],
    ]);
    const [comparison, market] = screensFor(LEVERAGE_FORM, fromDefaults(), { mode: 'all', surface: 'calculator' });
    expect(comparison.title).toBe('Contributions');
    expect(market.title).toBe('Assumptions');
  });

  it('asks the facts and the market assumptions in the intake, worded as before where they were asked before', () => {
    expect(askedScreens('leverage')).toEqual([
      {
        id: 'facts',
        title: 'What goes into the comparison?',
        description: undefined,
        questions: [
          { ...OLD_QUESTIONS['person.age'], help: undefined, options: undefined },
          { ...OLD_QUESTIONS['leverage:person.retirementAge'], help: undefined, options: undefined },
          { ...OLD_QUESTIONS['investing.taxableMonthlyContribution'], options: undefined, max: undefined, step: undefined },
          { ...OLD_QUESTIONS['leverage:investing.investedBalance'], options: undefined, max: undefined, step: undefined },
          {
            path: 'strategy.leverageRatio',
            label: 'Leverage ratio',
            kind: 'select',
            help: expect.any(Function),
            options: [
              { value: 1, label: '1x (index exposure, leveraged-fund fees)' },
              { value: 2, label: '2x (SSO-like daily-reset fund)' },
              { value: 3, label: '3x (UPRO-like daily-reset fund)' },
            ],
            min: 1,
            max: 3,
            step: undefined,
          },
        ],
      },
      {
        id: 'market',
        title: 'Assumptions',
        description: undefined,
        questions: [
          { path: MARKET_PATHS[0], label: 'Index expected annual return', kind: 'percent', help: 'Expected simple return of the underlying index, before fund costs.', options: undefined, min: -0.5, max: 0.3, step: undefined },
          { path: MARKET_PATHS[1], label: 'Index annual volatility', kind: 'percent', help: undefined, options: undefined, min: 0, max: 0.6, step: undefined },
          { path: MARKET_PATHS[2], label: 'Financing rate on borrowed exposure', kind: 'percent', help: 'Short-term rate plus swap spread, charged on the extra (L-1) exposure.', options: undefined, min: 0, max: 0.2, step: undefined },
          { path: MARKET_PATHS[3], label: 'Leveraged fund expense ratio', kind: 'percent', help: undefined, options: undefined, min: 0, max: 0.05, step: undefined },
          { path: MARKET_PATHS[4], label: 'Index fund expense ratio', kind: 'percent', help: undefined, options: undefined, min: 0, max: 0.05, step: undefined },
        ],
      },
    ]);
    const market = LEVERAGE_FORM.screens[2];
    expect(market.question).toBe('Which market assumptions should the comparison use?');
  });

  it('still asks every question the old intake asked', () => {
    const intake = getIntakeScreens('leverage', fromDefaults()).flatMap((s) => s.fields);
    const asked = new Set([...CORE_PATHS, ...intake]);
    for (const question of Object.values(OLD_QUESTIONS)) expect(asked.has(question.path), question.path).toBe(true);
    expect(intake).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.taxableMonthlyContribution',
      'investing.investedBalance',
      'strategy.leverageRatio',
      ...MARKET_PATHS,
    ]);
  });

  it('skips with a typical value on the facts and keeps the default assumptions on the market screen', () => {
    const [facts, market] = getIntakeScreens('leverage', fromDefaults());
    expect(skipLabelFor(facts)).toBe('Skip, use a typical value');
    expect(skipLabelFor(market)).toBe('Keep the default assumptions');
  });

  it('leaves the path count and seed to the results (Model and caveats): no note on the market screen', () => {
    const market = LEVERAGE_FORM.screens[2];
    expect(visibleScreenNotes(market, fromDefaults())).toEqual([]);
  });
});

describe('leverage form: the comparison fields', () => {
  it('derives the three overrides from the profile while they are null', () => {
    const contribution = spec('leverage.monthlyContribution');
    const years = spec('leverage.years');
    const balance = spec('leverage.startingBalance');
    const get = fromDefaults();
    expect([contribution.label, years.label, balance.label]).toEqual(['Monthly contribution', 'Years', 'Starting balance']);
    expect(resolveText(contribution.nullable!.autoLabel, get)).toBe('Your monthly taxable contribution');
    expect(resolveText(contribution.nullable!.autoLabel, fromDefaults({ 'investing.taxableMonthlyContribution': 0 }))).toBe(
      'Your monthly investing contribution'
    );
    expect(resolveText(years.nullable!.autoLabel, get)).toBe('From your age to the age you plan to stop contributing');
    expect(resolveText(balance.nullable!.autoLabel, get)).toBe('What you already have invested');
    // Defaults: taxable $500, age 30 to 60, $25,000 invested.
    const auto = (field: FieldSpec, g = get) => (field.nullable!.overrideDefault as (g: typeof get) => number)(g);
    expect([auto(contribution), auto(years), auto(balance)]).toEqual([500, 30, 25000]);
    expect(auto(contribution, fromDefaults({ 'investing.taxableMonthlyContribution': 0 }))).toBe(1500);
  });

  it('keeps the old units and bounds, with one short help line each', () => {
    expect(spec('leverage.monthlyContribution')).toMatchObject({
      kind: 'money',
      help: "Added at each month's start, to both funds.",
      min: 0,
      max: 1_000_000,
    });
    expect(spec('leverage.years')).toMatchObject({
      kind: 'number',
      help: '1 to 60 years.',
      unit: { suffix: ' yrs' },
      min: 1,
      max: 60,
      step: 1,
    });
    expect(spec('leverage.startingBalance')).toMatchObject({
      kind: 'money',
      help: 'Invested at month 0; 0 compares contributions only.',
      min: 0,
      max: 100_000_000,
    });
  });

  it('offers 1x, 2x and 3x plus a saved ratio, with help that depends on the ratio', () => {
    const ratio = spec('strategy.leverageRatio');
    expect(resolveOptions(ratio, fromDefaults({ 'strategy.leverageRatio': 2.5 }))).toEqual([
      { value: 1, label: '1x (index exposure, leveraged-fund fees)' },
      { value: 2, label: '2x (SSO-like daily-reset fund)' },
      { value: 2.5, label: '2.5x daily-reset fund' },
      { value: 3, label: '3x (UPRO-like daily-reset fund)' },
    ]);
    expect(resolveText(ratio.help, fromDefaults({ 'strategy.leverageRatio': 1 }))).toBe(
      'At 1x, the funds differ only in expense ratio.'
    );
    expect(resolveText(ratio.help, fromDefaults())).toBeUndefined();
    expect(resolveText(ratio.help, fromDefaults({ 'strategy.leverageRatio': 3 }))).toBeUndefined();
  });

  it('summarizes each screen in one line, auto values included', () => {
    const [comparison, , market] = LEVERAGE_FORM.screens;
    expect(summarizeScreen(LEVERAGE_FORM, comparison, fromDefaults())).toBe('$500/mo, 30 years, $25,000 start, 2x fund');
    expect(
      summarizeScreen(LEVERAGE_FORM, comparison, fromDefaults({ 'leverage.monthlyContribution': 750, 'leverage.years': 1 }))
    ).toBe('$750/mo, 1 year, $25,000 start, 2x fund');
    expect(summarizeScreen(LEVERAGE_FORM, market, fromDefaults())).toBe('10.0% return, 16.0% volatility, 4.50% financing');
  });
});

describe('leverage intake: validation', () => {
  it('requires the stop age strictly above the current age on the facts screen', () => {
    const get = fromDefaults({ 'person.age': 60, 'person.retirementAge': 60 });
    const facts = getIntakeScreens('leverage', get).find((s) => s.id === 'facts')!;
    expect(validateIntakeScreen('leverage', facts, get)).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
  });

  it('checks the bounds of each fact and rate', () => {
    const get = fromDefaults({
      'investing.taxableMonthlyContribution': -1,
      'strategy.leverageRatio': 5,
      'assumptions.leverage.indexVolatility': 0.9,
      'assumptions.leverage.financingRate': -0.01,
    });
    const [facts, market] = getIntakeScreens('leverage', get);
    expect(validateIntakeScreen('leverage', facts, get)).toEqual({
      'investing.taxableMonthlyContribution': 'Monthly taxable contribution must be at least $0.',
      'strategy.leverageRatio': 'Leverage ratio must be between 1 and 3.',
    });
    expect(validateIntakeScreen('leverage', market, get)).toEqual({
      'assumptions.leverage.indexVolatility': 'Index annual volatility must be between 0% and 60%.',
      'assumptions.leverage.financingRate': 'Financing rate on borrowed exposure must be between 0% and 20%.',
    });
  });
});

describe("leverage intake: 'remaining' mode", () => {
  it('asks 2 screens after the core, without the age', () => {
    const screens = getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(screens.map((s) => [s.id, s.fields])).toEqual([
      ['facts', ['person.retirementAge', 'investing.taxableMonthlyContribution', 'investing.investedBalance', 'strategy.leverageRatio']],
      ['market', MARKET_PATHS],
    ]);
    // 'all' mode keeps the age on the facts screen.
    expect(getIntakeScreens('leverage', fromDefaults())[0].fields[0]).toBe('person.age');
  });

  it('drops a screen once every fact on it is answered', () => {
    const facts = ['person.retirementAge', 'investing.taxableMonthlyContribution', 'investing.investedBalance'];
    // A partly answered facts screen still shows.
    expect(remainingIds([...CORE_PATHS, ...facts])).toEqual(['facts', 'market']);
    expect(remainingIds([...CORE_PATHS, ...facts, 'strategy.leverageRatio'])).toEqual(['market']);
    expect(remainingIds([...CORE_PATHS, ...facts, 'strategy.leverageRatio', ...MARKET_PATHS])).toEqual([]);
  });

  it('matches what /start/leverage asks on arrival, from the saved profile', () => {
    const profile = { ...getDefaultFinancialProfile(), provided: [...CORE_PATHS, ...MARKET_PATHS] };
    expect(remainingIntakeScreens('leverage', profile).map((s) => s.id)).toEqual(['facts']);
  });
});
