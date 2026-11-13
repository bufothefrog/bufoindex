/**
 * useCalculatorValues: the values a calculator page shows are the stored
 * profile with each unanswered derived leaf filled (lib/profile/derived.ts),
 * so the page shows what its engine runs on; the stored profile is not
 * rewritten by reading it.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCalculatorValues } from '@/components/calculators/shared/useCalculatorValues';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetProfileStore } from '@/test/utils/stores';

beforeEach(() => {
  resetProfileStore();
});

describe('useCalculatorValues', () => {
  it('shows the derived emergency fund balance and follows the must-pay answer', () => {
    useProfileStore.setState((state) => ({
      profile: { ...state.profile, cash: { ...state.profile.cash, emergencyFundBalance: 5000 } },
    }));
    const { result } = renderHook(() => useCalculatorValues());
    expect(result.current.get('cash.emergencyFundBalance')).toBe(9000);
    act(() => useProfileStore.getState().setValues([{ path: 'spending.necessaryMonthly', value: 2500 }]));
    expect(result.current.get('cash.emergencyFundBalance')).toBe(7500);
    expect(result.current.values.cash.emergencyFundBalance).toBe(7500);
    // The store still holds what was saved.
    expect(useProfileStore.getState().profile.cash.emergencyFundBalance).toBe(5000);
  });

  it('shows an answered derived leaf as saved', () => {
    useProfileStore.getState().setValues([{ path: 'cash.emergencyFundBalance', value: 1234 }]);
    const { result } = renderHook(() => useCalculatorValues());
    expect(result.current.get('cash.emergencyFundBalance')).toBe(1234);
  });
});
