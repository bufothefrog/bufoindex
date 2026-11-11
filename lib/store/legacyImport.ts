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
import type { Write } from '@/lib/fields/types';
import { providedPathFor } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

/**
 * The writes that reproduce `engine`, one group per binding. A derived
 * binding may write coupled paths (an amount and its unit), which only make
 * sense together, so the import keeps or skips each group as a whole.
 */
function writeGroups<E, R>(def: CalculatorDefinition<E, R>, engine: E): Write[][] {
  return def.bindings.map((binding) => fromEngineInputs([binding], engine));
}

/** The engine inputs stored in `raw`; null when it is not JSON or not this calculator's payload. */
function readEngine<E>(legacy: LegacyStorage<E>, raw: string): E | null {
  try {
    return legacy.readStorage(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/**
 * Imports `def.legacy.storageKey` into the profile, then removes the key.
 *
 * The writes are taken per binding. A binding's writes are imported only
 * when they differ from what the same binding writes for
 * def.legacy.storageDefaults() (an untouched old default says nothing about
 * the visitor), and only when none of its paths is already marked provided
 * (an answer given since always wins). A binding's writes are kept or
 * skipped together, so coupled paths (an amount and its unit) never split. Written values are marked provided; setValues refuses any
 * that are not valid profile values. The key is removed even when its
 * payload is corrupt or foreign, since nothing else will ever read it.
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

    const engine = readEngine(legacy, raw);
    const writes: Write[] = [];
    if (engine !== null) {
      const defaults = writeGroups(def, legacy.storageDefaults());
      const provided = new Set(profileStore.profile.provided);
      writeGroups(def, engine).forEach((group, i) => {
        if (group.length === 0 || stableKey(group) === stableKey(defaults[i])) return;
        const providedPaths = group.map((write) => providedPathFor(write.path));
        if (providedPaths.some((path) => path !== null && provided.has(path))) return;
        group.forEach((write, j) => {
          if (providedPaths[j] !== null) writes.push(write);
        });
      });
    }
    if (writes.length > 0) profileStore.setValues(writes);
    storage.removeItem(legacy.storageKey);
    return [...new Set(writes.map((write) => write.path))];
  } catch {
    // Storage is blocked (e.g. a privacy mode): leave everything as it is.
    return [];
  }
}
