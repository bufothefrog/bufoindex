'use client';

import { useEffect, useRef, useState } from 'react';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { PROFILE_HANDOFF_PARAM, PROFILE_HANDOFF_VALUE } from '@/lib/profile/links';
import type { CalculatorStore } from '@/lib/store/createCalculatorStore';
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
import { useProfileStore } from '@/lib/store/profileStore';

export interface CalculatorBootstrap {
  /** True once the steps below have run; the page shows results only from then on. */
  ready: boolean;
  /** The page was opened from the wizard or the dashboard (`?from=profile`): phones open on Results. */
  arrivedFromProfile: boolean;
}

const NOT_READY: CalculatorBootstrap = { ready: false, arrivedFromProfile: false };

/**
 * Mount order, profile > defaults (docs/rebuild-plan.md section 0.1 item 3).
 * Until the profile store has hydrated the page renders from the default
 * profile and nothing runs. Then, once per mount (a ref guards against the
 * StrictMode double effect):
 *
 * 1. Strip the query and the hash with history.replaceState. `?from=profile`
 *    is reported as arrivedFromProfile; any other query or hash (an old
 *    share link) is dropped unread, so the page always shows the visitor's
 *    own profile and a reload reads the profile too.
 * 2. Import the calculator's old localStorage key once (O7), so the first
 *    run already sees the imported values.
 * 3. Submit the profile to the run store immediately (no debounce).
 * 4. Report ready.
 *
 * window is read only inside the effect, so server and hydration renders
 * agree.
 */
export function useCalculatorBootstrap<E, R>(
  def: CalculatorDefinition<E, R>,
  store: CalculatorStore<E, R>
): CalculatorBootstrap {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const [bootstrap, setBootstrap] = useState<CalculatorBootstrap>(NOT_READY);
  const started = useRef(false);

  useEffect(() => {
    if (!hasHydrated || started.current) return;
    started.current = true;

    const { pathname, search, hash } = window.location;
    const arrivedFromProfile =
      new URLSearchParams(search).get(PROFILE_HANDOFF_PARAM) === PROFILE_HANDOFF_VALUE;
    if (search !== '' || hash !== '') window.history.replaceState(null, '', pathname);

    if (def.legacy) importLegacyCalculatorStorage(def);
    store.getState().submit(useProfileStore.getState().profile, { immediate: true });
    setBootstrap({ ready: true, arrivedFromProfile });
  }, [hasHydrated, def, store]);

  return bootstrap;
}
