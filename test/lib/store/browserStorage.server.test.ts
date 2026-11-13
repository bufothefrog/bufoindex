// @vitest-environment node
/**
 * The persisted stores on the server: no window, so no storage, nothing
 * hydrates, hasHydrated stays false and a setState only updates memory.
 *
 * The runtime differs by Node version: Node 22 and 24 have no global
 * localStorage, Node 25 and later define one that returns undefined and
 * warns. The first test runs against whatever this runtime has (and so
 * checks the warning on Node 25 and later). The others install a global
 * localStorage and sessionStorage like Node 26's on every version and
 * assert the stores never read them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';

const STORAGE_GLOBALS = ['localStorage', 'sessionStorage'] as const;

/** Collects the process warnings emitted while `run` executes. */
async function collectWarnings(run: () => Promise<void>): Promise<string[]> {
  const warnings: string[] = [];
  const onWarning = (warning: Error) => warnings.push(`${warning.name}: ${warning.message}`);
  process.on('warning', onWarning);
  try {
    await run();
    // process.emitWarning delivers on a later tick.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off('warning', onWarning);
  }
  return warnings;
}

async function importStores() {
  const [{ useProfileStore }, { usePreferencesStore }] = await Promise.all([
    import('@/lib/store/profileStore'),
    import('@/lib/store/preferencesStore'),
  ]);
  return { useProfileStore, usePreferencesStore };
}

/** Exercises both stores the way a server render or a server action could. */
async function useStoresOnTheServer(): Promise<void> {
  const { useProfileStore, usePreferencesStore } = await importStores();
  expect(useProfileStore.getState().hasHydrated).toBe(false);
  expect(usePreferencesStore.getState().hasHydrated).toBe(false);
  useProfileStore.getState().setProvidedValue('person.age', 41);
  usePreferencesStore.getState().setDisplayMode('nominal');
  expect(useProfileStore.getState().profile.person.age).toBe(41);
  expect(usePreferencesStore.getState().displayMode).toBe('nominal');
  expect(useProfileStore.getState().hasHydrated).toBe(false);
  expect(usePreferencesStore.getState().hasHydrated).toBe(false);
}

beforeEach(() => {
  vi.resetModules();
  // persist without storage warns on every set; that is expected here.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the persisted stores on the server', () => {
  it('runs in an environment with no window', () => {
    expect(typeof window).toBe('undefined');
  });

  // Node prints each experimental warning once per thread, so this runs first.
  it('importing both stores emits no ExperimentalWarning about storage', async () => {
    const warnings = await collectWarnings(async () => {
      await importStores();
    });
    expect(warnings.filter((w) => /localStorage|sessionStorage/.test(w))).toEqual([]);
    expect(warnings.filter((w) => w.startsWith('ExperimentalWarning'))).toEqual([]);
  });

  it("with this runtime's own globals, nothing hydrates and a setState does not throw", async () => {
    const warnings = await collectWarnings(useStoresOnTheServer);
    expect(warnings.filter((w) => w.startsWith('ExperimentalWarning'))).toEqual([]);
  });

  describe('with a runtime that defines its own storage globals (as Node 25 and later do)', () => {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    const reads: string[] = [];

    beforeEach(() => {
      reads.length = 0;
      for (const key of STORAGE_GLOBALS) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {
          configurable: true,
          get: () => {
            reads.push(key);
            return undefined;
          },
        });
      }
    });

    afterEach(() => {
      for (const key of STORAGE_GLOBALS) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    });

    it('the helper throws before reading any global, so persist gets no storage', async () => {
      const { browserLocalStorage } = await import('@/lib/store/browserStorage');
      expect(() => browserLocalStorage()).toThrow(/server/);
      expect(createJSONStorage(browserLocalStorage)).toBeUndefined();
      expect(reads).toEqual([]);
    });

    it('both stores import without reading the storage globals', async () => {
      await expect(importStores()).resolves.toBeDefined();
      expect(reads).toEqual([]);
    });

    it('nothing hydrates and a setState on the server does not throw', async () => {
      await useStoresOnTheServer();
      expect(reads).toEqual([]);
    });

    it('persist runs without storage, so no rehydrate can mark a store hydrated', async () => {
      const { useProfileStore, usePreferencesStore } = await importStores();
      // persist without storage attaches no persist API in zustand.
      expect((useProfileStore as { persist?: unknown }).persist).toBeUndefined();
      expect((usePreferencesStore as { persist?: unknown }).persist).toBeUndefined();
      expect(useProfileStore.getState().hasHydrated).toBe(false);
    });
  });
});
