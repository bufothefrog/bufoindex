/**
 * useDollarDisplay: the shared display mode from the preferences store, the
 * display-only conversions, and the captions the retirement and paycheck
 * results show today.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';

beforeEach(() => {
  window.localStorage.clear();
  usePreferencesStore.getState().setDisplayMode('today');
});

describe('useDollarDisplay', () => {
  it("in today's dollars deflates nominal amounts and passes real ones through", () => {
    const { result } = renderHook(() => useDollarDisplay(0.03));
    expect(result.current.mode).toBe('today');
    // 10,000 / 1.03^2 = 9425.959...
    expect(result.current.fromNominal(10000, 2)).toBeCloseTo(9425.96, 2);
    expect(result.current.fromNominal(10000, 0)).toBe(10000);
    expect(result.current.fromReal(10000, 2)).toBe(10000);
    expect(result.current.caption).toBe("Amounts adjusted to today's dollars using your inflation rate");
    expect(result.current.chartCaption).toBe("in today's dollars");
    expect(result.current.axisSuffix).toBe(" (today's $)");
  });

  it('in future dollars passes nominal amounts through and inflates real ones', () => {
    const { result } = renderHook(() => useDollarDisplay(0.03));
    act(() => result.current.setMode('nominal'));
    expect(result.current.mode).toBe('nominal');
    expect(result.current.fromNominal(10000, 2)).toBe(10000);
    // 10,000 * 1.03^2 = 10,609
    expect(result.current.fromReal(10000, 2)).toBeCloseTo(10609, 6);
    expect(result.current.caption).toBe('Amounts in future dollars, as of the year they occur');
    expect(result.current.chartCaption).toBe('in future dollars');
    expect(result.current.axisSuffix).toBe(' (future $)');
  });

  it('shares one mode across calculators and persists it', () => {
    const first = renderHook(() => useDollarDisplay(0.03));
    const second = renderHook(() => useDollarDisplay(0.025));
    act(() => first.result.current.setMode('nominal'));
    expect(second.result.current.mode).toBe('nominal');
    expect(JSON.parse(window.localStorage.getItem('bufo-preferences') ?? 'null')?.state).toEqual({
      displayMode: 'nominal',
    });
  });

  it('names the assumed rate in the caption for a fixed basis', () => {
    const { result } = renderHook(() => useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' }));
    expect(result.current.caption).toBe("Adjusted to today's dollars (assumes 3% inflation).");
    act(() => result.current.setMode('nominal'));
    expect(result.current.caption).toBe('Shown in future dollars.');
  });

  it('keeps the same object while nothing changes', () => {
    const { result, rerender } = renderHook(({ rate }) => useDollarDisplay(rate), { initialProps: { rate: 0.03 } });
    const before = result.current;
    rerender({ rate: 0.03 });
    expect(result.current).toBe(before);
    rerender({ rate: 0.04 });
    expect(result.current).not.toBe(before);
    expect(result.current.fromNominal(104, 1)).toBeCloseTo(100, 10);
  });
});
