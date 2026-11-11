/**
 * Shared financial profile store (Zustand + persist, localStorage key
 * 'bufo-profile', schema v2). Only `profile` is persisted; `hasProfile` is
 * derived from it and `hasHydrated` is runtime-only.
 *
 * Writes are path based: `setValues([{ path, value }])` accepts any leaf
 * ('assumptions.retirement.inflationRate'), a whole list ('debts') or a list
 * row field ('debts.0.balance'). Invalid writes (unknown paths, wrong types,
 * non-finite numbers, unknown enum members) are dropped; everything else is
 * normalized against the previous profile, so the stored record is always a
 * complete v2 profile.
 *
 * Hydration and SSR: on the server there is no localStorage, so nothing
 * hydrates and `hasHydrated` stays false. On the client, persist hydrates
 * synchronously when this module loads, but zustand's React binding renders
 * the hydration pass from getInitialState() (the pre-hydration defaults with
 * hasHydrated false), so server and client markup match. Gate any
 * profile-dependent UI on `hasHydrated`.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { stableKey } from '@/lib/fields/binding';
import { applyWrites } from '@/lib/fields/paths';
import type { Write } from '@/lib/fields/types';
import {
  getDefaultFinancialProfile,
  isValidProfileValue,
  normalizeProfile,
  PROFILE_VERSION,
  providedPathFor,
} from '@/lib/profile/defaults';
import { migrateProfile, newCashAccountIndex } from '@/lib/profile/migrate';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

export interface SetValuesOptions {
  /**
   * Paths to mark as answered. Defaults to the written paths (a row field
   * records its list, e.g. 'debts'). Pass [] to write without marking.
   */
  provide?: readonly string[];
  /** Paths to un-mark (for example "Restore defaults" on an assumptions section). */
  unprovide?: readonly string[];
}

export interface ProfileState {
  profile: FinancialProfile;
  /** True once the user has answered at least one field. */
  hasProfile: boolean;
  /** False during SSR and the hydration render; true once storage is read. */
  hasHydrated: boolean;
  /**
   * Applies path writes in order and updates `provided` (see
   * SetValuesOptions). Invalid writes are dropped; a call that changes
   * nothing leaves the state (and updatedAt) untouched.
   */
  setValues: (writes: readonly Write[], opts?: SetValuesOptions) => void;
  /**
   * Merges `patch` path by path (any depth; arrays replace whole) and marks
   * `providedPaths` as answered.
   *
   * @deprecated Use setValues. Kept as a wrapper until x1.
   */
  setFields: (patch: ProfilePatch, providedPaths: string[]) => void;
  /**
   * Sets one path and marks it answered; a no-op for unknown paths and
   * invalid values.
   *
   * @deprecated Use setValues. Kept as a wrapper until x1.
   */
  setProvidedValue: (path: string, value: unknown) => void;
  /** Restores the default profile with nothing marked as answered. */
  reset: () => void;
}

export const PROFILE_STORAGE_KEY = 'bufo-profile';

const PATCH_META_KEYS = new Set(['version', 'updatedAt', 'provided']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens a patch into writes: objects recurse, arrays and scalars are values. */
export function patchToWrites(patch: ProfilePatch): Write[] {
  const writes: Write[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (prefix === '' && PATCH_META_KEYS.has(key)) continue;
        walk(child, prefix === '' ? key : `${prefix}.${key}`);
      }
    } else if (prefix !== '' && value !== undefined) {
      writes.push({ path: prefix, value });
    }
  };
  walk(patch, '');
  return writes;
}

/**
 * Deprecated-field shim (removed in x1 with the field): the v1 intake still
 * asks for investing.newCashThisMonth, which since v2 lives on the
 * Brokerage account's deposit, so a write to it is mirrored there.
 */
function withLegacyMirrors(profile: FinancialProfile, writes: readonly Write[]): Write[] {
  const out: Write[] = [];
  for (const write of writes) {
    out.push(write);
    if (write.path === 'investing.newCashThisMonth') {
      const index = newCashAccountIndex(profile);
      if (index >= 0) out.push({ path: `portfolio.accounts.${index}.deposit`, value: write.value });
    }
  }
  return out;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/** Pure core of setValues; returns null when nothing changes. */
export function applyProfileWrites(
  current: FinancialProfile,
  writes: readonly Write[],
  opts: SetValuesOptions = {},
  now: number = Date.now()
): FinancialProfile | null {
  const valid = writes.filter((w) => providedPathFor(w.path) !== null && isValidProfileValue(w.path, w.value));
  const merged =
    valid.length > 0 ? normalizeProfile(applyWrites(current, withLegacyMirrors(current, valid)), current) : current;

  const toProvide = (opts.provide ?? valid.map((w) => w.path))
    .map(providedPathFor)
    .filter((p): p is string => p !== null);
  const toUnprovide = new Set(
    (opts.unprovide ?? []).map(providedPathFor).filter((p): p is string => p !== null)
  );
  const provided = Array.from(new Set([...current.provided, ...toProvide])).filter((p) => !toUnprovide.has(p));

  const valuesChanged = merged !== current && stableKey({ ...merged, provided: [] }) !== stableKey({ ...current, provided: [] });
  if (!valuesChanged && sameList(provided, current.provided)) return null;
  return { ...merged, provided, updatedAt: now };
}

// Assigned inside the store creator so the rehydration callback can flip
// hasHydrated even during the synchronous hydration that runs before
// `useProfileStore` itself is initialized.
let markHydrated: () => void = () => {};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => {
      markHydrated = () => set({ hasHydrated: true });

      const setValues: ProfileState['setValues'] = (writes, opts) =>
        set((state) => {
          const profile = applyProfileWrites(state.profile, writes, opts);
          if (!profile) return {};
          return { profile, hasProfile: profile.provided.length > 0 };
        });

      return {
        profile: getDefaultFinancialProfile(),
        hasProfile: false,
        hasHydrated: false,

        setValues,

        setFields: (patch, providedPaths) =>
          setValues(patchToWrites(patch), {
            provide: providedPaths.filter((p) => typeof p === 'string'),
          }),

        setProvidedValue: (path, value) => {
          if (providedPathFor(path) === null || !isValidProfileValue(path, value)) return;
          setValues([{ path, value }]);
        },

        reset: () => set({ profile: getDefaultFinancialProfile(), hasProfile: false }),
      };
    },
    {
      name: PROFILE_STORAGE_KEY,
      version: PROFILE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
      // Runs only when the stored version differs from PROFILE_VERSION.
      migrate: (persisted, version) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        return { profile: migrateProfile(raw, version) };
      },
      // Persisted data is untrusted: normalize it against the defaults so a
      // missing section or a hand-edited value can never break the mappers.
      merge: (persisted, current) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        const profile = raw === undefined ? current.profile : normalizeProfile(raw);
        return { ...current, profile, hasProfile: profile.provided.length > 0 };
      },
      onRehydrateStorage: () => () => {
        markHydrated();
      },
    }
  )
);
