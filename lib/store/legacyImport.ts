/**
 * One-time import of a calculator's old localStorage inputs into the profile
 * (O7). The hand-written retirement and paycheck stores persisted their own
 * inputs ('retirement-calculator' v3, 'paycheck-allocator-storage'); the
 * profile is now the only record, so whatever the visitor changed there is
 * carried over once and the old key is removed.
 *
 * Sequencing: call it on the client after the profile store has hydrated
 * (useProfileStore.getState().hasHydrated) and before the calculator's first
 * submit, so the first run already sees the imported values. On the server
 * and before hydration it does nothing and leaves the key in place, so the
 * caller can simply call it again once hydration is done.
 */

import type { CalculatorDefinition, LegacyStorage } from '@/lib/calculators/types';
import { fromEngineInputs, stableKey } from '@/lib/fields/binding';
import { getAt, isRecord } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { PAY_FREQUENCY_META, type PayFrequency } from '@/lib/constants/frequency';
import { GROSS_PAY, NET_PAY, PAY_FREQUENCY } from '@/lib/fields/shared';
import { getDefaultFinancialProfile, providedPathFor } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { DEFAULT_DOLLAR_DISPLAY_MODE } from '@/lib/utils/displayDollars';
import { useProfileStore } from '@/lib/store/profileStore';

/**
 * The writes that reproduce `engine` and `defaults`, side by side, one pair
 * per group of coupled paths. Each binding starts a group; groups that write
 * a common path (the 1:1 binding of an amount and the derived binding that
 * writes the amount with its unit) are merged, so coupled paths are always
 * compared, kept or skipped together. Within a group the first write to a
 * path wins.
 */
function writeGroups<E, R>(def: CalculatorDefinition<E, R>, engine: E, defaults: E): [Write[], Write[]][] {
  const pairs = def.bindings.map((binding) => [fromEngineInputs([binding], engine), fromEngineInputs([binding], defaults)]);
  let groups: { paths: Set<string>; members: number[] }[] = [];
  pairs.forEach(([fromEngine, fromDefaults], i) => {
    const merged = { paths: new Set([...fromEngine, ...fromDefaults].map((write) => write.path)), members: [i] };
    if (merged.paths.size === 0) return;
    const overlapping = groups.filter((group) => [...group.paths].some((path) => merged.paths.has(path)));
    for (const group of overlapping) {
      group.paths.forEach((path) => merged.paths.add(path));
      merged.members.push(...group.members);
    }
    groups = [...groups.filter((group) => !overlapping.includes(group)), merged];
  });
  const firstPerPath = (writes: readonly Write[]): Write[] => {
    const seen = new Set<string>();
    return writes.filter((write) => !seen.has(write.path) && seen.add(write.path) !== undefined);
  };
  return groups
    .map(({ members }) => members.sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0])
    .map((members): [Write[], Write[]] => [
      firstPerPath(members.flatMap((i) => pairs[i][0])),
      firstPerPath(members.flatMap((i) => pairs[i][1])),
    ]);
}

/** A group's writes as a key that ignores their order. */
function groupKey(writes: readonly Write[]): string {
  return stableKey(Object.fromEntries(writes.map((write) => [write.path, write.value])));
}

/** The engine inputs stored in `payload`; null when it is not this calculator's payload. */
function readEngine<E>(legacy: LegacyStorage<E>, payload: unknown): E | null {
  try {
    return legacy.readStorage(payload);
  } catch {
    return null;
  }
}

/**
 * The old keys whose envelope kept the dollar display mode
 * (`state.displayMode`): the retirement and paycheck stores' storageKey
 * (test/lib/store/legacyImport.test.ts pins the two in step).
 */
export const LEGACY_DISPLAY_MODE_KEYS: readonly string[] = ['retirement-calculator', 'paycheck-allocator-storage'];

/** The parsed JSON under `key`; null when it is missing or not JSON. */
function readJson(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** The old envelope's state record, when `payload` holds one with a display mode. */
function stateWithMode(payload: unknown): Record<string, unknown> | null {
  return isRecord(payload) && isRecord(payload.state) && 'displayMode' in payload.state ? payload.state : null;
}

/**
 * Both old stores persisted the visitor's dollar display mode next to their
 * inputs. The first import that meets one settles the shared preference
 * (O15) once, from every old key still present: a saved future-dollars
 * choice ('nominal') in any of them becomes the preference while it is
 * still at its default. The mode is then removed from the other keys still
 * waiting for their own calculator, so a later import of those inputs
 * cannot undo a choice the visitor made in between. The preference store
 * writes its key as soon as it hydrates, so the key's presence does not
 * tell whether a mode was ever chosen; the old keys are the older record.
 */
function importDisplayMode(storage: Storage, ownKey: string, ownPayload: unknown): void {
  const others = LEGACY_DISPLAY_MODE_KEYS.filter((key) => key !== ownKey).map((key) => ({ key, payload: readJson(storage, key) }));
  const states = [ownPayload, ...others.map((other) => other.payload)].map(stateWithMode);
  if (states.every((state) => state === null)) return;
  const preferences = usePreferencesStore.getState();
  if (states.some((state) => state?.displayMode === 'nominal') && preferences.displayMode === DEFAULT_DOLLAR_DISPLAY_MODE) {
    preferences.setDisplayMode('nominal');
  }
  others.forEach(({ key, payload }, i) => {
    const state = states[i + 1];
    if (state === null) return;
    delete state.displayMode;
    storage.setItem(key, JSON.stringify(payload));
  });
}

/**
 * The writes among `defaults` (a group's writes for the frozen old
 * defaults) whose value is not the shared profile's default at that path.
 */
function profileDefaultGaps(defaults: readonly Write[], profileDefaults: FinancialProfile): Write[] {
  return defaults.filter((write) => stableKey(getAt(profileDefaults, write.path)) !== stableKey(write.value));
}

/**
 * The profile paths where a calculator's frozen old default and the shared
 * profile's default disagree (in binding order). A visitor who left such a
 * value untouched saw the old default, so the import carries it over
 * (importLegacyCalculatorStorage); test/lib/store/legacyImport.test.ts
 * pins the list for each legacy calculator.
 */
export function legacyDefaultGaps<E, R>(def: CalculatorDefinition<E, R>): string[] {
  if (!def.legacy) return [];
  const defaults = def.legacy.storageDefaults();
  const profileDefaults = getDefaultFinancialProfile();
  return writeGroups(def, defaults, defaults).flatMap(([, writes]) =>
    profileDefaultGaps(writes, profileDefaults).map((write) => write.path)
  );
}

const GROSS_PATH = GROSS_PAY.path;
const NET_PATH = NET_PAY.path;
const FREQUENCY_PATH = PAY_FREQUENCY.path;
const PAY_RATE_PATHS: ReadonlySet<string> = new Set([GROSS_PATH, FREQUENCY_PATH]);

/** Paychecks per year for a stored frequency; null when it is not one. */
function paychecksPerYear(frequency: unknown): number | null {
  return typeof frequency === 'string' && Object.prototype.hasOwnProperty.call(PAY_FREQUENCY_META, frequency)
    ? PAY_FREQUENCY_META[frequency as PayFrequency].perYear
    : null;
}

/**
 * True when the group writes the whole per-paycheck income record (gross,
 * take-home and frequency), the take-home pay is still unanswered, and the
 * answered gross and frequency describe the same annual income in another
 * form (e.g. the retirement import's monthly paycheck for an old yearly
 * salary). The per-paycheck record is the finer one of the same income, so
 * the group then replaces the gross and frequency with its own and keeps
 * its take-home pay. The annual incomes are compared within one cent per
 * paycheck of the more frequent pay (each side was rounded to the cent per
 * paycheck), never for exact equality.
 */
function finerIncomeRecord(group: readonly Write[], answered: readonly boolean[], profile: FinancialProfile): boolean {
  const at = (path: string) => group.findIndex((write) => write.path === path);
  const [gross, net, frequency] = [at(GROSS_PATH), at(NET_PATH), at(FREQUENCY_PATH)];
  if (gross < 0 || net < 0 || frequency < 0 || answered[net] || !answered[gross] || !answered[frequency]) return false;
  const ownPerYear = paychecksPerYear(group[frequency].value);
  const heldPerYear = paychecksPerYear(profile.income.frequency);
  const ownGross = group[gross].value;
  if (ownPerYear === null || heldPerYear === null || typeof ownGross !== 'number' || !Number.isFinite(ownGross)) return false;
  const tolerance = 0.01 * Math.max(ownPerYear, heldPerYear);
  return Math.abs(ownGross * ownPerYear - profile.income.grossPerPaycheck * heldPerYear) <= tolerance;
}

/**
 * Imports `def.legacy.storageKey` into the profile, then removes the key.
 *
 * The writes are taken per group of coupled paths (writeGroups), and a
 * group is imported or skipped whole:
 *
 * - A group whose writes differ from what the same bindings write for
 *   def.legacy.storageDefaults() holds the visitor's own values: it is
 *   imported and its paths are marked provided.
 * - A group equal to the old defaults is imported only when one of those
 *   old defaults is not the shared profile's default (legacyDefaultGaps),
 *   so the visitor keeps seeing what the old calculator showed them. These
 *   values were never answered, so they are written unprovided: the intake
 *   still asks for them, and a later import of the other old key (which
 *   may hold the visitor's own answer) can still write them.
 * - A path already marked provided is never written (an answer given since
 *   always wins); its group's other paths are imported only when every such
 *   provided path already holds the value the group would write, so coupled
 *   paths (an amount and its unit) never split. One exception: when the
 *   answered pay and frequency describe the same annual income as the
 *   group's own per-paycheck record and its take-home pay is unanswered
 *   (finerIncomeRecord), the group's gross, take-home and frequency are all
 *   written, so the take-home pay keeps the pay it was saved with.
 *
 * setValues refuses any value that is not a valid profile value. A saved
 * future-dollars display mode is carried into the shared preference once,
 * from every old key (importDisplayMode). The key is removed even when its
 * payload is corrupt or foreign, since nothing else will ever read it.
 *
 * Idempotent: once the key is gone a call does nothing. Never throws.
 * Returns the profile paths it passed to setValues as the visitor's answers
 * (a refused value among them stays unprovided); the unprovided writes of
 * untouched old defaults are not listed.
 */
export function importLegacyCalculatorStorage<E, R>(def: CalculatorDefinition<E, R>): string[] {
  const legacy = def.legacy;
  if (!legacy || typeof window === 'undefined') return [];
  const profileStore = useProfileStore.getState();
  if (!profileStore.hasHydrated) return [];

  try {
    const storage = window.localStorage;
    if (storage.getItem(legacy.storageKey) === null) return [];

    const payload = readJson(storage, legacy.storageKey);
    const engine = payload === null ? null : readEngine(legacy, payload);
    const answers: Write[] = [];
    const untouched: Write[] = [];
    if (engine !== null) {
      const { profile } = profileStore;
      const provided = new Set(profile.provided);
      const profileDefaults = getDefaultFinancialProfile();
      for (const [group, defaults] of writeGroups(def, engine, legacy.storageDefaults())) {
        if (group.length === 0) continue;
        const changed = groupKey(group) !== groupKey(defaults);
        if (!changed && profileDefaultGaps(defaults, profileDefaults).length === 0) continue;
        const providedPaths = group.map((write) => providedPathFor(write.path));
        const answered = providedPaths.map((path) => path !== null && provided.has(path));
        const holds = (write: Write) => stableKey(getAt(profile, write.path)) === stableKey(write.value);
        const finer = finerIncomeRecord(group, answered, profile);
        const replaces = (write: Write) => finer && PAY_RATE_PATHS.has(write.path) && !holds(write);
        // An answer given since wins, and the group stays whole: its other
        // paths come along only when every answered path already holds what
        // the group would write (e.g. the same pay and frequency imported
        // from the other old calculator), or describes the same income.
        const agrees = group.every((write, j) => !answered[j] || replaces(write) || holds(write));
        if (!agrees) continue;
        group.forEach((write, j) => {
          if (providedPaths[j] !== null && (!answered[j] || replaces(write))) (changed ? answers : untouched).push(write);
        });
      }
    }
    importDisplayMode(storage, legacy.storageKey, payload);
    // Already provided paths stay provided; untouched old defaults add none.
    if (untouched.length > 0) profileStore.setValues(untouched, { provide: [] });
    if (answers.length > 0) profileStore.setValues(answers);
    storage.removeItem(legacy.storageKey);
    return [...new Set(answers.map((write) => write.path))];
  } catch {
    // Storage is blocked (e.g. a privacy mode): leave everything as it is.
    return [];
  }
}
