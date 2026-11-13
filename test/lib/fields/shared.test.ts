import { describe, expect, it } from 'vitest';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import {
  ACCOUNTS,
  ACCOUNTS_SCREEN,
  AGE,
  CORE_FIELDS,
  CORE_SCREENS,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_HELD_NOTE,
  EMERGENCY_FUND_MONTHS,
  FILING_STATUS,
  GROSS_PAY,
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
  TAXABLE_MONTHLY,
  ageSummary,
  filingStatusSummary,
  grossPaySummary,
  intakeDerivedWrites,
  monthlyCostSummary,
  payFrequencySummary,
  stateSummary,
  takeHomeSummary,
  usesTypedEmergencyFund,
  withOverrides,
} from '@/lib/fields/shared';
import { makeGet } from '@/lib/fields/paths';
import { relationErrors, resolveOptions, resolveText, summarizeScreen, visibleScreenNotes } from '@/lib/fields/runtime';
import type { FormSpec, Get } from '@/lib/fields/types';
import { PAY_FREQUENCIES, PROFILE_ENUM_VALUES, isProfilePath, normalizeProfile } from '@/lib/profile/defaults';
import { fromDefaults } from '@/test/utils/intakeFixture';
import { ownerRaw } from '@/test/factories/accountsFixtures';

const SHARED = [
  AGE,
  STATE,
  FILING_STATUS,
  GROSS_PAY,
  PAY_FREQUENCY,
  NET_PAY,
  NECESSARY_MONTHLY,
  RETIREMENT_AGE,
  ACCOUNTS,
  MONTHLY_INVESTING,
  TAXABLE_MONTHLY,
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_MONTHS,
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
    for (const spec of [FILING_STATUS, PAY_FREQUENCY]) {
      for (const option of resolveOptions(spec, getFrom({}))) {
        expect(PROFILE_ENUM_VALUES[spec.path]).toContain(option.value);
      }
    }
  });

  it('words filing status from the label table: all four statuses, whatever is saved (O10)', () => {
    const offered = [
      { value: 'single', label: 'Single' },
      { value: 'marriedJoint', label: 'Married filing jointly' },
      { value: 'marriedSeparate', label: 'Married filing separately' },
      { value: 'headOfHousehold', label: 'Head of household' },
    ];
    for (const saved of ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']) {
      expect(resolveOptions(FILING_STATUS, getFrom({ 'person.filingStatus': saved })), saved).toEqual(offered);
    }
    expect(FILING_STATUS_META.marriedJoint.phrase).toBe('married filing jointly');
  });

  it('asks the emergency fund target in whole months from 0 to 60, with one help line', () => {
    expect(EMERGENCY_FUND_MONTHS).toMatchObject({
      path: 'cash.targetMonths',
      kind: 'number',
      label: 'Emergency fund target',
      help: '3 to 6 months is common.',
      min: 0,
      max: 60,
      step: 1,
      precision: 0,
      tier: 'details',
    });
    expect(EMERGENCY_FUND_MONTHS.summary?.(6, getFrom({}))).toBe('6-month emergency fund');
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
    for (const spec of [GROSS_PAY, NET_PAY, NECESSARY_MONTHLY, MONTHLY_INVESTING, TAXABLE_MONTHLY]) {
      expect(spec.min, spec.path).toBe(0);
    }
  });

  it('marks the core facts as core and the rest as details', () => {
    expect(CORE_FIELDS.every((spec) => spec.tier === 'core')).toBe(true);
    expect(SHARED.filter((spec) => !CORE_FIELDS.includes(spec)).every((spec) => spec.tier === 'details')).toBe(true);
  });
});

describe('the account list and monthly investing (profile v3)', () => {
  it('asks the account list on one shared screen, with one row spec per account fact', () => {
    expect(ACCOUNTS_SCREEN).toEqual({
      id: 'accounts',
      title: 'What do you have saved and invested?',
      tier: 'details',
      surface: 'both',
      fields: ['portfolio.accounts'],
    });
    expect(ACCOUNTS).toMatchObject({
      path: 'portfolio.accounts',
      kind: 'list',
      label: 'Accounts',
      renderer: 'accounts',
      covers: ['portfolio.holdings', 'portfolio.securities'],
      minRows: 0,
      addLabel: 'Add account',
    });
    expect(ACCOUNTS.covers).not.toContain('portfolio.newCash');
    // Only the balance carries a line of text: its hint.
    expect(ACCOUNTS.row!.map((row) => [row.path, row.help, row.hint])).toEqual([
      ['kind', undefined, undefined],
      ['name', undefined, undefined],
      ['balance', undefined, "Today's balance."],
      ['holdsEmergencyFund', undefined, undefined],
    ]);
  });

  it('offers the emergency-fund tick on brokerage rows only', () => {
    const tick = ACCOUNTS.row!.find((row) => row.path === 'holdsEmergencyFund')!;
    expect(tick.visibleWhen!(getFrom({ kind: 'brokerage' }))).toBe(true);
    for (const kind of ['cash', '401k', 'hsa', 'roth-ira']) expect(tick.visibleWhen!(getFrom({ kind })), kind).toBe(false);
  });

  it('summarizes the list with accountsSummary', () => {
    expect(ACCOUNTS.summary!(undefined, fromDefaults())).toBe(
      '401(k) or similar $16,225; Brokerage (taxable) $8,775 (3 holdings)'
    );
  });

  it('runs monthly investing on Auto from the contribution answers, with the figure in the label', () => {
    expect(MONTHLY_INVESTING.label).toBe('Monthly investing');
    expect(MONTHLY_INVESTING.help).toBeUndefined();
    expect(resolveText(MONTHLY_INVESTING.nullable!.autoLabel, fromDefaults())).toBe('From your answers: $1,540 a month');
    expect((MONTHLY_INVESTING.nullable!.overrideDefault as (get: Get) => number)(fromDefaults())).toBe(1540);
  });

  it('hides the typed emergency fund while an account holds it, and says where it is held', () => {
    const owner = makeGet(normalizeProfile(ownerRaw()));
    expect(usesTypedEmergencyFund(fromDefaults())).toBe(true);
    expect(EMERGENCY_FUND_BALANCE.visibleWhen!(fromDefaults())).toBe(true);
    expect(EMERGENCY_FUND_BALANCE.visibleWhen!(owner)).toBe(false);
    const screen = { id: 'ef', title: 'Emergency fund', tier: 'details' as const, fields: [], notes: [EMERGENCY_FUND_HELD_NOTE] };
    expect(visibleScreenNotes(screen, fromDefaults())).toEqual([]);
    expect(visibleScreenNotes(screen, owner).map((note) => resolveText(note.text, owner))).toEqual([
      'Held in your accounts: Robinhood $10,350.',
    ]);
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

  it('asks the emergency fund, its target months included, on the one profile-only screen', () => {
    expect(PROFILE_EXTRA_SCREENS.map((s) => [s.id, s.fields])).toEqual([
      ['cash-buffer', ['cash.emergencyFundBalance', 'cash.emergencyFundApy', 'cash.targetMonths']],
    ]);
    expect(PROFILE_EXTRA_SCREENS[0].notes).toEqual([EMERGENCY_FUND_HELD_NOTE]);
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
  it('never derives the target months, whatever an old stored preset says', () => {
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'standard' }))).toEqual([]);
    expect(intakeDerivedWrites(getFrom({ 'strategy.preset': 'cashflow-investor', 'cash.targetMonths': 1 }))).toEqual([]);
  });

  it('raises a retirement age at or below the age to age + 1', () => {
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45, 'person.retirementAge': 45 }))).toEqual([
      { path: 'person.retirementAge', value: 46 },
    ]);
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45, 'person.retirementAge': 46 }))).toEqual([]);
    expect(intakeDerivedWrites(getFrom({ 'person.age': 45 }))).toEqual([]);
  });
});

describe('core summaries', () => {
  const CORE: FormSpec = { id: 'core', fields: CORE_FIELDS, screens: CORE_SCREENS };
  const cards = (values: Record<string, unknown> = {}) =>
    CORE_SCREENS.map((screen) => summarizeScreen(CORE, screen, getFrom(values)));
  const BASE = {
    'person.age': 25,
    'person.state': 'CA',
    'person.filingStatus': 'single',
    'income.grossPerPaycheck': 4000,
    'income.frequency': 'bi-weekly',
    'income.netPerPaycheck': 3000,
    'spending.necessaryMonthly': 3000,
  };

  it('words each collapsed core card in one compact line', () => {
    expect(cards(BASE)).toEqual(['25, CA, single', '$4,000 gross every 2 weeks, $3,000 take-home', '$3,000 a month']);
    expect(
      cards({ ...BASE, 'person.filingStatus': 'headOfHousehold', 'income.frequency': 'semi-monthly', 'income.grossPerPaycheck': 5250.6 })
    ).toEqual(['25, CA, head of household', '$5,251 gross twice a month, $3,000 take-home', '$3,000 a month']);
  });

  it('moves the cadence to the frequency when no gross amount carries it', () => {
    expect(cards({ ...BASE, 'income.grossPerPaycheck': undefined })[1]).toBe('paid every 2 weeks, $3,000 take-home');
    expect(cards({ ...BASE, 'income.grossPerPaycheck': undefined, 'income.netPerPaycheck': undefined })[1]).toBe(
      'paid every 2 weeks'
    );
  });

  it('gives each piece null for a value it cannot word', () => {
    expect([ageSummary(undefined), ageSummary(NaN), ageSummary('30')]).toEqual([null, null, null]);
    expect([stateSummary(''), stateSummary(undefined)]).toEqual([null, null]);
    expect([filingStatusSummary('toString'), filingStatusSummary(undefined)]).toEqual([null, null]);
    expect(grossPaySummary(undefined, 'weekly')).toBeNull();
    expect(grossPaySummary(1200, 'toString')).toBe('$1,200 gross per paycheck');
    expect([payFrequencySummary('yearly'), takeHomeSummary(null), monthlyCostSummary(Infinity)]).toEqual([null, null, null]);
  });

  it('words every filing status and pay frequency from the label constants', () => {
    for (const [status, meta] of Object.entries(FILING_STATUS_META)) expect(filingStatusSummary(status)).toBe(meta.phrase);
    for (const frequency of PAY_FREQUENCIES) {
      expect(grossPaySummary(100, frequency)).toBe(`$100 gross ${PAY_FREQUENCY_META[frequency].cadence}`);
      expect(payFrequencySummary(frequency)).toBe(`paid ${PAY_FREQUENCY_META[frequency].cadence}`);
    }
  });
});
