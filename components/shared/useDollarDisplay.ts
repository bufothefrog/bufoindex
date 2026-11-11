'use client';

/**
 * Today's/future dollars display for results (docs/rebuild-plan.md section
 * 2.6). Reads the one app-wide mode from the preferences store (O15) and
 * returns the converters and captions every results view shares. Display
 * only: never feed these values back into a calculation.
 */

import { useCallback, useMemo } from 'react';
import { formatPercent } from '@/lib/format';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { displayDollars, displayRealDollars, type DollarDisplayMode } from '@/lib/utils/displayDollars';

export interface DollarDisplay {
  mode: DollarDisplayMode;
  setMode: (mode: DollarDisplayMode) => void;
  /** A nominal amount `yearsFromNow` out, in the selected basis. */
  fromNominal: (value: number, yearsFromNow: number) => number;
  /** An amount already in today's dollars, in the selected basis. */
  fromReal: (value: number, yearsFromNow: number) => number;
  /** Sentence for a results header ("Amounts adjusted to today's dollars at 3% annual inflation."). */
  caption: string;
  /** Short note above a chart ("in today's dollars"). */
  chartCaption: string;
  /** Axis label suffix (" (today's $)"). */
  axisSuffix: string;
}

/** The captions for a mode and inflation rate (exported for tests and server copy). */
export function dollarDisplayCopy(
  mode: DollarDisplayMode,
  inflationRate: number
): Pick<DollarDisplay, 'caption' | 'chartCaption' | 'axisSuffix'> {
  if (mode === 'today') {
    return {
      caption: `Amounts adjusted to today's dollars at ${formatPercent(inflationRate)} annual inflation.`,
      chartCaption: "in today's dollars",
      axisSuffix: " (today's $)",
    };
  }
  return {
    caption: 'Amounts in future dollars, as of the year they occur.',
    chartCaption: 'in future dollars',
    axisSuffix: ' (future $)',
  };
}

export default function useDollarDisplay(inflationRate: number): DollarDisplay {
  const mode = usePreferencesStore((state) => state.displayMode);
  const setMode = usePreferencesStore((state) => state.setDisplayMode);

  const fromNominal = useCallback(
    (value: number, yearsFromNow: number) => displayDollars(value, mode, inflationRate, yearsFromNow),
    [mode, inflationRate]
  );
  const fromReal = useCallback(
    (value: number, yearsFromNow: number) => displayRealDollars(value, mode, inflationRate, yearsFromNow),
    [mode, inflationRate]
  );

  return useMemo(
    () => ({ mode, setMode, fromNominal, fromReal, ...dollarDisplayCopy(mode, inflationRate) }),
    [mode, setMode, fromNominal, fromReal, inflationRate]
  );
}
