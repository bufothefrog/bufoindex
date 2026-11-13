/**
 * browserLocalStorage in the browser (jsdom): the window's localStorage, so
 * the persisted stores keep their keys and payloads. The server side is in
 * browserStorage.server.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';
import { browserLocalStorage } from '@/lib/store/browserStorage';

describe('browserLocalStorage in the browser', () => {
  it("returns the window's localStorage", () => {
    expect(browserLocalStorage()).toBe(window.localStorage);
  });

  it('gives persist a storage that reads and writes the same keys', () => {
    window.localStorage.clear();
    const storage = createJSONStorage<{ a: number }>(browserLocalStorage);
    expect(storage).toBeDefined();
    storage?.setItem('bufo-test', { state: { a: 1 }, version: 3 });
    expect(window.localStorage.getItem('bufo-test')).toBe('{"state":{"a":1},"version":3}');
    expect(storage?.getItem('bufo-test')).toEqual({ state: { a: 1 }, version: 3 });
    window.localStorage.clear();
  });
});
