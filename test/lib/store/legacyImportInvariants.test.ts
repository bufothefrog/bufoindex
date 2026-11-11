/**
 * The legacy import's invariants over a fixed grid of old payloads and
 * starting profiles (no randomness). Each case seeds the profile (fresh,
 * pay fully answered, or only the take-home pay, only the frequency or only
 * the gross pay answered), stores the old paycheck and retirement keys
 * (absent, untouched or changed), runs importLegacyStorage(LEGACY_IMPORTS)
 * once, as every calculator page does, and checks:
 *
 * I1 take-home pay never above gross pay (and no NET_PAY_AT_MOST_GROSS error);
 * I2 gross pay and frequency are one record's pair (the seeded profile's, a
 *    key's own, or an old yearly or hourly income written for the frequency
 *    the profile holds), the take-home pay is a record's own, the answered
 *    one, or a record's share of gross pay, and a 401(k) total keeps the
 *    split it was saved with;
 * I3 the visitor's own values survive, except where an old pay group meets
 *    an answered pay path holding another value (answered before the import,
 *    or by the paycheck key imported first), which skips the group whole;
 * I4 an untouched old key alone, on a fresh profile, reproduces the old run;
 * I5 strict: nothing unanswered becomes provided, and no provided path
 *    changes its value at all;
 * I6 a second call is a no-op; each key is gone after the call; a corrupt
 *    or foreign payload changes nothing and does not stop the other key;
 * I7 on a sample of cases, the profile is the same whichever of the four
 *    calculator pages runs the import.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalculatorBootstrap } from '@/components/calculators/shared/useCalculatorBootstrap';
import { annualizeIncome, type IncomePeriod, type RetirementInputs } from '@/lib/calculations/retirement';
import { LEGACY_IMPORTS } from '@/lib/calculators/legacyImports';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY } from '@/lib/calculators/paycheck/legacy';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_LEGACY } from '@/lib/calculators/retirement/legacy';
import { engineInputsFor, validateFor } from '@/lib/calculators/runtime';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { PAY_FREQUENCY_META, type PayFrequency } from '@/lib/constants/frequency';
import { stableKey } from '@/lib/fields/binding';
import { getAt } from '@/lib/fields/paths';
import { NET_PAY_AT_MOST_GROSS } from '@/lib/fields/shared';
import { getDefaultFinancialProfile } from '@/lib/profile';
import type { ContributionType, FinancialProfile, ProfilePatch } from '@/lib/profile/types';
import type { CalculatorStore } from '@/lib/store/createCalculatorStore';
import { importLegacyStorage } from '@/lib/store/legacyImport';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const GROSS = 'income.grossPerPaycheck';
const NET = 'income.netPerPaycheck';
const FREQUENCY = 'income.frequency';
const TYPE = 'workplace.contributionType';
const PERCENT = 'workplace.contributionPercent';
const ROTH = 'workplace.rothContributionPercent';

/** Pay as the profile holds it: per paycheck of `frequency` (no take-home pay for the retirement key). */
interface Pay {
  gross: number;
  net?: number;
  frequency: PayFrequency;
}

/**
 * The pay an old key stands for: a per-paycheck record, or (an old yearly
 * or hourly retirement income) an annual income with no frequency of its own.
 */
type OldPay = Pay | { annual: number };

/** A 401(k) election as the profile holds it. */
interface Election {
  type: ContributionType;
  percent: number;
  roth: number;
}

/** One old key as a case stores it, with what the profile should hold from it. */
interface OldKey {
  label: string;
  id: 'retirement' | 'paycheck';
  storageKey: string;
  payload: unknown;
  /** The pay this payload stands for (changed or the old default). */
  pay: OldPay;
  /** Set when the visitor changed the pay. */
  payChanged: boolean;
  /** The 401(k) election this payload stands for (paycheck key only). */
  election?: Election;
  electionChanged: boolean;
  /** The profile paths the visitor's changes write (the only ones that may become provided). */
  touched: readonly string[];
}

/** A profile the visitor answered some pay facts in before the import. */
interface Seed {
  label: string;
  patch: ProfilePatch;
}

interface Case {
  name: string;
  paycheck?: OldKey;
  retirement?: OldKey;
  seed: Seed;
}

const PROFILE_DEFAULTS = getDefaultFinancialProfile();
const DEFAULT_ELECTION: Election = {
  type: PROFILE_DEFAULTS.workplace.contributionType,
  percent: PROFILE_DEFAULTS.workplace.contributionPercent,
  roth: PROFILE_DEFAULTS.workplace.rothContributionPercent,
};

const SEEDS: readonly Seed[] = [
  { label: 'fresh profile', patch: {} },
  // 100,800 a year (the retirement grid's yearly 100,800) as 8,400 monthly.
  { label: 'pay 8,400 / 6,000 monthly answered', patch: { income: { grossPerPaycheck: 8400, netPerPaycheck: 6000, frequency: 'monthly' } } },
  { label: 'only take-home 2,800 answered', patch: { income: { netPerPaycheck: 2800 } } },
  // Only the frequency, as the paycheck page's frequency select alone marks it.
  { label: 'only frequency semi-monthly answered', patch: { income: { frequency: 'semi-monthly' } } },
  // 100,800 a year once more, as the bi-weekly gross the retirement key's yearly 100,800 writes.
  { label: 'only gross 3,876.92 answered', patch: { income: { grossPerPaycheck: 3876.92 } } },
];

// ---------------------------------------------------------------------------
// Building the old keys
// ---------------------------------------------------------------------------

/** The pay an old retirement entry stands for, computed here independently of the bindings. */
function retirementPay(amount: number, period: IncomePeriod): OldPay {
  const kept: Partial<Record<IncomePeriod, PayFrequency>> = { biweekly: 'bi-weekly', semimonthly: 'semi-monthly', monthly: 'monthly' };
  const frequency = kept[period];
  return frequency ? { gross: amount, frequency } : { annual: annualizeIncome(amount, period) };
}

/** The old retirement key with `inputs` changed over the old defaults ({} is untouched). */
function retirementKey(label: string, inputs: Partial<RetirementInputs>): OldKey {
  const stored = { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs };
  const payChanged = 'incomeAmount' in inputs || 'incomePeriod' in inputs;
  const pay = retirementPay(stored.incomeAmount, stored.incomePeriod);
  return {
    label: `retirement ${label}`,
    id: 'retirement',
    storageKey: RETIREMENT_LEGACY.storageKey,
    payload: { state: { inputs: stored, showAdvanced: true }, version: 3 },
    pay,
    payChanged,
    electionChanged: false,
    touched: payChanged ? ('annual' in pay ? [GROSS] : [GROSS, FREQUENCY]) : [],
  };
}

/** The old paycheck key with its pay and/or 401(k) election changed over the old defaults. */
function paycheckKey(label: string, change: { pay?: Required<Pay>; election?: Election } = {}): OldKey {
  const profile = PAYCHECK_LEGACY.storageDefaults();
  if (change.pay) {
    profile.income = { ...profile.income, grossPaycheck: change.pay.gross, netPaycheck: change.pay.net, frequency: change.pay.frequency };
  }
  if (change.election) {
    const { type, percent, roth } = change.election;
    profile.benefits.employer401k = {
      ...profile.benefits.employer401k,
      contributionType: type,
      currentContribution: percent,
      traditionalContribution: percent - roth,
      rothContribution: roth,
    };
  }
  const plan = profile.benefits.employer401k;
  return {
    label: `paycheck ${label}`,
    id: 'paycheck',
    storageKey: PAYCHECK_LEGACY.storageKey,
    payload: { state: { profile, currentStep: 4, hasCalculatedOnce: true }, version: 0 },
    pay: { gross: profile.income.grossPaycheck, net: profile.income.netPaycheck, frequency: profile.income.frequency },
    payChanged: change.pay !== undefined,
    election: { type: plan.contributionType, percent: plan.currentContribution, roth: plan.rothContribution },
    electionChanged: change.election !== undefined,
    touched: [
      ...(change.pay ? [GROSS, NET, FREQUENCY] : []),
      ...(change.election ? [TYPE, PERCENT, ...(change.election.type === 'split' ? [ROTH] : [])] : []),
    ],
  };
}

const RETIREMENT_KEYS: readonly (OldKey | undefined)[] = [
  undefined,
  retirementKey('untouched', {}),
  retirementKey('yearly 50,000', { incomeAmount: 50000, incomePeriod: 'yearly' }),
  // 100,800 a year is the paycheck grid's 4,200 semi-monthly in another form.
  retirementKey('yearly 100,800', { incomeAmount: 100800, incomePeriod: 'yearly' }),
  retirementKey('yearly 250,000', { incomeAmount: 250000, incomePeriod: 'yearly' }),
  retirementKey('hourly 25', { incomeAmount: 25, incomePeriod: 'hourly' }),
  // 104,000 a year is the paycheck grid's 2,000 weekly in another form.
  retirementKey('hourly 50', { incomeAmount: 50, incomePeriod: 'hourly' }),
  retirementKey('monthly 8,000', { incomeAmount: 8000, incomePeriod: 'monthly' }),
  // Below both the profile default take-home pay and the answered one.
  retirementKey('bi-weekly 2,400', { incomeAmount: 2400, incomePeriod: 'biweekly' }),
  retirementKey('semi-monthly 4,200', { incomeAmount: 4200, incomePeriod: 'semimonthly' }),
  retirementKey('monthly 3,000', { incomeAmount: 3000, incomePeriod: 'monthly' }),
  // One member of the coupled income entry: the period alone.
  retirementKey('only the period (monthly)', { incomePeriod: 'monthly' }),
];

const PAYCHECK_KEYS: readonly (OldKey | undefined)[] = [
  undefined,
  paycheckKey('untouched'),
  paycheckKey('weekly 2,000 / 1,500', { pay: { gross: 2000, net: 1500, frequency: 'weekly' } }),
  paycheckKey('bi-weekly 4,000 / 2,900', { pay: { gross: 4000, net: 2900, frequency: 'bi-weekly' } }),
  paycheckKey('semi-monthly 4,200 / 3,050', { pay: { gross: 4200, net: 3050, frequency: 'semi-monthly' } }),
  paycheckKey('monthly 8,400 / 6,000', { pay: { gross: 8400, net: 6000, frequency: 'monthly' } }),
  // One member of a coupled group: the frequency alone, the 401(k) split alone.
  paycheckKey('only the frequency (monthly)', { pay: { gross: 2500, net: 1900, frequency: 'monthly' } }),
  paycheckKey('only the 401(k) split', { election: { type: 'split', percent: 0.03, roth: 0.015 } }),
];

function buildCases(): Case[] {
  return SEEDS.flatMap((seed) =>
    PAYCHECK_KEYS.flatMap((paycheck) =>
      RETIREMENT_KEYS.map((retirement) => ({
        name: [paycheck?.label ?? 'no paycheck key', retirement?.label ?? 'no retirement key', seed.label].join(' | '),
        paycheck,
        retirement,
        seed,
      }))
    )
  );
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

const profile = () => useProfileStore.getState().profile;

/** The keys of `c`, in the order the import handles them (paycheck first). */
function keysOf(c: Case): OldKey[] {
  return [c.paycheck, c.retirement].filter((key): key is OldKey => key !== undefined);
}

/** Seeds the profile and stores the old keys of `c`; returns the seeded profile. */
function prepare(c: Case): FinancialProfile {
  clearBrowserState();
  resetProfileStore({ profile: c.seed.patch });
  for (const key of keysOf(c)) localStorage.setItem(key.storageKey, JSON.stringify(key.payload));
  return profile();
}

/** Seeds, stores, runs the import once and returns the profile before and after. */
function runCase(c: Case): { before: FinancialProfile; after: FinancialProfile } {
  const before = prepare(c);
  expect(() => importLegacyStorage(LEGACY_IMPORTS)).not.toThrow();
  // I6: each key is removed once its import ran.
  for (const key of keysOf(c)) expect(localStorage.getItem(key.storageKey)).toBeNull();
  return { before, after: profile() };
}

// ---------------------------------------------------------------------------
// The invariants
// ---------------------------------------------------------------------------

const CENT = 0.005 + 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
const toCents = (value: number) => Math.round(value * 100) / 100;
const perYear = (frequency: PayFrequency) => PAY_FREQUENCY_META[frequency].perYear;
const holdsPay = (income: FinancialProfile['income'], pay: Pay) =>
  income.frequency === pay.frequency && same(income.grossPerPaycheck, pay.gross) && (pay.net === undefined || same(income.netPerPaycheck, pay.net));
const holdsElection = (after: FinancialProfile, election: Election) =>
  after.workplace.contributionType === election.type &&
  same(after.workplace.contributionPercent, election.percent) &&
  (election.type !== 'split' || same(after.workplace.rothContributionPercent, election.roth));
/** The share of gross pay a record's take-home pay is, capped at 1 (the documented rule). */
const shareOf = (pay: Pay) => Math.min((pay.net ?? 0) / pay.gross, 1);
const seedPay = (seeded: FinancialProfile): Pay => ({
  gross: seeded.income.grossPerPaycheck,
  net: seeded.income.netPerPaycheck,
  frequency: seeded.income.frequency,
});
/**
 * The tolerance of a take-home pay at a share of `gross`: a cent, plus one
 * cent rounding at an intermediate gross pay of at least 1,000 (every gross
 * pay in the grid) carried to `gross`.
 */
const shareTolerance = (gross: number) => CENT * (1 + gross / 1000);

/** The pay values an answered path holds in `profile`, by path. */
function answeredPay(profile: FinancialProfile): Map<string, unknown> {
  const values: Record<string, unknown> = { [GROSS]: profile.income.grossPerPaycheck, [NET]: profile.income.netPerPaycheck, [FREQUENCY]: profile.income.frequency };
  return new Map(profile.provided.filter((path) => path in values).map((path) => [path, values[path]]));
}

/**
 * Whether a pay group writing `writes` is imported over the answered pay
 * `answered` (path -> value): no answered path in it holds another value,
 * and an answered take-home pay stays at most the gross pay.
 */
function payGroupFits(writes: Record<string, unknown>, answered: ReadonlyMap<string, unknown>, held: FinancialProfile['income']): boolean {
  const conflict = Object.entries(writes).some(([path, value]) => answered.has(path) && stableKey(answered.get(path)) !== stableKey(value));
  if (conflict) return false;
  if (!answered.has(NET)) return true;
  const gross = (writes[GROSS] as number | undefined) ?? held.grossPerPaycheck;
  return gross >= (answered.get(NET) as number);
}

function expectInvariants(c: Case, before: FinancialProfile, after: FinancialProfile): void {
  const keys = keysOf(c);
  const { income } = after;
  const provided = new Set(after.provided);

  // I1: take-home pay never above gross pay (every payload in the grid has net <= gross).
  expect(income.netPerPaycheck).toBeLessThanOrEqual(income.grossPerPaycheck);
  expect(Object.values(validateFor(PAYCHECK_CALCULATOR, after))).not.toContain(NET_PAY_AT_MOST_GROSS.message);
  expect(Object.values(validateFor(RETIREMENT_CALCULATOR, after))).not.toContain(NET_PAY_AT_MOST_GROSS.message);

  // I2: gross and frequency are one record's pair, or an annual income
  // written for the frequency the profile holds (to the cent).
  const records: Pay[] = [seedPay(before), ...keys.flatMap((key) => ('annual' in key.pay ? [] : [key.pay]))];
  const annuals = keys.flatMap((key) => ('annual' in key.pay ? [key.pay.annual] : []));
  const fromRecord = records.some((pay) => holdsPay(income, { gross: pay.gross, frequency: pay.frequency }));
  const fromAnnual = annuals.some((annual) => same(toCents(annual / perYear(income.frequency)), income.grossPerPaycheck));
  expect(fromRecord || fromAnnual, 'gross and frequency from one record or an annual income').toBe(true);
  // The take-home pay is a record's own with its gross and frequency, the
  // answered value (never written), or a record's share of this gross.
  const netFromRecord = records.some((pay) => pay.net !== undefined && holdsPay(income, pay));
  const netAnswered = before.provided.includes(NET) && same(income.netPerPaycheck, before.income.netPerPaycheck);
  const netAtShare = records.some(
    (pay) => pay.net !== undefined && Math.abs(shareOf(pay) * income.grossPerPaycheck - income.netPerPaycheck) <= shareTolerance(income.grossPerPaycheck)
  );
  expect(netFromRecord || netAnswered || netAtShare, `take-home ${income.netPerPaycheck} explained`).toBe(true);
  // A 401(k) total never appears without the split it was saved with.
  const elections = [DEFAULT_ELECTION, ...keys.flatMap((key) => (key.election ? [key.election] : []))];
  expect(elections.some((election) => holdsElection(after, election)), '401(k) election from one record').toBe(true);

  // I5 (strict): only the visitor's own changes become provided; no provided path changes.
  const touched = new Set(keys.flatMap((key) => key.touched));
  for (const path of after.provided) {
    if (!before.provided.includes(path)) expect([path, touched.has(path)]).toEqual([path, true]);
  }
  for (const path of before.provided) {
    expect(after.provided).toContain(path);
    expect([path, stableKey(getAt(after, path))]).toEqual([path, stableKey(getAt(before, path))]);
  }

  // I3: the visitor's own values survive, except where an old pay group
  // meets an answered pay path holding another value (the accepted cases).
  let answered = answeredPay(before);
  let held = before.income;
  if (c.paycheck) {
    const pay = c.paycheck.pay as Required<Pay>;
    const fits = payGroupFits({ [GROSS]: pay.gross, [NET]: pay.net, [FREQUENCY]: pay.frequency }, answered, held);
    if (c.paycheck.payChanged && fits) {
      expect(holdsPay(income, pay), `${c.paycheck.label}: own pay`).toBe(true);
      expect([GROSS, NET, FREQUENCY].every((path) => provided.has(path))).toBe(true);
      answered = new Map([...answered, [GROSS, pay.gross], [NET, pay.net], [FREQUENCY, pay.frequency]]);
    }
    if (fits) held = { ...held, grossPerPaycheck: pay.gross, netPerPaycheck: pay.net, frequency: pay.frequency };
    if (c.paycheck.electionChanged && c.paycheck.election) {
      expect(holdsElection(after, c.paycheck.election), `${c.paycheck.label}: own 401(k) election`).toBe(true);
      expect(c.paycheck.touched.filter((path) => path !== GROSS && path !== NET && path !== FREQUENCY).every((path) => provided.has(path))).toBe(true);
    }
  }
  if (c.retirement?.payChanged) {
    const pay = c.retirement.pay;
    const writes: Pay = 'annual' in pay ? { gross: toCents(pay.annual / perYear(held.frequency)), frequency: held.frequency } : pay;
    const group: Record<string, unknown> = 'annual' in pay ? { [GROSS]: writes.gross } : { [GROSS]: writes.gross, [FREQUENCY]: writes.frequency };
    if (payGroupFits(group, answered, held)) {
      expect(holdsPay(income, writes), `${c.retirement.label}: own pay`).toBe(true);
      expect(Object.keys(group).every((path) => provided.has(path))).toBe(true);
      // The take-home pay keeps its share of gross pay: the paycheck key's
      // record when there is one, else the seeded profile's.
      if (!provided.has(NET)) {
        const record = c.paycheck ? (c.paycheck.pay as Pay) : seedPay(before);
        const expected = Math.min(shareOf(record) * income.grossPerPaycheck, income.grossPerPaycheck);
        expect(Math.abs(income.netPerPaycheck - expected), `${c.retirement.label}: take-home at its share`).toBeLessThanOrEqual(
          shareTolerance(income.grossPerPaycheck)
        );
      }
    }
  }

  // I4: an untouched old key alone reproduces the old calculator's run.
  const [only] = keys;
  if (keys.length === 1 && c.seed.patch.income === undefined && !only.payChanged && !only.electionChanged) {
    if (only.id === 'retirement') expectSameRun(RETIREMENT_CALCULATOR);
    else expectSameRun(PAYCHECK_CALCULATOR);
  }
}

/** The old defaults' engine inputs against the imported profile's, leaf by leaf (income by annual value). */
function expectSameRun<E, R>(def: CalculatorDefinition<E, R>): void {
  const old = def.legacy!.storageDefaults();
  const now = engineInputsFor(def, profile());
  const incomeLeaves = new Set(['income', 'currentIncome', 'incomeAmount', 'incomePeriod']);
  for (const binding of def.bindings) {
    if (incomeLeaves.has(binding.engine)) continue;
    expect([binding.engine, getAt(now, binding.engine)]).toEqual([binding.engine, getAt(old, binding.engine)]);
  }
  if (def.id === 'retirement') {
    expect(getAt(now, 'currentIncome') as number).toBeCloseTo(getAt(old, 'currentIncome') as number, 0);
  } else {
    const [nowIncome, oldIncome] = [getAt(now, 'income'), getAt(old, 'income')] as Record<string, number>[];
    expect(nowIncome.monthlyGross * 12).toBeCloseTo(oldIncome.grossPaycheck * 26, 0);
    expect(nowIncome.monthlyNet * 12).toBeCloseTo(oldIncome.netPaycheck * 26, 0);
  }
}

/** The profile with its write stamp zeroed, for comparing two runs. */
const withoutStamp = (written: FinancialProfile): FinancialProfile => ({ ...written, updatedAt: 0 });

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

const CASES = buildCases();

describe('importLegacyStorage: invariants over the old payload grid', () => {
  it('covers every combination of old keys for every starting profile', () => {
    // (7 paycheck keys + none) x (11 retirement keys + none) x 5 profiles.
    expect(CASES).toHaveLength(8 * 12 * 5);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const { before, after } = runCase(c);
    expectInvariants(c, before, after);

    // I6: a second call changes nothing.
    const setValues = vi.spyOn(useProfileStore.getState(), 'setValues');
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(setValues).not.toHaveBeenCalled();
    expect(profile()).toBe(after);
    setValues.mockRestore();
  });
});

describe('importLegacyStorage: the same profile whichever calculator page runs it', () => {
  const PAGES = [
    ['paycheck', PAYCHECK_CALCULATOR],
    ['retirement', RETIREMENT_CALCULATOR],
    ['portfolio', PORTFOLIO_CALCULATOR],
    ['leverage', LEVERAGE_CALCULATOR],
  ] as const;
  // Every 17th case: both keys, one key and no key, over every starting profile.
  const SAMPLE = CASES.filter((_, i) => i % 17 === 0);

  /** Runs `def`'s page bootstrap (the run store stubbed) and returns the profile it leaves. */
  function bootstrapOn<E, R>(c: Case, def: CalculatorDefinition<E, R>): FinancialProfile {
    prepare(c);
    const store = { getState: () => ({ submit: () => {} }) } as unknown as CalculatorStore<E, R>;
    const { result, unmount } = renderHook(() => useCalculatorBootstrap(def, store));
    expect(result.current.ready).toBe(true);
    unmount();
    for (const key of keysOf(c)) expect(localStorage.getItem(key.storageKey)).toBeNull();
    return withoutStamp(profile());
  }

  it('samples cases from every starting profile', () => {
    expect(new Set(SAMPLE.map((c) => c.seed.label)).size).toBe(SEEDS.length);
    expect(SAMPLE.some((c) => c.paycheck && c.retirement)).toBe(true);
  });

  it.each(SAMPLE.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const direct = withoutStamp(runCase(c).after);
    for (const [id, def] of PAGES) {
      expect([id, bootstrapOn(c, def as CalculatorDefinition<unknown, unknown>)]).toEqual([id, direct]);
    }
  });
});

describe('importLegacyStorage: a corrupt payload changes nothing and does not stop the other key', () => {
  const CORRUPT: readonly [string, string][] = [
    ['corrupt JSON', '{"state":'],
    ['JSON null', 'null'],
    ['a foreign payload', JSON.stringify({ something: 'else' })],
    ['an envelope of the wrong shape', JSON.stringify({ state: { inputs: [], profile: [] }, version: 3 })],
  ];
  // The corrupt key next to a changed key of the other calculator.
  const PAIRS = [
    ['paycheck', PAYCHECK_LEGACY.storageKey, RETIREMENT_KEYS[2]!],
    ['retirement', RETIREMENT_LEGACY.storageKey, PAYCHECK_KEYS[4]!],
  ] as const;

  it.each(PAIRS.flatMap(([id, storageKey, other]) => CORRUPT.map(([what, raw]) => [`${id}: ${what}`, storageKey, other, raw] as const)))(
    '%s',
    (_, storageKey, other, raw) => {
      // The other key alone gives the expected profile.
      localStorage.setItem(other.storageKey, JSON.stringify(other.payload));
      importLegacyStorage(LEGACY_IMPORTS);
      const expected = withoutStamp(profile());

      clearBrowserState();
      resetProfileStore();
      localStorage.setItem(storageKey, raw);
      localStorage.setItem(other.storageKey, JSON.stringify(other.payload));
      expect(() => importLegacyStorage(LEGACY_IMPORTS)).not.toThrow();
      expect(withoutStamp(profile())).toEqual(expected);
      expect(localStorage.getItem(storageKey)).toBeNull();
      expect(localStorage.getItem(other.storageKey)).toBeNull();
    }
  );
});
