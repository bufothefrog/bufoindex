/**
 * Old per-calculator storage (docs/rebuild-plan.md section 2.6, owner
 * decision O7: DISCARD, no import).
 *
 * Before profile v2 the retirement and paycheck calculators persisted their
 * own inputs. O7 drops that data instead of importing it. The old stores
 * still read these keys until their calculators move onto the profile
 * (phase 3, c1 and c3), so nothing calls clearLegacyCalculatorStorage yet;
 * once those slices land, call it once on the first profile hydration.
 */

/** localStorage keys of the pre-profile calculator stores. */
export const LEGACY_CALCULATOR_STORAGE_KEYS = ['retirement-calculator', 'paycheck-allocator-storage'] as const;

export type LegacyCalculatorStorageKey = (typeof LEGACY_CALCULATOR_STORAGE_KEYS)[number];

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Access can throw (blocked site data); there is nothing to clear then.
    return null;
  }
}

/**
 * Removes the legacy keys that are present and returns the ones removed.
 * Idempotent; a missing or throwing storage removes nothing.
 */
export function clearLegacyCalculatorStorage(
  storage: Pick<Storage, 'getItem' | 'removeItem'> | null = defaultStorage(),
  keys: readonly string[] = LEGACY_CALCULATOR_STORAGE_KEYS
): string[] {
  if (!storage) return [];
  const removed: string[] = [];
  for (const key of keys) {
    try {
      if (storage.getItem(key) === null) continue;
      storage.removeItem(key);
      removed.push(key);
    } catch {
      // Ignore a key the storage refuses; the rest still clear.
    }
  }
  return removed;
}
