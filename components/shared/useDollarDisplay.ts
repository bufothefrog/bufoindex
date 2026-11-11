'use client';

import { useMemo } from 'react';
import type { CalculatorMeta } from '@/lib/calculators/types';
import { formatPercent } from '@/lib/format';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { displayDollars, displayRealDollars, type DollarDisplayMode } from '@/lib/utils/displayDollars';

/** Where today's dollars get their inflation rate (CalculatorMeta.dollarDisplay). */
export type DollarDisplayBasis = Exclude<CalculatorMeta['dollarDisplay'], 'none'>;

export interface UseDollarDisplayOptions {
  /** Default 'inflation-input'. 'fixed' names the rate in the caption. */
  basis?: DollarDisplayBasis;
}

export interface DollarDisplay {
  mode: DollarDisplayMode;
  setMode: (mode: DollarDisplayMode) => void;
  /** A nominal amount `yearsFromNow` out, in the active mode. */
  fromNominal: (value: number, yearsFromNow: number) => number;
  /** An amount already in today's dollars, in the active mode. */
  fromReal: (value: number, yearsFromNow: number) => number;
  /** The sentence under a results header that says which dollars are shown. */
  caption: string;
  /** The short label above a chart: "in today's dollars". */
  chartCaption: string;
  /** Appended to a chart axis or series name: " (today's $)". */
  axisSuffix: string;
}

const CHART_CAPTION: Record<DollarDisplayMode, string> = {
  today: "in today's dollars",
  nominal: 'in future dollars',
};

const AXIS_SUFFIX: Record<DollarDisplayMode, string> = {
  today: " (today's $)",
  nominal: ' (future $)',
};

function captionFor(mode: DollarDisplayMode, basis: DollarDisplayBasis, inflationRate: number): string {
  if (basis === 'fixed') {
    return mode === 'today'
      ? `Adjusted to today's dollars (assumes ${formatPercent(inflationRate)} inflation).`
      : 'Shown in future dollars.';
  }
  return mode === 'today'
    ? "Amounts adjusted to today's dollars using your inflation rate"
    : 'Amounts in future dollars, as of the year they occur';
}

/**
 * The shared today's / future dollars preference and the conversions and
 * wording that go with it. Display only: values from fromNominal and
 * fromReal must never feed a calculation (CLAUDE.md display-dollar
 * boundary). Before hydration the mode is the default ('today').
 */
export function useDollarDisplay(inflationRate: number, options: UseDollarDisplayOptions = {}): DollarDisplay {
  const basis = options.basis ?? 'inflation-input';
  const mode = usePreferencesStore((state) => state.displayMode);
  const setMode = usePreferencesStore((state) => state.setDisplayMode);

  return useMemo(
    () => ({
      mode,
      setMode,
      fromNominal: (value, yearsFromNow) => displayDollars(value, mode, inflationRate, yearsFromNow),
      fromReal: (value, yearsFromNow) => displayRealDollars(value, mode, inflationRate, yearsFromNow),
      caption: captionFor(mode, basis, inflationRate),
      chartCaption: CHART_CAPTION[mode],
      axisSuffix: AXIS_SUFFIX[mode],
    }),
    [mode, setMode, basis, inflationRate]
  );
}

export default useDollarDisplay;
