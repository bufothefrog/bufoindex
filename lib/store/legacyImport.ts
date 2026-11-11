/**
 * One-time import of the old calculators' localStorage inputs into the
 * profile (O7). The hand-written retirement and paycheck stores persisted
 * their own inputs ('retirement-calculator' v3, 'paycheck-allocator-storage');
 * the profile is now the only record, so whatever the visitor changed there
 * is carried over once and each old key is removed.
 *
 * importLegacyStorage(LEGACY_IMPORTS) handles every old key in one call, in
 * the list's order (lib/calculators/legacyImports.ts: paycheck, then
 * retirement), each against the profile as the previous key left it, so the
 * result does not depend on which page runs it. Call it on the client after
 * the profile store has hydrated and before a calculator's first submit; on
 * the server and before hydration it does nothing and leaves the keys in
 * place.
 *
 * The rule, the same for every group of coupled paths: a key's writes are
 * taken per group (writeGroups) and a group is imported or skipped whole. A
 * group that differs from what the bindings write for the frozen old
 * defaults is the visitor's own: imported, its paths marked provided. A
 * group equal to the old defaults is imported unprovided, and only when an
 * old default differs from the shared profile's default (legacyDefaultGaps).
 * A provided path is never written, and a group is skipped when one of its
 * provided paths holds another value than the group would write, or when it
 * would leave an answered take-home pay above the gross pay. After each key,
 * an unanswered take-home pay keeps the share of gross pay it had in its
 * record (the key's own pay record when it has one, else the profile's
 * before that key), written unprovided and never above gross pay
 * (takeHomeAtShare).
 *
 * What follows, and is accepted:
 * - For any path (pay, age, state, must-pay costs) both old keys changed to
 *   different values, the paycheck key's value wins because it is imported
 *   first; the retirement key's value is dropped (paycheck age 31,
 *   retirement starting age 45 gives person.age 31).
 * - Both old keys hold the visitor's own pay: the paycheck record (gross,
 *   take-home, frequency) stays; the retirement salary is dropped unless it
 *   writes the same values.
 * - Only the retirement salary is the visitor's own: it is imported, and the
 *   take-home pay keeps its share of gross pay.
 * - Pay answered in the new site before the import (the intake does not run
 *   it): an old pay group that conflicts with any answered pay path is
 *   skipped whole, not merged (only take-home pay answered: the paycheck
 *   record is not imported; only the frequency: a monthly salary in another
 *   frequency is not; only gross pay: a paycheck record with another gross
 *   is not).
 * - Both keys untouched on pay: the later key's old default may replace the
 *   earlier one's (both unprovided).
 * - Only take-home pay answered, and an old retirement salary with a
 *   frequency of its own (monthly, bi-weekly, semi-monthly): accepted in
 *   this design as a consequence of the generic rule; it is listed for the
 *   site owner in the pull request. The salary and its frequency are
 *   imported, the answered take-home number is kept as it is under the new
 *   frequency, and a salary below the answered take-home is still refused. It is not reachable through the normal UI: the wizard's
 *   pay screen marks gross, take-home and frequency together, and every
 *   calculator page runs the import before any edit.
 *
 * A saved future-dollars display mode in any old key becomes the shared
 * preference once (importDisplayMode). It is read from any old key whose
 * envelope has state.displayMode, even when the rest of the payload is not
 * a calculator payload; nothing else is read from such a payload. Never
 * throws; a corrupt or foreign payload does not stop the other key.
 */

import type { LegacyImport, LegacyStorage } from '@/lib/calculators/types';
import { fromEngineInputs, stableKey, type Binding } from '@/lib/fields/binding';
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
 * starts a group; groups that write a common path (the 1:1 binding of an
 * amount and the derived binding that writes the amount with its unit) are
 * merged, so coupled paths are always compared, kept or skipped together.
 * Within a group the first write to a path wins.
 */
function writeGroups<E>(bindings: readonly Binding<E>[], engine: E, defaults: E, get: Get): [Write[], Write[]][] {
  const pairs = bindings.map((binding) => [fromEngineInputs([binding], engine, get), fromEngineInputs([binding], defaults, get)]);
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

/** The parsed JSON in `raw`; null when it is not JSON. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Both old stores persisted the visitor's dollar display mode next to their
 * inputs (`state.displayMode`). A saved future-dollars choice ('nominal') in
 * any of `payloads` becomes the shared preference (O15) while it is still at
 * its default. The preference store writes its key as soon as it hydrates,
 * so the key's presence does not tell whether a mode was ever chosen; the
 * old keys are the older record.
 */
function importDisplayMode(payloads: readonly unknown[]): void {
  const nominal = payloads.some((payload) => isRecord(payload) && isRecord(payload.state) && payload.state.displayMode === 'nominal');
  const preferences = usePreferencesStore.getState();
  if (nominal && preferences.displayMode === DEFAULT_DOLLAR_DISPLAY_MODE) preferences.setDisplayMode('nominal');
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
 * value untouched saw the old default, so the import carries it over;
 * test/lib/store/legacyImport.test.ts pins the list for each legacy calculator.
 */
export function legacyDefaultGaps<E>({ legacy, bindings }: LegacyImport<E>): string[] {
  const defaults = legacy.storageDefaults();
  const profileDefaults = getDefaultFinancialProfile();
  return writeGroups(bindings, defaults, defaults, (path) => getAt(profileDefaults, path)).flatMap(([, writes]) =>
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

/** The value `group` writes at `path`; undefined when it does not write it. */
function valueAt(group: readonly Write[], path: string): unknown {
  return group.find((write) => write.path === path)?.value;
}

/** False when `group` would leave an answered take-home pay above the gross pay. */
function keepsTakeHomeUnderGross(group: readonly Write[], profile: FinancialProfile, provided: ReadonlySet<string>): boolean {
  if (!provided.has(NET_PATH)) return true;
  const gross = valueAt(group, GROSS_PATH) ?? profile.income.grossPerPaycheck;
  const net = valueAt(group, NET_PATH) ?? profile.income.netPerPaycheck;
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
 * Imports one old key's `payload` into the profile as it is now, by the rule
 * in the module docblock, then removes the key. setValues refuses any value
 * that is not a valid profile value. Returns the paths it passed to
 * setValues as the visitor's answers.
 */
function importKey<E>({ legacy, bindings }: LegacyImport<E>, payload: unknown, storage: Storage): string[] {
  const profileStore = useProfileStore.getState();
  const { profile } = profileStore;
  const engine = payload === null ? null : readEngine(legacy, payload);
  const answers: Write[] = [];
  const untouched: Write[] = [];
  let record: PayRecord = { gross: profile.income.grossPerPaycheck, net: profile.income.netPerPaycheck, frequency: profile.income.frequency };
  if (engine !== null) {
    const provided = new Set(profile.provided);
    const profileDefaults = getDefaultFinancialProfile();
    const get = (path: string) => getAt(profile, path);
    for (const [group, defaults] of writeGroups(bindings, engine, legacy.storageDefaults(), get)) {
      if (group.length === 0) continue;
      const changed = groupKey(group) !== groupKey(defaults);
      if (!changed && profileDefaultGaps(defaults, profileDefaults).length === 0) continue;
      if (group.some((write) => write.path === NET_PATH)) {
        record = { gross: valueAt(group, GROSS_PATH), net: valueAt(group, NET_PATH), frequency: valueAt(group, FREQUENCY_PATH) };
      }
      const providedPaths = group.map((write) => providedPathFor(write.path));
      const answered = providedPaths.map((path) => path !== null && provided.has(path));
      const holds = (write: Write) => stableKey(getAt(profile, write.path)) === stableKey(write.value);
      if (!group.every((write, j) => !answered[j] || holds(write))) continue;
      if (!keepsTakeHomeUnderGross(group, profile, provided)) continue;
      group.forEach((write, j) => {
        if (providedPaths[j] !== null && !answered[j]) (changed ? answers : untouched).push(write);
      });
    }
  }
  // Already provided paths stay provided; untouched old defaults add none.
  if (untouched.length > 0) profileStore.setValues(untouched, { provide: [] });
  if (answers.length > 0) profileStore.setValues(answers);
  const imported = useProfileStore.getState().profile;
  const share = imported.provided.includes(NET_PATH) ? null : takeHomeAtShare(record, imported);
  if (share) profileStore.setValues([share], { provide: [] });
  storage.removeItem(legacy.storageKey);
  return answers.map((write) => write.path);
}

/**
 * Imports every old key of `imports` still in localStorage, in order, then
 * removes each (see the module docblock). Idempotent: once the keys are gone
 * a call does nothing. Never throws; when storage is blocked nothing
 * changes. Returns the profile paths passed to setValues as the visitor's
 * answers (a refused value among them stays unprovided); the unprovided
 * writes of old defaults and of the take-home pay's share are not listed.
 */
export function importLegacyStorage<T extends readonly unknown[]>(imports: { readonly [K in keyof T]: LegacyImport<T[K]> }): string[] {
  if (typeof window === 'undefined' || !useProfileStore.getState().hasHydrated) return [];
  try {
    const storage = window.localStorage;
    const present = imports.flatMap((item) => {
      const raw = storage.getItem(item.legacy.storageKey);
      return raw === null ? [] : [{ item, payload: parseJson(raw) }];
    });
    importDisplayMode(present.map(({ payload }) => payload));
    const answered = present.flatMap(({ item, payload }) => {
      try {
        return importKey(item, payload, storage);
      } catch {
        return [];
      }
    });
    return [...new Set(answered)];
  } catch {
    // Storage is blocked (e.g. a privacy mode): leave everything as it is.
    return [];
  }
}
