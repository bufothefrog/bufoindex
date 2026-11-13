/**
 * The one way the persisted stores reach localStorage.
 *
 * On the server there must be no storage, so nothing hydrates and persist
 * runs without storage. The bare global cannot be trusted for that: Node 22
 * and 24 have no `localStorage` (reading it throws a ReferenceError), while
 * Node 25 and later define one whose getter returns undefined and prints an
 * ExperimentalWarning. This helper checks for a window first and never reads
 * the bare global, so the server behaves the same on every Node version.
 */

/**
 * The browser's localStorage, for zustand's createJSONStorage. On the server
 * (no window) it throws without touching any global, so createJSONStorage
 * returns undefined and persist runs without storage. In the browser it is
 * the same object as the bare `localStorage`, and it throws whatever reading
 * that throws (a blocked-storage SecurityError, for example).
 */
export function browserLocalStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available on the server');
  }
  return window.localStorage;
}
