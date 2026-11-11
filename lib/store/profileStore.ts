/**
 * Shared financial profile store (Zustand + persist, localStorage key
 * 'bufo-profile', version 2). Only `profile` is persisted; `hasProfile` is
 * derived from it and `hasHydrated` is runtime-only.
 *
 * Hydration and SSR: on the server there is no localStorage, so nothing
 * hydrates and `hasHydrated` stays false. On the client, persist hydrates
 * synchronously when this module loads, but zustand's React binding renders
 * the hydration pass from getInitialState() (the pre-hydration defaults with
 * hasHydrated false), so server and client markup match. Gate any
 * profile-dependent UI on `hasHydrated`.
 *
 * Persisted data under an older version goes through migrateProfile, then
 * every payload is normalized, so a hand-edited value can never break the
 * mappers.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Write } from '@/lib/fields/types';
import {
  applyProfileWrites,
  getDefaultFinancialProfile,
  isProfilePath,
  normalizeProfile,
  normalizeProvided,
  PROFILE_SECTIONS,
} from '@/lib/profile/defaults';
import { migrateProfile, PROFILE_VERSION } from '@/lib/profile/migrate';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

export interface SetValuesOptions {
  /** Paths to mark as answered. Defaults to the accepted written paths. */
  provide?: readonly string[];
  /** Paths to mark as not answered; applied after `provide`, so they win. */
  unprovide?: readonly string[];
}

export interface ProfileState {
  profile: FinancialProfile;
  /** True once the user has answered at least one field. */
  hasProfile: boolean;
  /** False during SSR and the hydration render; true once storage is read. */
  hasHydrated: boolean;
  /**
   * Writes values by profile path (leaf, list, row or row field) in order.
   * A write whose path is unknown or whose value is invalid keeps the
   * previous value. Provided paths are recorded canonically (a row by its
   * list path); unknown ones are ignored. Every call stamps updatedAt.
   */
  setValues: (writes: readonly Write[], opts?: SetValuesOptions) => void;
  /**
   * Merges `patch` leaf by leaf (a list is replaced whole) and marks
   * `providedPaths` as answered. Invalid leaf values keep their previous
   * value. A wrapper over setValues.
   */
  setFields: (patch: ProfilePatch, providedPaths: string[]) => void;
  /**
   * Sets one value by path (e.g. 'person.age' or 'debts.0.balance') and
   * marks it answered. A no-op for unknown paths and invalid values.
   */
  setProvidedValue: (path: string, value: unknown) => void;
  /** Restores the default profile with nothing marked as answered. */
  reset: () => void;
}

export const PROFILE_STORAGE_KEY = 'bufo-profile';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens a patch into writes: objects recurse until a profile path is reached. */
function patchWrites(value: unknown, path: string, out: Write[]): Write[] {
  if (isRecord(value) && !isProfilePath(path)) {
    for (const [key, child] of Object.entries(value)) patchWrites(child, `${path}.${key}`, out);
  } else {
    out.push({ path, value });
  }
  return out;
}

/** Records the provided paths of applied writes and stamps updatedAt. */
function commit(
  { profile: written, accepted }: ReturnType<typeof applyProfileWrites>,
  opts: SetValuesOptions
): Pick<ProfileState, 'profile' | 'hasProfile'> {
  const removed = new Set(normalizeProvided(opts.unprovide ?? []));
  const provided = normalizeProvided([...written.provided, ...(opts.provide ?? accepted)]).filter(
    (path) => !removed.has(path)
  );
  const profile = { ...written, provided, updatedAt: Date.now() };
  return { profile, hasProfile: provided.length > 0 };
}

// Assigned inside the store creator so the rehydration callback can flip
// hasHydrated even during the synchronous hydration that runs before
// `useProfileStore` itself is initialized.
let markHydrated: () => void = () => {};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => {
      markHydrated = () => set({ hasHydrated: true });

      return {
        profile: getDefaultFinancialProfile(),
        hasProfile: false,
        hasHydrated: false,

        setValues: (writes, opts = {}) => set((state) => commit(applyProfileWrites(state.profile, writes), opts)),

        setFields: (patch, providedPaths) =>
          set((state) => {
            const writes: Write[] = [];
            for (const section of PROFILE_SECTIONS) {
              if (patch[section] !== undefined) patchWrites(patch[section], section, writes);
            }
            return commit(applyProfileWrites(state.profile, writes), { provide: providedPaths });
          }),

        setProvidedValue: (path, value) =>
          set((state) => {
            const applied = applyProfileWrites(state.profile, [{ path, value }]);
            return applied.accepted.length > 0 ? commit(applied, {}) : {};
          }),

        reset: () => set({ profile: getDefaultFinancialProfile(), hasProfile: false }),
      };
    },
    {
      name: PROFILE_STORAGE_KEY,
      version: PROFILE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
      // Persisted data is untrusted: normalize it against the defaults so a
      // missing section or a hand-edited value can never break the mappers.
      merge: (persisted, current) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        const profile = raw === undefined ? current.profile : normalizeProfile(raw);
        return { ...current, profile, hasProfile: profile.provided.length > 0 };
      },
      migrate: (persisted, version) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        return { profile: raw === undefined ? undefined : migrateProfile(raw, version) } as {
          profile: FinancialProfile;
        };
      },
      onRehydrateStorage: () => () => {
        markHydrated();
      },
    }
  )
);
