import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useDollarDisplay, { dollarDisplayCopy } from '@/components/shared/useDollarDisplay';
import { usePreferencesStore } from '@/lib/store/preferencesStore';

beforeEach(() => {
  window.localStorage.clear();
  usePreferencesStore.setState({ displayMode: 'today' });
});

describe('useDollarDisplay', () => {
  it("converts nominal and real amounts for today's dollars", () => {
    const { result } = renderHook(() => useDollarDisplay(0.03));
    expect(result.current.mode).toBe('today');
    expect(result.current.fromNominal(1030, 1)).toBeCloseTo(1000, 6);
    expect(result.current.fromReal(1000, 1)).toBe(1000);
    expect(result.current.caption).toBe("Amounts adjusted to today's dollars at 3% annual inflation.");
    expect(result.current.chartCaption).toBe("in today's dollars");
    expect(result.current.axisSuffix).toBe(" (today's $)");
  });

  it('follows the shared preference', () => {
    const { result } = renderHook(() => useDollarDisplay(0.025));
    act(() => result.current.setMode('nominal'));
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(result.current.fromNominal(1030, 1)).toBe(1030);
    expect(result.current.fromReal(1000, 2)).toBeCloseTo(1050.625, 6);
    expect(result.current.caption).toBe('Amounts in future dollars, as of the year they occur.');
    expect(result.current.axisSuffix).toBe(' (future $)');
  });

  it('formats fractional inflation in the caption', () => {
    expect(dollarDisplayCopy('today', 0.025).caption).toContain('2.5%');
  });
});
