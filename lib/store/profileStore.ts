/**
 * Shared financial profile store (Zustand + persist, localStorage key
 * 'bufo-profile'). Only `profile` is persisted; `hasProfile` is derived from
 * it and `hasHydrated` is runtime-only.
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
import {
  getDefaultFinancialProfile,
  isValidProfileValue,
  normalizeProfile,
  PROFILE_SECTIONS,
  splitProfilePath,
} from '@/lib/profile/defaults';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

export interface ProfileState {
  profile: FinancialProfile;
  /** True once the user has answered at least one field. */
  hasProfile: boolean;
  /** False during SSR and the hydration render; true once storage is read. */
  hasHydrated: boolean;
  /**
   * Shallow-merges each section of `patch` into the profile and marks
   * `providedPaths` as answered (deduped). Invalid leaf values (wrong type,
   * non-finite numbers, unknown enum members) keep their previous value.
   */
  setFields: (patch: ProfilePatch, providedPaths: string[]) => void;
  /** Sets one leaf by dot path (e.g. 'person.age') and marks it answered. */
  setProvidedValue: (path: string, value: unknown) => void;
  /** Restores the default profile with nothing marked as answered. */
  reset: () => void;
}

export const PROFILE_STORAGE_KEY = 'bufo-profile';

function mergePatch(current: FinancialProfile, patch: ProfilePatch): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const section of PROFILE_SECTIONS) {
    const sectionPatch = patch[section];
    if (sectionPatch && typeof sectionPatch === 'object') {
      merged[section] = { ...current[section], ...sectionPatch };
    }
  }
  return merged;
}

function withProvided(profile: FinancialProfile, paths: string[], updatedAt: number): FinancialProfile {
  const provided = Array.from(new Set([...profile.provided, ...paths]));
  return { ...profile, provided, updatedAt };
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

        setFields: (patch, providedPaths) =>
          set((state) => {
            const merged = normalizeProfile(mergePatch(state.profile, patch), state.profile);
            const paths = providedPaths.filter((p) => typeof p === 'string');
            const profile = withProvided(merged, paths, Date.now());
            return { profile, hasProfile: profile.provided.length > 0 };
          }),

        setProvidedValue: (path, value) =>
          set((state) => {
            const parts = splitProfilePath(path);
            if (!parts || !isValidProfileValue(path, value)) return {};
            const section = { ...state.profile[parts.section], [parts.key]: value };
            const profile = withProvided(
              { ...state.profile, [parts.section]: section },
              [path],
              Date.now()
            );
            return { profile, hasProfile: true };
          }),

        reset: () => set({ profile: getDefaultFinancialProfile(), hasProfile: false }),
      };
    },
    {
      name: PROFILE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
      // Persisted data is untrusted: normalize it against the defaults so a
      // missing section or a hand-edited value can never break the mappers.
      merge: (persisted, current) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        const profile = raw === undefined ? current.profile : normalizeProfile(raw);
        return { ...current, profile, hasProfile: profile.provided.length > 0 };
      },
      migrate: (persisted) => persisted as { profile: FinancialProfile },
      onRehydrateStorage: () => () => {
        markHydrated();
      },
    }
  )
);
