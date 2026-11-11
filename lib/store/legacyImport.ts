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
import { isRecord } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import { providedPathFor } from '@/lib/profile/defaults';
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
 * Both old stores persisted the visitor's dollar display mode next to their
 * inputs (`state.displayMode`). A saved future-dollars choice ('nominal')
 * becomes the shared preference (O15) while that preference is still at its
 * default; a future-dollars preference already set stays. The preference
 * store writes its key as soon as it hydrates, so the key's presence does
 * not tell whether a mode was ever chosen; the old key, read here once, is
 * the older record.
 */
function importDisplayMode(payload: unknown): void {
  if (!isRecord(payload) || !isRecord(payload.state) || payload.state.displayMode !== 'nominal') return;
  const preferences = usePreferencesStore.getState();
  if (preferences.displayMode === DEFAULT_DOLLAR_DISPLAY_MODE) preferences.setDisplayMode('nominal');
}

/**
 * Imports `def.legacy.storageKey` into the profile, then removes the key.
 *
 * The writes are taken per group of coupled paths (writeGroups). A group is
 * imported only when its writes differ from what the same bindings write
 * for def.legacy.storageDefaults() (an untouched old default says nothing
 * about the visitor), and only when none of its paths is already marked
 * provided (an answer given since always wins). A group is kept or skipped
 * as a whole, so coupled paths (an amount and its unit) never split.
 * Written values are marked provided; setValues refuses any that are not
 * valid profile values. A saved future-dollars display mode is carried into
 * the shared preference (importDisplayMode). The key is removed even when
 * its payload is corrupt or foreign, since nothing else will ever read it.
 *
 * Idempotent: once the key is gone a call does nothing, and a repeat import
 * would find every path it wrote already provided. Never throws. Returns the
 * profile paths it passed to setValues (a refused value among them stays
 * unprovided).
 */
export function importLegacyCalculatorStorage<E, R>(def: CalculatorDefinition<E, R>): string[] {
  const legacy = def.legacy;
  if (!legacy || typeof window === 'undefined') return [];
  const profileStore = useProfileStore.getState();
  if (!profileStore.hasHydrated) return [];

  try {
    const storage = window.localStorage;
    const raw = storage.getItem(legacy.storageKey);
    if (raw === null) return [];

    let payload: unknown = null;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = null;
    }
    const engine = payload === null ? null : readEngine(legacy, payload);
    const writes: Write[] = [];
    if (engine !== null) {
      const provided = new Set(profileStore.profile.provided);
      for (const [group, defaults] of writeGroups(def, engine, legacy.storageDefaults())) {
        if (group.length === 0 || groupKey(group) === groupKey(defaults)) continue;
        const providedPaths = group.map((write) => providedPathFor(write.path));
        if (providedPaths.some((path) => path !== null && provided.has(path))) continue;
        group.forEach((write, j) => {
          if (providedPaths[j] !== null) writes.push(write);
        });
      }
    }
    importDisplayMode(payload);
    if (writes.length > 0) profileStore.setValues(writes);
    storage.removeItem(legacy.storageKey);
    return [...new Set(writes.map((write) => write.path))];
  } catch {
    // Storage is blocked (e.g. a privacy mode): leave everything as it is.
    return [];
  }
}
