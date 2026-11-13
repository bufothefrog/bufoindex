/**
 * Shared financial profile store (Zustand + persist, localStorage key
 * 'bufo-profile', version 2). Only `profile` is persisted; `hasProfile` is
 * derived from it and `hasHydrated` is runtime-only.
 *
 * Hydration and SSR: storage comes from browserLocalStorage, which gives
 * persist no storage on the server on every Node version (it never reads the
 * bare global, which Node 25 and later define), so on the server nothing
 * hydrates, `hasHydrated` stays false and a setState only updates memory.
 * On the client, persist hydrates synchronously when this module loads, but
 * zustand's React binding renders the hydration pass from getInitialState()
 * (the pre-hydration defaults with hasHydrated false), so server and client
 * markup match. Gate any profile-dependent UI on `hasHydrated`.
 *
 * Persisted data saved under another version goes through migrateProfile
 * (today a normalize only: an older payload keeps every leaf that still
 * exists), and every payload is normalized, so a hand-edited value can never
 * break the engine bindings. A payload saved under a later version is read
 * (normalized to v2) but never overwritten in that session, so a rollback
 * cannot delete the fields the later version added.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Write } from '@/lib/fields/types';
import {
  applyProfileWrites,
  getDefaultFinancialProfile,
  normalizeProfile,
  normalizeProvided,
  patchWrites,
} from '@/lib/profile/defaults';
import { migrateProfile, PROFILE_VERSION } from '@/lib/profile/migrate';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';
import { browserLocalStorage } from '@/lib/store/browserStorage';

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

/** Records the provided paths of applied writes and stamps updatedAt. */
function commit(
  { profile: written, accepted }: ReturnType<typeof applyProfileWrites>,
  opts: SetValuesOptions
): Pick<ProfileState, 'profile' | 'hasProfile'> {
  const removed = new Set(normalizeProvided(opts.unprovide ?? []));
  const provided = normalizeProvided([...written.provided, ...(opts.provide ?? accepted)], written).filter(
    (path) => !removed.has(path)
  );
  const profile = { ...written, provided, updatedAt: Date.now() };
  return { profile, hasProfile: provided.length > 0 };
}

// True while the stored payload was saved by a later version (e.g. after a
// rollback). That payload is kept as it is: the session works on its
// normalized v2 copy, but nothing is written back, so the fields the later
// version added survive. Reset at the start of every hydration.
let storedPayloadIsNewer = false;

/** localStorage, minus the writes that would overwrite a newer payload. */
function profileStorage(): StateStorage {
  // Read eagerly, so that on the server browserLocalStorage throws here and
  // persist runs without storage, exactly as with
  // createJSONStorage(browserLocalStorage).
  const storage = browserLocalStorage();
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      if (!storedPayloadIsNewer) storage.setItem(name, value);
    },
    removeItem: (name) => storage.removeItem(name),
  };
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
          set((state) => commit(applyProfileWrites(state.profile, patchWrites(patch)), { provide: providedPaths })),

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
      storage: createJSONStorage(profileStorage),
      partialize: (state) => ({ profile: state.profile }),
      // Persisted data is untrusted: normalize it against the defaults so a
      // missing section or a hand-edited value can never break the engine
      // bindings.
      merge: (persisted, current) => {
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        const profile = raw === undefined ? current.profile : normalizeProfile(raw);
        return { ...current, profile, hasProfile: profile.provided.length > 0 };
      },
      migrate: (persisted, version) => {
        storedPayloadIsNewer = version > PROFILE_VERSION;
        const raw = (persisted as { profile?: unknown } | undefined)?.profile;
        return { profile: raw === undefined ? undefined : migrateProfile(raw, version) } as {
          profile: FinancialProfile;
        };
      },
      onRehydrateStorage: () => {
        storedPayloadIsNewer = false;
        return () => {
          markHydrated();
        };
      },
    }
  )
);
