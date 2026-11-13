/**
 * The sentences and derived figures the leverage results print, as pure
 * functions of the result and the inputs that produced it. Moved unchanged
 * from the results component; formatting comes from lib/format.
 */

import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { formatCurrency, formatPercent } from '@/lib/format';

const MINUS = '\u2212';

/** formatCurrency options shared by the leverage results: "$1.2M", and "+$1.2M" with a sign. */
export const COMPACT = { compact: true } as const;
export const COMPACT_SIGNED = { compact: true, signed: true } as const;
const SIGNED_ONE_DECIMAL = { digits: 1, signed: true } as const;

/** A gap as a share of its base; 0 when the base is not positive. */
export function relativeGap(gap: number, base: number): number {
  return base > 0 ? gap / base : 0;
}

function direction(gap: number): string {
  if (Math.abs(gap) < 0.5) return 'level with';
  return gap > 0 ? 'above' : 'below';
}

/** Gain needed to get back to the prior peak after a fractional drawdown. */
export function recoveryGain(drawdown: number): string {
  if (drawdown >= 0.999) return 'more than 100,000%';
  return formatPercent(1 / (1 - drawdown) - 1, { digits: 0 });
}

/**
 * The parts of the leveraged fund's annual drag the model and caveats list:
 * volatility drag (L^2 - L) / 2 x sigma^2 and financing (L - 1) x rate. The
 * expense ratio and the engine's total (annualDragEstimate) complete it.
 */
export function dragParts(inputs: Pick<DcaComparisonInputs, 'leverageRatio' | 'indexVolatility' | 'financingRate'>): {
  volatilityDrag: number;
  financing: number;
} {
  const lev = inputs.leverageRatio;
  const sigma = Math.max(0, inputs.indexVolatility);
  return {
    volatilityDrag: ((lev * lev - lev) / 2) * sigma * sigma,
    financing: (lev - 1) * inputs.financingRate,
  };
}

/** The horizon in years as the results print it: whole, or to one decimal. */
export function yearsText(months: number): string {
  const years = months / 12;
  return String(years % 1 === 0 ? years : years.toFixed(1));
}

export type NoiseInputs = Pick<DcaComparisonInputs, 'leverageRatio' | 'years' | 'paths'>;

/**
 * Rough seed-to-seed noise, in percentage points, in the difference between
 * the two relative gaps. Calibrated by rerunning the engine on 30 to 40 seeds
 * at the default assumptions with 500 paths: the standard deviation was about
 * 2.8 points at 2x over 20 years, 1.4 at 1.5x, 5 at 3x, 1.5 over 5 years and
 * 4.3 over 40 years, and about 0.3 at 1x (fees only, nearly deterministic).
 * This returns roughly 1.5 of those standard deviations: 4 points at 2x over
 * 20 years, scaled by the leverage above 1x, the square root of the horizon,
 * and one over the square root of the path count. It only decides whether the
 * copy calls a difference noise; it is not a confidence interval.
 * Calibrated for the earlier monthly versus whole-total-at-month-0 pair; for monthly versus start of each year it is conservative (at the defaults the seed-to-seed SD of the difference is about 1.5 points, mean 0.26, over 30 seeds).
 */
export function relativeGapNoisePoints(inputs: NoiseInputs): number {
  const excess = Math.abs(inputs.leverageRatio - 1);
  const years = Math.max(1, inputs.years);
  const paths = Math.max(1, inputs.paths);
  if (!Number.isFinite(excess) || !Number.isFinite(years) || !Number.isFinite(paths)) return 0;
  return 4 * excess * Math.sqrt(years / 20) * Math.sqrt(500 / paths);
}

/**
 * A fraction as formatPercent(fraction, SIGNED_ONE_DECIMAL) prints it, in
 * whole tenths of a percentage point (0.0952 -> 95, -0.0315 -> -32). Whole
 * tenths keep the difference of two printed gaps free of rounding error.
 */
function printedTenths(fraction: number): number {
  const tenths = Math.round(Number((Math.abs(fraction) * 100).toFixed(1)) * 10);
  return fraction < 0 ? -tenths : tenths;
}

/** Whole tenths as one-decimal text: 95 -> "9.5". */
function tenthsText(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

/** Whole tenths with the sign formatPercent prints: "+9.5", "\u22123.2", and "0.0" without one. */
function signedTenthsText(tenths: number): string {
  if (tenths > 0) return `+${tenthsText(tenths)}`;
  if (tenths < 0) return `${MINUS}${tenthsText(-tenths)}`;
  return tenthsText(tenths);
}

/**
 * `display` converts an ending-balance gap for display (the results pass the
 * active dollar mode); the yearly amount is money paid in and is printed as
 * entered. The relative gaps and the noise test read the engine figures.
 */
export function dcaEffectSentence(
  result: DcaComparisonResult,
  L: string,
  inputs: NoiseInputs & Pick<DcaComparisonInputs, 'monthlyContribution'>,
  display: (nominal: number) => number = (nominal) => nominal
): string {
  const { dcaGap, yearStartGap } = result.dcaEffect;
  if (Math.abs(dcaGap) < 0.5 && Math.abs(yearStartGap) < 0.5) {
    return `At these settings the ${L} fund and the index fund produce the same balances under both timings.`;
  }
  const dcaRel = relativeGap(dcaGap, result.index.dca.p50);
  if (!(inputs.monthlyContribution > 0)) {
    // No yearly amount: both rows hold only the starting balance, so there is no timing to compare.
    return (
      `With no monthly contribution the two timings are the same: under both, the ${L} fund's median ends ` +
      `${direction(dcaGap)} the index fund's median by ${formatCurrency(Math.abs(display(dcaGap)), COMPACT)} ` +
      `(${formatPercent(dcaRel, SIGNED_ONE_DECIMAL)} of the index median).`
    );
  }
  const yearStartRel = relativeGap(yearStartGap, result.index.yearStart.p50);
  // Which branch applies is decided from the engine's unrounded values.
  const diffPoints = (dcaRel - yearStartRel) * 100;
  const noise = relativeGapNoisePoints(inputs);
  // Every figure the sentence states comes from the two gaps as printed:
  // each gap is rounded once, and both its text and the stated difference
  // are built from that rounded value, so they cannot disagree.
  const dcaTenths = printedTenths(dcaRel);
  const yearStartTenths = printedTenths(yearStartRel);
  const printedDiffTenths = dcaTenths - yearStartTenths;
  const pointsText = `${tenthsText(Math.abs(printedDiffTenths))} percentage points`;
  const gaps =
    `With monthly contributions the ${L} fund's median ends ${direction(dcaGap)} the index fund's ` +
    `median by ${formatCurrency(Math.abs(display(dcaGap)), COMPACT)} (${signedTenthsText(dcaTenths)}% of the index median). ` +
    `Investing the same ${formatCurrency(12 * Math.max(0, inputs.monthlyContribution), COMPACT)} a year at the start of each year gives a gap of ` +
    `${formatCurrency(display(yearStartGap), COMPACT_SIGNED)} (${signedTenthsText(yearStartTenths)}%).`;

  if (noise > 0 && Math.abs(diffPoints) < noise) {
    if (printedDiffTenths === 0) {
      return (
        `${gaps} The two relative gaps are the same to one decimal place; with the sampling error of ` +
        `${inputs.paths} simulated paths, this run does not separate the two timings.`
      );
    }
    return (
      `${gaps} The two relative gaps differ by ${pointsText}, which is within the sampling error of ` +
      `${inputs.paths} simulated paths, so at these settings this run does not separate the two timings.`
    );
  }
  if (printedDiffTenths === 0) {
    return `${gaps} The two relative gaps are the same to one decimal place, so at these settings the timing does not change the comparison.`;
  }
  if (Math.abs(diffPoints) < 0.05) {
    // The unrounded difference rounds to 0.0 points, so nothing is attributed
    // to timing, but the two gaps print one step apart: each rounding moves a
    // value by at most 0.05, so values less than 0.05 apart print at most 0.1
    // apart, and "about 0.1" agrees with the printed gaps.
    return `${gaps} The two relative gaps differ by about 0.1 percentage points, so at these settings the timing barely changes the comparison.`;
  }
  const sign = printedDiffTenths > 0 ? '+' : MINUS;
  const noiseNote =
    noise > 0 ? ` With ${inputs.paths} paths that figure still carries sampling error of a few percentage points.` : '';
  return (
    `${gaps} Both timings use the same simulated markets, so the difference between the two relative ` +
    `gaps (${sign}${pointsText}) comes from when the money goes in, interacting with the funds' ` +
    `different growth rates.${noiseNote}`
  );
}

/**
 * Compares each fund's start-of-year median with its monthly-contribution
 * median. Each year's amount goes in before most of that year's monthly
 * amounts, so with positive expected returns the start-of-year median is
 * usually larger, but at low or negative returns (or where volatility drag
 * dominates the leveraged fund) it can be smaller for one fund or both, so the
 * sentence is computed rather than fixed. No sentence prints a month count:
 * the average lead depends on the horizon.
 */
export function yearStartScaleSentence(result: DcaComparisonResult, L: string): string {
  const indexDiff = result.index.yearStart.p50 - result.index.dca.p50;
  const levDiff = result.leveraged.yearStart.p50 - result.leveraged.dca.p50;
  const indexDir = direction(indexDiff);
  const levDir = direction(levDiff);
  if (indexDir === levDir) {
    if (indexDir === 'above') {
      return "Each year's amount goes in at the start of the year, before most of the monthly amounts, and at these settings that makes its median balance larger than the monthly median under both funds.";
    }
    if (indexDir === 'below') {
      return 'At these settings the start-of-year median balance is smaller than the monthly median under both funds: when the typical path grows slowly or falls, money that goes in earlier has more time to lose ground.';
    }
    return 'At these settings the two timings end at about the same median balance under both funds.';
  }
  return (
    `At these settings the start-of-year median ends ${indexDir} the monthly median for the index fund and ` +
    `${levDir} it for the ${L} fund: the two funds' typical paths grow at different rates, and money that goes ` +
    'in earlier spends longer exposed to that difference.'
  );
}
