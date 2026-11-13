/**
 * Saving as you go (components/guided/wizardProgress.ts). The wizard saves
 * after every Next and Skip; the old wizard saved once, at Finish, with
 * buildIntakeSubmission. For the same actions both must leave the same
 * profile: these tests run seeded sequences of Next, Skip, Back and field
 * edits through the progress functions, apply each save to the profile
 * store as the wizard does, and compare the store after every save with the
 * old single save of the same progress applied to the arrival profile.
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
  /** Store profile and old-path profile after every save. */
  checks: { action: string; store: FinancialProfile; old: FinancialProfile }[];
  finished: boolean;
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

  const save = (action: string) => {
    const { writes, options, ledger: next } = saveWrites(flow, seed, progress, ledger);
    ledger = next;
    useProfileStore.getState().setValues(writes, options);
    checks.push({ action, store: useProfileStore.getState().profile, old: oldSave(flow, seed, progress) });
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
      if (writes) progress = editScreen(form, progress, screen, writes);
    } else {
      progress = action === 'next' ? answerScreen(form, progress, screen) : skipScreens(form, progress, seed, [screen], screens);
      save(label);
      if (step >= screensOf(progress).length - 1) return { checks, finished: true };
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
  ['leverage', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['retirement', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['paycheck', 'remaining', 'a returning visitor', returning],
  ['retirement', 'remaining', 'a returning visitor', returning],
  ['portfolio', 'all', 'a new visitor', getDefaultFinancialProfile],
  ['profile', 'all', 'a returning visitor', returning],
];

describe('saving as you go equals the single save at Finish', () => {
  it.each(CASES)('%s (%s mode), %s: after every Next and Skip', (flow, mode, _who, makeSeed) => {
    let saves = 0;
    let finished = 0;
    for (let rngSeed = 1; rngSeed <= 40; rngSeed += 1) {
      const result = run(flow, mode, makeSeed(), rngSeed, 30);
      for (const { action, store, old } of result.checks) {
        expect(comparable(store), `seed ${rngSeed}, ${action}`).toEqual(comparable(old));
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
    let save = saveWrites('core', seed, progress, EMPTY_LEDGER);
    useProfileStore.getState().setValues(save.writes, save.options);
    // The derived write raises the retirement age above the new age.
    expect(useProfileStore.getState().profile.person).toMatchObject({ age: 70, retirementAge: 71 });

    // Back to the screen, then Skip: the store goes back to the arrival values.
    progress = skipScreens(form, progress, seed, [about], screens);
    save = saveWrites('core', seed, progress, save.ledger);
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
    let save = saveWrites('profile', seed, progress, EMPTY_LEDGER);
    progress = skipScreens(form, progress, seed, [about], screens);
    save = saveWrites('profile', seed, progress, save.ledger);
    expect(save.options.unprovide).toEqual([]);
    useProfileStore.getState().setValues(save.writes, save.options);
    expect(useProfileStore.getState().profile.provided).toEqual(expect.arrayContaining([...CORE_PATHS]));
    expect(useProfileStore.getState().profile.person.age).toBe(58);
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
