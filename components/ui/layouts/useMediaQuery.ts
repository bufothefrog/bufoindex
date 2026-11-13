'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Tailwind's `lg` breakpoint (64rem), as a media query for useMediaQuery. */
export const LG_MEDIA_QUERY = '(min-width: 64rem)';

function canMatch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/** The server and the first client render agree: no query matches yet. */
function serverSnapshot(): boolean {
  return false;
}

/**
 * Whether `query` matches, kept in step with the browser through
 * matchMedia's `change` event. The server snapshot is false, so the server
 * markup and the hydrating client render agree; the hook reports the real
 * value right after hydration. Where window.matchMedia is missing (jsdom,
 * old browsers) it stays false.
 *
 * Pass the breakpoint in rem to mirror Tailwind's breakpoints, which are rem
 * based: LG_MEDIA_QUERY ('(min-width: 64rem)') matches exactly where `lg:`
 * classes apply, whatever the browser's default font size.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );
  const snapshot = () => (canMatch() ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export default useMediaQuery;
