'use client';

import { useCallback, useMemo } from 'react';
import { makeGet } from '@/lib/fields/paths';
import type { Get, Write } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';

export interface CalculatorValues {
  /** The visitor's profile (the default profile on the server and during hydration). */
  values: FinancialProfile;
  get: Get;
  /** Writes through to the profile and marks the accepted paths provided (O1). */
  write: (writes: Write[]) => void;
}

/**
 * The values a calculator page shows and edits. There is one layer, the
 * shared profile: edits write through to it (O1), so the dashboard and the
 * other calculators see them, and the page resubmits to its run store when
 * the profile changes. With no scenario layer (plan section 0.1 item 4)
 * nothing here depends on the calculator, so the hook takes no arguments.
 */
export function useCalculatorValues(): CalculatorValues {
  const values = useProfileStore((state) => state.profile);
  const get = useMemo(() => makeGet(values), [values]);
  const write = useCallback((writes: Write[]) => useProfileStore.getState().setValues(writes), []);
  return { values, get, write };
}
