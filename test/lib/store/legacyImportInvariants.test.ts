/**
 * The legacy import's invariants over a fixed grid of old payloads, import
 * orders and profiles (no randomness). Each case seeds the profile (fresh,
 * or with a take-home pay, a pay frequency, or a gross pay and frequency
 * answered since), stores the old retirement and paycheck keys (absent,
 * untouched or changed), imports the keys in one order and checks:
 *
 * I1 take-home pay never above gross pay (and no NET_PAY_AT_MOST_GROSS error);
 * I2 gross, take-home and frequency come from one record or a documented
 *    rule, and a 401(k) total keeps the split it was saved with;
 * I3 the visitor's own values survive (where the case changed any), unless
 *    a newer answer for the same pay existed (payAnsweredSince); an old
 *    yearly or hourly income has no frequency of its own and survives as the
 *    same annual income in the frequency the profile holds;
 * I4 an untouched old key alone reproduces the old calculator's run;
 * I5 nothing unanswered becomes provided, nothing provided is overwritten;
 * I6 a second import is a no-op; a corrupt payload changes nothing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annualizeIncome, type IncomePeriod, type RetirementInputs } from '@/lib/calculations/retirement';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY } from '@/lib/calculators/paycheck/legacy';
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
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
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

type Order = 'retirement first' | 'paycheck first';

/** A profile the visitor answered some pay facts in before the import. */
interface Seed {
  label: string;
  patch: ProfilePatch;
}

interface Case {
  name: string;
  retirement?: OldKey;
  paycheck?: OldKey;
  order: Order;
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
  { label: 'take-home 2,800 answered', patch: { income: { netPerPaycheck: 2800 } } },
  // Only the frequency, as the paycheck page's frequency select alone marks it.
  { label: 'frequency weekly answered', patch: { income: { frequency: 'weekly' } } },
  // 100,800 a year (the retirement grid's yearly 100,800) is 4,200 semi-monthly.
  { label: 'frequency semi-monthly answered', patch: { income: { frequency: 'semi-monthly' } } },
  // 100,800 a year again, as 8,400 monthly; the take-home pay stays unanswered.
  { label: 'gross 8,400 monthly answered', patch: { income: { grossPerPaycheck: 8400, frequency: 'monthly' } } },
];

/** Imports the old key of calculator `id`. */
const importKey = (id: OldKey['id']): string[] =>
  id === 'retirement' ? importLegacyCalculatorStorage(RETIREMENT_CALCULATOR) : importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);

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
  paycheckKey('monthly 9,000 / 6,400', { pay: { gross: 9000, net: 6400, frequency: 'monthly' } }),
  // One member of a coupled group: the frequency alone, the 401(k) split alone.
  paycheckKey('only the frequency (monthly)', { pay: { gross: 2500, net: 1900, frequency: 'monthly' } }),
  paycheckKey('only the 401(k) split', { election: { type: 'split', percent: 0.03, roth: 0.015 } }),
];

function buildCases(): Case[] {
  const cases = new Map<string, Case>();
  for (const seed of SEEDS) {
    for (const retirement of RETIREMENT_KEYS) {
      for (const paycheck of PAYCHECK_KEYS) {
        for (const order of ['retirement first', 'paycheck first'] as const) {
          // With one key (or none) the order makes no difference.
          const effective: Order | 'one key' = retirement && paycheck ? order : 'one key';
          const name = [
            retirement?.label ?? 'no retirement key',
            paycheck?.label ?? 'no paycheck key',
            effective,
            seed.label,
          ].join(' | ');
          if (!cases.has(name)) cases.set(name, { name, retirement, paycheck, order, seed });
        }
      }
    }
  }
  return [...cases.values()];
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

const profile = () => useProfileStore.getState().profile;

/** The keys of `c` in import order. */
function importOrder(c: Case): OldKey[] {
  const keys = c.order === 'retirement first' ? [c.retirement, c.paycheck] : [c.paycheck, c.retirement];
  return keys.filter((key): key is OldKey => key !== undefined);
}

interface Run {
  /** The seeded profile, before any import. */
  before: FinancialProfile;
  /** The profile just before each key's import, in import order. */
  steps: FinancialProfile[];
  after: FinancialProfile;
}

/** Seeds the profile, stores the old keys, imports them in order and returns the profiles along the way. */
function runCase(c: Case): Run {
  clearBrowserState();
  resetProfileStore({ profile: c.seed.patch });
  for (const key of importOrder(c)) localStorage.setItem(key.storageKey, JSON.stringify(key.payload));
  const before = profile();
  const steps: FinancialProfile[] = [];
  for (const key of importOrder(c)) {
    steps.push(profile());
    // I6: the old key is still there until its own import runs, and gone after.
    expect(localStorage.getItem(key.storageKey)).not.toBeNull();
    expect(() => importKey(key.id)).not.toThrow();
    expect(localStorage.getItem(key.storageKey)).toBeNull();
  }
  return { before, steps, after: profile() };
}

// ---------------------------------------------------------------------------
// The invariants
// ---------------------------------------------------------------------------

const CENT = 0.005 + 1e-9;
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
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
 * True when an answer in `held` (the profile just before the key's import)
 * is a newer answer for the pay the key stands for: an answered gross pay or
 * frequency that differs from what the key would write, an answered amount
 * (gross or take-home pay, per paycheck of the held frequency) the key would
 * put under another frequency, or an answered take-home pay the key would
 * change or leave above its gross pay. An annual income has no frequency of
 * its own: it stands for gross pay in the frequency the profile holds.
 */
function payAnsweredSince(pay: OldPay, held: FinancialProfile): boolean {
  const answered = new Set(held.provided);
  const { income } = held;
  const gross = 'annual' in pay ? pay.annual / perYear(income.frequency) : pay.gross;
  const movesFrequency = !('annual' in pay) && pay.frequency !== income.frequency;
  if (answered.has(GROSS) && (movesFrequency || Math.abs(income.grossPerPaycheck - gross) > CENT)) return true;
  if (answered.has(FREQUENCY) && movesFrequency) return true;
  if (!answered.has(NET)) return false;
  const net = 'annual' in pay || pay.net === undefined ? income.netPerPaycheck : pay.net;
  return movesFrequency || !same(net, income.netPerPaycheck) || gross < net;
}

function expectInvariants(c: Case, { before, steps, after }: Run): void {
  const keys = importOrder(c);
  const { income } = after;
  const provided = new Set(after.provided);

  // I1: take-home pay never above gross pay (every payload in the grid has net <= gross).
  expect(income.netPerPaycheck).toBeLessThanOrEqual(income.grossPerPaycheck);
  expect(Object.values(validateFor(PAYCHECK_CALCULATOR, after))).not.toContain(NET_PAY_AT_MOST_GROSS.message);
  expect(Object.values(validateFor(RETIREMENT_CALCULATOR, after))).not.toContain(NET_PAY_AT_MOST_GROSS.message);

  // I2: gross and frequency are one record's pair, or an annual income
  // written for the frequency some record holds; the take-home pay is a
  // record's own (the seeded profile's included) or a record's share of
  // gross pay applied to this gross (to the cent).
  const records: Pay[] = [seedPay(before), ...keys.flatMap((key) => ('annual' in key.pay ? [] : [key.pay]))];
  const annuals = keys.flatMap((key) => ('annual' in key.pay ? [key.pay.annual] : []));
  const fromRecord = records.some((pay) => holdsPay(income, { gross: pay.gross, frequency: pay.frequency }));
  const fromAnnual =
    records.some((pay) => pay.frequency === income.frequency) &&
    annuals.some((annual) => Math.abs(annual / perYear(income.frequency) - income.grossPerPaycheck) <= CENT);
  expect(fromRecord || fromAnnual, 'gross and frequency from one record or an annual income').toBe(true);
  const netFromRecord = records.some((pay) => pay.net !== undefined && holdsPay(income, pay));
  // An answered take-home pay stays as answered, under the frequency it was answered for.
  const netAnswered = before.provided.includes(NET) && holdsPay(income, { ...seedPay(before), gross: income.grossPerPaycheck });
  const netAtShare = records.some((pay) => pay.net !== undefined && Math.abs(shareOf(pay) * income.grossPerPaycheck - income.netPerPaycheck) <= CENT);
  expect(netFromRecord || netAnswered || netAtShare, `take-home ${income.netPerPaycheck} explained`).toBe(true);
  // A 401(k) total never appears without the split it was saved with.
  const elections = [DEFAULT_ELECTION, ...keys.flatMap((key) => (key.election ? [key.election] : []))];
  expect(elections.some((election) => holdsElection(after, election)), '401(k) election from one record').toBe(true);

  // I5: only the visitor's own changes become provided; nothing provided is overwritten.
  const touched = new Set(keys.flatMap((key) => key.touched));
  for (const path of after.provided) {
    if (!before.provided.includes(path)) expect([path, touched.has(path)]).toEqual([path, true]);
  }
  for (const path of before.provided) {
    expect(after.provided).toContain(path);
    expect([path, stableKey(getAt(after, path))]).toEqual([path, stableKey(getAt(before, path))]);
  }

  // I3: the visitor's own values survive, unless a newer answer for the same fact existed.
  for (const [i, key] of keys.entries()) {
    if (key.electionChanged && key.election) {
      expect(holdsElection(after, key.election), `${key.label}: own 401(k) election`).toBe(true);
      expect(key.touched.every((path) => path === GROSS || path === NET || path === FREQUENCY || provided.has(path))).toBe(true);
    }
    if (!key.payChanged) continue;
    const pay = key.pay;
    if (!payAnsweredSince(pay, steps[i])) {
      if ('annual' in pay) {
        // The same annual income, in the frequency the profile holds.
        expect(Math.abs(income.grossPerPaycheck * perYear(income.frequency) - pay.annual), `${key.label}: own income`).toBeLessThanOrEqual(
          CENT * perYear(income.frequency)
        );
        expect(provided.has(GROSS)).toBe(true);
      } else {
        expect(holdsPay(income, pay), `${key.label}: own pay`).toBe(true);
        expect(key.touched.filter((path) => path !== TYPE && path !== PERCENT && path !== ROTH).every((path) => provided.has(path))).toBe(true);
      }
      continue;
    }
    if ('annual' in pay || pay.net === undefined || steps[i].provided.includes(NET)) continue;
    // The documented exception: the take-home pay keeps its share of the
    // gross pay that stays (checked when no later key moved that pay).
    expect(provided.has(NET)).toBe(false);
    const movedLater = !holdsPay(steps[i].income, { gross: income.grossPerPaycheck, frequency: income.frequency });
    if (!movedLater) expect(Math.abs(shareOf(pay) * income.grossPerPaycheck - income.netPerPaycheck)).toBeLessThanOrEqual(CENT);
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

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

const CASES = buildCases();

describe('importLegacyCalculatorStorage: invariants over the old payload grid', () => {
  it('covers every combination in both import orders, for every seeded profile', () => {
    // (9 x 7 two-key pairs x 2 orders + 9 + 7 one-key + 1 empty) x 5 profiles.
    expect(CASES).toHaveLength((9 * 7 * 2 + 9 + 7 + 1) * 5);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    const run = runCase(c);
    expectInvariants(c, run);
    const { after } = run;

    // I6: a second import changes nothing.
    const setValues = vi.spyOn(useProfileStore.getState(), 'setValues');
    for (const key of importOrder(c)) expect(importKey(key.id)).toEqual([]);
    expect(setValues).not.toHaveBeenCalled();
    expect(profile()).toBe(after);
    setValues.mockRestore();
  });
});

describe('importLegacyCalculatorStorage: a corrupt payload changes nothing', () => {
  const CORRUPT: readonly [string, string][] = [
    ['corrupt JSON', '{"state":'],
    ['JSON null', 'null'],
    ['a foreign payload', JSON.stringify({ something: 'else' })],
    ['an envelope of the wrong shape', JSON.stringify({ state: { inputs: [], profile: [] }, version: 3 })],
  ];
  const DEFS = [
    ['retirement', RETIREMENT_LEGACY.storageKey],
    ['paycheck', PAYCHECK_LEGACY.storageKey],
  ] as const;
  const OTHER = { retirement: PAYCHECK_KEYS[4]!, paycheck: RETIREMENT_KEYS[2]! };

  it.each(DEFS.flatMap(([id, storageKey]) => CORRUPT.map(([what, raw]) => [`${id}: ${what}`, id, storageKey, raw] as const)))(
    '%s',
    (_, id, storageKey, raw) => {
      // After the other key's import, so the profile holds answers and derived values.
      const other = OTHER[id];
      localStorage.setItem(other.storageKey, JSON.stringify(other.payload));
      importKey(other.id);
      const before = profile();
      localStorage.setItem(storageKey, raw);
      expect(() => importKey(id)).not.toThrow();
      expect(profile()).toEqual(before);
      expect(localStorage.getItem(storageKey)).toBeNull();
    }
  );
});
