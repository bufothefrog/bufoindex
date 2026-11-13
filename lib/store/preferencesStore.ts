/**
 * Site-wide display preferences (Zustand + persist, localStorage key
 * 'bufo-preferences', version 1). One dollar display mode shared by every
 * calculator and the dashboard (O15); display only, never a calculation
 * input. Only `displayMode` is persisted; `hasHydrated` is runtime-only.
 *
 * Hydration and SSR follow the profile store: storage comes from
 * browserLocalStorage, so on the server (any Node version) persist runs
 * without storage, nothing hydrates and hasHydrated stays false. On the
 * client, zustand's React binding renders the hydration pass from
 * getInitialState() (the default mode, hasHydrated false), so server and
 * first client markup agree. The stored mode appears on the next render.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { browserLocalStorage } from '@/lib/store/browserStorage';
import { DEFAULT_DOLLAR_DISPLAY_MODE, type DollarDisplayMode } from '@/lib/utils/displayDollars';

export interface PreferencesState {
  displayMode: DollarDisplayMode;
  /** False during SSR and the hydration render; true once storage is read. */
  hasHydrated: boolean;
  setDisplayMode: (mode: DollarDisplayMode) => void;
}

export const PREFERENCES_STORAGE_KEY = 'bufo-preferences';
const PREFERENCES_VERSION = 1;

function isDisplayMode(value: unknown): value is DollarDisplayMode {
  return value === 'today' || value === 'nominal';
}

// Assigned inside the store creator so the rehydration callback can flip
// hasHydrated during the synchronous hydration that runs before
// `usePreferencesStore` itself is initialized.
let markHydrated: () => void = () => {};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => {
      markHydrated = () => set({ hasHydrated: true });
      return {
        displayMode: DEFAULT_DOLLAR_DISPLAY_MODE,
        hasHydrated: false,
        setDisplayMode: (mode) => set({ displayMode: mode }),
      };
    },
    {
      name: PREFERENCES_STORAGE_KEY,
      version: PREFERENCES_VERSION,
      storage: createJSONStorage(browserLocalStorage),
      partialize: (state) => ({ displayMode: state.displayMode }),
      // Any other version passes through to merge, which keeps only a valid mode.
      migrate: (persisted) => persisted as Pick<PreferencesState, 'displayMode'>,
      // Stored data is untrusted: anything but a known mode keeps the default.
      merge: (persisted, current) => {
        const mode = (persisted as { displayMode?: unknown } | undefined)?.displayMode;
        return { ...current, displayMode: isDisplayMode(mode) ? mode : current.displayMode };
      },
      onRehydrateStorage: () => () => {
        markHydrated();
      },
    }
  )
);
