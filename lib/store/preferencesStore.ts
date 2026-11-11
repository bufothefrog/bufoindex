/**
 * App-wide display preferences (docs/rebuild-plan.md section 2.6, O15).
 *
 * One today's/future dollars mode for every calculator, persisted under
 * 'bufo-preferences'. It is display-only and never feeds a calculation
 * (lib/utils/displayDollars.ts). As with the profile store, zustand renders
 * the hydration pass from getInitialState(), so server and client markup
 * match and the stored mode applies right after hydration.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DOLLAR_DISPLAY_MODE, type DollarDisplayMode } from '@/lib/utils/displayDollars';

export const PREFERENCES_STORAGE_KEY = 'bufo-preferences';
export const PREFERENCES_VERSION = 1;

export interface PreferencesState {
  displayMode: DollarDisplayMode;
  setDisplayMode: (mode: DollarDisplayMode) => void;
}

export function isDollarDisplayMode(value: unknown): value is DollarDisplayMode {
  return value === 'today' || value === 'nominal';
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      displayMode: DEFAULT_DOLLAR_DISPLAY_MODE,
      setDisplayMode: (mode) => {
        if (isDollarDisplayMode(mode)) set({ displayMode: mode });
      },
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: PREFERENCES_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ displayMode: state.displayMode }),
      // Stored data is untrusted: keep only a known mode.
      merge: (persisted, current) => {
        const mode = (persisted as { displayMode?: unknown } | undefined)?.displayMode;
        return isDollarDisplayMode(mode) ? { ...current, displayMode: mode } : current;
      },
    }
  )
);
