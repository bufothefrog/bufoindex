'use client';

/**
 * useCalculatorValues (docs/rebuild-plan.md section 2.9, as amended by owner
 * decisions O1 and O6): the values a calculator page reads and writes.
 *
 * Values are the shared profile; writes go straight to it through
 * profileStore.setValues, which also marks the written paths as answered
 * (write-through, O1). There is no scenario mode (O6 dropped legacy links).
 *
 * Subscribes through selectors only, so a keystroke re-renders the
 * components that read the profile, not everything bound to a store.
 */

import { useCallback, useMemo } from 'react';
import { getAt, makeGet } from '@/lib/fields/paths';
import { screenPaths } from '@/lib/fields/runtime';
import type { FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';

export interface CalculatorValues {
  values: FinancialProfile;
  get: Get;
  /** Answered profile paths. */
  provided: readonly string[];
  /** Applies writes to the shared profile and marks their paths as answered. */
  write: (writes: Write[]) => void;
  /** Resets the screen's visible fields to their defaults and un-marks them as answered. */
  restoreDefaults: (form: FormSpec, screen: ScreenSpec) => void;
}

/**
 * The writes that put a screen's visible fields back to the default
 * profile's values (visibility is judged on the current values).
 */
export function restoreDefaultsWrites(form: FormSpec, screen: ScreenSpec, values: FinancialProfile): Write[] {
  const defaults = getDefaultFinancialProfile();
  return screenPaths(form, screen, makeGet(values)).map((path) => ({ path, value: getAt(defaults, path) }));
}

export function useCalculatorValues(): CalculatorValues {
  const values = useProfileStore((s) => s.profile);
  const get = useMemo(() => makeGet(values), [values]);

  const write = useCallback((writes: Write[]) => {
    if (writes.length > 0) useProfileStore.getState().setValues(writes);
  }, []);

  const restoreDefaults = useCallback((form: FormSpec, screen: ScreenSpec) => {
    const { profile, setValues } = useProfileStore.getState();
    const writes = restoreDefaultsWrites(form, screen, profile);
    if (writes.length === 0) return;
    setValues(writes, { provide: [], unprovide: writes.map((w) => w.path) });
  }, []);

  return { values, get, provided: values.provided, write, restoreDefaults };
}

export default useCalculatorValues;
