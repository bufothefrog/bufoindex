/**
 * Saving as you go (components/guided/wizardProgress.ts). The wizard saves
 * after every Next and Skip; the old wizard saved once, at Finish, with
 * buildIntakeSubmission of its working copy. These tests run seeded
 * sequences of Next, Skip, Back and field edits through the progress
 * functions, apply each save to the profile store as the wizard does, and
 * check the store after every save against a separate model of what the
 * visitor has confirmed: a shadow progress that receives a screen's edits
 * only when that screen is confirmed with Next (and drops them on Skip),
 * saved the old way. At Finish the store also equals the old single save.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_LEDGER,
  answerScreen,
  editScreen,
  isBlankField,
  saveWrites,
  skipScreens,
  startProgress,
  type SaveLedger,
  type WizardProgress,
} from '@/components/guided/wizardProgress';
import {
  CORE_PATHS,
  buildIntakeSubmission,
  getIntakeScreens,
  intakeForm,
  type IntakeFlow,
  type IntakeMode,
} from '@/lib/constants/intake';
import { addAccountRow, setHoldsEmergencyFund } from '@/lib/calculators/portfolio/accountWrites';
import { makeGet } from '@/lib/fields/paths';
import { fieldWrites, resolveOptions, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldSpec, Get, Write } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { createSeededRng } from '@/lib/utils/random';
import { resetProfileStore } from '@/test/utils/stores';

type Action = 'next' | 'skip' | 'back' | 'edit';
const ACTIONS: readonly Action[] = ['next', 'skip', 'back', 'edit', 'edit'];

beforeEach(() => resetProfileStore());

/** The store's profile without the timestamp, provided as a sorted set. */
function comparable(profile: FinancialProfile) {
  return { ...profile, updatedAt: 0, provided: [...profile.provided].sort() };
}

/** Puts `profile` in the store as it is (the wizard's arrival state). */
function load(profile: FinancialProfile) {
  useProfileStore.setState({ profile });
}

/** The old path: the arrival profile plus one buildIntakeSubmission save of `progress`. */
function oldSave(flow: IntakeFlow, seed: FinancialProfile, progress: WizardProgress): FinancialProfile {
  const kept = useProfileStore.getState().profile;
  load(seed);
  const { writes, providedPaths } = buildIntakeSubmission(flow, progress.answers, progress.provided, seed.provided);
  useProfileStore.getState().setValues(writes, { provide: providedPaths });
  const result = useProfileStore.getState().profile;
  load(kept);
  return result;
}

/** A different value for an editable field, picked by `rng`; undefined for list and custom fields. */
function editFor(spec: FieldSpec, get: Get, rng: () => number): Write[] | undefined {
  const value = get(spec.path);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  switch (spec.kind) {
    case 'money':
    case 'number':
    case 'percent':
    case 'slider': {
      if (spec.nullable && value === null) return fieldWrites(spec, spec.min ?? 0, get);
      const n = typeof value === 'number' ? value : 0;
      const candidates = [spec.min ?? 0, spec.max ?? n * 2, n + (spec.step ?? 1), 0, spec.kind === 'number' ? 99 : n / 2];
      return fieldWrites(spec, pick(candidates), get);
    }
    case 'choice':
    case 'select':
    case 'boolean': {
      const options = spec.kind === 'boolean' ? [true, false] : resolveOptions(spec, get).map((o) => o.value);
      return options.length > 0 ? fieldWrites(spec, pick(options), get) : undefined;
    }
    case 'state':
      return fieldWrites(spec, pick(['OR', 'CA', 'TX']), get);
    default:
      return undefined;
  }
}

interface Run {
  /** Store profile and the confirmed-values model, saved the old way, after every save. */
  checks: { action: string; store: FinancialProfile; old: FinancialProfile }[];
  finished: boolean;
  /** At Finish: the store and the old single save of the working copy. */
  final?: { store: FinancialProfile; old: FinancialProfile };
}

/** Runs `count` seeded actions through the progress functions, saving as the wizard does. */
function run(flow: IntakeFlow, mode: IntakeMode, seed: FinancialProfile, rngSeed: number, count: number): Run {
  const rng = createSeededRng(rngSeed);
  const form = intakeForm(flow, mode);
  load(seed);
  let progress = startProgress(seed);
  let ledger: SaveLedger = EMPTY_LEDGER;
  let index = 0;
  const checks: Run['checks'] = [];
  const screensOf = (p: WizardProgress) =>
    getIntakeScreens(flow, makeGet(p.answers), { mode, provided: seed.provided });

  // The model: edits wait per screen and reach the shadow only on Next.
  let shadow = startProgress(seed);
  // Each edit is kept as its own group: editScreen tells own paths from
  // coupled writes by the visibility at the time of the edit.
  let pending: Record<string, Write[][]> = {};

  const save = (action: string) => {
    const { writes, options, ledger: next } = saveWrites(flow, seed, progress, ledger, form.screens);
    ledger = next;
    useProfileStore.getState().setValues(writes, options);
    checks.push({ action, store: useProfileStore.getState().profile, old: oldSave(flow, seed, shadow) });
  };

  for (let i = 0; i < count; i += 1) {
    const screens = screensOf(progress);
    const step = Math.min(index, screens.length - 1);
    const screen = screens[step];
    const action = ACTIONS[Math.floor(rng() * ACTIONS.length)];
    const label = `${i}:${action}@${screen.id}`;
    if (action === 'back') {
      index = Math.max(0, step - 1);
    } else if (action === 'edit') {
      const get = makeGet(progress.answers);
      const fields = visibleScreenFields(form, screen, get);
      const writes = fields.length > 0 ? editFor(fields[Math.floor(rng() * fields.length)], get, rng) : undefined;
      if (writes) {
        progress = editScreen(form, progress, screen, writes);
        pending = { ...pending, [screen.id]: [...(pending[screen.id] ?? []), writes] };
      }
    } else {
      const waiting = pending[screen.id] ?? [];
      pending = { ...pending, [screen.id]: [] };
      if (action === 'next') {
        progress = answerScreen(form, progress, screen);
        shadow = answerScreen(
          form,
          waiting.reduce((p, writes) => editScreen(form, p, screen, writes), shadow),
          screen
        );
      } else {
        progress = skipScreens(form, progress, seed, [screen], screens);
        shadow = skipScreens(form, shadow, seed, [screen], screens);
      }
      save(label);
      if (step >= screensOf(progress).length - 1) {
        return {
          checks,
          finished: true,
          final: { store: useProfileStore.getState().profile, old: oldSave(flow, seed, progress) },
        };
      }
      index = step + 1;
    }
  }
  return { checks, finished: false };
}

/** A returning visitor: some answers saved earlier, one value away from its default. */
function returning(): FinancialProfile {
  resetProfileStore();
  useProfileStore.getState().setValues(
    [
      { path: 'person.age', value: 58 },
      { path: 'investing.investedBalance', value: 120000 },
      { path: 'cash.emergencyFundBalance', value: 0 },
    ],
    { provide: [...CORE_PATHS, 'investing.investedBalance', 'cash.emergencyFundBalance'] }
  );
  const profile = useProfileStore.getState().profile;
  resetProfileStore();
  return profile;
}

const CASES: readonly [IntakeFlow, IntakeMode, string, () => FinancialProfile][] = [
  ['core', 'all', 'a new visitor', getDefaultFinancialProfile],
  // The leverage intake has one screen since slice c1 (the ratio and the market assumptions stay on
  // the page), so every run would end at its first save; the paycheck intake in 'all' mode, nine
  // screens from the core on, takes its place here. WizardLeverage.test.tsx covers its one screen.
  ['paycheck', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['retirement', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['paycheck', 'remaining', 'a returning visitor', returning],
  ['retirement', 'remaining', 'a returning visitor', returning],
  ['portfolio', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['profile', 'all', 'a returning visitor', returning],
];

describe('saving as you go stores exactly what the visitor has confirmed', () => {
  it.each(CASES)('%s (%s mode), %s: after every Next and Skip', (flow, mode, _who, makeSeed) => {
    let saves = 0;
    let finished = 0;
    for (let rngSeed = 1; rngSeed <= 40; rngSeed += 1) {
      const result = run(flow, mode, makeSeed(), rngSeed, 30);
      for (const { action, store, old } of result.checks) {
        expect(comparable(store), `seed ${rngSeed}, ${action}`).toEqual(comparable(old));
      }
      if (result.final) {
        expect(comparable(result.final.store), `seed ${rngSeed}, Finish`).toEqual(comparable(result.final.old));
      }
      saves += result.checks.length;
      if (result.finished) finished += 1;
    }
    // The sequences reach saves and Finish, not only Back and edits.
    expect(saves).toBeGreaterThan(40);
    expect(finished).toBeGreaterThan(0);
  });

  it('takes back a derived write when the answer it came from is skipped (an age past the retirement age)', () => {
    const seed = getDefaultFinancialProfile();
    const form = intakeForm('core', 'all');
    const screens = getIntakeScreens('core', makeGet(seed), { mode: 'all', provided: [] });
    const about = screens[0];
    const age = form.fields.find((f) => f.path === 'person.age')!;
    load(seed);

    let progress = editScreen(form, startProgress(seed), about, fieldWrites(age, 70, makeGet(seed)));
    progress = answerScreen(form, progress, about);
    let save = saveWrites('core', seed, progress, EMPTY_LEDGER, form.screens);
    useProfileStore.getState().setValues(save.writes, save.options);
    // The derived write raises the retirement age above the new age.
    expect(useProfileStore.getState().profile.person).toMatchObject({ age: 70, retirementAge: 71 });

    // Back to the screen, then Skip: the store goes back to the arrival values.
    progress = skipScreens(form, progress, seed, [about], screens);
    save = saveWrites('core', seed, progress, save.ledger, form.screens);
    useProfileStore.getState().setValues(save.writes, save.options);
    const stored = useProfileStore.getState().profile;
    expect(stored.person).toMatchObject({ age: seed.person.age, retirementAge: seed.person.retirementAge });
    expect(stored.provided).toEqual([]);
    expect(comparable(stored)).toEqual(comparable(oldSave('core', seed, progress)));
  });

  it('never unmarks a path that was answered on arrival', () => {
    const seed = returning();
    const form = intakeForm('profile', 'all');
    const screens = getIntakeScreens('profile', makeGet(seed), { mode: 'all', provided: seed.provided });
    const about = screens[0];
    load(seed);
    let progress = answerScreen(form, startProgress(seed), about);
    let save = saveWrites('profile', seed, progress, EMPTY_LEDGER, form.screens);
    progress = skipScreens(form, progress, seed, [about], screens);
    save = saveWrites('profile', seed, progress, save.ledger, form.screens);
    expect(save.options.unprovide).toEqual([]);
    useProfileStore.getState().setValues(save.writes, save.options);
    expect(useProfileStore.getState().profile.provided).toEqual(expect.arrayContaining([...CORE_PATHS]));
    expect(useProfileStore.getState().profile.person.age).toBe(58);
  });
});

describe('saving as you go leaves unconfirmed edits out', () => {
  /** Applies one save to the store as the wizard does. */
  const apply = (save: ReturnType<typeof saveWrites>) => useProfileStore.getState().setValues(save.writes, save.options);

  it('keeps an earlier screen\'s confirmed value when it was edited after Next and then left with Back', () => {
    const seed = getDefaultFinancialProfile();
    const form = intakeForm('core', 'all');
    const screens = getIntakeScreens('core', makeGet(seed), { mode: 'all', provided: [] });
    const [about, pay] = screens;
    const frequency = form.fields.find((f) => f.path === 'income.frequency')!;
    load(seed);

    // Next on the first two screens, the pay frequency weekly.
    let progress = answerScreen(form, startProgress(seed), about);
    let save = saveWrites('core', seed, progress, EMPTY_LEDGER, form.screens);
    apply(save);
    progress = answerScreen(form, editScreen(form, progress, pay, fieldWrites(frequency, 'weekly', makeGet(progress.answers))), pay);
    save = saveWrites('core', seed, progress, save.ledger, form.screens);
    apply(save);
    expect(useProfileStore.getState().profile.income.frequency).toBe('weekly');

    // Back to the pay screen, change it to monthly, Back again, Next on the first screen.
    progress = editScreen(form, progress, pay, fieldWrites(frequency, 'monthly', makeGet(progress.answers)));
    progress = answerScreen(form, progress, about);
    save = saveWrites('core', seed, progress, save.ledger, form.screens);
    apply(save);
    const stored = useProfileStore.getState().profile;
    expect(stored.income.frequency).toBe('weekly');
    expect(stored.provided).toContain('income.frequency');
  });

  it('computes derived writes from confirmed values only (an unconfirmed age past the retirement age)', () => {
    const seed = getDefaultFinancialProfile();
    const form = intakeForm('core', 'all');
    const screens = getIntakeScreens('core', makeGet(seed), { mode: 'all', provided: [] });
    const [about, pay] = screens;
    const age = form.fields.find((f) => f.path === 'person.age')!;
    load(seed);

    let progress = answerScreen(form, startProgress(seed), about);
    // Back to the first screen, an age of 70 typed and not confirmed, then Next on the next screen.
    progress = editScreen(form, progress, about, fieldWrites(age, 70, makeGet(progress.answers)));
    progress = answerScreen(form, progress, pay);
    apply(saveWrites('core', seed, progress, EMPTY_LEDGER, form.screens));
    expect(useProfileStore.getState().profile.person).toMatchObject({
      age: seed.person.age,
      retirementAge: seed.person.retirementAge,
    });
  });
});

describe('Next keeps an answer whose field is hidden now', () => {
  it('keeps the typed emergency fund when Next is pressed again after an account took the fund over', () => {
    const seed = getDefaultFinancialProfile();
    const form = intakeForm('profile', 'all');
    const fund = form.screens.find((s) => s.id === 'emergency-fund')!;
    const accounts = form.screens.find((s) => s.id === 'accounts')!;
    const balance = form.fields.find((f) => f.path === 'cash.emergencyFundBalance')!;
    load(seed);
    const apply = (save: ReturnType<typeof saveWrites>) => useProfileStore.getState().setValues(save.writes, save.options);

    // 10,000 typed on the emergency fund screen, Next.
    let progress = editScreen(form, startProgress(seed), fund, fieldWrites(balance, 10000, makeGet(seed)));
    progress = answerScreen(form, progress, fund);
    let save = saveWrites('profile', seed, progress, EMPTY_LEDGER, form.screens);
    apply(save);
    expect(useProfileStore.getState().profile.cash.emergencyFundBalance).toBe(10000);

    // On the accounts screen: a new brokerage, ticked "Holds my emergency fund", Next.
    const added = addAccountRow(makeGet(progress.answers), 'brokerage');
    progress = editScreen(form, progress, accounts, added.writes);
    progress = editScreen(form, progress, accounts, setHoldsEmergencyFund(makeGet(progress.answers), added.id, true));
    progress = answerScreen(form, progress, accounts);
    save = saveWrites('profile', seed, progress, save.ledger, form.screens);
    apply(save);
    expect(useProfileStore.getState().profile.cash.emergencyFundBalance).toBe(10000);

    // Back to the emergency fund screen, where the balance is hidden now, and Next.
    expect(screenFieldsOf(form, fund, progress).map((f) => f.path)).not.toContain('cash.emergencyFundBalance');
    progress = answerScreen(form, progress, fund);
    save = saveWrites('profile', seed, progress, save.ledger, form.screens);
    apply(save);
    const stored = useProfileStore.getState().profile;
    expect(stored.cash.emergencyFundBalance).toBe(10000);
    expect(stored.provided).toContain('cash.emergencyFundBalance');
  });
});

/** The visible fields of `screen` over the working copy. */
function screenFieldsOf(form: ReturnType<typeof intakeForm>, screen: (typeof form.screens)[number], progress: WizardProgress) {
  return visibleScreenFields(form, screen, makeGet(progress.answers));
}

describe('Skip takes back what the screen gave, hidden fields included', () => {
  it('unmarks and reverts the 401(k) details answered before the plan was switched off and the screen skipped', () => {
    const seed = returning();
    const form = intakeForm('paycheck', 'remaining');
    const screens = getIntakeScreens('paycheck', makeGet(seed), { mode: 'remaining', provided: seed.provided });
    const plan = screens.find((s) => s.id === '401k')!;
    const has401k = form.fields.find((f) => f.path === 'workplace.has401k')!;
    const matchLimit = form.fields.find((f) => f.path === 'workplace.matchLimit')!;
    load(seed);

    // Next with a match limit typed in, then Back, the plan switched off, Skip.
    let progress = editScreen(form, startProgress(seed), plan, fieldWrites(matchLimit, 0, makeGet(seed)));
    progress = answerScreen(form, progress, plan);
    let save = saveWrites('paycheck', seed, progress, EMPTY_LEDGER, form.screens);
    useProfileStore.getState().setValues(save.writes, save.options);
    expect(useProfileStore.getState().profile.provided).toContain('workplace.matchPercent');

    progress = editScreen(form, progress, plan, fieldWrites(has401k, false, makeGet(progress.answers)));
    progress = skipScreens(form, progress, seed, [plan], screens);
    expect(progress.provided.filter((path) => path.startsWith('workplace.'))).toEqual([]);
    save = saveWrites('paycheck', seed, progress, save.ledger, form.screens);
    useProfileStore.getState().setValues(save.writes, save.options);
    const stored = useProfileStore.getState().profile;
    expect(stored.provided.filter((path) => path.startsWith('workplace.'))).toEqual([]);
    expect(stored.workplace).toEqual(seed.workplace);
  });
});

describe('isBlankField', () => {
  const money: FieldSpec = { path: 'cash.emergencyFundBalance', kind: 'money', label: 'Cash', tier: 'details' };

  it('is blank while the path is neither answered nor edited on the screen', () => {
    expect(isBlankField(money, 5000, [], [])).toBe(true);
    expect(isBlankField(money, 5000, ['cash.emergencyFundBalance'], [])).toBe(false);
    expect(isBlankField(money, 5000, [], ['cash.emergencyFundBalance'])).toBe(false);
  });

  it('leaves a nullable field on Auto, and list, custom and slider fields, as they are', () => {
    const nullable: FieldSpec = { ...money, nullable: { autoLabel: 'Auto', overrideDefault: 1 } };
    expect(isBlankField(nullable, null, [], [])).toBe(false);
    expect(isBlankField(nullable, 3, [], [])).toBe(true);
    for (const kind of ['list', 'custom', 'slider'] as const) {
      expect(isBlankField({ ...money, kind }, [], [], [])).toBe(false);
    }
  });
});
