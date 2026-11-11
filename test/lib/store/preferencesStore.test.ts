import { beforeEach, describe, expect, it } from 'vitest';
import { isDollarDisplayMode, PREFERENCES_STORAGE_KEY, usePreferencesStore } from '@/lib/store/preferencesStore';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';

beforeEach(() => {
  window.localStorage.clear();
  usePreferencesStore.setState({ displayMode: 'today' });
});

describe('preferencesStore', () => {
  it("defaults to today's dollars", () => {
    expect(usePreferencesStore.getInitialState().displayMode).toBe('today');
  });

  it('persists the display mode under bufo-preferences', () => {
    usePreferencesStore.getState().setDisplayMode('nominal');
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}');
    expect(stored.state).toEqual({ displayMode: 'nominal' });
  });

  it('ignores unknown modes', () => {
    usePreferencesStore.getState().setDisplayMode('real' as DollarDisplayMode);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
    expect(isDollarDisplayMode('nominal')).toBe(true);
    expect(isDollarDisplayMode(undefined)).toBe(false);
  });

  it('rehydrates a stored mode and rejects a tampered one', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state: { displayMode: 'nominal' }, version: 1 }));
    await usePreferencesStore.persist.rehydrate();
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');

    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state: { displayMode: 'sideways' }, version: 1 }));
    await usePreferencesStore.persist.rehydrate();
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
  });
});
