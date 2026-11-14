/**
 * The intake wizard's progress as pure data, and the store update that
 * brings the saved profile to it after every Next and Skip.
 *
 * The working copy (`answers`) is the profile as it was on arrival plus the
 * visitor's edits; it always holds a complete value for every path, so
 * validation and the bindings never see a blank. What the wizard shows for a
 * field the visitor has not answered is a display layer over it (isBlankField).
 *
 * Saving as you go: saveWrites returns the setValues call that makes the
 * store equal to "the arrival profile plus buildIntakeSubmission of what the
 * visitor has confirmed so far" (confirmedProfile), so leaving through the
 * site header keeps every confirmed answer and nothing unconfirmed.
 */

import { buildIntakeSubmission, type IntakeFlow } from '@/lib/constants/intake';
import { applyWrites, getAt, makeGet } from '@/lib/fields/paths';
import { screenPaths } from '@/lib/fields/runtime';
import type { FieldSpec, FormSpec, ScreenSpec, Write } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import type { SetValuesOptions } from '@/lib/store/profileStore';

type ById<T> = Readonly<Record<string, T>>;

export interface WizardProgress {
  /** The working copy of the profile. */
  answers: FinancialProfile;
  /** Paths answered in this visit (screen paths and their coupled writes). */
  provided: readonly string[];
  /** Coupled-write paths each screen touched, by screen id (see coupledPaths). */
  coupled: ById<readonly string[]>;
  /**
   * The values each answered screen gave, by screen id: its own paths and its
   * coupled writes, as they stood when the visitor moved on from it.
   */
  answered: ById<Readonly<Record<string, unknown>>>;
  /** Paths the visitor edited on each screen, by screen id (the display layer). */
  touched: ById<readonly string[]>;
}

export function startProgress(seed: FinancialProfile): WizardProgress {
  return { answers: seed, provided: [], coupled: {}, answered: {}, touched: {} };
}

/** True when `path` is one of `paths` or lies under one (a list row under its list). */
export function isUnder(path: string, paths: readonly string[]): boolean {
  return paths.some((answered) => path === answered || path.startsWith(`${answered}.`));
}

/**
 * The paths among `writes` that are not the screen's own: a field's coupled
 * writes (onChange) to paths on no field of this screen. They are answers
 * too, so the screen saves and marks them as the calculator page would.
 */
function coupledPaths(writes: readonly Write[], own: readonly string[]): string[] {
  return writes.map((w) => w.path).filter((path) => !isUnder(path, own));
}

const union = (a: readonly string[], b: readonly string[]): string[] => Array.from(new Set([...a, ...b]));

/** A field edit on `screen`: applies `writes`, recording coupled and touched paths. */
export function editScreen(
  form: FormSpec,
  progress: WizardProgress,
  screen: ScreenSpec,
  writes: readonly Write[]
): WizardProgress {
  const own = screenPaths(form, screen, makeGet(progress.answers));
  const extra = coupledPaths(writes, own);
  return {
    ...progress,
    answers: applyWrites(progress.answers, writes),
    coupled: extra.length > 0 ? { ...progress.coupled, [screen.id]: union(progress.coupled[screen.id] ?? [], extra) } : progress.coupled,
    touched: { ...progress.touched, [screen.id]: union(progress.touched[screen.id] ?? [], writes.map((w) => w.path)) },
  };
}

/**
 * The visitor emptied the input of `path` on `screen`: the path goes back to
 * its value on arrival through `writes` (the field's writes for that value)
 * and is no longer touched, so the field shows blank again.
 */
export function clearField(
  form: FormSpec,
  progress: WizardProgress,
  screen: ScreenSpec,
  path: string,
  writes: readonly Write[]
): WizardProgress {
  const edited = editScreen(form, progress, screen, writes);
  return {
    ...edited,
    touched: { ...edited.touched, [screen.id]: (edited.touched[screen.id] ?? []).filter((p) => p !== path) },
  };
}

/**
 * Next on `screen` (validated by the caller): applies `writes` (a choice made
 * with Enter), then marks every visible path of the screen, its covers and
 * its coupled writes as answered, whatever value they show, so a field left
 * blank is answered with its typical value. A field of the screen that an
 * earlier Next answered and that is hidden now keeps that answer.
 */
export function answerScreen(
  form: FormSpec,
  progress: WizardProgress,
  screen: ScreenSpec,
  writes: readonly Write[] = []
): WizardProgress {
  const answers = writes.length > 0 ? applyWrites(progress.answers, writes) : progress.answers;
  const own = screenPaths(form, screen, makeGet(answers));
  const touched = [...(progress.coupled[screen.id] ?? []), ...coupledPaths(writes, own)];
  const given = [...own, ...touched];
  // A field of this screen answered on an earlier Next and hidden now (its
  // visibleWhen turned false meanwhile, e.g. the emergency fund balance once an
  // account holds the fund) keeps the value it was answered with: the stored
  // leaf is untouched, not reverted to its value on arrival.
  const previous = progress.answered[screen.id] ?? {};
  const hiddenKept = Object.entries(previous).filter(
    ([path]) => screen.fields.includes(path) && !isUnder(path, given)
  );
  return {
    ...progress,
    answers,
    provided: union(progress.provided, given),
    answered: {
      ...progress.answered,
      [screen.id]: Object.fromEntries([
        ...hiddenKept,
        ...given.map((path): [string, unknown] => [path, getAt(answers, path)]),
      ]),
    },
  };
}

/**
 * Skip on `skipped` screens: restores their answers and unmarks them. A path
 * that another answered screen also gave (a coupled write over an earlier
 * answer) goes back to that screen's value and stays marked; any other path
 * goes back to its value on arrival (`seed`). `order` is the flow's screens,
 * for which answered screen is the latest.
 */
export function skipScreens(
  form: FormSpec,
  progress: WizardProgress,
  seed: FinancialProfile,
  skipped: readonly ScreenSpec[],
  order: readonly ScreenSpec[]
): WizardProgress {
  const get = makeGet(progress.answers);
  const skippedIds = new Set(skipped.map((s) => s.id));
  // The paths visible now, the coupled writes, and the paths the screen gave
  // when it was last answered: a field a later toggle hides is reverted and
  // unmarked too.
  const skippedPaths = union(
    [],
    skipped.flatMap((s) => [
      ...screenPaths(form, s, get),
      ...(progress.coupled[s.id] ?? []),
      ...Object.keys(progress.answered[s.id] ?? {}),
    ])
  );
  const kept = Object.entries(progress.answered).filter(([id]) => !skippedIds.has(id));
  const keptValue = (path: string) => {
    // The latest screen in flow order wins, as it did when it was answered.
    const at = (id: string) => order.findIndex((s) => s.id === id);
    const holders = kept.filter(([, values]) => path in values).sort(([a], [b]) => at(a) - at(b));
    return holders.length > 0 ? { value: holders[holders.length - 1][1][path] } : undefined;
  };
  const answers = applyWrites(
    progress.answers,
    skippedPaths.map((path) => {
      const earlier = keptValue(path);
      return { path, value: earlier ? earlier.value : getAt(seed, path) };
    })
  );
  const provided = progress.provided.filter((path) => !skippedPaths.includes(path) || keptValue(path) !== undefined);
  const drop = <T>(prev: ById<T>): ById<T> => {
    const next = { ...prev };
    for (const id of skippedIds) delete next[id];
    return next;
  };
  return {
    answers,
    provided,
    coupled: drop(progress.coupled),
    answered: drop(progress.answered),
    touched: drop(progress.touched),
  };
}

/**
 * The profile as the visitor has confirmed it: the arrival profile (`seed`)
 * plus the values each answered screen gave when the visitor moved on from
 * it, applied in flow order (`order`), so the latest screen wins as in
 * skipScreens. Edits made after a screen was answered and not confirmed
 * again with Next are not in it.
 */
function confirmedProfile(
  seed: FinancialProfile,
  progress: WizardProgress,
  order: readonly Pick<ScreenSpec, 'id'>[]
): FinancialProfile {
  const at = (id: string) => order.findIndex((s) => s.id === id);
  return Object.entries(progress.answered)
    .sort(([a], [b]) => at(a) - at(b))
    .reduce(
      (profile, [, values]) => applyWrites(profile, Object.entries(values).map(([path, value]) => ({ path, value }))),
      seed
    );
}

/** Field kinds the display layer can show with no value. */
const BLANKABLE: ReadonlySet<FieldSpec['kind']> = new Set<FieldSpec['kind']>([
  'money',
  'number',
  'percent',
  'select',
  'state',
  'choice',
  'boolean',
  'text',
]);

/**
 * Whether the wizard shows `spec` with no value: an input, select or choice
 * whose path was not answered (not in `answered`, the arrival
 * profile.provided plus this visit's answers) and that the visitor has not
 * edited on this screen (`touched`). A nullable field on Auto stays on Auto;
 * list, custom and slider fields always show their value.
 */
export function isBlankField(
  spec: FieldSpec,
  value: unknown,
  answered: readonly string[],
  touched: readonly string[]
): boolean {
  if (!BLANKABLE.has(spec.kind)) return false;
  if (spec.nullable && value === null) return false;
  return !isUnder(spec.path, answered) && !touched.includes(spec.path);
}

/** Which paths earlier saves of this visit wrote and marked, so a later save can take them back. */
export interface SaveLedger {
  written: readonly string[];
  provided: readonly string[];
}

export const EMPTY_LEDGER: SaveLedger = { written: [], provided: [] };

export interface ProgressSave {
  writes: Write[];
  options: Required<Pick<SetValuesOptions, 'provide' | 'unprovide'>>;
  ledger: SaveLedger;
}

/**
 * The store update after a Next or Skip, applied with setValues(writes,
 * options) to the store as the previous saves left it. It makes the store
 * equal to the arrival profile (`seed`) plus buildIntakeSubmission of the
 * confirmed profile (confirmedProfile; `order` is the form's screens), so
 * an unconfirmed edit on an earlier screen is neither saved nor fed to the
 * derived writes: every path an earlier save wrote first goes back to its value on
 * arrival, then the submission's writes (answered paths and the form's
 * derived writes) apply; paths an earlier save marked and the progress no
 * longer answers are unmarked, unless they were answered on arrival.
 */
export function saveWrites(
  flow: IntakeFlow,
  seed: FinancialProfile,
  progress: WizardProgress,
  ledger: SaveLedger,
  order: readonly Pick<ScreenSpec, 'id'>[]
): ProgressSave {
  const confirmed = confirmedProfile(seed, progress, order);
  const { writes, providedPaths } = buildIntakeSubmission(flow, confirmed, progress.provided, seed.provided);
  const restore = ledger.written.map((path) => ({ path, value: getAt(seed, path) }));
  const unprovide = ledger.provided.filter((path) => !providedPaths.includes(path) && !seed.provided.includes(path));
  return {
    writes: [...restore, ...writes],
    options: { provide: providedPaths, unprovide },
    ledger: {
      written: union(ledger.written, writes.map((w) => w.path)),
      provided: union(ledger.provided, providedPaths),
    },
  };
}
