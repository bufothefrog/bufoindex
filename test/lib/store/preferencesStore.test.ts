/**
 * Preferences store: the shared dollar display mode, persisted under
 * 'bufo-preferences'. jsdom provides localStorage, so persist hydrates when
 * the module loads; the rehydration tests seed storage and call
 * persist.rehydrate().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, usePreferencesStore } from '@/lib/store/preferencesStore';

const store = usePreferencesStore;

function seed(state: unknown, version = 1): void {
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state, version }));
}

beforeEach(() => {
  store.getState().setDisplayMode('today');
  window.localStorage.clear();
});

describe('preferences store', () => {
  it("uses the key bufo-preferences and starts in today's dollars", () => {
    expect(PREFERENCES_STORAGE_KEY).toBe('bufo-preferences');
    expect(store.persist.getOptions().name).toBe('bufo-preferences');
    expect(store.getInitialState().displayMode).toBe('today');
  });

  it('renders the hydration pass from the defaults, like the server', () => {
    expect(store.getState().hasHydrated).toBe(true);
    expect(store.getInitialState().hasHydrated).toBe(false);
  });

  it('persists only the display mode', () => {
    store.getState().setDisplayMode('nominal');
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null')).toEqual({
      state: { displayMode: 'nominal' },
      version: 1,
    });
  });

  it('rehydrates a stored mode', async () => {
    seed({ displayMode: 'nominal' });
    await store.persist.rehydrate();
    expect(store.getState().displayMode).toBe('nominal');
  });

  it('keeps the current mode when the stored one is not a known mode', async () => {
    seed({ displayMode: 'real' });
    await store.persist.rehydrate();
    expect(store.getState().displayMode).toBe('today');
  });

  it('reads a payload stored under another version without an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    seed({ displayMode: 'nominal' }, 7);
    await store.persist.rehydrate();
    expect(store.getState().displayMode).toBe('nominal');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
