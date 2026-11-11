'use client';

/**
 * useCalculatorBootstrap (docs/rebuild-plan.md sections 2.8 and 2.9, as
 * amended by owner decision O6: no legacy share links, no scenario).
 *
 * Mount order is profile > defaults:
 *
 * - Before hydration (and on the server) the profile store holds the
 *   default profile, so inputs render from defaults and nothing runs.
 * - Once the profile store has hydrated, the page is `ready`. If the URL
 *   carries `?from=profile` (a wizard or dashboard hand-off) the query and
 *   hash are stripped with history.replaceState and `arrivedFromProfile`
 *   turns true, so phones can open on Results. Either way the profile is
 *   the input.
 * - From then on every profile change is submitted to the run store (the
 *   first submit skips the debounce). The store validates, memoizes and
 *   debounces (lib/store/createCalculatorStore).
 *
 * The URL is read after commit (never during render): on a client-side
 * navigation the router updates the location in the same commit, so a
 * render-time read could still see the previous page's URL.
 */

import { useEffect, useRef, useState } from 'react';
import { PROFILE_HANDOFF_PARAM, PROFILE_HANDOFF_VALUE } from '@/lib/calculators/registry';
import type { CalculatorStore } from '@/lib/store/createCalculatorStore';
import { useProfileStore } from '@/lib/store/profileStore';

export interface CalculatorBootstrap {
  /** True once the profile store has hydrated and the hand-off (if any) was consumed. */
  ready: boolean;
  /** True when the page opened from a `?from=profile` link. */
  arrivedFromProfile: boolean;
}

/**
 * Consumes a profile hand-off marker: returns true and strips the query and
 * hash from the address bar when the location carries `?from=profile`.
 * Next's router state in history.state is preserved.
 */
export function consumeProfileHandoff(win: Window = window): boolean {
  const params = new URLSearchParams(win.location.search);
  if (params.get(PROFILE_HANDOFF_PARAM) !== PROFILE_HANDOFF_VALUE) return false;
  win.history.replaceState(win.history.state, '', win.location.pathname);
  return true;
}

export function useCalculatorBootstrap<E, R>(store: CalculatorStore<E, R>): CalculatorBootstrap {
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const profile = useProfileStore((s) => s.profile);
  const [bootstrap, setBootstrap] = useState<CalculatorBootstrap>({ ready: false, arrivedFromProfile: false });
  // Guards the one-time hand-off against StrictMode's double effect run.
  const consumed = useRef<boolean | null>(null);
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (consumed.current === null) consumed.current = consumeProfileHandoff();
    const arrivedFromProfile = consumed.current;
    setBootstrap((prev) =>
      prev.ready && prev.arrivedFromProfile === arrivedFromProfile ? prev : { ready: true, arrivedFromProfile }
    );
  }, [hasHydrated]);

  useEffect(() => {
    if (!bootstrap.ready) return;
    store.getState().submit(profile, { immediate: !submittedOnce.current });
    submittedOnce.current = true;
  }, [bootstrap.ready, profile, store]);

  return bootstrap;
}

export default useCalculatorBootstrap;
