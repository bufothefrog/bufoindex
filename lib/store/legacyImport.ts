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
import type { Get, Write } from '@/lib/fields/types';
import { GROSS_PAY, NET_PAY, PAY_FREQUENCY } from '@/lib/fields/shared';
import { getDefaultFinancialProfile, providedPathFor } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { DEFAULT_DOLLAR_DISPLAY_MODE } from '@/lib/utils/displayDollars';
import { useProfileStore } from '@/lib/store/profileStore';

/**
 * The writes that reproduce `engine` and `defaults` in the profile `get`
 * reads, side by side, one pair per group of coupled paths. Each binding
 * starts a group; groups that write
 * a common path (the 1:1 binding of an amount and the derived binding that
 * writes the amount with its unit) are merged, so coupled paths are always
 * compared, kept or skipped together. Within a group the first write to a
 * path wins.
 */
function writeGroups<E, R>(def: CalculatorDefinition<E, R>, engine: E, defaults: E, get: Get): [Write[], Write[]][] {
  const pairs = def.bindings.map((binding) => [fromEngineInputs([binding], engine, get), fromEngineInputs([binding], defaults, get)]);
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
  return writeGroups(def, defaults, defaults, (path) => getAt(profileDefaults, path)).flatMap(([, writes]) =>
    profileDefaultGaps(writes, profileDefaults).map((write) => write.path)
  );
}

const GROSS_PATH = GROSS_PAY.path;
const NET_PATH = NET_PAY.path;
const FREQUENCY_PATH = PAY_FREQUENCY.path;

/** Gross and take-home pay per paycheck of `frequency`, as stored (unchecked). */
interface PayRecord {
  gross: unknown;
  net: unknown;
  frequency: unknown;
}

/** The pay record `profile` holds. */
const payRecord = (profile: FinancialProfile): PayRecord => ({
  gross: profile.income.grossPerPaycheck,
  net: profile.income.netPerPaycheck,
  frequency: profile.income.frequency,
});

/** The value `group` writes at `path`; undefined when it does not write it. */
function valueAt(group: readonly Write[], path: string): unknown {
  return group.find((write) => write.path === path)?.value;
}

/**
 * False when `group` would change the pay under an answered amount. An
 * answered gross or take-home pay is an amount per paycheck of the
 * frequency the profile holds, so it pins that frequency (even where the
 * group writes the same number for another one), and an answered take-home
 * pay stays at most the gross pay.
 */
function keepsAnsweredPay(group: readonly Write[], profile: FinancialProfile, provided: ReadonlySet<string>): boolean {
  const { grossPerPaycheck, netPerPaycheck, frequency } = profile.income;
  const movesFrequency = stableKey(valueAt(group, FREQUENCY_PATH) ?? frequency) !== stableKey(frequency);
  if (movesFrequency && (provided.has(GROSS_PATH) || provided.has(NET_PATH))) return false;
  if (!provided.has(NET_PATH)) return true;
  const gross = valueAt(group, GROSS_PATH) ?? grossPerPaycheck;
  const net = valueAt(group, NET_PATH) ?? netPerPaycheck;
  return typeof gross === 'number' && typeof net === 'number' && gross >= net;
}

/**
 * The take-home pay of `record` carried to the pay `profile` now holds: the
 * share of gross pay it had (net / gross, the same in any frequency, capped
 * at 1) applied to the new gross, rounded to the cent and never above it.
 * Null when the profile still holds the record's own gross and frequency,
 * or the share cannot be formed (the record's gross is not above zero).
 */
function takeHomeAtShare(record: PayRecord, profile: FinancialProfile): Write | null {
  const { grossPerPaycheck: gross, frequency } = profile.income;
  if (stableKey(record.gross) === stableKey(gross) && stableKey(record.frequency) === stableKey(frequency)) return null;
  if (typeof record.gross !== 'number' || !(record.gross > 0) || typeof record.net !== 'number' || !Number.isFinite(record.net)) return null;
  const share = Math.min(record.net / record.gross, 1);
  return { path: NET_PATH, value: Math.min(Math.round(share * gross * 100) / 100, gross) };
}

/**
 * Imports `def.legacy.storageKey` into the profile, then removes the key.
 *
 * The writes are taken per group of coupled paths (writeGroups), each in
 * the profile as it is before the import, and a group is imported or
 * skipped whole:
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
 *   always wins), and a group is skipped when one of its provided paths
 *   holds another value than the group would write, so coupled paths (an
 *   amount and its unit) never split. An answered gross or take-home pay
 *   also pins the frequency, and an answered take-home pay must stay at
 *   most the gross pay: a group that would break either is skipped
 *   (keepsAnsweredPay).
 *
 * Pay is gross pay per paycheck of a frequency. An old amount with no pay
 * frequency of its own (the retirement calculator's yearly or hourly
 * income) is written by its binding in the frequency the profile holds, at
 * the same annual income, so it never moves the frequency.
 *
 * Take-home pay: after the groups, an unanswered take-home pay is carried
 * to the gross pay and frequency the profile ends up with at the share of
 * gross pay it had in its record (takeHomeAtShare), written unprovided. Its
 * record is the old key's own pay record when the key has one (the paycheck
 * income group, imported or skipped), else the profile's before the import.
 * That is the one exception to keeping the visitor's numbers: when the old
 * key's pay lost to a pay answered before it (by the visitor, or by the
 * other old key imported first), its take-home pay is kept as the same
 * share of the gross pay that stays.
 *
 * setValues refuses any value that is not a valid profile value. A saved
 * future-dollars display mode is carried into the shared preference once,
 * from every old key (importDisplayMode). The key is removed even when its
 * payload is corrupt or foreign, since nothing else will ever read it.
 *
 * Idempotent: once the key is gone a call does nothing. Never throws.
 * Returns the profile paths it passed to setValues as the visitor's answers
 * (a refused value among them stays unprovided); the unprovided writes of
 * untouched old defaults and of the take-home pay's share are not listed.
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
    const { profile } = profileStore;
    let takeHome = payRecord(profile);
    if (engine !== null) {
      const provided = new Set(profile.provided);
      const profileDefaults = getDefaultFinancialProfile();
      const get = (path: string) => getAt(profile, path);
      for (const [group, defaults] of writeGroups(def, engine, legacy.storageDefaults(), get)) {
        if (group.length === 0) continue;
        const changed = groupKey(group) !== groupKey(defaults);
        if (!changed && profileDefaultGaps(defaults, profileDefaults).length === 0) continue;
        if (group.some((write) => write.path === NET_PATH)) {
          takeHome = { gross: valueAt(group, GROSS_PATH), net: valueAt(group, NET_PATH), frequency: valueAt(group, FREQUENCY_PATH) };
        }
        const providedPaths = group.map((write) => providedPathFor(write.path));
        const answered = providedPaths.map((path) => path !== null && provided.has(path));
        const holds = (write: Write) => stableKey(getAt(profile, write.path)) === stableKey(write.value);
        if (!group.every((write, j) => !answered[j] || holds(write))) continue;
        if (!keepsAnsweredPay(group, profile, provided)) continue;
        group.forEach((write, j) => {
          if (providedPaths[j] !== null && !answered[j]) (changed ? answers : untouched).push(write);
        });
      }
    }
    importDisplayMode(storage, legacy.storageKey, payload);
    // Already provided paths stay provided; untouched old defaults add none.
    if (untouched.length > 0) profileStore.setValues(untouched, { provide: [] });
    if (answers.length > 0) profileStore.setValues(answers);
    const imported = useProfileStore.getState().profile;
    const share = imported.provided.includes(NET_PATH) ? null : takeHomeAtShare(takeHome, imported);
    if (share) profileStore.setValues([share], { provide: [] });
    storage.removeItem(legacy.storageKey);
    return [...new Set(answers.map((write) => write.path))];
  } catch {
    // Storage is blocked (e.g. a privacy mode): leave everything as it is.
    return [];
  }
}
